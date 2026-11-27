package streaming

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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

type AuthorizeInput struct {
	UserID     *int64
	ContentID  int64
	EpisodeID  *int64
	ProfileID  *int64
	DeviceID   string
	DeviceType string
	IsTrailer  bool
	IPAddress  string
}

type PlaybackAuthResult struct {
	Authorized            bool             `json:"authorized"`
	ContentID             int64            `json:"contentId"`
	SessionID             string           `json:"sessionId"`
	SessionToken          string           `json:"sessionToken"`
	StreamURL             string           `json:"streamUrl"`
	HlsURL                string           `json:"hlsUrl"`
	MasterPlaylistURL     string           `json:"masterPlaylistUrl"`
	BunnyVideoID          string           `json:"bunnyVideoId"`
	ResumePositionSeconds int32            `json:"resumePositionSeconds"`
	DurationSeconds       int32            `json:"durationSeconds"`
	IsTrailer             bool             `json:"isTrailer"`
	Subtitles             []map[string]any `json:"subtitles"`
	AudioTracks           []map[string]any `json:"audioTracks"`
	ContentWarnings       []string         `json:"contentWarnings"`
	SkipIntroStart        *int32           `json:"skipIntroStart,omitempty"`
	SkipIntroEnd          *int32           `json:"skipIntroEnd,omitempty"`
	SkipOutroStart        *int32           `json:"skipOutroStart,omitempty"`
	ShowAds               bool             `json:"showAds"`
	VastTagURL            *string          `json:"vastTagUrl,omitempty"`
	IsHls                 bool             `json:"isHls"`
	MaxVideoQuality       string           `json:"maxVideoQuality"`
	MaxResolution         string           `json:"maxResolution"`
	MaxConcurrentStreams  int              `json:"maxConcurrentStreams"`
	AllowDownloads        bool             `json:"allowDownloads"`
	PlanCode              string           `json:"planCode"`
	PlanName              string           `json:"planName"`
}

// PlanEntitlements holds the resolved runtime playback limits for a user's active subscription plan.
type PlanEntitlements struct {
	HasActivePlan        bool
	PlanCode             string
	PlanName             string
	MaxConcurrentStreams int
	MaxDevices           int
	MaxProfiles          int
	MaxVideoQuality      string
	AdsEnabled           bool
	AllowDownloads       bool
}

func resolveEntitlementsFromPlan(p *models.Plan) PlanEntitlements {
	if p == nil {
		return PlanEntitlements{
			HasActivePlan:        false,
			PlanCode:             "FREE",
			PlanName:             "Free",
			MaxConcurrentStreams: 1,
			MaxDevices:           2,
			MaxProfiles:          1,
			MaxVideoQuality:      "480p",
			AdsEnabled:           true,
			AllowDownloads:       false,
		}
	}
	ent := PlanEntitlements{
		HasActivePlan:        true,
		PlanCode:             p.Code,
		PlanName:             p.Name,
		MaxConcurrentStreams: 1,
		MaxDevices:           2,
		MaxProfiles:          1,
		MaxVideoQuality:      "1080p",
		AdsEnabled:           false,
		AllowDownloads:       false,
	}
	if p.MaxConcurrentStreams != nil && *p.MaxConcurrentStreams > 0 {
		ent.MaxConcurrentStreams = int(*p.MaxConcurrentStreams)
	}
	if p.MaxDevices != nil && *p.MaxDevices > 0 {
		ent.MaxDevices = int(*p.MaxDevices)
	} else if p.MaxRegisteredDevices != nil && *p.MaxRegisteredDevices > 0 {
		ent.MaxDevices = int(*p.MaxRegisteredDevices)
	}
	if p.MaxProfiles != nil && *p.MaxProfiles > 0 {
		ent.MaxProfiles = int(*p.MaxProfiles)
	}
	if p.MaxVideoQuality != nil && strings.TrimSpace(*p.MaxVideoQuality) != "" {
		ent.MaxVideoQuality = strings.TrimSpace(*p.MaxVideoQuality)
	} else if p.MaxResolution != nil && strings.TrimSpace(*p.MaxResolution) != "" {
		ent.MaxVideoQuality = strings.TrimSpace(*p.MaxResolution)
	}
	if (p.AdsEnabled != nil && *p.AdsEnabled) || (p.HasAds != nil && *p.HasAds) {
		ent.AdsEnabled = true
	}
	if (p.AllowDownloads != nil && *p.AllowDownloads) || (p.DownloadsEnabled != nil && *p.DownloadsEnabled) || (p.DownloadAllowed != nil && *p.DownloadAllowed) {
		ent.AllowDownloads = true
	}
	return ent
}

