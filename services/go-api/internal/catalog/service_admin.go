package catalog

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/bunny"
	"github.com/maxxpixels/go-api/pkg/models"
	"gorm.io/gorm"
)

var nonAlnumRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	out := strings.Trim(nonAlnumRe.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-"), "-")
	if out == "" {
		return fmt.Sprintf("item-%d", time.Now().UnixMilli())
	}
	return out
}

func (s *Service) invalidateCatalogCache(ctx context.Context) {
	for _, k := range []string{"catalog:metadata:v1", "catalog:trending:20", "catalog:banners", "catalog:sections"} {
		_ = s.cache.Del(ctx, k)
	}
}

// --- Category Content by ID or Slug ---

func (s *Service) BrowseByCategory(ctx context.Context, idOrSlug string, page, size int) ([]models.Content, int64, error) {
	if size <= 0 || size > 100 {
		size = 24
	}
	if page < 0 {
		page = 0
	}
	var cat models.Category
	if numID, err := strconv.ParseInt(idOrSlug, 10, 64); err == nil {
		if err := s.db.WithContext(ctx).First(&cat, numID).Error; err != nil {
			return []models.Content{}, 0, nil
		}
	} else {
		if err := s.db.WithContext(ctx).Where("LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?)", idOrSlug, idOrSlug).First(&cat).Error; err != nil {
			return []models.Content{}, 0, nil
		}
	}
	q := s.db.WithContext(ctx).Model(&models.Content{}).
		Joins("JOIN content_categories cc ON cc.content_id = contents.id").
		Where("cc.category_id = ? AND COALESCE(contents.status, 'PUBLISHED') IN ('PUBLISHED', 'ACTIVE')", cat.ID)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []models.Content
	err := q.Order("contents.created_at DESC").Offset(page * size).Limit(size).Find(&items).Error
	return items, total, err
}

// --- Admin Movies CRUD ---

