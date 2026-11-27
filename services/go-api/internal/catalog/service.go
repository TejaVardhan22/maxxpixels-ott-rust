package catalog

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type Service struct {
	db            *gorm.DB
	cache         *cache.Store
	publicBaseURL string
}

func NewService(db *gorm.DB, cacheStore *cache.Store, publicBaseURL string) *Service {
	return &Service{db: db, cache: cacheStore, publicBaseURL: strings.TrimRight(publicBaseURL, "/")}
}

type BrowseFilter struct {
	Query       string
	ContentType string
	Language    string
	Category    string
	Genre       string
	Featured    bool
	Trending    bool
	Page        int
	Size        int
}

func applyLanguageFilter(q *gorm.DB, lang string) *gorm.DB {
	l := strings.ToLower(strings.TrimSpace(lang))
	switch l {
	case "", "all":
		return q
	case "kannada", "kn":
		return q.Where("LOWER(COALESCE(original_language_code, '')) IN ('kn', 'kannada')")
	case "non-kannada", "all-indian", "all_indian":
		return q.Where("LOWER(COALESCE(original_language_code, '')) NOT IN ('', 'kn', 'kannada')")
	default:
		return q.Where("LOWER(COALESCE(original_language_code, '')) = ?", l)
	}
}

func (s *Service) Browse(ctx context.Context, f BrowseFilter) ([]models.Content, int64, error) {
	if f.Size <= 0 || f.Size > 100 {
		f.Size = 24
	}
	if f.Page < 0 {
		f.Page = 0
	}

	q := s.db.WithContext(ctx).Model(&models.Content{}).
		Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE', 'UPCOMING')")

	if f.Query != "" {
		like := "%" + strings.TrimSpace(f.Query) + "%"
		q = q.Where("title ILIKE ? OR description ILIKE ? OR slug ILIKE ?", like, like, like)
	}
	if f.ContentType != "" {
		ct := strings.ToUpper(strings.TrimSpace(f.ContentType))
		q = q.Where("UPPER(COALESCE(content_type, type, '')) = ?", ct)
	}
	q = applyLanguageFilter(q, f.Language)
	if f.Featured {
		q = q.Where("is_featured = TRUE")
	}
	if f.Trending {
		q = q.Where("is_trending = TRUE")
	}
	if f.Category != "" {
		if cid, err := strconv.ParseInt(f.Category, 10, 64); err == nil {
			q = q.Joins("JOIN content_categories cc ON cc.content_id = contents.id").Where("cc.category_id = ?", cid)
		} else {
			q = q.Joins("JOIN content_categories cc ON cc.content_id = contents.id").
				Joins("JOIN categories c ON c.id = cc.category_id").
				Where("LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?)", f.Category, f.Category)
		}
	}
	if f.Genre != "" {
		if gid, err := strconv.ParseInt(f.Genre, 10, 64); err == nil {
			q = q.Joins("JOIN content_genres cg ON cg.content_id = contents.id").Where("cg.genre_id = ?", gid)
		} else {
			q = q.Joins("JOIN content_genres cg ON cg.content_id = contents.id").
				Joins("JOIN genres g ON g.id = cg.genre_id").
				Where("LOWER(g.slug) = LOWER(?) OR LOWER(g.name) = LOWER(?)", f.Genre, f.Genre)
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []models.Content
	err := q.Order("COALESCE(view_count, 0) DESC, id DESC").
		Offset(f.Page * f.Size).
		Limit(f.Size).
		Find(&items).Error
	return items, total, err
}

func (s *Service) GetTrending(ctx context.Context, limit int) ([]models.Content, error) {
	if limit <= 0 || limit > 60 {
		limit = 30
	}
	key := fmt.Sprintf("cat:trending:%d", limit)
	return cache.GetOrLoadJSON(ctx, s.cache, key, 60*time.Second, func(c context.Context) ([]models.Content, error) {
		var items []models.Content
		err := s.db.WithContext(c).
			Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE')").
			Order("is_trending DESC NULLS LAST, COALESCE(view_count, 0) DESC, id DESC").
			Limit(limit).
			Find(&items).Error
		return items, err
	})
}

func (s *Service) GetByLanguage(ctx context.Context, language string, limit int) ([]models.Content, error) {
	if limit <= 0 || limit > 100 {
		limit = 60
	}
	key := fmt.Sprintf("cat:lang:%s:%d", strings.ToLower(strings.TrimSpace(language)), limit)
	return cache.GetOrLoadJSON(ctx, s.cache, key, 60*time.Second, func(c context.Context) ([]models.Content, error) {
		var items []models.Content
		q := s.db.WithContext(c).Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE', 'UPCOMING')")
		q = applyLanguageFilter(q, language)
		err := q.Order("id DESC").Limit(limit).Find(&items).Error
		return items, err
	})
}

func (s *Service) GetDetail(ctx context.Context, idOrSlug string) (map[string]any, error) {
	var content models.Content
	var err error
	if id, pErr := strconv.ParseInt(idOrSlug, 10, 64); pErr == nil {
		err = s.db.WithContext(ctx).First(&content, id).Error
	} else {
		err = s.db.WithContext(ctx).Where("slug = ?", idOrSlug).First(&content).Error
	}
	if err != nil {
		return nil, err
	}

	var (
		seasons  []models.Season
		tvodList []models.TvodProduct
		genres   []models.Genre
	)

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		var ser models.Series
		if s.db.WithContext(gctx).Where("content_id = ?", content.ID).First(&ser).Error == nil {
			_ = s.db.WithContext(gctx).Where("series_id = ?", ser.ID).Order("season_number ASC").Find(&seasons).Error
		}
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Where("content_id = ? AND COALESCE(is_active, TRUE) = TRUE", content.ID).Find(&tvodList).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).
			Table("genres").
			Joins("JOIN content_genres cg ON cg.genre_id = genres.id").
			Where("cg.content_id = ?", content.ID).
			Find(&genres).Error
		return nil
	})
	_ = g.Wait()

	var rentPrice, purchasePrice float64
	for _, p := range tvodList {
		if strings.EqualFold(p.PurchaseType, "PURCHASE") || strings.EqualFold(p.PurchaseType, "BUY") {
			purchasePrice = p.Price
		} else {
			rentPrice = p.Price
		}
	}
	if rentPrice == 0 && content.RentPrice != nil {
		rentPrice = *content.RentPrice
	}

	genreNames := make([]string, 0, len(genres))
	for _, gr := range genres {
		genreNames = append(genreNames, gr.Name)
	}

	return map[string]any{
		"content":       content,
		"id":            content.ID,
		"title":         content.Title,
		"slug":          content.Slug,
		"description":   content.Description,
		"posterUrl":     content.PosterUrl,
		"backdropUrl":   content.BackdropUrl,
		"landscapeUrl":  content.LandscapeImageUrl,
		"monetization":  content.Monetization,
		"rentPrice":     rentPrice,
		"purchasePrice": purchasePrice,
		"genres":        genreNames,
		"seasons":       seasons,
		"tvodProducts":  tvodList,
	}, nil
}