func (s *Service) resolveUserEntitlements(ctx context.Context, userID int64) PlanEntitlements {
	var activeSub models.Subscription
	if s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", userID, time.Now().UTC()).
		Order("end_date DESC").First(&activeSub).Error == nil {
		var p models.Plan
		if s.db.WithContext(ctx).First(&p, activeSub.PlanId).Error == nil {
			return resolveEntitlementsFromPlan(&p)
		}
		// Active subscription exists even if plan row lookup fails
		ent := resolveEntitlementsFromPlan(nil)
		ent.HasActivePlan = true
		ent.AdsEnabled = false
		return ent
	}
	return resolveEntitlementsFromPlan(nil)
}

func (s *Service) AuthorizePlayback(ctx context.Context, in AuthorizeInput) (*PlaybackAuthResult, error) {
	var content models.Content
	if err := s.db.WithContext(ctx).First(&content, in.ContentID).Error; err != nil {
		return nil, errors.New("content not found")
	}

	monetization := strings.ToUpper(deref(content.Monetization))
	if monetization == "" {
		monetization = strings.ToUpper(deref(content.AccessType))
	}

	ent := resolveEntitlementsFromPlan(nil)
	var isAdmin bool
	var hasTvod bool
	if !in.IsTrailer {
		if in.UserID == nil || *in.UserID <= 0 {
			return nil, errors.New("authentication required to watch content")
		}
		uid := *in.UserID
		isAdmin = s.isAdminUser(ctx, uid)
		ent = s.resolveUserEntitlements(ctx, uid)
		hasTvod = s.hasActiveTvod(ctx, uid, in.ContentID)

		if !isAdmin {
			isTVOD := monetization == "TVOD" || monetization == "RENT"
			isSVOD := monetization == "SVOD" || (!isTVOD && monetization != "AVOD" && monetization != "FREE" && content.IsPremium != nil && *content.IsPremium)

			if isTVOD && !hasTvod {
				return nil, errors.New("rental required: please rent this title to watch")
			}
			if isSVOD && !ent.HasActivePlan && !hasTvod {
				return nil, errors.New("active subscription required to watch this premium title")
			}

			// Enforce plan max_concurrent_streams (2-minute heartbeat window on other devices)
			if err := s.enforceConcurrentStreamLimit(ctx, uid, in.DeviceID, ent.MaxConcurrentStreams); err != nil {
				return nil, err
			}
		}
	}

	var streamURL, bunnyVideoID string
	if in.IsTrailer {
		streamURL = deref(content.TrailerUrl)
	} else {
		streamURL, bunnyVideoID = s.resolveStreamURL(ctx, in.ContentID, in.EpisodeID)
		if streamURL == "" {
			streamURL = deref(content.TrailerUrl)
		}
	}
	if streamURL == "" {
		return nil, errors.New("stream URL unavailable for this title")
	}
	streamURL = s.signBunnyURL(streamURL)

	var resumeSec int32
	if in.UserID != nil && *in.UserID > 0 {
		var hist models.WatchHistory
		if s.db.WithContext(ctx).
			Where("user_id = ? AND content_id = ?", *in.UserID, in.ContentID).
			Order("last_watched_at DESC").
			First(&hist).Error == nil {
			alreadyDone := (hist.IsCompleted != nil && *hist.IsCompleted) || (hist.Completed != nil && *hist.Completed)
			if !alreadyDone && hist.PositionSeconds != nil {
				resumeSec = *hist.PositionSeconds
			}
		}
	}

	var durSec int32
	if content.DurationSeconds != nil {
		durSec = *content.DurationSeconds
	}

	sessionID := uuid.NewString()
	now := time.Now().UTC()
	active := true
	status := "ACTIVE"
	sess := models.PlaybackSession{
		SessionId:              sessionID,
		SessionToken:           &sessionID,
		UserId:                 in.UserID,
		ProfileId:              in.ProfileID,
		ContentId:              in.ContentID,
		EpisodeId:              in.EpisodeID,
		CurrentPositionSeconds: &resumeSec,
		TotalDurationSeconds:   &durSec,
		Status:                 &status,
		IsActive:               &active,
		StartedAt:              &now,
		LastHeartbeat:          &now,
		LastHeartbeatAt:        &now,
	}
	if strings.TrimSpace(in.DeviceID) != "" {
		d := strings.TrimSpace(in.DeviceID)
		sess.DeviceId = &d
	}
	if strings.TrimSpace(in.DeviceType) != "" {
		dt := strings.TrimSpace(in.DeviceType)
		sess.DeviceType = &dt
	}
	if strings.TrimSpace(in.IPAddress) != "" {
		ip := strings.TrimSpace(in.IPAddress)
		sess.IpAddress = &ip
	}
	_ = s.db.WithContext(ctx).Create(&sess).Error

	// Idempotent view count ledger (matches Rust content_view_events)
	if !in.IsTrailer {
		viewerKey := "session:" + sessionID
		if in.UserID != nil && *in.UserID > 0 {
			viewerKey = fmt.Sprintf("user:%d", *in.UserID)
		} else if strings.TrimSpace(in.DeviceID) != "" {
			viewerKey = "device:" + strings.TrimSpace(in.DeviceID)
		}
		res := s.db.WithContext(ctx).Exec(`
			INSERT INTO content_view_events (event_id, content_id, user_id, viewer_key, session_id, event_type)
			VALUES (?, ?, ?, ?, ?, 'start')
			ON CONFLICT (event_id) DO NOTHING`,
			sessionID, in.ContentID, in.UserID, viewerKey, sessionID,
		)
		if res.Error == nil && res.RowsAffected > 0 {
			_ = s.db.WithContext(ctx).Exec(
				"UPDATE contents SET view_count = COALESCE(view_count, 0) + 1, updated_at = NOW() WHERE id = ?",
				in.ContentID,
			).Error
		}
	}

	// Show ads based on plan (ads_enabled/has_ads), or on AVOD/FREE content for non-subscribers (never on trailers, admins, or paid TVOD rentals)
	showAds := !in.IsTrailer && !isAdmin && !hasTvod && (ent.AdsEnabled || ((monetization == "AVOD" || monetization == "FREE") && !ent.HasActivePlan))
	var vastURL *string
	if showAds {
		v := fmt.Sprintf("%s/api/v1/ads/vast?contentId=%d", strings.TrimRight(s.cfg.PublicBaseURL, "/"), in.ContentID)
		vastURL = &v
	}

	return &PlaybackAuthResult{
		Authorized:            true,
		ContentID:             content.ID,
		SessionID:             sessionID,
		SessionToken:          sessionID,
		StreamURL:             streamURL,
		HlsURL:                streamURL,
		MasterPlaylistURL:     streamURL,
		BunnyVideoID:          bunnyVideoID,
		ResumePositionSeconds: resumeSec,
		DurationSeconds:       durSec,
		IsTrailer:             in.IsTrailer,
		Subtitles:             parseJSONMapSlice(content.SubtitlesJson),
		AudioTracks:           parseJSONMapSlice(content.AudioTracksJson),
		ContentWarnings:       parseJSONStringSlice(content.ContentWarnings),
		SkipIntroStart:        content.SkipIntroStart,
		SkipIntroEnd:          content.SkipIntroEnd,
		SkipOutroStart:        content.SkipOutroStart,
		ShowAds:               showAds,
		VastTagURL:            vastURL,
		IsHls:                 strings.Contains(strings.ToLower(streamURL), ".m3u8"),
		MaxVideoQuality:       ent.MaxVideoQuality,
		MaxResolution:         ent.MaxVideoQuality,
		MaxConcurrentStreams:  ent.MaxConcurrentStreams,
		AllowDownloads:        ent.AllowDownloads,
		PlanCode:              ent.PlanCode,
		PlanName:              ent.PlanName,
	}, nil
}

