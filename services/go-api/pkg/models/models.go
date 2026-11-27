// Code generated from services/api/crates/core/src/entities/*.rs; 1:1 PostgreSQL schema mapping.
package models

import "time"

type AdCampaign struct {
	ID                   int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	AdBreakType          *string    `gorm:"column:ad_break_type" json:"adBreakType,omitempty"`
	AdvertiserName       *string    `gorm:"column:advertiser_name" json:"advertiserName,omitempty"`
	CampaignName         string     `gorm:"column:campaign_name" json:"campaignName,omitempty"`
	ClickUrl             *string    `gorm:"column:click_url" json:"clickUrl,omitempty"`
	CpmRate              *float64   `gorm:"column:cpm_rate" json:"cpmRate,omitempty"`
	CreatedAt            time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	DurationSeconds      *int32     `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	ImpressionsDelivered *int64     `gorm:"column:impressions_delivered" json:"impressionsDelivered,omitempty"`
	ImpressionsTarget    *int64     `gorm:"column:impressions_target" json:"impressionsTarget,omitempty"`
	Provider             *string    `gorm:"column:provider" json:"provider,omitempty"`
	SpentBudget          *float64   `gorm:"column:spent_budget" json:"spentBudget,omitempty"`
	Status               *string    `gorm:"column:status" json:"status,omitempty"`
	StreamVideoId        *string    `gorm:"column:stream_video_id" json:"streamVideoId,omitempty"`
	TargetDevices        *string    `gorm:"column:target_devices" json:"targetDevices,omitempty"`
	ThumbnailUrl         *string    `gorm:"column:thumbnail_url" json:"thumbnailUrl,omitempty"`
	TotalBudget          *float64   `gorm:"column:total_budget" json:"totalBudget,omitempty"`
	VastTagUrl           *string    `gorm:"column:vast_tag_url" json:"vastTagUrl,omitempty"`
	VideoUrl             *string    `gorm:"column:video_url" json:"videoUrl,omitempty"`
	Name                 *string    `gorm:"column:name" json:"name,omitempty"`
	BunnyVideoGuid       *string    `gorm:"column:bunny_video_guid" json:"bunnyVideoGuid,omitempty"`
	AdType               *string    `gorm:"column:ad_type" json:"adType,omitempty"`
	SkipOffsetSeconds    *int32     `gorm:"column:skip_offset_seconds" json:"skipOffsetSeconds,omitempty"`
	TargetContentType    *string    `gorm:"column:target_content_type" json:"targetContentType,omitempty"`
	TargetLanguage       *string    `gorm:"column:target_language" json:"targetLanguage,omitempty"`
	BudgetAmount         *string    `gorm:"column:budget_amount" json:"budgetAmount,omitempty"`
	ImpressionsCount     *int64     `gorm:"column:impressions_count" json:"impressionsCount,omitempty"`
	ClicksCount          *int64     `gorm:"column:clicks_count" json:"clicksCount,omitempty"`
	StartDate            *time.Time `gorm:"column:start_date" json:"startDate,omitempty"`
	EndDate              *time.Time `gorm:"column:end_date" json:"endDate,omitempty"`
	IsActive             *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	ClickThroughUrl      *string    `gorm:"column:click_through_url" json:"clickThroughUrl,omitempty"`
	UpdatedAt            *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (AdCampaign) TableName() string { return "ad_campaigns" }

type AdEvent struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	SessionToken string     `gorm:"column:session_token" json:"sessionToken,omitempty"`
	CampaignId   *int64     `gorm:"column:campaign_id" json:"campaignId,omitempty"`
	ProviderCode *string    `gorm:"column:provider_code" json:"providerCode,omitempty"`
	EventType    string     `gorm:"column:event_type" json:"eventType,omitempty"`
	ContentId    *int64     `gorm:"column:content_id" json:"contentId,omitempty"`
	ProducerId   *int64     `gorm:"column:producer_id" json:"producerId,omitempty"`
	DedupKey     string     `gorm:"column:dedup_key" json:"dedupKey,omitempty"`
	RevenuePaise *int32     `gorm:"column:revenue_paise" json:"revenuePaise,omitempty"`
	Metadata     *string    `gorm:"column:metadata" json:"metadata,omitempty"`
	CreatedAt    *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (AdEvent) TableName() string { return "ad_events" }

type AdPlacement struct {
	ID                  int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Code                string     `gorm:"column:code" json:"code,omitempty"`
	Name                string     `gorm:"column:name" json:"name,omitempty"`
	Format              *string    `gorm:"column:format" json:"format,omitempty"`
	Platform            *string    `gorm:"column:platform" json:"platform,omitempty"`
	CuePointSeconds     *int32     `gorm:"column:cue_point_seconds" json:"cuePointSeconds,omitempty"`
	MaxDurationSeconds  *int32     `gorm:"column:max_duration_seconds" json:"maxDurationSeconds,omitempty"`
	SkipOffsetSeconds   *int32     `gorm:"column:skip_offset_seconds" json:"skipOffsetSeconds,omitempty"`
	FrequencyCapPerHour *int32     `gorm:"column:frequency_cap_per_hour" json:"frequencyCapPerHour,omitempty"`
	IsActive            *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	CreatedAt           *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt           *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (AdPlacement) TableName() string { return "ad_placements" }

type AdProvider struct {
	ID               int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Code             string     `gorm:"column:code" json:"code,omitempty"`
	Name             string     `gorm:"column:name" json:"name,omitempty"`
	Type             *string    `gorm:"column:type" json:"type,omitempty"`
	NetworkCode      *string    `gorm:"column:network_code" json:"networkCode,omitempty"`
	PublisherId      *string    `gorm:"column:publisher_id" json:"publisherId,omitempty"`
	AppId            *string    `gorm:"column:app_id" json:"appId,omitempty"`
	AccountId        *string    `gorm:"column:account_id" json:"accountId,omitempty"`
	IsActive         *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	IsBiddingEnabled *bool      `gorm:"column:is_bidding_enabled" json:"isBiddingEnabled,omitempty"`
	Status           *string    `gorm:"column:status" json:"status,omitempty"`
	CreatedAt        *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt        *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (AdProvider) TableName() string { return "ad_providers" }

type Banner struct {
	ID             int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	ActionUrl      *string    `gorm:"column:action_url" json:"actionUrl,omitempty"`
	DisplayOrder   *int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	ImageUrl       *string    `gorm:"column:image_url" json:"imageUrl,omitempty"`
	IsActive       *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	Title          string     `gorm:"column:title" json:"title,omitempty"`
	ContentId      *int64     `gorm:"column:content_id" json:"contentId,omitempty"`
	Subtitle       *string    `gorm:"column:subtitle" json:"subtitle,omitempty"`
	MobileImageUrl *string    `gorm:"column:mobile_image_url" json:"mobileImageUrl,omitempty"`
	TrailerUrl     *string    `gorm:"column:trailer_url" json:"trailerUrl,omitempty"`
	TargetUrl      *string    `gorm:"column:target_url" json:"targetUrl,omitempty"`
	Placement      *string    `gorm:"column:placement" json:"placement,omitempty"`
	PageSlug       *string    `gorm:"column:page_slug" json:"pageSlug,omitempty"`
	StartTime      *time.Time `gorm:"column:start_time" json:"startTime,omitempty"`
	EndTime        *time.Time `gorm:"column:end_time" json:"endTime,omitempty"`
	CreatedAt      *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Banner) TableName() string { return "banners" }

type Category struct {
	ID           int64   `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Name         string  `gorm:"column:name" json:"name,omitempty"`
	Slug         string  `gorm:"column:slug" json:"slug,omitempty"`
	Description  *string `gorm:"column:description" json:"description,omitempty"`
	DisplayOrder *int32  `gorm:"column:display_order" json:"displayOrder,omitempty"`
	ImageUrl     *string `gorm:"column:image_url" json:"imageUrl,omitempty"`
	IsActive     *bool   `gorm:"column:is_active" json:"isActive,omitempty"`
}

