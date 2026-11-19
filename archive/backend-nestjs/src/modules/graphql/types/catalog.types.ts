import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ContentCast')
export class ContentCastType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  characterName?: string;

  @Field({ nullable: true })
  role?: string;

  @Field({ nullable: true })
  imageUrl?: string;
}

@ObjectType('EpisodeItem')
export class EpisodeItemType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { defaultValue: 1 })
  episodeNumber: number;

  @Field(() => Int, { defaultValue: 1 })
  seasonNumber: number;

  @Field(() => Int, { defaultValue: 0 })
  duration: number;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field({ nullable: true })
  videoUrl?: string;
}

@ObjectType('ContentItem')
export class ContentItemType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  posterUrl?: string;

  @Field({ nullable: true })
  bannerUrl?: string;

  @Field({ nullable: true })
  trailerUrl?: string;

  @Field(() => Int, { defaultValue: 1 })
  videoType: number; // 1 = Movie, 2 = Series, 3 = Short, etc.

  @Field(() => Int, { defaultValue: 1 })
  typeId: number;

  @Field({ defaultValue: 0 })
  rating: number;

  @Field(() => Int, { defaultValue: 0 })
  duration: number;

  @Field(() => Int, { nullable: true })
  releaseYear?: number;

  @Field({ defaultValue: false })
  isPremium: boolean;

  @Field(() => [String], { defaultValue: [] })
  genres: string[];

  @Field(() => [String], { defaultValue: [] })
  languages: string[];
}

@ObjectType('ContentDetail')
export class ContentDetailType extends ContentItemType {
  @Field({ nullable: true })
  videoUrl?: string;

  @Field({ defaultValue: false })
  isRented: boolean;

  @Field({ defaultValue: false })
  isWatchlisted: boolean;

  @Field(() => [EpisodeItemType], { defaultValue: [] })
  episodes: EpisodeItemType[];

  @Field(() => [ContentCastType], { defaultValue: [] })
  cast: ContentCastType[];

  @Field(() => [ContentItemType], { defaultValue: [] })
  relatedContent: ContentItemType[];
}

@ObjectType('HomeSection')
export class HomeSectionType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field(() => Int, { defaultValue: 1 })
  videoType: number;

  @Field({ defaultValue: false })
  landscape: boolean;

  @Field(() => [ContentItemType], { defaultValue: [] })
  items: ContentItemType[];
}

@ObjectType('HomeBanner')
export class HomeBannerType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  subtitle?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  mobileImageUrl?: string;

  @Field(() => ID, { nullable: true })
  contentId?: string;

  @Field({ nullable: true })
  pageSlug?: string;

  @Field(() => ContentItemType, { nullable: true })
  content?: ContentItemType;
}

@ObjectType('CategoryItem')
export class CategoryType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field(() => Int, { defaultValue: 0 })
  typeId: number;
}

@ObjectType('LanguageItem')
export class LanguageType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  code: string;

  @Field({ nullable: true })
  nativeName?: string;
}

@ObjectType('HomeCatalog')
export class HomeCatalogType {
  @Field(() => [HomeBannerType], { defaultValue: [] })
  banners: HomeBannerType[];

  @Field(() => [HomeSectionType], { defaultValue: [] })
  sections: HomeSectionType[];

  @Field(() => [CategoryType], { defaultValue: [] })
  categories: CategoryType[];

  @Field(() => [LanguageType], { defaultValue: [] })
  languages: LanguageType[];
}

