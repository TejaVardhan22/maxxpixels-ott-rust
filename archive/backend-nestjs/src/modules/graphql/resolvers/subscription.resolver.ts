import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../../common/decorators/auth.decorators';
import { PlanService } from '../../subscriptions/services/plan.service';
import { SubscriptionPlanType } from '../types/subscription.types';

@Resolver()
export class SubscriptionResolver {
  constructor(private readonly planService: PlanService) {}

  @Public()
  @Query(() => [SubscriptionPlanType], { description: 'Get all available subscription membership plans' })
  async subscriptionPlans(): Promise<SubscriptionPlanType[]> {
    const plans = await this.planService.listPlans(true);
    return (plans || []).map((p: any) => ({
      id: String(p.id),
      name: p.name || 'Premium Plan',
      description: p.description || '',
      price: Number(p.effectivePrice ?? p.price ?? 0),
      currency: p.currency || 'INR',
      durationDays: Number(p.durationDays || p.validityDays || 30),
      maxScreens: Number(p.maxScreens || p.maxDevices || 1),
      quality: p.videoQuality || p.quality || 'HD',
      features: Array.isArray(p.features)
        ? p.features
        : typeof p.features === 'string'
        ? p.features.split(',').map((f: string) => f.trim())
        : [],
      isActive: Boolean(p.isActive !== false),
    }));
  }
}

