package streaming

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/models"
	"gorm.io/gorm"
)

type Service struct {
	db  *gorm.DB
	cfg *config.AppConfig
}

func NewService(db *gorm.DB, cfg *config.AppConfig) *Service {
	return &Service{db: db, cfg: cfg}
}

type PlaybackAuthResult struct {
	StreamURL             string  `json:"streamUrl"`
	SessionToken          string  `json:"sessionToken"`
	ResumePositionSeconds int32   `json:"resumePositionSeconds"`
	DurationSeconds       int32   `json:"durationSeconds"`
	ShowAds               bool    `json:"showAds"`
	VastTagURL            *string `json:"vastTagUrl,omitempty"`
	IsHls                 bool    `json:"isHls"`
}

func (s *Service) AuthorizePlayback(ctx context.Context, userID, contentID int64, episodeID *int64) (*PlaybackAuthResult, error) {
	var content models.Content
	if err := s.db.WithContext(ctx).First(&content, contentID).Error; err != nil {
		return nil, errors.New("content not found")
	}

	monetization := strings.ToUpper(deref(content.Monetization))
	if monetization == "" {
		monetization = strings.ToUpper(deref(content.AccessType))
	}

	hasActiveSub := s.hasActiveSubscription(ctx, userID)
	hasTvod := s.hasActiveTvod(ctx, userID, contentID)

	isTVOD := monetization == "TVOD" || monetization == "RENT"
	isSVOD := monetization == "SVOD" || (!isTVOD && monetization != "AVOD" && monetization != "FREE" && content.IsPremium != nil && *content.IsPremium)

	if isTVOD && !hasTvod {
		return nil, errors.New("TVOD rental or purchase required to watch this title")
	}
	if isSVOD && !hasActiveSub && !hasTvod {
		return nil, errors.New("active VIP subscription required to watch this title")
	}

	streamURL := s.resolveStreamURL(ctx, contentID, episodeID)
	if streamURL == "" {
		return nil, errors.New("stream URL unavailable for this title")
	}
	streamURL = s.signBunnyURL(streamURL)

	// Resolve resume position from watch_history
	var hist models.WatchHistory
	var resumeSec int32
	if s.db.WithContext(ctx).
		Where("user_id = ? AND content_id = ?", userID, contentID).
		Order("last_watched_at DESC").
		First(&hist).Error == nil && hist.PositionSeconds != nil {
		resumeSec = *hist.PositionSeconds
	}

	var durSec int32
	if content.DurationSeconds != nil {
		durSec = *content.DurationSeconds
	}

	// Create playback session token
	sessionTok := uuid.NewString()
	now := time.Now().UTC()
	active := true
	status := "ACTIVE"
	_ = s.db.WithContext(ctx).Create(&models.PlaybackSession{
		SessionId:       sessionTok,
		SessionToken:    &sessionTok,
		UserId:          &userID,
		ContentId:       contentID,
		EpisodeId:       episodeID,
		Status:          &status,
		IsActive:        &active,
		StartedAt:       &now,
		LastHeartbeat:   &now,
		LastHeartbeatAt: &now,
	}).Error

	showAds := (monetization == "AVOD" || monetization == "FREE") && !hasActiveSub
	var vastURL *string
	if showAds {
		v := fmt.Sprintf("%s/api/v1/ads/vast?contentId=%d", strings.TrimRight(s.cfg.PublicBaseURL, "/"), contentID)
		vastURL = &v
	}

	return &PlaybackAuthResult{
		StreamURL:             streamURL,
		SessionToken:          sessionTok,
		ResumePositionSeconds: resumeSec,
		DurationSeconds:       durSec,
		ShowAds:               showAds,
		VastTagURL:            vastURL,
		IsHls:                 strings.Contains(strings.ToLower(streamURL), ".m3u8"),
	}, nil
}

