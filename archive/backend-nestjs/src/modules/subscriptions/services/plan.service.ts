import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { Coupon } from '../entities/coupon.entity';
import { Subscription } from '../entities/subscription.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { PageResponse } from '../../../common/dto/page-response.dto';
import { BusinessException } from '../../../common/filters/global-exception.filter';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async listPlans(onlyActive = true, userId?: string | number): Promise<any[]> {
    const formatPlan = (p: Plan, isAlreadyUsed: boolean) => ({
      ...p,
      singleUseOnly: Boolean(p.singleUseOnly),
      single_use_only: Boolean(p.singleUseOnly),
      isAlreadyUsed,
      is_already_used: isAlreadyUsed,
      alreadyUsed: isAlreadyUsed,
      already_used: isAlreadyUsed,
      canPurchase: !isAlreadyUsed,
      can_purchase: !isAlreadyUsed,
      active: p.isActive,
      is_active: p.isActive,
      autopayEnabled: p.isAutopayEligible,
      autopay_enabled: p.isAutopayEligible,
      isAutopayEligible: p.isAutopayEligible,
      is_autopay_eligible: p.isAutopayEligible,
      razorpayPlanId: p.razorpayPlanId || null,
      razorpay_plan_id: p.razorpayPlanId || null,
      billingPeriod: p.billingPeriod || p.billingCycle,
      billing_period: p.billingPeriod || p.billingCycle,
      maxResolution: p.maxResolution || p.maxVideoQuality,
      max_resolution: p.maxResolution || p.maxVideoQuality,
      adsEnabled: p.adsEnabled,
      ads_enabled: p.adsEnabled,
      downloadsEnabled: p.downloadsEnabled,
      downloads_enabled: p.downloadsEnabled,
      effectivePrice: p.discountPrice ?? p.price,
    });

    if (!userId) {
      const cacheKey = `plans:list:${onlyActive}:public`;
      return this.redisService.getOrSet(cacheKey, 300, async () => {
        const whereClause = onlyActive ? { isActive: true } : {};
        const plans = await this.planRepo.find({
          where: whereClause,
          order: { price: 'ASC', id: 'ASC' },
        });
        return plans.map((p) => formatPlan(p, false));
      });
    }

    const whereClause = onlyActive ? { isActive: true } : {};
    const plans = await this.planRepo.find({
      where: whereClause,
      order: { price: 'ASC', id: 'ASC' },
    });

    const usedPlanIds = new Set<number>();
    const pastSubs = await this.subscriptionRepo.find({
      where: [
        { userId: userId as any },
        { userId: Number(userId) as any },
      ],
      select: ['planId', 'status'],
    });
    pastSubs.forEach((s) => s.planId && usedPlanIds.add(Number(s.planId)));

    return plans
      .filter((p) => {
        const isAlreadyUsed = Boolean(p.singleUseOnly && usedPlanIds.has(Number(p.id)));
        if (onlyActive && isAlreadyUsed) {
          return false;
        }
        return true;
      })
      .map((p) => {
        const isAlreadyUsed = Boolean(p.singleUseOnly && usedPlanIds.has(Number(p.id)));
        return formatPlan(p, isAlreadyUsed);
      });
  }

  async listAdminPlansPaginated(page = 0, size = 20, search?: string): Promise<PageResponse<any>> {
    const p = Math.max(0, Number(page || 0));
    const s = Math.min(100, Math.max(1, Number(size || 20)));
    const qb = this.planRepo.createQueryBuilder('plan').orderBy('plan.price', 'ASC').skip(p * s).take(s);
    if (search && search.trim()) {
      qb.where('plan.name ILIKE :q OR plan.description ILIKE :q OR plan.code ILIKE :q', { q: `%${search.trim()}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    const mapped = items.map((plan) => ({
      ...plan,
      singleUseOnly: Boolean(plan.singleUseOnly),
      single_use_only: Boolean(plan.singleUseOnly),
      active: plan.isActive,
      is_active: plan.isActive,
      autopayEnabled: plan.isAutopayEligible,
      autopay_enabled: plan.isAutopayEligible,
      isAutopayEligible: plan.isAutopayEligible,
      is_autopay_eligible: plan.isAutopayEligible,
      razorpayPlanId: plan.razorpayPlanId || null,
      razorpay_plan_id: plan.razorpayPlanId || null,
      billingPeriod: plan.billingPeriod || plan.billingCycle,
      billing_period: plan.billingPeriod || plan.billingCycle,
      maxResolution: plan.maxResolution || plan.maxVideoQuality,
      max_resolution: plan.maxResolution || plan.maxVideoQuality,
      adsEnabled: plan.adsEnabled,
      ads_enabled: plan.adsEnabled,
      downloadsEnabled: plan.downloadsEnabled,
      downloads_enabled: plan.downloadsEnabled,
      effectivePrice: plan.discountPrice ?? plan.price,
    }));
    return PageResponse.of(mapped, total, p, s);
  }

  async getPlanById(id: number): Promise<any> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return {
      ...plan,
      singleUseOnly: Boolean(plan.singleUseOnly),
      single_use_only: Boolean(plan.singleUseOnly),
      active: plan.isActive,
      is_active: plan.isActive,
      autopayEnabled: plan.isAutopayEligible,
      autopay_enabled: plan.isAutopayEligible,
      isAutopayEligible: plan.isAutopayEligible,
      is_autopay_eligible: plan.isAutopayEligible,
      razorpayPlanId: plan.razorpayPlanId || null,
      razorpay_plan_id: plan.razorpayPlanId || null,
      billingPeriod: plan.billingPeriod || plan.billingCycle,
      billing_period: plan.billingPeriod || plan.billingCycle,
      maxResolution: plan.maxResolution || plan.maxVideoQuality,
      max_resolution: plan.maxResolution || plan.maxVideoQuality,
      adsEnabled: plan.adsEnabled,
      ads_enabled: plan.adsEnabled,
      downloadsEnabled: plan.downloadsEnabled,
      downloads_enabled: plan.downloadsEnabled,
      effectivePrice: plan.discountPrice ?? plan.price,
    };
  }

  async togglePlanStatus(id: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    plan.isActive = !plan.isActive;
    const saved = await this.planRepo.save(plan);
    await this.redisService.delByPrefix('plans:');
    await this.redisService.del('plans:list:true');
    await this.redisService.del('plans:list:false');
    return saved;
  }

  async upsertPlan(body: any, id?: number): Promise<Plan> {
    let plan = id ? await this.planRepo.findOne({ where: { id } }) : null;
    const name = String(body?.name || '').trim();
    if (!plan && !name) {
      throw new BadRequestException('Plan name is required');
    }

    const price = Number(body?.price ?? 99);
    const discountPrice =
      body?.discountPrice !== undefined && body?.discountPrice !== null
        ? Number(body.discountPrice)
        : (body?.discount_price !== undefined && body?.discount_price !== null ? Number(body.discount_price) : price);

    const billingPeriod = (body?.billingPeriod || body?.billing_period || body?.billingCycle || body?.billing_cycle || 'MONTHLY').toString().toUpperCase();
    const maxResolution = (body?.maxResolution || body?.max_resolution || body?.maxVideoQuality || body?.max_video_quality || '1080p').toString();
    const adsEnabled = body?.adsEnabled !== undefined ? Boolean(body.adsEnabled) : (body?.ads_enabled !== undefined ? Boolean(body.ads_enabled) : (body?.hasAds !== undefined ? Boolean(body.hasAds) : false));
    const downloadsEnabled = body?.downloadsEnabled !== undefined ? Boolean(body.downloadsEnabled) : (body?.downloads_enabled !== undefined ? Boolean(body.downloads_enabled) : (body?.allowDownloads !== undefined ? Boolean(body.allowDownloads) : true));
    const autopayEnabled =
      body?.autopayEnabled !== undefined
        ? Boolean(body.autopayEnabled)
        : body?.autopay_enabled !== undefined
        ? Boolean(body.autopay_enabled)
        : body?.isAutopayEligible !== undefined
        ? Boolean(body.isAutopayEligible)
        : body?.is_autopay_eligible !== undefined
        ? Boolean(body.is_autopay_eligible)
        : plan?.isAutopayEligible ?? false;
    const razorpayPlanId =
      body?.razorpayPlanId !== undefined
        ? body.razorpayPlanId ? String(body.razorpayPlanId).trim() : null
        : body?.razorpay_plan_id !== undefined
        ? body.razorpay_plan_id ? String(body.razorpay_plan_id).trim() : null
        : undefined;
    const singleUseOnly = body?.singleUseOnly !== undefined ? Boolean(body.singleUseOnly) : (body?.single_use_only !== undefined ? Boolean(body.single_use_only) : false);
    const active = body?.active !== undefined ? Boolean(body.active) : (body?.isActive !== undefined ? Boolean(body.isActive) : (body?.is_active !== undefined ? Boolean(body.is_active) : true));
    const code = body?.code ? String(body.code).trim().toUpperCase() : (name ? name.toUpperCase().replace(/[^A-Z0-9]/g, '_') : undefined);
    const maxDevices = Number(body?.maxDevices ?? body?.max_devices ?? 2);
    const maxStreams = Number(body?.maxConcurrentStreams ?? body?.max_concurrent_streams ?? 1);
    const trialDays = Number(body?.trialDays ?? body?.trial_days ?? 0);
    const durationDays = body?.durationDays ?? body?.duration_days;

    if (!plan) {
      plan = this.planRepo.create({
        name,
        code: code || `PLAN_${Date.now()}`,
        description: body?.description || null,
        price,
        discountPrice,
        currency: body?.currency || 'INR',
        billingPeriod,
        billingCycle: billingPeriod,
        durationDays: durationDays ? Number(durationDays) : undefined,
        maxConcurrentStreams: maxStreams,
        maxDevices,
        maxRegisteredDevices: maxDevices,
        maxProfiles: Number(body?.maxProfiles ?? body?.max_profiles ?? 4),
        maxResolution,
        maxVideoQuality: maxResolution,
        adsEnabled,
        hasAds: adsEnabled,
        downloadsEnabled,
        downloadAllowed: downloadsEnabled,
        allowDownloads: downloadsEnabled,
        isPopular: Boolean(body?.isPopular ?? body?.is_popular ?? false),
        isActive: active,
        isAutopayEligible: autopayEnabled,
        razorpayPlanId: razorpayPlanId || null,
        singleUseOnly,
        trialDays,
        featuresJson: body?.featuresJson
          ? typeof body.featuresJson === 'string'
            ? body.featuresJson
            : JSON.stringify(body.featuresJson)
          : null,
      });
    } else {
      if (name) plan.name = name;
      if (code) plan.code = code;
      if (body.description !== undefined) plan.description = body.description;
      if (body.price !== undefined) plan.price = Number(body.price);
      if (body.discountPrice !== undefined || body.discount_price !== undefined) {
        plan.discountPrice = discountPrice;
      }
      if (body.currency !== undefined) plan.currency = body.currency;
      if (durationDays !== undefined) plan.durationDays = Number(durationDays);
      plan.billingPeriod = billingPeriod;
      plan.billingCycle = billingPeriod;
      if (body.maxConcurrentStreams !== undefined || body.max_concurrent_streams !== undefined) {
        plan.maxConcurrentStreams = maxStreams;
      }
      if (body.maxDevices !== undefined || body.max_devices !== undefined) {
        plan.maxDevices = maxDevices;
        plan.maxRegisteredDevices = maxDevices;
      }
      if (body.maxProfiles !== undefined || body.max_profiles !== undefined) {
        plan.maxProfiles = Number(body.maxProfiles ?? body.max_profiles);
      }
      plan.maxResolution = maxResolution;
      plan.maxVideoQuality = maxResolution;
      plan.adsEnabled = adsEnabled;
      plan.hasAds = adsEnabled;
      plan.downloadsEnabled = downloadsEnabled;
      plan.downloadAllowed = downloadsEnabled;
      plan.allowDownloads = downloadsEnabled;
      if (body.isPopular !== undefined || body.is_popular !== undefined) {
        plan.isPopular = Boolean(body.isPopular ?? body.is_popular);
      }
      plan.isActive = active;
      plan.isAutopayEligible = autopayEnabled;
      if (razorpayPlanId !== undefined) {
        plan.razorpayPlanId = razorpayPlanId || null;
      }
      plan.singleUseOnly = singleUseOnly;
      if (body.trialDays !== undefined || body.trial_days !== undefined) {
        plan.trialDays = trialDays;
      }
      if (body.featuresJson !== undefined) {
        plan.featuresJson =
          typeof body.featuresJson === 'string' ? body.featuresJson : JSON.stringify(body.featuresJson);
      }
    }

    const saved = await this.planRepo.save(plan);
    await this.redisService.delByPrefix('plans:');
    await this.redisService.del('plans:list:true');
    await this.redisService.del('plans:list:false');
    return saved;
  }

  async deletePlan(id: number): Promise<any> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    const [subCountRow, orderCountRow] = await Promise.all([
      this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.planId = :id OR s.plan_id = :id', { id })
        .getCount()
        .then((count) => ({ count }))
        .catch(async () => {
          const rows = await this.dataSource.query(
            'SELECT COUNT(*)::int AS count FROM subscriptions WHERE plan_id = $1',
            [id],
          );
          return { count: Number(rows?.[0]?.count || 0) };
        }),
      this.dataSource
        .query('SELECT COUNT(*)::int AS count FROM payment_orders WHERE plan_id = $1', [id])
        .then((rows) => ({ count: Number(rows?.[0]?.count || 0) }))
        .catch(() => ({ count: 0 })),
    ]);

    const subCount = Number(subCountRow?.count || 0);
    const orderCount = Number(orderCountRow?.count || 0);

    await this.couponRepo
      .createQueryBuilder()
      .update(Coupon)
      .set({ applicablePlanId: null as any })
      .where('applicablePlanId = :id OR applicable_plan_id = :id', { id })
      .execute()
      .catch(async () => {
        try {
          await this.dataSource.query('UPDATE coupons SET applicable_plan_id = NULL WHERE applicable_plan_id = $1', [id]);
        } catch {}
      });

    if (subCount > 0 || orderCount > 0) {
      plan.isActive = false;
      await this.planRepo.save(plan);
      await this.redisService.delByPrefix('plans:');
      await this.redisService.del('plans:list:true');
      await this.redisService.del('plans:list:false');
      return {
        id,
        deleted: false,
        deactivated: true,
        message:
          'Plan is linked to existing subscriptions/orders and cannot be hard-deleted. It has been deactivated instead.',
        references: { subscriptions: subCount, paymentOrders: orderCount },
      };
    }

    await this.planRepo.remove(plan);
    await this.redisService.delByPrefix('plans:');
    await this.redisService.del('plans:list:true');
    await this.redisService.del('plans:list:false');
    return { id, deleted: true };
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== COUPONS ====================

  async listCoupons(): Promise<Coupon[]> {
    return this.couponRepo.find({ order: { id: 'DESC' } as any });
  }

  async listAdminCouponsPaginated(page = 0, size = 20, search?: string): Promise<PageResponse<Coupon>> {
    const p = Math.max(0, Number(page || 0));
    const s = Math.min(100, Math.max(1, Number(size || 20)));
    const qb = this.couponRepo.createQueryBuilder('c').orderBy('c.id', 'DESC').skip(p * s).take(s);
    if (search && search.trim()) {
      qb.where('c.code ILIKE :q', { q: `%${search.trim()}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return PageResponse.of(items, total, p, s);
  }

  async getCouponById(id: number): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException(`Coupon ${id} not found`);
    return coupon;
  }

  async toggleCouponStatus(id: number): Promise<Coupon> {
    const coupon = await this.getCouponById(id);
    coupon.isActive = !coupon.isActive;
    return this.couponRepo.save(coupon);
  }

  async upsertCoupon(body: any, id?: number): Promise<Coupon> {
    let coupon = id ? await this.couponRepo.findOne({ where: { id } }) : null;
    const code = String(body?.code || '').trim().toUpperCase();
    if (!coupon && !code) {
      throw new BadRequestException('Coupon code is required');
    }

    if (!coupon) {
      coupon = await this.couponRepo.findOne({ where: { code } });
    }

    if (!coupon) {
      coupon = this.couponRepo.create({
        code,
        description: body?.description || null,
        discountType: (body?.discountType || body?.discount_type || 'PERCENTAGE').toUpperCase(),
        discountValue: Number(body?.discountValue ?? body?.discount_value ?? 10),
        maxDiscountAmount:
          body?.maxDiscountAmount ?? body?.maximumDiscount ?? body?.maximum_discount
            ? Number(body?.maxDiscountAmount ?? body?.maximumDiscount ?? body?.maximum_discount)
            : null,
        minOrderAmount: Number(body?.minOrderAmount ?? body?.minimumAmount ?? body?.minimum_amount ?? 0),
        usageLimit:
          body?.usageLimit ?? body?.maxUses ?? body?.usage_limit
            ? Number(body?.usageLimit ?? body?.maxUses ?? body?.usage_limit)
            : null,
        usagePerUser:
          body?.usagePerUser ?? body?.usage_per_user
            ? Number(body?.usagePerUser ?? body?.usage_per_user)
            : 1,
        validFrom: body?.validFrom ? new Date(body.validFrom) : new Date(),
        validUntil: body?.validUntil ? new Date(body.validUntil) : null,
        applicablePlanId: body?.applicablePlanId ? Number(body.applicablePlanId) : null,
        isActive:
          body?.isActive !== undefined
            ? Boolean(body.isActive)
            : body?.active !== undefined
            ? Boolean(body.active)
            : true,
      } as any) as unknown as Coupon;
    } else {
      if (code) coupon.code = code;
      if (body.description !== undefined) coupon.description = body.description;
      if (body.discountType !== undefined || body.discount_type !== undefined) {
        coupon.discountType = String(body.discountType ?? body.discount_type).toUpperCase();
      }
      if (body.discountValue !== undefined || body.discount_value !== undefined) {
        coupon.discountValue = Number(body.discountValue ?? body.discount_value);
      }
      if (body.maxDiscountAmount !== undefined || body.maximumDiscount !== undefined || body.maximum_discount !== undefined) {
        const md = body.maxDiscountAmount ?? body.maximumDiscount ?? body.maximum_discount;
        coupon.maxDiscountAmount = md ? Number(md) : null;
      }
      if (body.minOrderAmount !== undefined || body.minimumAmount !== undefined || body.minimum_amount !== undefined) {
        coupon.minOrderAmount = Number(body.minOrderAmount ?? body.minimumAmount ?? body.minimum_amount ?? 0);
      }
      if (body.usageLimit !== undefined || body.maxUses !== undefined || body.usage_limit !== undefined) {
        const limit = body.usageLimit ?? body.maxUses ?? body.usage_limit;
        coupon.usageLimit = limit ? Number(limit) : null;
      }
      if (body.usagePerUser !== undefined || body.usage_per_user !== undefined) {
        const upu = body.usagePerUser ?? body.usage_per_user;
        coupon.usagePerUser = upu ? Number(upu) : 1;
      }
      if (body.validUntil !== undefined) coupon.validUntil = body.validUntil ? new Date(body.validUntil) : null;
      if (body.isActive !== undefined || body.active !== undefined) {
        coupon.isActive = Boolean(body.isActive ?? body.active);
      }
    }

    return this.couponRepo.save(coupon);
  }

  async deleteCoupon(id: number): Promise<any> {
    await this.couponRepo.delete(id);
    return { id, deleted: true };
  }

  async validateAndCalculateCoupon(
    code: string,
    orderAmount: number,
    planId?: number,
  ): Promise<{
    coupon: Coupon;
    discountAmount: number;
    finalAmount: number;
  }> {
    const cleanCode = String(code || '').trim().toUpperCase();
    const coupon = await this.couponRepo.findOne({ where: { code: cleanCode, isActive: true } });
    if (!coupon) {
      throw new BusinessException('Invalid or inactive coupon code', 'INVALID_COUPON');
    }

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BusinessException('Coupon is not yet active', 'COUPON_NOT_STARTED');
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BusinessException('Coupon has expired', 'COUPON_EXPIRED');
    }
    const usedCount = Number(coupon.usedCount || 0);
    if (coupon.usageLimit && usedCount >= Number(coupon.usageLimit)) {
      throw new BusinessException('Coupon usage limit reached', 'COUPON_LIMIT_EXCEEDED');
    }
    if (coupon.applicablePlanId) {
      if (!planId || Number(coupon.applicablePlanId) !== Number(planId)) {
        throw new BusinessException('Coupon is not applicable to the selected plan', 'COUPON_PLAN_MISMATCH');
      }
    }
    if (orderAmount < Number(coupon.minOrderAmount || 0)) {
      throw new BusinessException(
        `Minimum order amount of ${coupon.minOrderAmount} required for this coupon`,
        'COUPON_MIN_AMOUNT',
      );
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = Number(((orderAmount * Number(coupon.discountValue)) / 100).toFixed(2));
      if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
        discountAmount = Number(coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    discountAmount = Math.min(orderAmount, discountAmount);
    const finalAmount = Number(Math.max(0, orderAmount - discountAmount).toFixed(2));

    return {
      coupon,
      discountAmount,
      finalAmount,
    };
  }
}
