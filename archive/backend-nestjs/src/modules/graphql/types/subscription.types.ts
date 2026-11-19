import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SubscriptionPlan')
export class SubscriptionPlanType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price: number;

  @Field({ defaultValue: 'INR' })
  currency: string;

  @Field(() => Int, { defaultValue: 30 })
  durationDays: number;

  @Field(() => Int, { defaultValue: 1 })
  maxScreens: number;

  @Field({ nullable: true })
  quality?: string;

  @Field(() => [String], { defaultValue: [] })
  features: string[];

  @Field({ defaultValue: true })
  isActive: boolean;
}