func (s *Service) ListSessions(ctx context.Context, userID int64) ([]models.PlaybackSession, error) {
	var rows []models.PlaybackSession
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND is_active = TRUE", userID).
		Order("started_at DESC").
		Limit(20).
		Find(&rows).Error
	return rows, err
}

func (s *Service) SaveProgress(ctx context.Context, userID, contentID int64, episodeID *int64, posSec, durSec int32, sessionToken string, explicitCompleted *bool) error {
	now := time.Now().UTC()
	if sessionToken != "" {
		upd := map[string]any{"last_heartbeat": now, "last_heartbeat_at": now}
		if posSec > 0 {
			upd["current_position_seconds"] = posSec
		}
		if durSec > 0 {
			upd["total_duration_seconds"] = durSec
		}
		var sess models.PlaybackSession
		if s.db.WithContext(ctx).Where("session_id = ? OR session_token = ?", sessionToken, sessionToken).First(&sess).Error == nil {
			_ = s.db.WithContext(ctx).Model(&sess).Updates(upd).Error
			if contentID <= 0 {
				contentID = sess.ContentId
			}
			if episodeID == nil {
				episodeID = sess.EpisodeId
			}
		}
	}
	if contentID <= 0 {
		return nil
	}

	completed := durSec > 0 && posSec >= (durSec*92/100)
	if explicitCompleted != nil {
		completed = *explicitCompleted
	}
	// Never overwrite a saved resume position with 0 on initial mount heartbeat
	if posSec <= 0 && !completed {
		return nil
	}
	finalPos := posSec
	if completed && durSec > 0 {
		finalPos = durSec
	}

	var pct float64
	if completed {
		pct = 100.0
	} else if durSec > 0 {
		pct = (float64(finalPos) / float64(durSec)) * 100.0
		if pct > 100 {
			pct = 100
		}
	}

	profileID := s.defaultProfileID(ctx, userID)
	var existing models.WatchHistory
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND content_id = ?", userID, contentID).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := models.WatchHistory{
			UserId:               &userID,
			ProfileId:            profileID,
			ContentId:            contentID,
			EpisodeId:            episodeID,
			PositionSeconds:      &finalPos,
			DurationSeconds:      &durSec,
			WatchedSeconds:       &finalPos,
			TotalDurationSeconds: &durSec,
			Percentage:           &pct,
			Completed:            &completed,
			IsCompleted:          &completed,
			LastWatchedAt:        &now,
		}
		return s.db.WithContext(ctx).Create(&row).Error
	} else if err != nil {
		return err
	}

	upd := map[string]any{
		"position_seconds": finalPos,
		"watched_seconds":  finalPos,
		"percentage":       pct,
		"completed":        completed,
		"is_completed":     completed,
		"last_watched_at":  now,
	}
	if durSec > 0 {
		upd["duration_seconds"] = durSec
		upd["total_duration_seconds"] = durSec
	}
	return s.db.WithContext(ctx).Model(&models.WatchHistory{}).Where("id = ?", existing.ID).Updates(upd).Error
}