func (Category) TableName() string { return "categories" }

type Content struct {
	ID                   int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Title                string     `gorm:"column:title" json:"title,omitempty"`
	Slug                 string     `gorm:"column:slug" json:"slug,omitempty"`
	Description          *string    `gorm:"column:description" json:"description,omitempty"`
	ShortDescription     *string    `gorm:"column:short_description" json:"shortDescription,omitempty"`
	ContentType          *string    `gorm:"column:content_type" json:"contentType,omitempty"`
	Type                 *string    `gorm:"column:type" json:"type,omitempty"`
	Status               string     `gorm:"column:status" json:"status,omitempty"`
	AccessType           *string    `gorm:"column:access_type" json:"accessType,omitempty"`
	Monetization         *string    `gorm:"column:monetization" json:"monetization,omitempty"`
	RentPrice            *float64   `gorm:"column:rent_price" json:"rentPrice,omitempty"`
	ValidityHours        *int32     `gorm:"column:validity_hours" json:"validityHours,omitempty"`
	ReleaseYear          *int32     `gorm:"column:release_year" json:"releaseYear,omitempty"`
	ReleaseDate          *time.Time `gorm:"column:release_date" json:"releaseDate,omitempty"`
	AgeRating            *string    `gorm:"column:age_rating" json:"ageRating,omitempty"`
	PosterUrl            *string    `gorm:"column:poster_url" json:"posterUrl,omitempty"`
	Poster2Url           *string    `gorm:"column:poster_2_url" json:"poster2Url,omitempty"`
	BackdropUrl          *string    `gorm:"column:backdrop_url" json:"backdropUrl,omitempty"`
	LandscapeImageUrl    *string    `gorm:"column:landscape_image_url" json:"landscapeImageUrl,omitempty"`
	LogoImageUrl         *string    `gorm:"column:logo_image_url" json:"logoImageUrl,omitempty"`
	BannerImageUrl       *string    `gorm:"column:banner_image_url" json:"bannerImageUrl,omitempty"`
	TrailerUrl           *string    `gorm:"column:trailer_url" json:"trailerUrl,omitempty"`
	SubtitlesJson        *string    `gorm:"column:subtitles_json" json:"subtitlesJson,omitempty"`
	AudioTracksJson      *string    `gorm:"column:audio_tracks_json" json:"audioTracksJson,omitempty"`
	CastJson             *string    `gorm:"column:cast_json" json:"castJson,omitempty"`
	ContentWarnings      *string    `gorm:"column:content_warnings" json:"contentWarnings,omitempty"`
	QualityBadges        *string    `gorm:"column:quality_badges" json:"qualityBadges,omitempty"`
	SkipIntroStart       *int32     `gorm:"column:skip_intro_start" json:"skipIntroStart,omitempty"`
	SkipIntroEnd         *int32     `gorm:"column:skip_intro_end" json:"skipIntroEnd,omitempty"`
	SkipOutroStart       *int32     `gorm:"column:skip_outro_start" json:"skipOutroStart,omitempty"`
	ScheduledPublishAt   *time.Time `gorm:"column:scheduled_publish_at" json:"scheduledPublishAt,omitempty"`
	ExpiresAt            *time.Time `gorm:"column:expires_at" json:"expiresAt,omitempty"`
	DurationSeconds      *int32     `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	OriginalLanguageCode *string    `gorm:"column:original_language_code" json:"originalLanguageCode,omitempty"`
	IsPremium            *bool      `gorm:"column:is_premium" json:"isPremium,omitempty"`
	IsFeatured           *bool      `gorm:"column:is_featured" json:"isFeatured,omitempty"`
	IsTrending           *bool      `gorm:"column:is_trending" json:"isTrending,omitempty"`
	IsOriginal           *bool      `gorm:"column:is_original" json:"isOriginal,omitempty"`
	ViewCount            *int64     `gorm:"column:view_count" json:"viewCount,omitempty"`
	ProducerId           *int64     `gorm:"column:producer_id" json:"producerId,omitempty"`
	ContentTypeId        *int64     `gorm:"column:content_type_id" json:"contentTypeId,omitempty"`
	ProductionName       *string    `gorm:"column:production_name" json:"productionName,omitempty"`
	ProducerContactPhone *string    `gorm:"column:producer_contact_phone" json:"producerContactPhone,omitempty"`
	ProducerEmail        *string    `gorm:"column:producer_email" json:"producerEmail,omitempty"`
	GoogleDriveLink      *string    `gorm:"column:google_drive_link" json:"googleDriveLink,omitempty"`
	OneLineBrief         *string    `gorm:"column:one_line_brief" json:"oneLineBrief,omitempty"`
	SubmissionSource     *string    `gorm:"column:submission_source" json:"submissionSource,omitempty"`
	AgreementUrl         *string    `gorm:"column:agreement_url" json:"agreementUrl,omitempty"`
	AgreementStatus      *string    `gorm:"column:agreement_status" json:"agreementStatus,omitempty"`
	DrmRuleId            *int64     `gorm:"column:drm_rule_id" json:"drmRuleId,omitempty"`
	CreatedAt            time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt            time.Time  `gorm:"column:updated_at" json:"updatedAt,omitempty"`
	PublishedAt          *time.Time `gorm:"column:published_at" json:"publishedAt,omitempty"`
}

func (Content) TableName() string { return "contents" }

type ContentCategory struct {
	ContentId  int64 `gorm:"column:content_id;primaryKey" json:"contentId,omitempty"`
	CategoryId int64 `gorm:"column:category_id;primaryKey" json:"categoryId,omitempty"`
}

func (ContentCategory) TableName() string { return "content_categories" }

type ContentGenre struct {
	ContentId int64 `gorm:"column:content_id;primaryKey" json:"contentId,omitempty"`
	GenreId   int64 `gorm:"column:genre_id;primaryKey" json:"genreId,omitempty"`
}

func (ContentGenre) TableName() string { return "content_genres" }

type ContentPurchase struct {
	ID             int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Price          float64    `gorm:"column:price" json:"price,omitempty"`
	PurchaseType   string     `gorm:"column:purchase_type" json:"purchaseType,omitempty"`
	PurchasedAt    time.Time  `gorm:"column:purchased_at" json:"purchasedAt,omitempty"`
	TvodProductId  *int64     `gorm:"column:tvod_product_id" json:"tvodProductId,omitempty"`
	ValidUntil     *time.Time `gorm:"column:valid_until" json:"validUntil,omitempty"`
	ContentId      int64      `gorm:"column:content_id" json:"contentId,omitempty"`
	UserId         int64      `gorm:"column:user_id" json:"userId,omitempty"`
	AmountPaid     *float64   `gorm:"column:amount_paid" json:"amountPaid,omitempty"`
	Currency       *string    `gorm:"column:currency" json:"currency,omitempty"`
	PaymentId      *string    `gorm:"column:payment_id" json:"paymentId,omitempty"`
	Status         *string    `gorm:"column:status" json:"status,omitempty"`
	ExpiresAt      *time.Time `gorm:"column:expires_at" json:"expiresAt,omitempty"`
	FirstWatchedAt *time.Time `gorm:"column:first_watched_at" json:"firstWatchedAt,omitempty"`
}

func (ContentPurchase) TableName() string { return "content_purchases" }

type ContentType struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Slug         string     `gorm:"column:slug" json:"slug,omitempty"`
	Title        string     `gorm:"column:title" json:"title,omitempty"`
	Name         *string    `gorm:"column:name" json:"name,omitempty"`
	Description  *string    `gorm:"column:description" json:"description,omitempty"`
	IconUrl      *string    `gorm:"column:icon_url" json:"iconUrl,omitempty"`
	DisplayOrder *int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	IsActive     *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	CreatedAt    *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt    *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (ContentType) TableName() string { return "content_types" }

type Coupon struct {
	ID                int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Code              string     `gorm:"column:code" json:"code,omitempty"`
	Description       *string    `gorm:"column:description" json:"description,omitempty"`
	DiscountType      string     `gorm:"column:discount_type" json:"discountType,omitempty"`
	DiscountValue     float64    `gorm:"column:discount_value" json:"discountValue,omitempty"`
	IsActive          *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	MaximumDiscount   *float64   `gorm:"column:maximum_discount" json:"maximumDiscount,omitempty"`
	MaxDiscountAmount *float64   `gorm:"column:max_discount_amount" json:"maxDiscountAmount,omitempty"`
	MinimumAmount     *float64   `gorm:"column:minimum_amount" json:"minimumAmount,omitempty"`
	MinOrderAmount    *float64   `gorm:"column:min_order_amount" json:"minOrderAmount,omitempty"`
	UsageLimit        *int32     `gorm:"column:usage_limit" json:"usageLimit,omitempty"`
	UsagePerUser      *int32     `gorm:"column:usage_per_user" json:"usagePerUser,omitempty"`
	UsedCount         *int32     `gorm:"column:used_count" json:"usedCount,omitempty"`
	ApplicablePlanId  *int64     `gorm:"column:applicable_plan_id" json:"applicablePlanId,omitempty"`
	ValidFrom         *time.Time `gorm:"column:valid_from" json:"validFrom,omitempty"`
	ValidUntil        *time.Time `gorm:"column:valid_until" json:"validUntil,omitempty"`
	CreatedAt         *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Coupon) TableName() string { return "coupons" }

type Device struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	UserId       int64      `gorm:"column:user_id" json:"userId,omitempty"`
	DeviceId     string     `gorm:"column:device_id" json:"deviceId,omitempty"`
	DeviceName   *string    `gorm:"column:device_name" json:"deviceName,omitempty"`
	DeviceModel  *string    `gorm:"column:device_model" json:"deviceModel,omitempty"`
	DeviceType   *string    `gorm:"column:device_type" json:"deviceType,omitempty"`
	Platform     *string    `gorm:"column:platform" json:"platform,omitempty"`
	OsVersion    *string    `gorm:"column:os_version" json:"osVersion,omitempty"`
	AppVersion   *string    `gorm:"column:app_version" json:"appVersion,omitempty"`
	FcmToken     *string    `gorm:"column:fcm_token" json:"fcmToken,omitempty"`
	IpAddress    *string    `gorm:"column:ip_address" json:"ipAddress,omitempty"`
	IsActive     *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	LastSeen     *time.Time `gorm:"column:last_seen" json:"lastSeen,omitempty"`
	LastActiveAt *time.Time `gorm:"column:last_active_at" json:"lastActiveAt,omitempty"`
	CreatedAt    time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Device) TableName() string { return "devices" }

type Episode struct {
	ID              int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Description     *string    `gorm:"column:description" json:"description,omitempty"`
	DurationSeconds *int32     `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	EpisodeNumber   int32      `gorm:"column:episode_number" json:"episodeNumber,omitempty"`
	IsPremium       *bool      `gorm:"column:is_premium" json:"isPremium,omitempty"`
	PublishedAt     *time.Time `gorm:"column:published_at" json:"publishedAt,omitempty"`
	StillImageUrl   *string    `gorm:"column:still_image_url" json:"stillImageUrl,omitempty"`
	Title           string     `gorm:"column:title" json:"title,omitempty"`
	VideoAssetId    *string    `gorm:"column:video_asset_id" json:"videoAssetId,omitempty"`
	SeasonId        int64      `gorm:"column:season_id" json:"seasonId,omitempty"`
	Synopsis        *string    `gorm:"column:synopsis" json:"synopsis,omitempty"`
	DurationMinutes *int32     `gorm:"column:duration_minutes" json:"durationMinutes,omitempty"`
	ThumbnailUrl    *string    `gorm:"column:thumbnail_url" json:"thumbnailUrl,omitempty"`
	VideoUrl        *string    `gorm:"column:video_url" json:"videoUrl,omitempty"`
	BunnyVideoGuid  *string    `gorm:"column:bunny_video_guid" json:"bunnyVideoGuid,omitempty"`
	AccessType      *string    `gorm:"column:access_type" json:"accessType,omitempty"`
	IsFreePreview   *bool      `gorm:"column:is_free_preview" json:"isFreePreview,omitempty"`
	Status          *string    `gorm:"column:status" json:"status,omitempty"`
	ReleaseDate     *time.Time `gorm:"column:release_date" json:"releaseDate,omitempty"`
	CreatedAt       *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt       *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (Episode) TableName() string { return "episodes" }

type Genre struct {
	ID          int64   `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Name        string  `gorm:"column:name" json:"name,omitempty"`
	Slug        string  `gorm:"column:slug" json:"slug,omitempty"`
	Description *string `gorm:"column:description" json:"description,omitempty"`
	IconUrl     *string `gorm:"column:icon_url" json:"iconUrl,omitempty"`
	ImageUrl    *string `gorm:"column:image_url" json:"imageUrl,omitempty"`
	IsActive    *bool   `gorm:"column:is_active" json:"isActive,omitempty"`
}

func (Genre) TableName() string { return "genres" }

type IntroVideo struct {
	ID           int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Title        string    `gorm:"column:title" json:"title,omitempty"`
	Description  *string   `gorm:"column:description" json:"description,omitempty"`
	VideoUrl     string    `gorm:"column:video_url" json:"videoUrl,omitempty"`
	PosterUrl    *string   `gorm:"column:poster_url" json:"posterUrl,omitempty"`
	CtaLabel     *string   `gorm:"column:cta_label" json:"ctaLabel,omitempty"`
	IsActive     bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	DisplayOrder int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (IntroVideo) TableName() string { return "intro_videos" }

type Language struct {
	ID           int64   `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Code         string  `gorm:"column:code" json:"code,omitempty"`
	Name         string  `gorm:"column:name" json:"name,omitempty"`
	NativeName   *string `gorm:"column:native_name" json:"nativeName,omitempty"`
	IconUrl      *string `gorm:"column:icon_url" json:"iconUrl,omitempty"`
	IsDefault    *bool   `gorm:"column:is_default" json:"isDefault,omitempty"`
	IsActive     *bool   `gorm:"column:is_active" json:"isActive,omitempty"`
	DisplayOrder *int32  `gorm:"column:display_order" json:"displayOrder,omitempty"`
}

func (Language) TableName() string { return "languages" }

type LegalPage struct {
	ID          int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Content     string    `gorm:"column:content" json:"content,omitempty"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	IsPublished *bool     `gorm:"column:is_published" json:"isPublished,omitempty"`
	Slug        string    `gorm:"column:slug" json:"slug,omitempty"`
	Title       string    `gorm:"column:title" json:"title,omitempty"`
	UpdatedAt   time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
	Version     *string   `gorm:"column:version" json:"version,omitempty"`
	IsActive    *bool     `gorm:"column:is_active" json:"isActive,omitempty"`
}

func (LegalPage) TableName() string { return "legal_pages" }

type LiveChannel struct {
	ID             int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	EpgUrl         *string    `gorm:"column:epg_url" json:"epgUrl,omitempty"`
	IsActive       *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	IsDrmProtected *bool      `gorm:"column:is_drm_protected" json:"isDrmProtected,omitempty"`
	LogoUrl        *string    `gorm:"column:logo_url" json:"logoUrl,omitempty"`
	Name           string     `gorm:"column:name" json:"name,omitempty"`
	Slug           string     `gorm:"column:slug" json:"slug,omitempty"`
	StreamUrl      string     `gorm:"column:stream_url" json:"streamUrl,omitempty"`
	Description    *string    `gorm:"column:description" json:"description,omitempty"`
	PosterUrl      *string    `gorm:"column:poster_url" json:"posterUrl,omitempty"`
	HlsStreamUrl   *string    `gorm:"column:hls_stream_url" json:"hlsStreamUrl,omitempty"`
	DrmLicenseUrl  *string    `gorm:"column:drm_license_url" json:"drmLicenseUrl,omitempty"`
	Category       *string    `gorm:"column:category" json:"category,omitempty"`
	LanguageCode   *string    `gorm:"column:language_code" json:"languageCode,omitempty"`
	AccessType     *string    `gorm:"column:access_type" json:"accessType,omitempty"`
	ChannelNumber  *int32     `gorm:"column:channel_number" json:"channelNumber,omitempty"`
	IsLive         *bool      `gorm:"column:is_live" json:"isLive,omitempty"`
	IsPremium      *bool      `gorm:"column:is_premium" json:"isPremium,omitempty"`
	DisplayOrder   *int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	CreatedAt      *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (LiveChannel) TableName() string { return "live_channels" }

type LiveEvent struct {
	ID             int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	EndTime        time.Time  `gorm:"column:end_time" json:"endTime,omitempty"`
	IsDrmProtected *bool      `gorm:"column:is_drm_protected" json:"isDrmProtected,omitempty"`
	IsPremium      *bool      `gorm:"column:is_premium" json:"isPremium,omitempty"`
	PosterUrl      *string    `gorm:"column:poster_url" json:"posterUrl,omitempty"`
	Slug           string     `gorm:"column:slug" json:"slug,omitempty"`
	StartTime      time.Time  `gorm:"column:start_time" json:"startTime,omitempty"`
	Status         string     `gorm:"column:status" json:"status,omitempty"`
	StreamUrl      string     `gorm:"column:stream_url" json:"streamUrl,omitempty"`
	Title          string     `gorm:"column:title" json:"title,omitempty"`
	Description    *string    `gorm:"column:description" json:"description,omitempty"`
	HlsStreamUrl   *string    `gorm:"column:hls_stream_url" json:"hlsStreamUrl,omitempty"`
	ChannelId      *int64     `gorm:"column:channel_id" json:"channelId,omitempty"`
	ScheduledStart *time.Time `gorm:"column:scheduled_start" json:"scheduledStart,omitempty"`
	ScheduledEnd   *time.Time `gorm:"column:scheduled_end" json:"scheduledEnd,omitempty"`
	AccessType     *string    `gorm:"column:access_type" json:"accessType,omitempty"`
	IsPpv          *bool      `gorm:"column:is_ppv" json:"isPpv,omitempty"`
	PpvPrice       *float64   `gorm:"column:ppv_price" json:"ppvPrice,omitempty"`
	CreatedAt      *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (LiveEvent) TableName() string { return "live_events" }

type MarketingAgent struct {
	ID            int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	AgentCode     string    `gorm:"column:agent_code" json:"agentCode,omitempty"`
	FullName      string    `gorm:"column:full_name" json:"fullName,omitempty"`
	MobileNumber  string    `gorm:"column:mobile_number" json:"mobileNumber,omitempty"`
	Email         string    `gorm:"column:email" json:"email,omitempty"`
	AadhaarNumber *string   `gorm:"column:aadhaar_number" json:"aadhaarNumber,omitempty"`
	PanNumber     *string   `gorm:"column:pan_number" json:"panNumber,omitempty"`
	AadhaarDocUrl *string   `gorm:"column:aadhaar_doc_url" json:"aadhaarDocUrl,omitempty"`
	PanDocUrl     *string   `gorm:"column:pan_doc_url" json:"panDocUrl,omitempty"`
	Status        string    `gorm:"column:status" json:"status,omitempty"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt     time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (MarketingAgent) TableName() string { return "marketing_agents" }

type MarketingAgentMember struct {
	ID          int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	AgentId     int64     `gorm:"column:agent_id" json:"agentId,omitempty"`
	UserId      int64     `gorm:"column:user_id" json:"userId,omitempty"`
	PhoneNumber *string   `gorm:"column:phone_number" json:"phoneNumber,omitempty"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (MarketingAgentMember) TableName() string { return "marketing_agent_members" }

type Movie struct {
	ID              int64   `gorm:"column:id;primaryKey" json:"id,omitempty"`
	VideoAssetId    *string `gorm:"column:video_asset_id" json:"videoAssetId,omitempty"`
	VideoUrl        *string `gorm:"column:video_url" json:"videoUrl,omitempty"`
	BunnyVideoGuid  *string `gorm:"column:bunny_video_guid" json:"bunnyVideoGuid,omitempty"`
	DurationMinutes *int32  `gorm:"column:duration_minutes" json:"durationMinutes,omitempty"`
	DurationSeconds *int32  `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	Director        *string `gorm:"column:director" json:"director,omitempty"`
	Writers         *string `gorm:"column:writers" json:"writers,omitempty"`
	ProductionHouse *string `gorm:"column:production_house" json:"productionHouse,omitempty"`
	CountryOfOrigin *string `gorm:"column:country_of_origin" json:"countryOfOrigin,omitempty"`
	IsTvodAvailable *bool   `gorm:"column:is_tvod_available" json:"isTvodAvailable,omitempty"`
	DrmEnabled      *bool   `gorm:"column:drm_enabled" json:"drmEnabled,omitempty"`
	ContentId       *int64  `gorm:"column:content_id" json:"contentId,omitempty"`
	StreamUrl       *string `gorm:"column:stream_url" json:"streamUrl,omitempty"`
	HlsUrl          *string `gorm:"column:hls_url" json:"hlsUrl,omitempty"`
	DashUrl         *string `gorm:"column:dash_url" json:"dashUrl,omitempty"`
}

func (Movie) TableName() string { return "movies" }

type Notification struct {
	ID              int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	ActionUrl       *string    `gorm:"column:action_url" json:"actionUrl,omitempty"`
	Channel         *string    `gorm:"column:channel" json:"channel,omitempty"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	ErrorDetails    *string    `gorm:"column:error_details" json:"errorDetails,omitempty"`
	Message         string     `gorm:"column:message" json:"message,omitempty"`
	RecipientTarget *string    `gorm:"column:recipient_target" json:"recipientTarget,omitempty"`
	ScheduledAt     *time.Time `gorm:"column:scheduled_at" json:"scheduledAt,omitempty"`
	SentAt          *time.Time `gorm:"column:sent_at" json:"sentAt,omitempty"`
	Status          *string    `gorm:"column:status" json:"status,omitempty"`
	TargetType      *string    `gorm:"column:target_type" json:"targetType,omitempty"`
	TargetValue     *string    `gorm:"column:target_value" json:"targetValue,omitempty"`
	Title           string     `gorm:"column:title" json:"title,omitempty"`
	ImageUrl        *string    `gorm:"column:image_url" json:"imageUrl,omitempty"`
	DeepLinkUrl     *string    `gorm:"column:deep_link_url" json:"deepLinkUrl,omitempty"`
	TargetAudience  *string    `gorm:"column:target_audience" json:"targetAudience,omitempty"`
	TargetUserId    *string    `gorm:"column:target_user_id" json:"targetUserId,omitempty"`
	SentCount       *int32     `gorm:"column:sent_count" json:"sentCount,omitempty"`
	CreatedBy       *string    `gorm:"column:created_by" json:"createdBy,omitempty"`
}

func (Notification) TableName() string { return "notifications" }

type Page struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	IsActive     *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	Name         *string    `gorm:"column:name" json:"name,omitempty"`
	Slug         string     `gorm:"column:slug" json:"slug,omitempty"`
	Title        *string    `gorm:"column:title" json:"title,omitempty"`
	Description  *string    `gorm:"column:description" json:"description,omitempty"`
	IconUrl      *string    `gorm:"column:icon_url" json:"iconUrl,omitempty"`
	DisplayOrder *int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	CreatedAt    *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Page) TableName() string { return "pages" }

type Payment struct {
	ID                int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	PaymentId         *string    `gorm:"column:payment_id" json:"paymentId,omitempty"`
	OrderId           *string    `gorm:"column:order_id" json:"orderId,omitempty"`
	Amount            float64    `gorm:"column:amount" json:"amount,omitempty"`
	CreatedAt         time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	PaymentMethod     *string    `gorm:"column:payment_method" json:"paymentMethod,omitempty"`
	ProviderPaymentId *string    `gorm:"column:provider_payment_id" json:"providerPaymentId,omitempty"`
	Status            string     `gorm:"column:status" json:"status,omitempty"`
	TransactionId     string     `gorm:"column:transaction_id" json:"transactionId,omitempty"`
	PaymentOrderId    int64      `gorm:"column:payment_order_id" json:"paymentOrderId,omitempty"`
	UserId            *int64     `gorm:"column:user_id" json:"userId,omitempty"`
	Provider          *string    `gorm:"column:provider" json:"provider,omitempty"`
	ProviderOrderId   *string    `gorm:"column:provider_order_id" json:"providerOrderId,omitempty"`
	ProviderSignature *string    `gorm:"column:provider_signature" json:"providerSignature,omitempty"`
	TaxAmount         *float64   `gorm:"column:tax_amount" json:"taxAmount,omitempty"`
	RefundedAmount    *float64   `gorm:"column:refunded_amount" json:"refundedAmount,omitempty"`
	Currency          *string    `gorm:"column:currency" json:"currency,omitempty"`
	ErrorCode         *string    `gorm:"column:error_code" json:"errorCode,omitempty"`
	ErrorDescription  *string    `gorm:"column:error_description" json:"errorDescription,omitempty"`
	FailureReason     *string    `gorm:"column:failure_reason" json:"failureReason,omitempty"`
	PaidAt            *time.Time `gorm:"column:paid_at" json:"paidAt,omitempty"`
}

func (Payment) TableName() string { return "payments" }

type PaymentOrder struct {
	ID              int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Amount          *float64   `gorm:"column:amount" json:"amount,omitempty"`
	ContentId       *int64     `gorm:"column:content_id" json:"contentId,omitempty"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	Currency        *string    `gorm:"column:currency" json:"currency,omitempty"`
	OrderId         *string    `gorm:"column:order_id" json:"orderId,omitempty"`
	OrderType       *string    `gorm:"column:order_type" json:"orderType,omitempty"`
	Provider        string     `gorm:"column:provider" json:"provider,omitempty"`
	Status          string     `gorm:"column:status" json:"status,omitempty"`
	ValidityHours   *int32     `gorm:"column:validity_hours" json:"validityHours,omitempty"`
	PlanId          *int64     `gorm:"column:plan_id" json:"planId,omitempty"`
	UserId          int64      `gorm:"column:user_id" json:"userId,omitempty"`
	OriginalAmount  *float64   `gorm:"column:original_amount" json:"originalAmount,omitempty"`
	DiscountAmount  *float64   `gorm:"column:discount_amount" json:"discountAmount,omitempty"`
	TaxAmount       *float64   `gorm:"column:tax_amount" json:"taxAmount,omitempty"`
	FinalAmount     *float64   `gorm:"column:final_amount" json:"finalAmount,omitempty"`
	CouponCode      *string    `gorm:"column:coupon_code" json:"couponCode,omitempty"`
	ProviderOrderId *string    `gorm:"column:provider_order_id" json:"providerOrderId,omitempty"`
	ReceiptNumber   *string    `gorm:"column:receipt_number" json:"receiptNumber,omitempty"`
	UpdatedAt       *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
	SubscriptionId  *string    `gorm:"column:subscription_id" json:"subscriptionId,omitempty"`
}

func (PaymentOrder) TableName() string { return "payment_orders" }

type Plan struct {
	ID                   int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Code                 string     `gorm:"column:code" json:"code,omitempty"`
	Name                 string     `gorm:"column:name" json:"name,omitempty"`
	Description          *string    `gorm:"column:description" json:"description,omitempty"`
	BillingPeriod        string     `gorm:"column:billing_period" json:"billingPeriod,omitempty"`
	BillingCycle         *string    `gorm:"column:billing_cycle" json:"billingCycle,omitempty"`
	DurationDays         *int32     `gorm:"column:duration_days" json:"durationDays,omitempty"`
	Price                float64    `gorm:"column:price" json:"price,omitempty"`
	DiscountPrice        *float64   `gorm:"column:discount_price" json:"discountPrice,omitempty"`
	Currency             *string    `gorm:"column:currency" json:"currency,omitempty"`
	TrialDays            *int32     `gorm:"column:trial_days" json:"trialDays,omitempty"`
	MaxConcurrentStreams *int32     `gorm:"column:max_concurrent_streams" json:"maxConcurrentStreams,omitempty"`
	MaxDevices           *int32     `gorm:"column:max_devices" json:"maxDevices,omitempty"`
	MaxRegisteredDevices *int32     `gorm:"column:max_registered_devices" json:"maxRegisteredDevices,omitempty"`
	MaxProfiles          *int32     `gorm:"column:max_profiles" json:"maxProfiles,omitempty"`
	MaxResolution        *string    `gorm:"column:max_resolution" json:"maxResolution,omitempty"`
	MaxVideoQuality      *string    `gorm:"column:max_video_quality" json:"maxVideoQuality,omitempty"`
	AdsEnabled           *bool      `gorm:"column:ads_enabled" json:"adsEnabled,omitempty"`
	HasAds               *bool      `gorm:"column:has_ads" json:"hasAds,omitempty"`
	DownloadsEnabled     *bool      `gorm:"column:downloads_enabled" json:"downloadsEnabled,omitempty"`
	DownloadAllowed      *bool      `gorm:"column:download_allowed" json:"downloadAllowed,omitempty"`
	AllowDownloads       *bool      `gorm:"column:allow_downloads" json:"allowDownloads,omitempty"`
	IsActive             *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	IsPopular            *bool      `gorm:"column:is_popular" json:"isPopular,omitempty"`
	IsAutopayEligible    *bool      `gorm:"column:is_autopay_eligible" json:"isAutopayEligible,omitempty"`
	SingleUseOnly        *bool      `gorm:"column:single_use_only" json:"singleUseOnly,omitempty"`
	FeaturesJson         *string    `gorm:"column:features_json" json:"featuresJson,omitempty"`
	RazorpayPlanId       *string    `gorm:"column:razorpay_plan_id" json:"razorpayPlanId,omitempty"`
	CreatedAt            time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt            *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (Plan) TableName() string { return "plans" }

type PlaybackSession struct {
	ID                     int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	CurrentPositionSeconds *int32     `gorm:"column:current_position_seconds" json:"currentPositionSeconds,omitempty"`
	DeviceId               *string    `gorm:"column:device_id" json:"deviceId,omitempty"`
	DeviceType             *string    `gorm:"column:device_type" json:"deviceType,omitempty"`
	IpAddress              *string    `gorm:"column:ip_address" json:"ipAddress,omitempty"`
	LastHeartbeat          *time.Time `gorm:"column:last_heartbeat" json:"lastHeartbeat,omitempty"`
	SessionId              string     `gorm:"column:session_id" json:"sessionId,omitempty"`
	StartedAt              *time.Time `gorm:"column:started_at" json:"startedAt,omitempty"`
	Status                 *string    `gorm:"column:status" json:"status,omitempty"`
	TotalDurationSeconds   *int32     `gorm:"column:total_duration_seconds" json:"totalDurationSeconds,omitempty"`
	ContentId              int64      `gorm:"column:content_id" json:"contentId,omitempty"`
	ProfileId              *int64     `gorm:"column:profile_id" json:"profileId,omitempty"`
	UserId                 *int64     `gorm:"column:user_id" json:"userId,omitempty"`
	SessionToken           *string    `gorm:"column:session_token" json:"sessionToken,omitempty"`
	EpisodeId              *int64     `gorm:"column:episode_id" json:"episodeId,omitempty"`
	LastHeartbeatAt        *time.Time `gorm:"column:last_heartbeat_at" json:"lastHeartbeatAt,omitempty"`
	IsActive               *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
}

func (PlaybackSession) TableName() string { return "playback_sessions" }

type PortalBanner struct {
	ID             int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Title          string    `gorm:"column:title" json:"title,omitempty"`
	Subtitle       *string   `gorm:"column:subtitle" json:"subtitle,omitempty"`
	ImageUrl       string    `gorm:"column:image_url" json:"imageUrl,omitempty"`
	MobileImageUrl *string   `gorm:"column:mobile_image_url" json:"mobileImageUrl,omitempty"`
	TargetUrl      string    `gorm:"column:target_url" json:"targetUrl,omitempty"`
	PortalKey      string    `gorm:"column:portal_key" json:"portalKey,omitempty"`
	ButtonLabel    *string   `gorm:"column:button_label" json:"buttonLabel,omitempty"`
	DisplayOrder   int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	IsActive       bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	CreatedAt      time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt      time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (PortalBanner) TableName() string { return "portal_banners" }

type ProducerAdRevenue struct {
	ID                   int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	ProducerId           int64      `gorm:"column:producer_id" json:"producerId,omitempty"`
	ContentId            int64      `gorm:"column:content_id" json:"contentId,omitempty"`
	EpisodeId            *int64     `gorm:"column:episode_id" json:"episodeId,omitempty"`
	BillingPeriod        string     `gorm:"column:billing_period" json:"billingPeriod,omitempty"`
	TotalImpressions     *int64     `gorm:"column:total_impressions" json:"totalImpressions,omitempty"`
	GrossRevenue         *float64   `gorm:"column:gross_revenue" json:"grossRevenue,omitempty"`
	NetRevenue           *float64   `gorm:"column:net_revenue" json:"netRevenue,omitempty"`
	ProducerSharePercent *float64   `gorm:"column:producer_share_percent" json:"producerSharePercent,omitempty"`
	ProducerAmount       *float64   `gorm:"column:producer_amount" json:"producerAmount,omitempty"`
	PlatformSharePercent *float64   `gorm:"column:platform_share_percent" json:"platformSharePercent,omitempty"`
	PlatformAmount       *float64   `gorm:"column:platform_amount" json:"platformAmount,omitempty"`
	Currency             *string    `gorm:"column:currency" json:"currency,omitempty"`
	Status               *string    `gorm:"column:status" json:"status,omitempty"`
	SettledAt            *time.Time `gorm:"column:settled_at" json:"settledAt,omitempty"`
	CreatedAt            *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt            *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
	SettlementDate       *time.Time `gorm:"column:settlement_date" json:"settlementDate,omitempty"`
}

func (ProducerAdRevenue) TableName() string { return "producer_ad_revenue" }

type ProducerProfile struct {
	ID                       int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	AgreementStatus          *string    `gorm:"column:agreement_status" json:"agreementStatus,omitempty"`
	BankAccountNumber        *string    `gorm:"column:bank_account_number" json:"bankAccountNumber,omitempty"`
	BankAccountPayoutId      *string    `gorm:"column:bank_account_payout_id" json:"bankAccountPayoutId,omitempty"`
	BankDocUrl               *string    `gorm:"column:bank_doc_url" json:"bankDocUrl,omitempty"`
	BankName                 *string    `gorm:"column:bank_name" json:"bankName,omitempty"`
	BankStatus               *string    `gorm:"column:bank_status" json:"bankStatus,omitempty"`
	CompanyName              string     `gorm:"column:company_name" json:"companyName,omitempty"`
	CreatedAt                time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	GstDocUrl                *string    `gorm:"column:gst_doc_url" json:"gstDocUrl,omitempty"`
	GstNumber                *string    `gorm:"column:gst_number" json:"gstNumber,omitempty"`
	GstStatus                *string    `gorm:"column:gst_status" json:"gstStatus,omitempty"`
	IfscCode                 *string    `gorm:"column:ifsc_code" json:"ifscCode,omitempty"`
	OnboardingStatus         *string    `gorm:"column:onboarding_status" json:"onboardingStatus,omitempty"`
	PanDocUrl                *string    `gorm:"column:pan_doc_url" json:"panDocUrl,omitempty"`
	PanNumber                *string    `gorm:"column:pan_number" json:"panNumber,omitempty"`
	PanStatus                *string    `gorm:"column:pan_status" json:"panStatus,omitempty"`
	AadharDocUrl             *string    `gorm:"column:aadhar_doc_url" json:"aadharDocUrl,omitempty"`
	AadharBackDocUrl         *string    `gorm:"column:aadhar_back_doc_url" json:"aadharBackDocUrl,omitempty"`
	AadharNumber             *string    `gorm:"column:aadhar_number" json:"aadharNumber,omitempty"`
	AadharStatus             *string    `gorm:"column:aadhar_status" json:"aadharStatus,omitempty"`
	RejectionReason          *string    `gorm:"column:rejection_reason" json:"rejectionReason,omitempty"`
	RevenueShare             *float64   `gorm:"column:revenue_share" json:"revenueShare,omitempty"`
	SignedAgreementUrl       *string    `gorm:"column:signed_agreement_url" json:"signedAgreementUrl,omitempty"`
	Status                   string     `gorm:"column:status" json:"status,omitempty"`
	StudioRegistrationNumber *string    `gorm:"column:studio_registration_number" json:"studioRegistrationNumber,omitempty"`
	TaxId                    *string    `gorm:"column:tax_id" json:"taxId,omitempty"`
	UserId                   int64      `gorm:"column:user_id" json:"userId,omitempty"`
	ContactPerson            *string    `gorm:"column:contact_person" json:"contactPerson,omitempty"`
	Email                    *string    `gorm:"column:email" json:"email,omitempty"`
	Phone                    *string    `gorm:"column:phone" json:"phone,omitempty"`
	RevenueSharePercent      *float64   `gorm:"column:revenue_share_percent" json:"revenueSharePercent,omitempty"`
	KycStatus                *string    `gorm:"column:kyc_status" json:"kycStatus,omitempty"`
	BankIfsc                 *string    `gorm:"column:bank_ifsc" json:"bankIfsc,omitempty"`
	AgreementUrl             *string    `gorm:"column:agreement_url" json:"agreementUrl,omitempty"`
	IsActive                 *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	UpdatedAt                *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (ProducerProfile) TableName() string { return "producer_profiles" }

type Profile struct {
	ID                  int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	UserId              int64     `gorm:"column:user_id" json:"userId,omitempty"`
	Name                string    `gorm:"column:name" json:"name,omitempty"`
	AvatarUrl           *string   `gorm:"column:avatar_url" json:"avatarUrl,omitempty"`
	IsKids              *bool     `gorm:"column:is_kids" json:"isKids,omitempty"`
	IsKidsProfile       *bool     `gorm:"column:is_kids_profile" json:"isKidsProfile,omitempty"`
	KidsProfile         *bool     `gorm:"column:kids_profile" json:"kidsProfile,omitempty"`
	IsDefault           *bool     `gorm:"column:is_default" json:"isDefault,omitempty"`
	PinHash             *string   `gorm:"column:pin_hash" json:"pinHash,omitempty"`
	PinCodeHash         *string   `gorm:"column:pin_code_hash" json:"pinCodeHash,omitempty"`
	PreferredLanguage   *string   `gorm:"column:preferred_language" json:"preferredLanguage,omitempty"`
	PreferredLanguages  *string   `gorm:"column:preferred_languages" json:"preferredLanguages,omitempty"`
	MaturityLevel       *string   `gorm:"column:maturity_level" json:"maturityLevel,omitempty"`
	MaturityRatingLimit *string   `gorm:"column:maturity_rating_limit" json:"maturityRatingLimit,omitempty"`
	CreatedAt           time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt           time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (Profile) TableName() string { return "profiles" }

type RefreshToken struct {
	ID        int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	UserId    int64     `gorm:"column:user_id" json:"userId,omitempty"`
	Token     string    `gorm:"column:token" json:"token,omitempty"`
	TokenHash *string   `gorm:"column:token_hash" json:"tokenHash,omitempty"`
	DeviceId  *string   `gorm:"column:device_id" json:"deviceId,omitempty"`
	Revoked   *bool     `gorm:"column:revoked" json:"revoked,omitempty"`
	ExpiresAt time.Time `gorm:"column:expires_at" json:"expiresAt,omitempty"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }

type Role struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Name         string     `gorm:"column:name" json:"name,omitempty"`
	Description  *string    `gorm:"column:description" json:"description,omitempty"`
	IsSystemRole *bool      `gorm:"column:is_system_role" json:"isSystemRole,omitempty"`
	CreatedAt    *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Role) TableName() string { return "roles" }

type Season struct {
	ID           int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Description  *string    `gorm:"column:description" json:"description,omitempty"`
	PosterUrl    *string    `gorm:"column:poster_url" json:"posterUrl,omitempty"`
	SeasonNumber int32      `gorm:"column:season_number" json:"seasonNumber,omitempty"`
	Title        string     `gorm:"column:title" json:"title,omitempty"`
	SeriesId     int64      `gorm:"column:series_id" json:"seriesId,omitempty"`
	Synopsis     *string    `gorm:"column:synopsis" json:"synopsis,omitempty"`
	ReleaseYear  *int32     `gorm:"column:release_year" json:"releaseYear,omitempty"`
	ReleaseDate  *time.Time `gorm:"column:release_date" json:"releaseDate,omitempty"`
	IsActive     *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	CreatedAt    *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt    *time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (Season) TableName() string { return "seasons" }

type Section struct {
	ID                int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	DisplayOrder      *int32     `gorm:"column:display_order" json:"displayOrder,omitempty"`
	IsActive          *bool      `gorm:"column:is_active" json:"isActive,omitempty"`
	Layout            *string    `gorm:"column:layout" json:"layout,omitempty"`
	Title             string     `gorm:"column:title" json:"title,omitempty"`
	Slug              *string    `gorm:"column:slug" json:"slug,omitempty"`
	Type              string     `gorm:"column:type" json:"type,omitempty"`
	PageId            int64      `gorm:"column:page_id" json:"pageId,omitempty"`
	Subtitle          *string    `gorm:"column:subtitle" json:"subtitle,omitempty"`
	SectionType       *string    `gorm:"column:section_type" json:"sectionType,omitempty"`
	LayoutStyle       *string    `gorm:"column:layout_style" json:"layoutStyle,omitempty"`
	ContentTypeFilter *string    `gorm:"column:content_type_filter" json:"contentTypeFilter,omitempty"`
	CategoryId        *int64     `gorm:"column:category_id" json:"categoryId,omitempty"`
	GenreId           *int64     `gorm:"column:genre_id" json:"genreId,omitempty"`
	LanguageCode      *string    `gorm:"column:language_code" json:"languageCode,omitempty"`
	AutoFetchLimit    *int32     `gorm:"column:auto_fetch_limit" json:"autoFetchLimit,omitempty"`
	RuleJson          *string    `gorm:"column:rule_json" json:"ruleJson,omitempty"`
	CreatedAt         *time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
}

func (Section) TableName() string { return "sections" }

type Series struct {
	ID            int64  `gorm:"column:id;primaryKey" json:"id,omitempty"`
	TotalEpisodes *int32 `gorm:"column:total_episodes" json:"totalEpisodes,omitempty"`
	TotalSeasons  *int32 `gorm:"column:total_seasons" json:"totalSeasons,omitempty"`
	IsOngoing     *bool  `gorm:"column:is_ongoing" json:"isOngoing,omitempty"`
	ContentId     *int64 `gorm:"column:content_id" json:"contentId,omitempty"`
}

func (Series) TableName() string { return "series" }

type Subscription struct {
	ID                     int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	UserId                 int64      `gorm:"column:user_id" json:"userId,omitempty"`
	PlanId                 int64      `gorm:"column:plan_id" json:"planId,omitempty"`
	Status                 string     `gorm:"column:status" json:"status,omitempty"`
	Amount                 *float64   `gorm:"column:amount" json:"amount,omitempty"`
	AutoRenew              *bool      `gorm:"column:auto_renew" json:"autoRenew,omitempty"`
	AutopayEnabled         *bool      `gorm:"column:autopay_enabled" json:"autopayEnabled,omitempty"`
	StartDate              time.Time  `gorm:"column:start_date" json:"startDate,omitempty"`
	EndDate                time.Time  `gorm:"column:end_date" json:"endDate,omitempty"`
	CancelledAt            *time.Time `gorm:"column:cancelled_at" json:"cancelledAt,omitempty"`
	RazorpayCustomerId     *string    `gorm:"column:razorpay_customer_id" json:"razorpayCustomerId,omitempty"`
	RazorpaySubscriptionId *string    `gorm:"column:razorpay_subscription_id" json:"razorpaySubscriptionId,omitempty"`
	PaymentGatewaySubId    *string    `gorm:"column:payment_gateway_sub_id" json:"paymentGatewaySubId,omitempty"`
	PaymentId              *string    `gorm:"column:payment_id" json:"paymentId,omitempty"`
	CreatedAt              time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt              time.Time  `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (Subscription) TableName() string { return "subscriptions" }

type SystemSetting struct {
	ID           int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	SettingKey   string    `gorm:"column:setting_key" json:"settingKey,omitempty"`
	SettingValue *string   `gorm:"column:setting_value" json:"settingValue,omitempty"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt,omitempty"`
	Category     *string   `gorm:"column:category" json:"category,omitempty"`
	SettingGroup *string   `gorm:"column:setting_group" json:"settingGroup,omitempty"`
	Description  *string   `gorm:"column:description" json:"description,omitempty"`
	IsSecret     *bool     `gorm:"column:is_secret" json:"isSecret,omitempty"`
	IsPublic     *bool     `gorm:"column:is_public" json:"isPublic,omitempty"`
	UpdatedBy    *string   `gorm:"column:updated_by" json:"updatedBy,omitempty"`
}

func (SystemSetting) TableName() string { return "system_settings" }

type TvodProduct struct {
	ID                  int64   `gorm:"column:id;primaryKey" json:"id,omitempty"`
	IsActive            *bool   `gorm:"column:is_active" json:"isActive,omitempty"`
	Price               float64 `gorm:"column:price" json:"price,omitempty"`
	PurchaseType        string  `gorm:"column:purchase_type" json:"purchaseType,omitempty"`
	ValidityHours       *int32  `gorm:"column:validity_hours" json:"validityHours,omitempty"`
	ContentId           int64   `gorm:"column:content_id" json:"contentId,omitempty"`
	Currency            *string `gorm:"column:currency" json:"currency,omitempty"`
	RentalDurationHours *int32  `gorm:"column:rental_duration_hours" json:"rentalDurationHours,omitempty"`
}

func (TvodProduct) TableName() string { return "tvod_products" }

type User struct {
	ID                 int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Uuid               string     `gorm:"column:uuid" json:"uuid,omitempty"`
	Email              *string    `gorm:"column:email" json:"email,omitempty"`
	PasswordHash       *string    `gorm:"column:password_hash" json:"passwordHash,omitempty"`
	FullName           *string    `gorm:"column:full_name" json:"fullName,omitempty"`
	PhoneNumber        *string    `gorm:"column:phone_number" json:"phoneNumber,omitempty"`
	Phone              *string    `gorm:"column:phone" json:"phone,omitempty"`
	AuthMethod         *string    `gorm:"column:auth_method" json:"authMethod,omitempty"`
	Status             string     `gorm:"column:status" json:"status,omitempty"`
	PhoneVerified      *bool      `gorm:"column:phone_verified" json:"phoneVerified,omitempty"`
	EmailVerified      *bool      `gorm:"column:email_verified" json:"emailVerified,omitempty"`
	CountryCode        *string    `gorm:"column:country_code" json:"countryCode,omitempty"`
	Pincode            *string    `gorm:"column:pincode" json:"pincode,omitempty"`
	Profession         *string    `gorm:"column:profession" json:"profession,omitempty"`
	DateOfBirth        *string    `gorm:"column:date_of_birth" json:"dateOfBirth,omitempty"`
	AvatarUrl          *string    `gorm:"column:avatar_url" json:"avatarUrl,omitempty"`
	PreferredLanguages *string    `gorm:"column:preferred_languages" json:"preferredLanguages,omitempty"`
	LastActiveAt       *time.Time `gorm:"column:last_active_at" json:"lastActiveAt,omitempty"`
	LastLoginAt        *time.Time `gorm:"column:last_login_at" json:"lastLoginAt,omitempty"`
	CreatedAt          time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	UpdatedAt          time.Time  `gorm:"column:updated_at" json:"updatedAt,omitempty"`
}

func (User) TableName() string { return "users" }

type UserInteraction struct {
	ID                   int64     `gorm:"column:id;primaryKey" json:"id,omitempty"`
	ContentId            *int64    `gorm:"column:content_id" json:"contentId,omitempty"`
	ContentTitle         *string   `gorm:"column:content_title" json:"contentTitle,omitempty"`
	CreatedAt            time.Time `gorm:"column:created_at" json:"createdAt,omitempty"`
	DeviceId             *string   `gorm:"column:device_id" json:"deviceId,omitempty"`
	DeviceType           *string   `gorm:"column:device_type" json:"deviceType,omitempty"`
	DurationSeconds      *int32    `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	InteractionType      string    `gorm:"column:interaction_type" json:"interactionType,omitempty"`
	Metadata             *string   `gorm:"column:metadata" json:"metadata,omitempty"`
	PositionSeconds      *int32    `gorm:"column:position_seconds" json:"positionSeconds,omitempty"`
	ProfileId            *int64    `gorm:"column:profile_id" json:"profileId,omitempty"`
	SessionId            *string   `gorm:"column:session_id" json:"sessionId,omitempty"`
	UserId               *int64    `gorm:"column:user_id" json:"userId,omitempty"`
	UserName             *string   `gorm:"column:user_name" json:"userName,omitempty"`
	RatingValue          *float64  `gorm:"column:rating_value" json:"ratingValue,omitempty"`
	WatchDurationSeconds *int32    `gorm:"column:watch_duration_seconds" json:"watchDurationSeconds,omitempty"`
	CountryCode          *string   `gorm:"column:country_code" json:"countryCode,omitempty"`
	IpAddress            *string   `gorm:"column:ip_address" json:"ipAddress,omitempty"`
}

func (UserInteraction) TableName() string { return "user_interactions" }

type UserNotification struct {
	ID             int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	CreatedAt      time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	IsRead         *bool      `gorm:"column:is_read" json:"isRead,omitempty"`
	ReadAt         *time.Time `gorm:"column:read_at" json:"readAt,omitempty"`
	NotificationId int64      `gorm:"column:notification_id" json:"notificationId,omitempty"`
	UserId         int64      `gorm:"column:user_id" json:"userId,omitempty"`
}

func (UserNotification) TableName() string { return "user_notifications" }

type UserRole struct {
	UserId int64 `gorm:"column:user_id;primaryKey" json:"userId,omitempty"`
	RoleId int64 `gorm:"column:role_id;primaryKey" json:"roleId,omitempty"`
}

func (UserRole) TableName() string { return "user_roles" }

type WatchHistory struct {
	ID                     int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	Completed              *bool      `gorm:"column:completed" json:"completed,omitempty"`
	DurationSeconds        *int32     `gorm:"column:duration_seconds" json:"durationSeconds,omitempty"`
	LastWatchedAt          *time.Time `gorm:"column:last_watched_at" json:"lastWatchedAt,omitempty"`
	Percentage             *float64   `gorm:"column:percentage" json:"percentage,omitempty"`
	PositionSeconds        *int32     `gorm:"column:position_seconds" json:"positionSeconds,omitempty"`
	ContentId              int64      `gorm:"column:content_id" json:"contentId,omitempty"`
	EpisodeId              *int64     `gorm:"column:episode_id" json:"episodeId,omitempty"`
	ProfileId              int64      `gorm:"column:profile_id" json:"profileId,omitempty"`
	UserId                 *int64     `gorm:"column:user_id" json:"userId,omitempty"`
	WatchedSeconds         *int32     `gorm:"column:watched_seconds" json:"watchedSeconds,omitempty"`
	WatchedDurationSeconds *int32     `gorm:"column:watched_duration_seconds" json:"watchedDurationSeconds,omitempty"`
	TotalDurationSeconds   *int32     `gorm:"column:total_duration_seconds" json:"totalDurationSeconds,omitempty"`
	IsCompleted            *bool      `gorm:"column:is_completed" json:"isCompleted,omitempty"`
}

func (WatchHistory) TableName() string { return "watch_history" }

type Watchlist struct {
	ID        int64      `gorm:"column:id;primaryKey" json:"id,omitempty"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"createdAt,omitempty"`
	ContentId int64      `gorm:"column:content_id" json:"contentId,omitempty"`
	ProfileId int64      `gorm:"column:profile_id" json:"profileId,omitempty"`
	UserId    *int64     `gorm:"column:user_id" json:"userId,omitempty"`
	AddedAt   *time.Time `gorm:"column:added_at" json:"addedAt,omitempty"`
}

func (Watchlist) TableName() string { return "watchlist" }