func (s *Service) AdminListMovies(ctx context.Context, page, size int, search, status string) ([]map[string]any, int64, error) {
	if size <= 0 || size > 100 {
		size = 20
	}
	if page < 0 {
		page = 0
	}
	q := s.db.WithContext(ctx).Model(&models.Content{}).Where("COALESCE(content_type, 'MOVIE') <> 'SERIES'")
	if st := strings.TrimSpace(status); st != "" && !strings.EqualFold(st, "ALL") {
		q = q.Where("UPPER(status) = ?", strings.ToUpper(st))
	}
	if sr := strings.TrimSpace(search); sr != "" {
		like := "%" + sr + "%"
		q = q.Where("title ILIKE ? OR slug ILIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []models.Content
	if err := q.Order("id DESC").Offset(page * size).Limit(size).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
	}
	moviesByContent := map[int64]models.Movie{}
	if len(ids) > 0 {
		var mvs []models.Movie
		_ = s.db.WithContext(ctx).Where("content_id IN ?", ids).Find(&mvs).Error
		for _, m := range mvs {
			if m.ContentId != nil {
				moviesByContent[*m.ContentId] = m
			}
		}
	}
	out := make([]map[string]any, 0, len(rows))
	for _, c := range rows {
		item := map[string]any{
			"id":              c.ID,
			"title":           c.Title,
			"slug":            c.Slug,
			"description":     c.Description,
			"contentType":     c.ContentType,
			"language":        c.OriginalLanguageCode,
			"status":          c.Status,
			"posterUrl":       c.PosterUrl,
			"backdropUrl":     c.BackdropUrl,
			"trailerUrl":      c.TrailerUrl,
			"releaseYear":     c.ReleaseYear,
			"durationSeconds": c.DurationSeconds,
			"ageRating":       c.AgeRating,
			"monetization":    c.Monetization,
			"accessType":      c.AccessType,
			"isPremium":       c.IsPremium,
			"isFeatured":      c.IsFeatured,
			"isTrending":      c.IsTrending,
			"rentPrice":       c.RentPrice,
			"tvodPrice":       c.RentPrice,
			"viewCount":       c.ViewCount,
			"createdAt":       c.CreatedAt,
		}
		if mv, ok := moviesByContent[c.ID]; ok {
			item["hlsUrl"] = mv.HlsUrl
			item["streamUrl"] = mv.StreamUrl
			item["videoUrl"] = mv.VideoUrl
			item["bunnyVideoGuid"] = mv.BunnyVideoGuid
		}
		out = append(out, item)
	}
	return out, total, nil
}

func (s *Service) AdminCreateMovie(ctx context.Context, payload map[string]any) (map[string]any, error) {
	title := strVal(payload, "title")
	if title == "" {
		return nil, errors.New("title is required")
	}
	slug := strVal(payload, "slug")
	if slug == "" {
		slug = slugify(title) + "-" + strconv.FormatInt(time.Now().Unix()%10000, 10)
	}
	ct := strings.ToUpper(strVal(payload, "contentType", "content_type", "mainType", "main_type"))
	var ctPtr *string
	if ct != "" {
		ctPtr = &ct
	}
	status := strings.ToUpper(strVal(payload, "status"))
	if status == "" {
		status = "PUBLISHED"
	}
	mon := strings.ToUpper(strVal(payload, "monetization", "accessType", "access_type"))
	if mon == "" {
		mon = "SVOD"
	}
	lang := strVal(payload, "language")
	if lang == "" {
		lang = "Kannada"
	}
	now := time.Now().UTC()
	isPrem := mon == "SVOD" || mon == "TVOD" || boolVal(payload, "isPremium", "is_premium")
	isFeat := boolVal(payload, "isFeatured", "is_featured")
	isTrend := boolVal(payload, "isTrending", "is_trending")

	bannerVal := strVal(payload, "bannerUrl", "banner_image_url", "landscapeUrl", "landscape_image_url", "backdropUrl", "backdrop_url", "landscapePosterUrl")
	c := models.Content{
		Title:                title,
		Slug:                 slug,
		Description:          ptrStr(strVal(payload, "description", "synopsis")),
		ContentType:          ctPtr,
		OriginalLanguageCode: &lang,
		Status:               status,
		PosterUrl:            ptrStr(strVal(payload, "posterUrl", "poster_url")),
		BackdropUrl:          ptrStr(bannerVal),
		LandscapeImageUrl:    ptrStr(bannerVal),
		BannerImageUrl:       ptrStr(bannerVal),
		LogoImageUrl:         ptrStr(strVal(payload, "logoImageUrl", "logo_image_url")),
		TrailerUrl:           ptrStr(strVal(payload, "trailerUrl", "trailer_url")),
		AgeRating:            ptrStr(strVal(payload, "ageRating", "maturityRating", "age_rating")),
		Monetization:         &mon,
		AccessType:           &mon,
		IsPremium:            &isPrem,
		IsFeatured:           &isFeat,
		IsTrending:           &isTrend,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if y := int32Val(payload, "releaseYear", "release_year"); y > 0 {
		c.ReleaseYear = &y
	}
	if rd := strVal(payload, "releaseDate", "release_date"); rd != "" {
		if t, err := parseFlexibleDate(rd); err == nil {
			c.ReleaseDate = &t
			if c.ReleaseYear == nil {
				yr := int32(t.Year())
				c.ReleaseYear = &yr
			}
		}
	}
	if d := int32Val(payload, "durationSeconds", "duration_seconds"); d > 0 {
		c.DurationSeconds = &d
	}
	if p := floatVal(payload, "rentPrice", "rent_price", "tvodPrice", "tvod_price", "price"); p > 0 {
		c.RentPrice = &p
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&c).Error; err != nil {
			return err
		}
		hls := strVal(payload, "hlsUrl", "hls_url", "streamUrl", "stream_url", "videoUrl", "video_url")
		guid := strVal(payload, "bunnyVideoGuid", "bunny_video_guid", "bunnyVideoId")
		mv := models.Movie{
			ContentId:       &c.ID,
			HlsUrl:          ptrStr(hls),
			StreamUrl:       ptrStr(hls),
			VideoUrl:        ptrStr(hls),
			BunnyVideoGuid:  ptrStr(guid),
			DurationSeconds: c.DurationSeconds,
		}
		return tx.Create(&mv).Error
	})
	if err != nil {
		return nil, err
	}
	s.invalidateCatalogCache(ctx)
	return s.GetDetail(ctx, strconv.FormatInt(c.ID, 10))
}