func (s *Service) StopSession(ctx context.Context, userID, contentID int64, posSec, durSec int32, sessionToken string, completed *bool) error {
	if sessionToken != "" {
		upd := map[string]any{"status": "ENDED", "is_active": false, "last_heartbeat_at": time.Now().UTC()}
		if posSec > 0 {
			upd["current_position_seconds"] = posSec
		}
		if durSec > 0 {
			upd["total_duration_seconds"] = durSec
		}
		var sess models.PlaybackSession
		if s.db.WithContext(ctx).Where("session_id = ? OR session_token = ?", sessionToken, sessionToken).First(&sess).Error == nil {
			_ = s.db.WithContext(ctx).Model(&sess).Updates(upd).Error
			if contentID <= 0 {
				contentID = sess.ContentId
			}
		}
	}
	if (posSec > 0 || (completed != nil && *completed)) && contentID > 0 {
		return s.SaveProgress(ctx, userID, contentID, nil, posSec, durSec, "", completed)
	}
	return nil
}

func (s *Service) RemoveWatchHistory(ctx context.Context, userID, id int64) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND (id = ? OR content_id = ?)", userID, id, id).
		Delete(&models.WatchHistory{}).Error
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

func (s *Service) enforceConcurrentStreamLimit(ctx context.Context, userID int64, reqDeviceID string, maxStreams int) error {
	now := time.Now().UTC()
	if maxStreams <= 0 {
		maxStreams = 1
	}

	cutoff := now.Add(-2 * time.Minute)
	var sessions []models.PlaybackSession
	if err := s.db.WithContext(ctx).Where("user_id = ? AND is_active = TRUE", userID).Find(&sessions).Error; err != nil {
		return nil
	}
	reqDev := strings.TrimSpace(reqDeviceID)
	otherActive := 0
	for _, sess := range sessions {
		ts := sess.LastHeartbeatAt
		if ts == nil {
			ts = sess.LastHeartbeat
		}
		if ts == nil {
			ts = sess.StartedAt
		}
		if ts == nil || !ts.After(cutoff) {
			continue
		}
		sameDevice := reqDev != "" && sess.DeviceId != nil && *sess.DeviceId == reqDev
		if !sameDevice {
			otherActive++
		}
	}
	if otherActive >= maxStreams {
		return fmt.Errorf("screen limit reached: your plan allows up to %d concurrent stream(s). Stop playback on another device to continue", maxStreams)
	}
	return nil
}

