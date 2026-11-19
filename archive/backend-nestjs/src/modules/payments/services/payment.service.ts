import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PaymentOrder } from '../entities/payment-order.entity';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../../subscriptions/entities/plan.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Coupon } from '../../subscriptions/entities/coupon.entity';
import { TvodProduct } from '../../subscriptions/entities/tvod-product.entity';
import { ContentPurchase } from '../../subscriptions/entities/content-purchase.entity';
import { Content } from '../../content/entities/content.entity';
import { PlanService } from '../../subscriptions/services/plan.service';
import { SystemSettingService } from '../../uploads/services/system-setting.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { OutboxService } from '../../../infrastructure/database/outbox.service';
import { PageResponse } from '../../../common/dto/page-response.dto';
import { BusinessException } from '../../../common/filters/global-exception.filter';
import { PaymentGatewayFactory } from '../gateways/payment-gateway.factory';
import { CreatePaymentOrderDto } from '../dto/create-order.dto';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrder)
    private readonly orderRepo: Repository<PaymentOrder>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(TvodProduct)
    private readonly tvodRepo: Repository<TvodProduct>,
    @InjectRepository(ContentPurchase)
    private readonly purchaseRepo: Repository<ContentPurchase>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    private readonly planService: PlanService,
    private readonly settingService: SystemSettingService,
    private readonly redisService: RedisService,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly kafkaService: KafkaService,
  ) {}

  onModuleInit(): void {
    this.kafkaService.registerTopicHandler('ott.payments.razorpay', async (payload) => {
      await this.processPaymentWebhookEvent(payload);
    });
  }

  /**
   * Creates a payment order for SVOD Plan subscription or TVOD Movie/Series rental.
   */
  async createOrder(userId: string, body: CreatePaymentOrderDto | any): Promise<any> {
    let planId = body?.planId || body?.plan_id || body?.package_id || body?.packageId
      ? Number(body.planId || body.plan_id || body.package_id || body.packageId)
      : null;
    const contentId = body?.contentId || body?.video_id || body?.content_id
      ? Number(body.contentId || body.video_id || body.content_id)
      : null;
    const couponCode = body?.couponCode || body?.coupon_code || null;
    const provider = (body?.provider || (await this.settingService.getValue('PAYMENT_ACTIVE_GATEWAY', 'RAZORPAY'))).toUpperCase();

    let orderType = 'SUBSCRIPTION';
    let baseAmount = 0;
    let currency = 'INR';
    let itemTitle = 'MaxxPixels Subscription';

    if (!planId && !contentId && body?.amount) {
      const amt = Number(body.amount);
      const matchingPlan = await this.planRepo.findOne({
        where: [
          { discountPrice: amt, isActive: true },
          { price: amt, isActive: true },
        ],
      });
      if (matchingPlan) {
        planId = matchingPlan.id;
      }
    }

    let plan: Plan | null = null;
    if (planId) {
      plan = await this.planRepo.findOne({ where: { id: planId } });
      if (!plan) throw new NotFoundException(`Subscription plan ${planId} not found`);

      if (plan.singleUseOnly) {
        const pastSubscription = await this.subscriptionRepo.findOne({
          where: [
            { userId: userId as any, planId: plan.id },
            { userId: Number(userId) as any, planId: plan.id },
          ],
        });
        if (pastSubscription) {
          throw new BadRequestException(
            `The "${plan.name}" plan is for single-time use only and has already been used on your account.`,
          );
        }
        const pastPaidOrder = await this.orderRepo.findOne({
          where: [
            { userId: userId as any, planId: plan.id, status: 'PAID' },
            { userId: Number(userId) as any, planId: plan.id, status: 'PAID' },
          ],
        });
        if (pastPaidOrder) {
          throw new BadRequestException(
            `The "${plan.name}" plan is for single-time use only and has already been used on your account.`,
          );
        }
      }

      orderType = 'SUBSCRIPTION';
      baseAmount = Number(plan.discountPrice ?? plan.price);
      currency = plan.currency || 'INR';
      itemTitle = plan.name;
    } else if (contentId) {
      orderType = 'TVOD';
      const content = await this.contentRepo.findOne({
        where: { id: contentId },
        relations: ['tvodProducts'],
      });
      if (!content) throw new NotFoundException(`Content ${contentId} not found`);
      const tvod = content.tvodProducts?.[0];
      baseAmount = Number(body?.amount ?? tvod?.price ?? 49);
      currency = tvod?.currency || 'INR';
      itemTitle = `Rent: ${content.title}`;
    } else if (body?.amount) {
      baseAmount = Number(body.amount);
    } else {
      throw new BadRequestException('Either planId or contentId is required to create a payment order');
    }

    let discountAmount = 0;
    let finalAmount = baseAmount;

    if (couponCode) {
      const couponResult = await this.planService.validateAndCalculateCoupon(
        couponCode,
        baseAmount,
        planId || undefined,
      );
      discountAmount = couponResult.discountAmount;
      finalAmount = couponResult.finalAmount;
    }

    const isAutopay = Boolean(
      plan?.isAutopayEligible ||
      plan?.autopayEnabled ||
      body?.enableAutopay ||
      body?.enable_autopay ||
      body?.autopay ||
      body?.isAutopay,
    );

    const receiptNumber = `rcpt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const isFreeOrder = finalAmount <= 0;

    let gatewayResult: any = { orderId: '', subscriptionId: undefined, isLive: false };
    let effectiveProvider = provider;
    let razorpayKeyId = '';

    if (isFreeOrder) {
      effectiveProvider = couponCode ? 'COUPON_100_PERCENT' : 'FREE';
      gatewayResult = {
        orderId: `free_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
        subscriptionId: undefined,
        isLive: false,
      };
    } else {
      const gateway = this.gatewayFactory.getGateway(provider);
      gatewayResult = await gateway.createOrder({
        amount: finalAmount,
        currency,
        receipt: receiptNumber,
        isAutopay,
        planId: planId ? String(planId) : undefined,
        razorpayPlanId: plan?.razorpayPlanId,
        billingPeriod: plan?.billingPeriod || plan?.billingCycle,
        planName: plan?.name,
        notes: {
          userId,
          orderType,
          planId: planId ? String(planId) : '',
          contentId: contentId ? String(contentId) : '',
          isAutopay: String(isAutopay),
        },
      });

      // If Razorpay dynamically returned a plan_id and plan didn't have one, persist it
      if (plan && gatewayResult?.rawResponse?.plan_id && !plan.razorpayPlanId) {
        plan.razorpayPlanId = gatewayResult.rawResponse.plan_id;
        await this.planRepo
          .save(plan)
          .catch((e) => this.logger.warn(`Could not save razorpayPlanId: ${e.message}`));
      }

      razorpayKeyId =
        (await this.settingService.getValue('RAZORPAY_KEY_ID')) || process.env.RAZORPAY_KEY_ID || '';
    }

    const finalOrderId = gatewayResult.orderId;
    const isLiveRazorpayOrder = Boolean(gatewayResult.isLive);

    const savedOrder = await this.orderRepo.save(
      this.orderRepo.create({
        orderId: finalOrderId,
        userId,
        orderType,
        planId,
        contentId,
        couponCode,
        amount: finalAmount,
        originalAmount: baseAmount,
        discountAmount,
        finalAmount,
        currency,
        provider: effectiveProvider,
        providerOrderId: finalOrderId,
        subscriptionId: gatewayResult.subscriptionId || null,
        receiptNumber,
        status: 'CREATED',
      }),
    );

    let verifyResult: any = null;
    if (isFreeOrder) {
      // Fulfill immediately so entitlement is active without relying on client verification.
      try {
        verifyResult = await this.verifyPayment(userId, {
          dbOrderId: savedOrder.id,
          orderId: savedOrder.orderId,
          providerOrderId: savedOrder.providerOrderId,
          providerPaymentId: `free_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          signature: 'free_signature',
        });
      } catch (e: any) {
        // If already fulfilled (idempotent/parallel), continue with a success-shaped response.
        this.logger.warn(`Free order auto-fulfillment notice for order ${savedOrder.id}: ${e?.message || e}`);
      }
    }

    return {
      id: savedOrder.id,
      dbOrderId: savedOrder.id,
      orderId: finalOrderId,
      order_id: finalOrderId,
      gatewayOrderId: finalOrderId,
      gateway_order_id: finalOrderId,
      providerOrderId: finalOrderId,
      razorpayOrderId: finalOrderId,
      razorpay_order_id: finalOrderId,
      subscriptionId: gatewayResult.subscriptionId,
      subscription_id: gatewayResult.subscriptionId,
      razorpaySubscriptionId: gatewayResult.subscriptionId,
      razorpay_subscription_id: gatewayResult.subscriptionId,
      isAutopay: Boolean(gatewayResult.subscriptionId || (!isFreeOrder && isAutopay)),
      autopayEnabled: Boolean(gatewayResult.subscriptionId || (!isFreeOrder && isAutopay)),
      autopay_enabled: Boolean(gatewayResult.subscriptionId || (!isFreeOrder && isAutopay)),
      billingPeriod: plan?.billingPeriod || plan?.billingCycle || 'MONTHLY',
      billing_period: plan?.billingPeriod || plan?.billingCycle || 'MONTHLY',
      receiptNumber: savedOrder.receiptNumber,
      receipt: savedOrder.receiptNumber,
      orderType: savedOrder.orderType,
      itemTitle,
      originalAmount: savedOrder.originalAmount,
      discountAmount: savedOrder.discountAmount,
      finalAmount: savedOrder.finalAmount,
      amount: Math.round(savedOrder.finalAmount * 100),
      amountInRupees: savedOrder.finalAmount,
      currency: savedOrder.currency,
      provider: savedOrder.provider,
      gateway: savedOrder.provider,
      keyId: razorpayKeyId,
      key_id: razorpayKeyId,
      key: razorpayKeyId,
      razorpay_key: razorpayKeyId,
      status: verifyResult ? 'SUCCESS' : savedOrder.status,
      isFree: isFreeOrder,
      isLiveOrder: isLiveRazorpayOrder,
      ...(verifyResult
        ? {
            success: true,
            verified: true,
            subscription_active: Boolean(verifyResult.subscription_active ?? verifyResult.subscription),
            is_subscribed: Boolean(verifyResult.is_subscribed ?? verifyResult.subscription_active ?? verifyResult.subscription),
            isSubscribed: Boolean(verifyResult.isSubscribed ?? verifyResult.is_subscribed ?? verifyResult.subscription_active ?? verifyResult.subscription),
            subscription: verifyResult.subscription,
          }
        : {}),
    };
  }

  /**
   * Verifies a payment with:
   * - Redis Distributed Lock (`lock:payment:verify:<providerOrderId>`) for idempotency
   * - Razorpay HMAC-SHA256 signature verification
   * - Single PostgreSQL transaction updating `PaymentOrder`, `Payment`, `Subscription`/`ContentPurchase`, `Coupon`, and `OutboxEvent`.
   */
  async verifyPayment(userId: string | undefined, body: any): Promise<any> {
    const rawIdentifiers = [
      body?.razorpay_subscription_id,
      body?.subscriptionId,
      body?.subscription_id,
      body?.razorpay_order_id,
      body?.razorpayOrderId,
      body?.providerOrderId,
      body?.orderId,
      body?.order_id,
      body?.gatewayOrderId,
      body?.gateway_order_id,
      body?.dbOrderId,
    ];
    const orderIdentifiers = rawIdentifiers
      .filter((val): val is string | number => val !== null && val !== undefined && String(val).trim() !== '')
      .map((val) => String(val).trim());
    const providerOrderId = orderIdentifiers[0];

    const providerPaymentId =
      body?.razorpay_payment_id ||
      body?.razorpayPaymentId ||
      body?.providerPaymentId ||
      body?.paymentId ||
      body?.gateway_payment_id ||
      body?.transaction_id ||
      `pay_${crypto.randomBytes(8).toString('hex')}`;
    const signature =
      body?.razorpay_signature ||
      body?.razorpaySignature ||
      body?.signature ||
      body?.gateway_signature ||
      '';

    if (orderIdentifiers.length === 0 && !body?.planId && !body?.package_id && !body?.contentId && !body?.video_id) {
      throw new BadRequestException('Order ID or planId/contentId is required for payment verification');
    }

    const lockKey = `payment:verify:${providerOrderId || `${userId}-${Date.now()}`}`;
    const lockToken = await this.redisService.acquireLock(lockKey, 15000);
    if (!lockToken) {
      throw new BusinessException('Payment verification is already in progress', 'PAYMENT_IN_PROGRESS');
    }

    try {
      let order: PaymentOrder | null = null;
      for (const idStr of orderIdentifiers) {
        order = await this.orderRepo.findOne({
          where: [
            { orderId: idStr },
            { providerOrderId: idStr },
            { subscriptionId: idStr },
          ],
        });
        if (!order && !Number.isNaN(Number(idStr))) {
          order = await this.orderRepo.findOne({ where: { id: Number(idStr) } });
        }
        if (order) break;
      }

      // If already verified (idempotent retry), return the existing success record
      if (order && order.status === 'PAID') {
        const existingPayment = await this.paymentRepo.findOne({ where: { paymentOrderId: order.id } });
        const existingSub = await this.subscriptionRepo.findOne({
          where: [
            { userId: order.userId, status: 'ACTIVE' },
            { userId: Number(order.userId), status: 'ACTIVE' },
          ],
          order: { endDate: 'DESC' },
        });
        return {
          verified: true,
          idempotent: true,
          status: 'SUCCESS',
          success: true,
          subscription_active: Boolean(existingSub),
          is_subscribed: Boolean(existingSub),
          isSubscribed: Boolean(existingSub),
          isBuy: existingSub ? 1 : 0,
          is_buy: existingSub ? 1 : 0,
          orderId: order.id,
          providerOrderId: order.providerOrderId || order.orderId,
          paymentId: existingPayment?.id,
          subscription: existingSub,
        };
      }

      // Support legacy direct transaction call where mobile app creates + verifies in one step
      if (!order && userId) {
        const created = await this.createOrder(userId, body);
        order = await this.orderRepo.findOne({
          where: [
            { id: created.id },
            { orderId: created.orderId },
          ],
        });
      }

      if (!order) {
        throw new NotFoundException(`Payment order not found (${orderIdentifiers.join(', ') || 'no order ID'})`);
      }

      // Verify payment signature via provider gateway.
      // Zero-amount (100% coupon/free) orders are server-authorized without a paid gateway signature.
      const isFreeOrder = Number(order.finalAmount || order.amount || 0) <= 0;
      const gateway = this.gatewayFactory.getGateway(order.provider);
      const isSignatureValid =
        isFreeOrder ||
        (await gateway.verifyPayment({
          paymentId: providerPaymentId,
          orderId: order.providerOrderId || order.orderId || providerOrderId,
          subscriptionId:
            body?.subscription_id ||
            body?.subscriptionId ||
            body?.razorpay_subscription_id ||
            order.subscriptionId,
          signature,
        }));

      if (!isSignatureValid) {
        throw new BusinessException('Invalid payment signature', 'INVALID_PAYMENT_SIGNATURE');
      }

      const effectiveUserId = userId || order.userId || (body as any)?.userId || (body as any)?.user_id;

      return await this.dataSource.transaction(async (manager) => {
        order!.status = 'PAID';
        if (!order!.providerOrderId && (order!.orderId || providerOrderId)) {
          order!.providerOrderId = order!.orderId || providerOrderId;
        }
        await manager.save(PaymentOrder, order!);

        const payment = await manager.save(
          manager.create(Payment, {
            userId: effectiveUserId,
            paymentOrderId: order!.id,
            provider: order!.provider,
            providerOrderId: order!.providerOrderId || order!.orderId || providerOrderId,
            transactionId: String(providerPaymentId || `txn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`),
            providerPaymentId: String(providerPaymentId),
            providerSignature: signature || null,
            paymentMethod: body?.paymentMethod || 'ONLINE',
            amount: order!.finalAmount || order!.amount || 0,
            taxAmount: Number((((order!.finalAmount || order!.amount || 0) * 18) / 118).toFixed(2)),
            currency: order!.currency || 'INR',
            status: 'SUCCESS',
            paidAt: new Date(),
          }),
        );

        let subscriptionResult: Subscription | null = null;
        let purchaseResult: ContentPurchase | null = null;

        let targetPlanId = order!.planId || (body?.planId || body?.plan_id || body?.package_id || body?.packageId ? Number(body.planId || body.plan_id || body.package_id || body.packageId) : null);
        const isSubscription = order!.orderType === 'SUBSCRIPTION' || !order!.contentId;
        if (!targetPlanId && isSubscription) {
          const fallbackPlan = await manager.findOne(Plan, {
            where: { isActive: true },
            order: { price: 'ASC' },
          });
          if (fallbackPlan) {
            targetPlanId = fallbackPlan.id;
          }
        }

        if (isSubscription && targetPlanId) {
          const plan = await manager.findOne(Plan, { where: { id: targetPlanId } });

          if (plan?.singleUseOnly) {
            const priorSub = await manager.findOne(Subscription, {
              where: [
                { userId: effectiveUserId as any, planId: targetPlanId },
                { userId: Number(effectiveUserId) as any, planId: targetPlanId },
              ],
            });
            if (priorSub && priorSub.paymentId && priorSub.paymentId !== String(payment.id)) {
              throw new BusinessException(
                `The plan "${plan.name}" is for single-time use only and has already been activated on this account.`,
                'PLAN_ALREADY_USED',
              );
            }
          }
          const durationDays = plan?.durationDays || 30;
          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + durationDays * 86400 * 1000);

          // Mark previous active subscriptions as SUPERSEDED
          await manager.update(
            Subscription,
            { userId: effectiveUserId, status: 'ACTIVE' },
            { status: 'SUPERSEDED' },
          );

          const isAutopayOrder = Boolean(
            order!.subscriptionId ||
            body?.subscription_id ||
            body?.subscriptionId ||
            body?.razorpay_subscription_id ||
            plan?.autopayEnabled ||
            plan?.isAutopayEligible,
          );
          const activeSubId =
            body?.subscription_id ||
            body?.subscriptionId ||
            body?.razorpay_subscription_id ||
            order!.subscriptionId ||
            null;

          subscriptionResult = await manager.save(
            manager.create(Subscription, {
              userId: effectiveUserId,
              planId: targetPlanId,
              status: 'ACTIVE',
              startDate,
              endDate,
              autoRenew: isAutopayOrder,
              autopayEnabled: isAutopayOrder,
              paymentId: String(payment.id),
              paymentGatewaySubId: activeSubId,
              razorpaySubscriptionId: activeSubId,
              amount: order!.finalAmount || order!.amount || plan?.price || 0,
            }),
          );
        } else if (order!.orderType === 'TVOD' && order!.contentId) {
          const tvod = await manager.findOne(TvodProduct, { where: { contentId: order!.contentId } });
          const rentalHours = tvod?.rentalDurationHours || 48;
          const purchasedAt = new Date();
          const expiresAt = new Date(purchasedAt.getTime() + rentalHours * 3600 * 1000);

          purchaseResult = await manager.save(
            manager.create(ContentPurchase, {
              userId: effectiveUserId,
              contentId: order!.contentId,
              tvodProductId: tvod?.id || null,
              amountPaid: order!.finalAmount || order!.amount || 0,
              currency: order!.currency || 'INR',
              paymentId: String(payment.id),
              status: 'ACTIVE',
              purchasedAt,
              expiresAt,
            }),
          );
        }

        if (order!.couponCode) {
          try {
            await manager.query(
              'UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE UPPER(code) = UPPER($1)',
              [order!.couponCode],
            );
          } catch (e: any) {
            this.logger.warn(`Could not increment coupon usage for ${order!.couponCode}: ${e?.message || e}`);
          }
        }

        // Enqueue Transactional Outbox Event for `ott.subscriptions.events` (dispatched asynchronously)
        await this.outboxService.enqueue(
          {
            aggregateType: order!.orderType || 'SUBSCRIPTION',
            aggregateId: String(payment.id),
            eventType: 'PAYMENT_VERIFIED',
            topic: 'ott.subscriptions.events',
            payload: {
              userId: effectiveUserId,
              paymentId: payment.id,
              orderId: order!.id,
              orderType: order!.orderType || 'SUBSCRIPTION',
              planId: order!.planId || targetPlanId,
              contentId: order!.contentId,
              amount: order!.finalAmount || order!.amount || 0,
              currency: order!.currency || 'INR',
            },
          },
          manager,
        );

        return {
          verified: true,
          status: 'SUCCESS',
          success: true,
          subscription_active: Boolean(subscriptionResult),
          is_subscribed: Boolean(subscriptionResult),
          isSubscribed: Boolean(subscriptionResult),
          isBuy: subscriptionResult ? 1 : 0,
          is_buy: subscriptionResult ? 1 : 0,
          rent_active: Boolean(purchaseResult),
          is_rented: purchaseResult ? 1 : 0,
          orderId: order!.id,
          providerOrderId: order!.providerOrderId || order!.orderId,
          paymentId: payment.id,
          providerPaymentId: payment.providerPaymentId,
          amount: payment.amount,
          currency: payment.currency,
          subscription: subscriptionResult,
          rentalPurchase: purchaseResult,
        };
      });
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Handles Razorpay & Stripe asynchronous webhook callbacks.
   */
  async handleWebhook(provider: string, rawBody: string, signature: string | undefined, payload: any): Promise<any> {
    const normalized = provider.toUpperCase();
    if (normalized === 'RAZORPAY') {
      const webhookSecret = await this.settingService.getValue('RAZORPAY_WEBHOOK_SECRET', '');
      if (webhookSecret && signature) {
        const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        if (expected !== signature) {
          throw new BusinessException('Invalid Razorpay webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
        }
      }

      const event = String(payload?.event || '');
      const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
      const subEntity = payload?.payload?.subscription?.entity;
      const shouldProcess =
        (event === 'payment.captured' || event === 'order.paid' || event.startsWith('subscription.')) &&
        Boolean(entity || subEntity);

      if (shouldProcess) {
        const subId = subEntity?.id || entity?.subscription_id;
        const orderId = entity?.order_id || entity?.id || subId;
        const paymentId = payload?.payload?.payment?.entity?.id || entity?.id;
        const eventId = String(payload?.id || payload?.event_id || `${event}:${orderId || subId || paymentId || Date.now()}`);

        // Acknowledge the provider immediately; the Redis stream worker verifies
        // the payment and activates the subscription/rental idempotently.
        await this.kafkaService.publish('ott.payments.razorpay', String(orderId || subId || paymentId || 'razorpay'), {
          eventId,
          provider: 'RAZORPAY',
          event,
          razorpay_order_id: orderId,
          razorpay_subscription_id: subId,
          subscription_id: subId,
          razorpay_payment_id: paymentId,
          receivedAt: new Date().toISOString(),
        });
      }
    }

    return { received: true, provider: normalized, queued: normalized === 'RAZORPAY' };
  }

  private async processPaymentWebhookEvent(payload: any): Promise<void> {
    const provider = String(payload?.provider || 'RAZORPAY').toUpperCase();
    if (provider !== 'RAZORPAY') return;

    const body = {
      razorpay_order_id: payload?.razorpay_order_id || payload?.orderId,
      razorpay_subscription_id:
        payload?.razorpay_subscription_id || payload?.subscription_id || payload?.subscriptionId,
      subscription_id: payload?.subscription_id || payload?.subscriptionId || payload?.razorpay_subscription_id,
      razorpay_payment_id: payload?.razorpay_payment_id || payload?.paymentId,
    };

    if (!body.razorpay_order_id && !body.razorpay_subscription_id && !body.razorpay_payment_id) {
      this.logger.warn('Ignoring Razorpay webhook event with no order/subscription/payment identifier');
      return;
    }

    try {
      await this.verifyPayment(undefined, body);
    } catch (err: any) {
      const message = err?.message || String(err);
      // Idempotent replays are expected when the client verify endpoint already
      // activated the order; treat them as a successful no-op.
      if (/already|in progress|idempotent/i.test(message)) {
        this.logger.debug(`Razorpay webhook event skipped: ${message}`);
        return;
      }
      throw err;
    }
  }

  async getUserTransactions(userId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: [
        { userId: userId as any },
        { userId: Number(userId) as any },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUserActiveSubscription(userId: string): Promise<any> {
    const active = await this.subscriptionRepo.findOne({
      where: [
        { userId: userId as any, status: 'ACTIVE' },
        { userId: Number(userId) as any, status: 'ACTIVE' },
      ],
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });
    const isActive = Boolean(active && new Date(active.endDate).getTime() > Date.now());
    const pkgName = active?.plan?.name || (isActive ? 'VIP Membership' : 'Free');
    const expiry = active?.endDate ? (active.endDate instanceof Date ? active.endDate.toISOString() : new Date(active.endDate).toISOString()) : null;
    const planId = active?.planId || 0;

    return {
      isSubscribed: isActive,
      is_subscribed: isActive,
      isBuy: isActive ? 1 : 0,
      is_buy: isActive ? 1 : 0,
      is_buy_package: isActive ? 1 : 0,
      subscribed: isActive,
      planId,
      plan_id: planId,
      package_id: planId,
      packageName: pkgName,
      package_name: pkgName,
      planName: pkgName,
      expiryDate: expiry,
      expire_date: expiry,
      end_date: expiry,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      autopayEnabled: Boolean(active?.autopayEnabled || active?.autoRenew),
      autopay_enabled: Boolean(active?.autopayEnabled || active?.autoRenew),
      autoRenew: Boolean(active?.autoRenew),
      auto_renew: Boolean(active?.autoRenew),
      subscriptionId: active?.razorpaySubscriptionId || active?.paymentGatewaySubId || null,
      subscription_id: active?.razorpaySubscriptionId || active?.paymentGatewaySubId || null,
      subscription: active || null,
    };
  }

  // ==================== ADMIN PAYMENTS & SQL-AGGREGATED ANALYTICS ====================

  async listAdminTransactions(params: {
    page?: number;
    size?: number;
    status?: string;
    search?: string;
  }): Promise<PageResponse<any>> {
    const page = Math.max(0, Number(params.page || 0));
    const size = Math.min(100, Math.max(1, Number(params.size || 20)));

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .leftJoinAndSelect('p.paymentOrder', 'o')
      .leftJoinAndSelect('o.user', 'ou')
      .leftJoinAndSelect('o.plan', 'op')
      .orderBy('p.createdAt', 'DESC')
      .skip(page * size)
      .take(size);

    if (params.status) {
      qb.andWhere('p.status = :status', { status: params.status.toUpperCase() });
    }
    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      qb.andWhere(
        '(p.providerPaymentId ILIKE :q OR p.providerOrderId ILIKE :q OR p.transactionId ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q OR ou.email ILIKE :q OR ou.phone ILIKE :q)',
        { q },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const mapped = rows.map((p) => {
      const user = p.user || p.paymentOrder?.user;
      const txRef = p.providerPaymentId || p.transactionId || p.providerOrderId || p.paymentOrder?.orderId || `TXN-${p.id}`;
      const title = p.paymentOrder?.plan?.name || (p.paymentOrder?.orderType === 'TVOD' ? 'Pay-Per-View Movie Rental' : 'VIP Subscription');
      const gw = p.provider || p.paymentOrder?.provider || p.paymentMethod || 'RAZORPAY';

      return {
        id: p.id,
        transactionId: txRef,
        transactionRef: txRef,
        userId: user?.id || p.userId || p.paymentOrder?.userId,
        userEmail: user?.email || null,
        userName: user?.fullName || 'Subscriber',
        userPhone: user?.phone || user?.phoneNumber || null,
        customerName: user?.fullName || 'Subscriber',
        customerEmail: user?.email || null,
        customerPhone: user?.phone || user?.phoneNumber || null,
        orderType: p.paymentOrder?.orderType || 'SUBSCRIPTION',
        planName: title,
        planTitle: title,
        planId: p.paymentOrder?.planId,
        contentId: p.paymentOrder?.contentId,
        provider: gw,
        gateway: gw,
        providerOrderId: p.providerOrderId || p.paymentOrder?.orderId,
        providerPaymentId: p.providerPaymentId || txRef,
        paymentMethod: p.paymentMethod || 'ONLINE',
        amount: p.amount,
        taxAmount: p.taxAmount,
        refundedAmount: p.refundedAmount,
        currency: p.currency || 'INR',
        status: p.status,
        paidAt: p.paidAt || p.createdAt,
        createdAt: p.createdAt,
      };
    });

    return PageResponse.of(mapped, total, page, size);
  }

  async listAdminTvodPurchases(params: {
    page?: number;
    size?: number;
    search?: string;
  }): Promise<PageResponse<any>> {
    const page = Math.max(0, Number(params.page || 0));
    const size = Math.min(100, Math.max(1, Number(params.size || 20)));

    const qb = this.purchaseRepo
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.content', 'c')
      .orderBy('cp.purchasedAt', 'DESC')
      .skip(page * size)
      .take(size);

    if (params.search && params.search.trim()) {
      qb.where('c.title ILIKE :q OR cp.paymentId ILIKE :q', { q: `%${params.search.trim()}%` });
    }

    const [rows, total] = await qb.getManyAndCount();
    const mapped = rows.map((cp) => ({
      id: cp.id,
      userId: cp.userId,
      contentId: cp.contentId,
      contentTitle: cp.content?.title || `Content #${cp.contentId}`,
      amountPaid: cp.amountPaid,
      currency: cp.currency,
      paymentId: cp.paymentId,
      status: cp.status,
      purchasedAt: cp.purchasedAt,
      expiresAt: cp.expiresAt,
    }));

    return PageResponse.of(mapped, total, page, size);
  }

  /**
   * High-performance SQL aggregation for Payment & TVOD Analytics.
   * Replaces Spring Boot's in-memory `findAll().stream()` bottleneck.
   */
  async getPaymentAnalyticsSummary(): Promise<any> {
    const stats = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(CASE WHEN p.status = \'SUCCESS\' THEN p.amount ELSE 0 END), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(CASE WHEN p.status = \'REFUNDED\' THEN p.refundedAmount ELSE 0 END), 0)', 'totalRefunded')
      .addSelect('COUNT(CASE WHEN p.status = \'SUCCESS\' THEN 1 END)', 'successfulCount')
      .addSelect('COUNT(CASE WHEN p.status = \'FAILED\' THEN 1 END)', 'failedCount')
      .addSelect('COUNT(*)', 'totalCount')
      .getRawOne();

    const activeSubscriptions = await this.subscriptionRepo.count({ where: { status: 'ACTIVE' } });
    const activeRentals = await this.purchaseRepo.count({ where: { status: 'ACTIVE' } });

    return {
      totalRevenue: Number(Number(stats?.totalRevenue || 0).toFixed(2)),
      totalRefunded: Number(Number(stats?.totalRefunded || 0).toFixed(2)),
      netRevenue: Number((Number(stats?.totalRevenue || 0) - Number(stats?.totalRefunded || 0)).toFixed(2)),
      successfulTransactions: Number(stats?.successfulCount || 0),
      failedTransactions: Number(stats?.failedCount || 0),
      totalTransactions: Number(stats?.totalCount || 0),
      activeSubscriptions,
      activeRentals,
      currency: 'INR',
    };
  }

  async refundPayment(paymentId: number, reason = 'Admin initiated refund'): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    payment.status = 'REFUNDED';
    payment.refundedAmount = payment.amount;
    payment.failureReason = reason;
    await this.paymentRepo.save(payment);

    if (payment.paymentOrderId) {
      await this.orderRepo.update({ id: payment.paymentOrderId }, { status: 'REFUNDED' });
    }
    await this.subscriptionRepo.update({ paymentId: String(payment.id) }, { status: 'CANCELLED' });
    await this.purchaseRepo.update({ paymentId: String(payment.id) }, { status: 'REFUNDED' });

    return payment;
  }
}