func (s *Service) AdminUpdateMovie(ctx context.Context, id int64, payload map[string]any) (map[string]any, error) {
	var c models.Content
	if err := s.db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, errors.New("movie not found")
	}
	upd := map[string]any{"updated_at": time.Now().UTC()}
	for _, m := range [][2]string{
		{"title", "title"}, {"description", "description"}, {"synopsis", "description"},
		{"language", "original_language_code"}, {"originalLanguageCode", "original_language_code"}, {"status", "status"},
		{"posterUrl", "poster_url"}, {"backdropUrl", "backdrop_url"}, {"trailerUrl", "trailer_url"},
		{"ageRating", "age_rating"}, {"monetization", "monetization"}, {"accessType", "access_type"},
		{"contentType", "content_type"},
	} {
		if v := strVal(payload, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if bVal := strVal(payload, "bannerUrl", "banner_image_url", "landscapeUrl", "landscape_image_url", "backdropUrl", "backdrop_url", "landscapePosterUrl"); bVal != "" {
		upd["backdrop_url"] = bVal
		upd["landscape_image_url"] = bVal
		upd["banner_image_url"] = bVal
	}
	if lVal := strVal(payload, "logoImageUrl", "logo_image_url"); lVal != "" {
		upd["logo_image_url"] = lVal
	}
	if _, ok := payload["isPremium"]; ok {
		upd["is_premium"] = boolVal(payload, "isPremium")
	}
	if _, ok := payload["isFeatured"]; ok {
		upd["is_featured"] = boolVal(payload, "isFeatured")
	}
	if _, ok := payload["isTrending"]; ok {
		upd["is_trending"] = boolVal(payload, "isTrending")
	}
	if y := int32Val(payload, "releaseYear", "release_year"); y > 0 {
		upd["release_year"] = y
	}
	if rd := strVal(payload, "releaseDate", "release_date"); rd != "" {
		if t, err := parseFlexibleDate(rd); err == nil {
			upd["release_date"] = t
			if _, hasYr := upd["release_year"]; !hasYr {
				upd["release_year"] = int32(t.Year())
			}
		}
	}
	if d := int32Val(payload, "durationSeconds", "duration_seconds"); d > 0 {
		upd["duration_seconds"] = d
	}
	if p := floatVal(payload, "rentPrice", "rent_price", "tvodPrice", "tvod_price"); p > 0 {
		upd["rent_price"] = p
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Content{}).Where("id = ?", id).Updates(upd).Error; err != nil {
			return err
		}
		hls := strVal(payload, "hlsUrl", "hls_url", "streamUrl", "stream_url", "videoUrl", "video_url")
		guid := strVal(payload, "bunnyVideoGuid", "bunny_video_guid", "bunnyVideoId")
		if hls != "" || guid != "" {
			var mv models.Movie
			if tx.Where("content_id = ?", id).First(&mv).Error == nil {
				mvUpd := map[string]any{}
				if hls != "" {
					mvUpd["hls_url"] = hls
					mvUpd["stream_url"] = hls
					mvUpd["video_url"] = hls
				}
				if guid != "" {
					mvUpd["bunny_video_guid"] = guid
				}
				return tx.Model(&mv).Updates(mvUpd).Error
			}
			return tx.Create(&models.Movie{
				ContentId:      &id,
				HlsUrl:         ptrStr(hls),
				StreamUrl:      ptrStr(hls),
				VideoUrl:       ptrStr(hls),
				BunnyVideoGuid: ptrStr(guid),
			}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.invalidateCatalogCache(ctx)
	return s.GetDetail(ctx, strconv.FormatInt(id, 10))
}

func (s *Service) AdminUpdateMovieStatus(ctx context.Context, id int64, status string) (map[string]any, error) {
	st := strings.ToUpper(strings.TrimSpace(status))
	if st == "" {
		return nil, errors.New("status is required")
	}
	if err := s.db.WithContext(ctx).Model(&models.Content{}).Where("id = ?", id).
		Updates(map[string]any{"status": st, "updated_at": time.Now().UTC()}).Error; err != nil {
		return nil, err
	}
	s.invalidateCatalogCache(ctx)
	return map[string]any{"id": id, "status": st}, nil
}

func (s *Service) AdminDeleteMovie(ctx context.Context, id int64) error {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		_ = tx.Where("content_id = ?", id).Delete(&models.Movie{}).Error
		return tx.Delete(&models.Content{}, id).Error
	})
	s.invalidateCatalogCache(ctx)
	return err
}

// --- Admin Series, Seasons & Episodes CRUD ---

func (s *Service) AdminListSeries(ctx context.Context) ([]models.Content, error) {
	var rows []models.Content
	err := s.db.WithContext(ctx).Where("UPPER(content_type) = 'SERIES'").Order("id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminCreateSeries(ctx context.Context, payload map[string]any) (map[string]any, error) {
	payload["contentType"] = "SERIES"
	return s.AdminCreateMovie(ctx, payload)
}

func (s *Service) AdminListSeasons(ctx context.Context, seriesID int64) ([]models.Season, error) {
	var rows []models.Season
	err := s.db.WithContext(ctx).Where("series_id = ?", seriesID).Order("season_number ASC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminCreateSeason(ctx context.Context, seriesID int64, payload map[string]any) (*models.Season, error) {
	num := int32Val(payload, "seasonNumber", "season_number")
	if num <= 0 {
		num = 1
	}
	title := strVal(payload, "title")
	if title == "" {
		title = fmt.Sprintf("Season %d", num)
	}
	now := time.Now().UTC()
	active := true
	row := models.Season{
		SeriesId:     seriesID,
		SeasonNumber: num,
		Title:        title,
		Description:  ptrStr(strVal(payload, "description", "synopsis")),
		PosterUrl:    ptrStr(strVal(payload, "posterUrl", "poster_url")),
		IsActive:     &active,
		CreatedAt:    &now,
		UpdatedAt:    &now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) AdminDeleteSeason(ctx context.Context, seasonID int64) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		_ = tx.Where("season_id = ?", seasonID).Delete(&models.Episode{}).Error
		return tx.Delete(&models.Season{}, seasonID).Error
	})
}

func (s *Service) AdminCreateEpisode(ctx context.Context, seasonID int64, payload map[string]any) (*models.Episode, error) {
	num := int32Val(payload, "episodeNumber", "episode_number")
	if num <= 0 {
		num = 1
	}
	title := strVal(payload, "title")
	if title == "" {
		title = fmt.Sprintf("Episode %d", num)
	}
	now := time.Now().UTC()
	st := "PUBLISHED"
	row := models.Episode{
		SeasonId:       seasonID,
		EpisodeNumber:  num,
		Title:          title,
		Description:    ptrStr(strVal(payload, "description", "synopsis")),
		VideoUrl:       ptrStr(strVal(payload, "videoUrl", "video_url", "hlsUrl", "streamUrl")),
		BunnyVideoGuid: ptrStr(strVal(payload, "bunnyVideoGuid", "bunny_video_guid")),
		ThumbnailUrl:   ptrStr(strVal(payload, "thumbnailUrl", "thumbnail_url", "stillImageUrl")),
		StillImageUrl:  ptrStr(strVal(payload, "stillImageUrl", "thumbnailUrl")),
		Status:         &st,
		CreatedAt:      &now,
		UpdatedAt:      &now,
	}
	if d := int32Val(payload, "durationSeconds", "duration_seconds"); d > 0 {
		row.DurationSeconds = &d
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) AdminDeleteEpisode(ctx context.Context, episodeID int64) error {
	return s.db.WithContext(ctx).Delete(&models.Episode{}, episodeID).Error
}

// --- Live Channels & Live Events ---

func (s *Service) ListLiveChannels(ctx context.Context) ([]models.LiveChannel, error) {
	var rows []models.LiveChannel
	err := s.db.WithContext(ctx).Order("COALESCE(display_order, 0) ASC, id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) CreateLiveChannel(ctx context.Context, payload map[string]any) (*models.LiveChannel, error) {
	name := strVal(payload, "name", "title")
	stream := strVal(payload, "streamUrl", "stream_url", "hlsStreamUrl", "hls_stream_url")
	if name == "" || stream == "" {
		return nil, errors.New("name and streamUrl are required")
	}
	now := time.Now().UTC()
	active := true
	isLive := true
	row := models.LiveChannel{
		Name:         name,
		Slug:         slugify(name),
		StreamUrl:    stream,
		HlsStreamUrl: &stream,
		Description:  ptrStr(strVal(payload, "description")),
		LogoUrl:      ptrStr(strVal(payload, "logoUrl", "logo_url")),
		PosterUrl:    ptrStr(strVal(payload, "posterUrl", "poster_url")),
		Category:     ptrStr(strVal(payload, "category")),
		LanguageCode: ptrStr(strVal(payload, "languageCode", "language")),
		IsActive:     &active,
		IsLive:       &isLive,
		CreatedAt:    &now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) DeleteLiveChannel(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.LiveChannel{}, id).Error
}

func (s *Service) ListLiveEvents(ctx context.Context) ([]models.LiveEvent, error) {
	var rows []models.LiveEvent
	err := s.db.WithContext(ctx).Order("start_time DESC, id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) CreateLiveEvent(ctx context.Context, payload map[string]any) (*models.LiveEvent, error) {
	title := strVal(payload, "title", "name")
	stream := strVal(payload, "streamUrl", "stream_url", "hlsStreamUrl")
	if title == "" {
		return nil, errors.New("title is required")
	}
	now := time.Now().UTC()
	start := now
	end := now.Add(2 * time.Hour)
	if v := strVal(payload, "startTime", "start_time"); v != "" {
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			start = parsed
		}
	}
	if v := strVal(payload, "endTime", "end_time"); v != "" {
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			end = parsed
		}
	}
	st := strings.ToUpper(strVal(payload, "status"))
	if st == "" {
		st = "SCHEDULED"
	}
	row := models.LiveEvent{
		Title:        title,
		Slug:         slugify(title),
		StreamUrl:    stream,
		HlsStreamUrl: ptrStr(stream),
		Description:  ptrStr(strVal(payload, "description")),
		PosterUrl:    ptrStr(strVal(payload, "posterUrl", "poster_url")),
		StartTime:    start,
		EndTime:      end,
		Status:       st,
		CreatedAt:    &now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) DeleteLiveEvent(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.LiveEvent{}, id).Error
}

// --- Admin Intro Videos & Portal Banners CRUD ---

func (s *Service) AdminListIntroVideos(ctx context.Context) ([]models.IntroVideo, error) {
	var rows []models.IntroVideo
	err := s.db.WithContext(ctx).Order("display_order ASC, id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminCreateIntroVideo(ctx context.Context, payload map[string]any) (*models.IntroVideo, error) {
	title := strVal(payload, "title")
	videoURL := strVal(payload, "videoUrl", "video_url")
	if title == "" || videoURL == "" {
		return nil, errors.New("title and videoUrl are required")
	}
	now := time.Now().UTC()
	row := models.IntroVideo{
		Title:        title,
		Description:  ptrStr(strVal(payload, "description")),
		VideoUrl:     videoURL,
		PosterUrl:    ptrStr(strVal(payload, "posterUrl", "poster_url")),
		CtaLabel:     ptrStr(strVal(payload, "ctaLabel", "cta_label")),
		IsActive:     boolVal(payload, "isActive", "is_active"),
		DisplayOrder: int32Val(payload, "displayOrder", "display_order"),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) AdminUpdateIntroVideo(ctx context.Context, id int64, payload map[string]any) (*models.IntroVideo, error) {
	upd := map[string]any{"updated_at": time.Now().UTC()}
	for _, m := range [][2]string{
		{"title", "title"}, {"description", "description"}, {"videoUrl", "video_url"},
		{"posterUrl", "poster_url"}, {"ctaLabel", "cta_label"},
	} {
		if v := strVal(payload, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := payload["isActive"]; ok {
		upd["is_active"] = boolVal(payload, "isActive")
	}
	if err := s.db.WithContext(ctx).Model(&models.IntroVideo{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	var out models.IntroVideo
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminActivateIntroVideo(ctx context.Context, id int64) (*models.IntroVideo, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.IntroVideo{}).Where("1 = 1").Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&models.IntroVideo{}).Where("id = ?", id).Updates(map[string]any{"is_active": true, "updated_at": time.Now().UTC()}).Error
	})
	if err != nil {
		return nil, err
	}
	var out models.IntroVideo
	err = s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminDeleteIntroVideo(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.IntroVideo{}, id).Error
}

func (s *Service) AdminListPortalBanners(ctx context.Context) ([]models.PortalBanner, error) {
	var rows []models.PortalBanner
	err := s.db.WithContext(ctx).Order("display_order ASC, id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminCreatePortalBanner(ctx context.Context, payload map[string]any) (*models.PortalBanner, error) {
	title := strVal(payload, "title")
	img := strVal(payload, "imageUrl", "image_url")
	if title == "" || img == "" {
		return nil, errors.New("title and imageUrl are required")
	}
	now := time.Now().UTC()
	row := models.PortalBanner{
		Title:          title,
		Subtitle:       ptrStr(strVal(payload, "subtitle")),
		ImageUrl:       img,
		MobileImageUrl: ptrStr(strVal(payload, "mobileImageUrl", "mobile_image_url")),
		TargetUrl:      strVal(payload, "targetUrl", "target_url"),
		PortalKey:      strVal(payload, "portalKey", "portal_key"),
		ButtonLabel:    ptrStr(strVal(payload, "buttonLabel", "button_label")),
		DisplayOrder:   int32Val(payload, "displayOrder", "display_order"),
		IsActive:       true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) AdminUpdatePortalBanner(ctx context.Context, id int64, payload map[string]any) (*models.PortalBanner, error) {
	upd := map[string]any{"updated_at": time.Now().UTC()}
	for _, m := range [][2]string{
		{"title", "title"}, {"subtitle", "subtitle"}, {"imageUrl", "image_url"},
		{"mobileImageUrl", "mobile_image_url"}, {"targetUrl", "target_url"},
		{"portalKey", "portal_key"}, {"buttonLabel", "button_label"},
	} {
		if v := strVal(payload, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := payload["isActive"]; ok {
		upd["is_active"] = boolVal(payload, "isActive")
	}
	if err := s.db.WithContext(ctx).Model(&models.PortalBanner{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	var out models.PortalBanner
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminTogglePortalBanner(ctx context.Context, id int64) (*models.PortalBanner, error) {
	var row models.PortalBanner
	if err := s.db.WithContext(ctx).First(&row, id).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).Model(&row).Updates(map[string]any{"is_active": !row.IsActive, "updated_at": time.Now().UTC()}).Error
	row.IsActive = !row.IsActive
	return &row, nil
}

func (s *Service) AdminDeletePortalBanner(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.PortalBanner{}, id).Error
}

// --- Storage, Bunny Direct Upload & Media Serving Proxy ---

func (s *Service) UploadMedia(ctx context.Context, folder, fileName string, data []byte, contentType string) (map[string]any, error) {
	client := bunny.NewStorageClientFromEnv(s.publicBaseURL)
	return client.UploadFile(ctx, folder, fileName, data, contentType)
}

func (s *Service) DirectUploadToken(ctx context.Context, title string) (map[string]any, error) {
	if strings.TrimSpace(title) == "" {
		title = fmt.Sprintf("MaxxPixels Upload %d", time.Now().Unix())
	}
	client := bunny.NewStreamClientFromEnv()
	guid, err := client.CreateVideo(ctx, title)
	if err != nil {
		return nil, err
	}
	exp := time.Now().Add(6 * time.Hour).Unix()
	sig := client.SignTusUpload(guid, exp)
	hls := ""
	if client.CDNHostname != "" {
		hls = fmt.Sprintf("https://%s/%s/playlist.m3u8", client.CDNHostname, guid)
	}
	return map[string]any{
		"videoId":        guid,
		"bunnyVideoGuid": guid,
		"libraryId":      client.LibraryID,
		"expirationTime": exp,
		"signature":      sig,
		"tusEndpoint":    "https://video.bunnycdn.com/tusupload",
		"hlsUrl":         hls,
	}, nil
}

func (s *Service) UploadVideo(ctx context.Context, title string, data []byte) (map[string]any, error) {
	client := bunny.NewStreamClientFromEnv()
	guid, err := client.CreateVideo(ctx, title)
	if err != nil {
		return nil, err
	}
	if err := client.UploadVideoBytes(ctx, guid, data); err != nil {
		return nil, err
	}
	hls := ""
	if client.CDNHostname != "" {
		hls = fmt.Sprintf("https://%s/%s/playlist.m3u8", client.CDNHostname, guid)
	}
	return map[string]any{
		"videoId":        guid,
		"bunnyVideoGuid": guid,
		"hlsUrl":         hls,
		"streamUrl":      hls,
		"status":         "UPLOADED",
	}, nil
}

func (s *Service) ServeMedia(ctx context.Context, folder, fileName string) ([]byte, string, bool) {
	cleanName := filepath.Base(fileName)
	if cleanName == "" || cleanName == "." || strings.Contains(fileName, "..") {
		return nil, "", false
	}
	// 1. Check local disk ./uploads first
	localPaths := []string{filepath.Join("./uploads", folder, cleanName), filepath.Join("./uploads", cleanName)}
	for _, p := range localPaths {
		if data, err := os.ReadFile(p); err == nil && len(data) > 0 {
			return data, bunny.GuessMime(cleanName), true
		}
	}
	// 2. Fallback to Bunny Edge Storage API proxy
	client := bunny.NewStorageClientFromEnv(s.publicBaseURL)
	return client.DownloadFile(ctx, folder, cleanName)
}

// --- JSON Map Helpers ---

func parseFlexibleDate(raw string) (time.Time, error) {
	s := strings.TrimSpace(raw)
	for _, layout := range []string{"2006-01-02", time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		}
	}
	if len(s) >= 10 {
		if t, err := time.Parse("2006-01-02", s[:10]); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, errors.New("invalid date")
}

func strVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func boolVal(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if b, ok := v.(bool); ok {
				return b
			}
		}
	}
	return false
}

func int32Val(m map[string]any, keys ...string) int32 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch n := v.(type) {
			case float64:
				return int32(n)
			case int:
				return int32(n)
			case int64:
				return int32(n)
			}
		}
	}
	return 0
}

func floatVal(m map[string]any, keys ...string) float64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return f
			}
		}
	}
	return 0
}

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