func (s *Service) SaveProgress(ctx context.Context, userID, contentID int64, episodeID *int64, posSec, durSec int32, sessionToken string) error {
	now := time.Now().UTC()
	if sessionToken != "" {
		_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
			Where("session_token = ?", sessionToken).
			Update("last_heartbeat_at", now).Error
	}

	profileID := s.defaultProfileID(ctx, userID)
	var pct float64
	if durSec > 0 {
		pct = (float64(posSec) / float64(durSec)) * 100.0
		if pct > 100 {
			pct = 100
		}
	}
	completed := pct >= 92.0

	var existing models.WatchHistory
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND content_id = ?", userID, contentID).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := models.WatchHistory{
			UserId:                &userID,
			ProfileId:             profileID,
			ContentId:             contentID,
			EpisodeId:             episodeID,
			PositionSeconds:       &posSec,
			DurationSeconds:       &durSec,
			WatchedSeconds:        &posSec,
			TotalDurationSeconds:  &durSec,
			Percentage:            &pct,
			Completed:             &completed,
			IsCompleted:           &completed,
			LastWatchedAt:         &now,
		}
		return s.db.WithContext(ctx).Create(&row).Error
	} else if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Model(&models.WatchHistory{}).Where("id = ?", existing.ID).Updates(map[string]any{
		"position_seconds":       posSec,
		"duration_seconds":       durSec,
		"watched_seconds":        posSec,
		"total_duration_seconds": durSec,
		"percentage":             pct,
		"completed":              completed,
		"is_completed":           completed,
		"last_watched_at":        now,
	}).Error
}

func (s *Service) StopSession(ctx context.Context, userID, contentID int64, posSec, durSec int32, sessionToken string) error {
	if sessionToken != "" {
		_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
			Where("session_token = ?", sessionToken).
			Updates(map[string]any{"is_active": false, "last_heartbeat_at": time.Now().UTC()}).Error
	}
	if posSec > 0 && contentID > 0 {
		return s.SaveProgress(ctx, userID, contentID, nil, posSec, durSec, "")
	}
	return nil
}

func (s *Service) GetContinueWatching(ctx context.Context, userID int64) ([]map[string]any, error) {
	var rows []models.WatchHistory
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND COALESCE(completed, FALSE) = FALSE AND COALESCE(position_seconds, 0) > 0", userID).
		Order("last_watched_at DESC").
		Limit(20).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return s.hydrateHistory(ctx, rows), nil
}

func (s *Service) GetWatchHistory(ctx context.Context, userID int64) ([]map[string]any, error) {
	var rows []models.WatchHistory
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("last_watched_at DESC").
		Limit(50).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return s.hydrateHistory(ctx, rows), nil
}

func (s *Service) GetWatchlist(ctx context.Context, userID int64) ([]map[string]any, error) {
	var rows []models.Watchlist
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(100).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []map[string]any{}, nil
	}

	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ContentId)
	}
	var contents []models.Content
	_ = s.db.WithContext(ctx).Where("id IN ?", ids).Find(&contents).Error
	byID := make(map[int64]models.Content, len(contents))
	for _, c := range contents {
		byID[c.ID] = c
	}

	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		c, ok := byID[r.ContentId]
		if !ok {
			continue
		}
		out = append(out, map[string]any{
			"id":              r.ID,
			"contentId":       c.ID,
			"videoId":         c.ID,
			"isBookmark":      1,
			"title":           c.Title,
			"slug":            c.Slug,
			"posterUrl":       deref(c.PosterUrl),
			"backdropUrl":     deref(c.BackdropUrl),
			"contentType":     deref(c.ContentType),
			"releaseYear":     c.ReleaseYear,
			"maturityRating":  c.AgeRating,
			"durationSeconds": c.DurationSeconds,
			"isPremium":       c.IsPremium != nil && *c.IsPremium,
			"addedAt":         r.CreatedAt.Format(time.RFC3339),
		})
	}
	return out, nil
}

func (s *Service) ToggleWatchlist(ctx context.Context, userID, contentID int64) (bool, error) {
	pid := s.defaultProfileID(ctx, userID)
	var existing models.Watchlist
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND content_id = ?", userID, contentID).
		First(&existing).Error
	if err == nil {
		_ = s.db.WithContext(ctx).Delete(&existing).Error
		return false, nil
	}
	now := time.Now().UTC()
	row := models.Watchlist{
		UserId:    &userID,
		ProfileId: pid,
		ContentId: contentID,
		CreatedAt: now,
		AddedAt:   &now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) RemoveFromWatchlist(ctx context.Context, userID, contentID int64) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND (content_id = ? OR id = ?)", userID, contentID, contentID).
		Delete(&models.Watchlist{}).Error
}

