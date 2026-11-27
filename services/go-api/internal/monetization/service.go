package monetization

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/models"
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

func (s *Service) ListActiveCampaigns(ctx context.Context) ([]models.AdCampaign, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "monetization:active_campaigns", 30*time.Second, func(c context.Context) ([]models.AdCampaign, error) {
		var rows []models.AdCampaign
		err := s.db.WithContext(c).
			Where("COALESCE(is_active, TRUE) = TRUE AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'").
			Order("id DESC").
			Limit(20).
			Find(&rows).Error
		return rows, err
	})
}

// BuildVastXML generates a standards-compliant VAST 3.0 XML document for pre-roll playback.
func (s *Service) BuildVastXML(ctx context.Context) (string, error) {
	campaigns, err := s.ListActiveCampaigns(ctx)
	if err != nil || len(campaigns) == 0 {
		return `<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>`, nil
	}

	var chosen *models.AdCampaign
	for i := range campaigns {
		if campaigns[i].VideoUrl != nil && strings.HasPrefix(*campaigns[i].VideoUrl, "http") {
			chosen = &campaigns[i]
			break
		}
	}
	if chosen == nil {
		return `<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>`, nil
	}

	dur := 15
	if chosen.DurationSeconds != nil && *chosen.DurationSeconds > 0 {
		dur = int(*chosen.DurationSeconds)
	}
	skip := 5
	if chosen.SkipOffsetSeconds != nil && *chosen.SkipOffsetSeconds > 0 {
		skip = int(*chosen.SkipOffsetSeconds)
	}
	clickURL := ""
	if chosen.ClickThroughUrl != nil && *chosen.ClickThroughUrl != "" {
		clickURL = *chosen.ClickThroughUrl
	} else if chosen.ClickUrl != nil {
		clickURL = *chosen.ClickUrl
	}
	impURL := fmt.Sprintf("%s/api/v1/ads/track/impression/%d", s.publicBaseURL, chosen.ID)
	mediaType := "video/mp4"
	if strings.Contains(strings.ToLower(*chosen.VideoUrl), ".m3u8") {
		mediaType = "application/x-mpegURL"
	}

	var titleEsc bytes.Buffer
	_ = xml.EscapeText(&titleEsc, []byte(chosen.CampaignName))

	clickBlock := ""
	if clickURL != "" {
		clickBlock = fmt.Sprintf(`<VideoClicks><ClickThrough><![CDATA[%s]]></ClickThrough></VideoClicks>`, clickURL)
	}

	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="%d">
    <InLine>
      <AdSystem>MaxxPixels Go AdServer</AdSystem>
      <AdTitle>%s</AdTitle>
      <Impression><![CDATA[%s]]></Impression>
      <Creatives>
        <Creative>
          <Linear skipoffset="00:00:%02d">
            <Duration>00:00:%02d</Duration>
            %s
            <MediaFiles>
              <MediaFile delivery="progressive" type="%s" width="1280" height="720"><![CDATA[%s]]></MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`, chosen.ID, titleEsc.String(), impURL, skip, dur, clickBlock, mediaType, *chosen.VideoUrl), nil
}

func (s *Service) TrackAdEvent(ctx context.Context, campaignID int64, eventType string, contentID *int64) error {
	now := time.Now().UTC()
	ev := models.AdEvent{
		SessionToken: uuid.NewString(),
		CampaignId:   &campaignID,
		EventType:    strings.ToUpper(eventType),
		ContentId:    contentID,
		DedupKey:     uuid.NewString(),
		CreatedAt:    &now,
	}
	_ = s.db.WithContext(ctx).Create(&ev).Error

	col := "impressions_count"
	if strings.EqualFold(eventType, "CLICK") {
		col = "clicks_count"
	}
	return s.db.WithContext(ctx).Model(&models.AdCampaign{}).Where("id = ?", campaignID).
		Update(col, gorm.Expr("COALESCE("+col+", 0) + 1")).Error
}

func (s *Service) ValidateMarketingAgent(ctx context.Context, code string) (*models.MarketingAgent, error) {
	var agent models.MarketingAgent
	err := s.db.WithContext(ctx).
		Where("UPPER(agent_code) = UPPER(?) AND UPPER(status) = 'ACTIVE'", strings.TrimSpace(code)).
		First(&agent).Error
	if err != nil {
		return nil, err
	}
	return &agent, nil
}

func (s *Service) ListProducers(ctx context.Context) ([]models.ProducerProfile, error) {
	var rows []models.ProducerProfile
	err := s.db.WithContext(ctx).Order("id DESC").Limit(100).Find(&rows).Error
	return rows, err
}

func (s *Service) ListMarketingAgents(ctx context.Context) ([]models.MarketingAgent, error) {
	var rows []models.MarketingAgent
	err := s.db.WithContext(ctx).Order("id DESC").Limit(100).Find(&rows).Error
	return rows, err
}
