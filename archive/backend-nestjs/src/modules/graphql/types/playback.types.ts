import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('PlaybackStream')
export class PlaybackStreamType {
  @Field(() => ID)
  contentId: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  streamUrl?: string;

  @Field({ nullable: true })
  videoUrl?: string;

  @Field({ nullable: true })
  token?: string;

  @Field({ defaultValue: false })
  drmEnabled: boolean;

  @Field({ nullable: true })
  drmLicenseUrl?: string;

  @Field(() => [String], { defaultValue: [] })
  adTags: string[];
}

@InputType('WatchProgressInput')
export class WatchProgressInput {
  @Field(() => ID)
  contentId: string;

  @Field(() => ID, { nullable: true })
  episodeId?: string;

  @Field(() => Int)
  progressMs: number;

  @Field(() => Int)
  durationMs: number;
}

@ObjectType('WatchHistoryItem')
export class WatchHistoryItemType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  contentId: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  posterUrl?: string;

  @Field(() => Int, { defaultValue: 0 })
  progressMs: number;

  @Field(() => Int, { defaultValue: 0 })
  durationMs: number;

  @Field({ defaultValue: false })
  completed: boolean;

  @Field({ nullable: true })
  updatedAt?: string;
}