func (s *Service) hydrateHistory(ctx context.Context, rows []models.WatchHistory) []map[string]any {
	if len(rows) == 0 {
		return []map[string]any{}
	}
	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ContentId)
	}
	var contents []models.Content
	_ = s.db.WithContext(ctx).Where("id IN ?", ids).Find(&contents).Error
	byID := make(map[int64]models.Content, len(contents))
	for _, c := range contents {
		byID[c.ID] = c
	}

	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		c, ok := byID[r.ContentId]
		if !ok {
			continue
		}
		var pos, dur int32
		if r.PositionSeconds != nil {
			pos = *r.PositionSeconds
		}
		if r.DurationSeconds != nil {
			dur = *r.DurationSeconds
		}
		var pct float64
		if r.Percentage != nil {
			pct = *r.Percentage
		}
		out = append(out, map[string]any{
			"id":              r.ID,
			"contentId":       c.ID,
			"episodeId":       r.EpisodeId,
			"profileId":       r.ProfileId,
			"title":           c.Title,
			"slug":            c.Slug,
			"posterUrl":       deref(c.PosterUrl),
			"backdropUrl":     deref(c.BackdropUrl),
			"contentType":     deref(c.ContentType),
			"positionSeconds": pos,
			"durationSeconds": dur,
			"percentage":      pct,
			"completed":       r.Completed != nil && *r.Completed,
		})
	}
	return out
}

func (s *Service) hasActiveSubscription(ctx context.Context, userID int64) bool {
	var cnt int64
	_ = s.db.WithContext(ctx).Model(&models.Subscription{}).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", userID, time.Now().UTC()).
		Count(&cnt).Error
	return cnt > 0
}

func (s *Service) hasActiveTvod(ctx context.Context, userID, contentID int64) bool {
	var cnt int64
	_ = s.db.WithContext(ctx).Model(&models.ContentPurchase{}).
		Where("user_id = ? AND content_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > ?)", userID, contentID, time.Now().UTC()).
		Count(&cnt).Error
	return cnt > 0
}

func (s *Service) defaultProfileID(ctx context.Context, userID int64) int64 {
	var p models.Profile
	if s.db.WithContext(ctx).Where("user_id = ?", userID).Order("id ASC").First(&p).Error == nil {
		return p.ID
	}
	return 1
}

func (s *Service) resolveStreamURL(ctx context.Context, contentID int64, episodeID *int64) string {
	if episodeID != nil && *episodeID > 0 {
		var ep models.Episode
		if s.db.WithContext(ctx).First(&ep, *episodeID).Error == nil {
			if ep.VideoUrl != nil && *ep.VideoUrl != "" {
				return *ep.VideoUrl
			}
			if ep.BunnyVideoGuid != nil && *ep.BunnyVideoGuid != "" && s.cfg.BunnyStreamCDNHostname != "" {
				return fmt.Sprintf("https://%s/%s/playlist.m3u8", s.cfg.BunnyStreamCDNHostname, *ep.BunnyVideoGuid)
			}
		}
	}
	var mv models.Movie
	if s.db.WithContext(ctx).Where("content_id = ?", contentID).First(&mv).Error == nil {
		if mv.HlsUrl != nil && *mv.HlsUrl != "" {
			return *mv.HlsUrl
		}
		if mv.StreamUrl != nil && *mv.StreamUrl != "" {
			return *mv.StreamUrl
		}
		if mv.VideoUrl != nil && *mv.VideoUrl != "" {
			return *mv.VideoUrl
		}
		if mv.BunnyVideoGuid != nil && *mv.BunnyVideoGuid != "" && s.cfg.BunnyStreamCDNHostname != "" {
			return fmt.Sprintf("https://%s/%s/playlist.m3u8", s.cfg.BunnyStreamCDNHostname, *mv.BunnyVideoGuid)
		}
	}
	return ""
}

func (s *Service) signBunnyURL(rawURL string) string {
	key := strings.TrimSpace(s.cfg.BunnyStreamTokenAuthKey)
	if key == "" || !strings.Contains(rawURL, s.cfg.BunnyStreamCDNHostname) {
		return rawURL
	}
	expires := time.Now().Add(4 * time.Hour).Unix()
	idx := strings.Index(rawURL, "://")
	if idx < 0 {
		return rawURL
	}
	rest := rawURL[idx+3:]
	slash := strings.Index(rest, "/")
	if slash < 0 {
		return rawURL
	}
	path := rest[slash:]
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s%s%d", key, path, expires)))
	tok := strings.NewReplacer("+", "-", "/", "_", "=", "").Replace(base64.StdEncoding.EncodeToString(sum[:]))
	sep := "?"
	if strings.Contains(rawURL, "?") {
		sep = "&"
	}
	return fmt.Sprintf("%s%stoken=%s&expires=%d", rawURL, sep, tok, expires)
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