func (s *Service) ListSeasonEpisodes(ctx context.Context, seasonID int64) ([]models.Episode, error) {
	var eps []models.Episode
	err := s.db.WithContext(ctx).Where("season_id = ?", seasonID).Order("episode_number ASC").Find(&eps).Error
	return eps, err
}

func (s *Service) ListBanners(ctx context.Context, placement, language string) ([]models.Banner, error) {
	key := fmt.Sprintf("cat:banners:%s:%s", strings.ToLower(placement), strings.ToLower(language))
	return cache.GetOrLoadJSON(ctx, s.cache, key, 60*time.Second, func(c context.Context) ([]models.Banner, error) {
		var rows []models.Banner
		q := s.db.WithContext(c).Where("COALESCE(is_active, TRUE) = TRUE")
		if placement != "" {
			q = q.Where("UPPER(COALESCE(placement, 'MOBILE')) IN (?, 'ALL')", strings.ToUpper(placement))
		}
		err := q.Order("COALESCE(display_order, 0) ASC, id DESC").Limit(15).Find(&rows).Error
		return rows, err
	})
}

func (s *Service) ListSections(ctx context.Context, language string) ([]map[string]any, error) {
	key := fmt.Sprintf("cat:sections:%s", strings.ToLower(language))
	return cache.GetOrLoadJSON(ctx, s.cache, key, 60*time.Second, func(c context.Context) ([]map[string]any, error) {
		var secs []models.Section
		if err := s.db.WithContext(c).
			Where("COALESCE(is_active, TRUE) = TRUE").
			Order("COALESCE(display_order, 0) ASC, id ASC").
			Find(&secs).Error; err != nil {
			return nil, err
		}

		out := make([]map[string]any, 0, len(secs))
		for _, sec := range secs {
			limit := 15
			if sec.AutoFetchLimit != nil && *sec.AutoFetchLimit > 0 {
				limit = int(*sec.AutoFetchLimit)
			}
			q := s.db.WithContext(c).Model(&models.Content{}).Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE')")
			q = applyLanguageFilter(q, language)
			if sec.ContentTypeFilter != nil && *sec.ContentTypeFilter != "" {
				q = q.Where("UPPER(COALESCE(content_type, type, '')) = ?", strings.ToUpper(*sec.ContentTypeFilter))
			}
			if sec.CategoryId != nil && *sec.CategoryId > 0 {
				q = q.Joins("JOIN content_categories cc ON cc.content_id = contents.id").Where("cc.category_id = ?", *sec.CategoryId)
			}
			if sec.GenreId != nil && *sec.GenreId > 0 {
				q = q.Joins("JOIN content_genres cg ON cg.content_id = contents.id").Where("cg.genre_id = ?", *sec.GenreId)
			}
			var items []models.Content
			_ = q.Order("id DESC").Limit(limit).Find(&items).Error
			if len(items) == 0 {
				continue
			}
			out = append(out, map[string]any{
				"id":       sec.ID,
				"title":    sec.Title,
				"subtitle": sec.Subtitle,
				"layout":   sec.Layout,
				"items":    items,
			})
		}
		return out, nil
	})
}