func (s *Service) isAdminUser(ctx context.Context, userID int64) bool {
	var names []string
	_ = s.db.WithContext(ctx).Table("roles").
		Select("roles.name").
		Joins("JOIN user_roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ?", userID).
		Pluck("roles.name", &names).Error
	for _, n := range names {
		if strings.Contains(strings.ToUpper(n), "ADMIN") {
			return true
		}
	}
	return false
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

func (s *Service) resolveStreamURL(ctx context.Context, contentID int64, episodeID *int64) (string, string) {
	if episodeID != nil && *episodeID > 0 {
		var ep models.Episode
		if s.db.WithContext(ctx).First(&ep, *episodeID).Error == nil {
			guid := deref(ep.BunnyVideoGuid)
			if ep.VideoUrl != nil && *ep.VideoUrl != "" {
				return *ep.VideoUrl, guid
			}
			if guid != "" && s.cfg.BunnyStreamCDNHostname != "" {
				return fmt.Sprintf("https://%s/%s/playlist.m3u8", s.cfg.BunnyStreamCDNHostname, guid), guid
			}
		}
	}
	var mv models.Movie
	if s.db.WithContext(ctx).Where("content_id = ? OR id = ?", contentID, contentID).Order("CASE WHEN content_id = ? THEN 0 ELSE 1 END").First(&mv).Error == nil {
		guid := deref(mv.BunnyVideoGuid)
		if mv.HlsUrl != nil && *mv.HlsUrl != "" {
			return *mv.HlsUrl, guid
		}
		if mv.StreamUrl != nil && *mv.StreamUrl != "" {
			return *mv.StreamUrl, guid
		}
		if mv.VideoUrl != nil && *mv.VideoUrl != "" {
			return *mv.VideoUrl, guid
		}
		if guid != "" && s.cfg.BunnyStreamCDNHostname != "" {
			return fmt.Sprintf("https://%s/%s/playlist.m3u8", s.cfg.BunnyStreamCDNHostname, guid), guid
		}
	}
	return "", ""
}

func (s *Service) signBunnyURL(rawURL string) string {
	key := strings.TrimSpace(s.cfg.BunnyStreamTokenAuthKey)
	if key == "" || s.cfg.BunnyStreamCDNHostname == "" || !strings.Contains(rawURL, s.cfg.BunnyStreamCDNHostname) {
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

func parseJSONMapSlice(raw *string) []map[string]any {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return []map[string]any{}
	}
	var out []map[string]any
	if json.Unmarshal([]byte(*raw), &out) != nil || out == nil {
		return []map[string]any{}
	}
	return out
}

func parseJSONStringSlice(raw *string) []string {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return []string{}
	}
	var out []string
	if json.Unmarshal([]byte(*raw), &out) != nil || out == nil {
		return []string{}
	}
	return out
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
