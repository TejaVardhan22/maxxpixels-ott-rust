import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SubProfile')
export class SubProfileType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ defaultValue: false })
  isKids: boolean;

  @Field({ defaultValue: false })
  isPinProtected: boolean;
}

@ObjectType('ActiveSubscription')
export class ActiveSubscriptionType {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field({ nullable: true })
  planId?: string;

  @Field({ nullable: true })
  planName?: string;

  @Field({ defaultValue: 'INACTIVE' })
  status: string;

  @Field({ nullable: true })
  startsAt?: string;

  @Field({ nullable: true })
  expiresAt?: string;
}

@ObjectType('UserProfile')
export class UserProfileType {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ defaultValue: 'USER' })
  role: string;

  @Field(() => ActiveSubscriptionType, { nullable: true })
  activeSubscription?: ActiveSubscriptionType;

  @Field(() => [SubProfileType], { defaultValue: [] })
  subProfiles: SubProfileType[];
}

@ObjectType('UserDevice')
export class UserDeviceType {
  @Field(() => ID)
  id: string;

  @Field()
  deviceId: string;

  @Field({ nullable: true })
  deviceName?: string;

  @Field({ nullable: true })
  deviceType?: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  lastActiveAt?: string;
}