func (s *Service) GetMetadata(ctx context.Context) (map[string]any, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "cat:metadata", 120*time.Second, func(c context.Context) (map[string]any, error) {
		var (
			langs      []models.Language
			categories []models.Category
			genres     []models.Genre
			types      []models.ContentType
		)
		g, gctx := errgroup.WithContext(c)
		g.Go(func() error { return s.db.WithContext(gctx).Where("COALESCE(is_active, TRUE) = TRUE").Order("id ASC").Find(&langs).Error })
		g.Go(func() error { return s.db.WithContext(gctx).Where("COALESCE(is_active, TRUE) = TRUE").Order("COALESCE(display_order,0) ASC").Find(&categories).Error })
		g.Go(func() error { return s.db.WithContext(gctx).Order("id ASC").Find(&genres).Error })
		g.Go(func() error { return s.db.WithContext(gctx).Order("id ASC").Find(&types).Error })
		if err := g.Wait(); err != nil {
			return nil, err
		}
		return map[string]any{
			"languages":    langs,
			"categories":   categories,
			"genres":       genres,
			"contentTypes": types,
		}, nil
	})
}

func (s *Service) ListPortalBanners(ctx context.Context) ([]models.PortalBanner, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "cat:portal_banners", 60*time.Second, func(c context.Context) ([]models.PortalBanner, error) {
		var rows []models.PortalBanner
		err := s.db.WithContext(c).Where("COALESCE(is_active, TRUE) = TRUE").Order("COALESCE(display_order,0) ASC, id ASC").Find(&rows).Error
		return rows, err
	})
}

func (s *Service) GetActiveIntroVideo(ctx context.Context) (*models.IntroVideo, error) {
	var row models.IntroVideo
	err := s.db.WithContext(ctx).Where("COALESCE(is_active, FALSE) = TRUE").Order("id DESC").First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}
