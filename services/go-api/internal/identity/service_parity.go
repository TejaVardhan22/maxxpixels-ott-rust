package identity

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const DefaultReferralRewardDays = 7

// --- Password & Device Token ---

func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	if len(strings.TrimSpace(newPassword)) < 6 {
		return errors.New("new password must be at least 6 characters")
	}
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return errors.New("user not found")
	}
	if user.PasswordHash != nil && *user.PasswordHash != "" && currentPassword != "" {
		if bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(currentPassword)) != nil {
			return errors.New("current password is incorrect")
		}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{
		"password_hash": string(hash),
		"updated_at":    time.Now().UTC(),
	}).Error
}

func (s *Service) UpdateDeviceToken(ctx context.Context, userID int64, deviceID, deviceName, fcmToken, platform string) (map[string]any, error) {
	did := strings.TrimSpace(deviceID)
	if did == "" {
		did = "default-device"
	}
	_, err := s.RegisterDevice(ctx, userID, RegisterDeviceInput{
		DeviceID:   did,
		DeviceName: deviceName,
		Platform:   platform,
		FCMToken:   fcmToken,
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"success":       true,
		"deviceId":      did,
		"fcmRegistered": strings.TrimSpace(fcmToken) != "",
		"updatedAt":     time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// --- Smart TV Pairing Flow (Redis tv:pair:<code>) ---

type tvPairSession struct {
	Code       string      `json:"code"`
	DeviceID   string      `json:"deviceId"`
	DeviceName string      `json:"deviceName"`
	Platform   string      `json:"platform"`
	Status     string      `json:"status"`
	UserID     *int64      `json:"userId,omitempty"`
	Auth       *AuthResult `json:"auth,omitempty"`
	CreatedAt  string      `json:"createdAt"`
}

func (s *Service) GenerateTVCode(ctx context.Context, deviceID, deviceName, platform string) (map[string]any, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, 6)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return nil, err
		}
		buf[i] = charset[n.Int64()]
	}
	code := string(buf)

	did := strings.TrimSpace(deviceID)
	if did == "" {
		did = "tv-" + strings.ToLower(code)
	}
	dname := strings.TrimSpace(deviceName)
	if dname == "" {
		dname = "Smart TV"
	}
	plat := strings.ToUpper(strings.TrimSpace(platform))
	if plat == "" {
		plat = "ANDROID_TV"
	}

	sess := tvPairSession{
		Code:       code,
		DeviceID:   did,
		DeviceName: dname,
		Platform:   plat,
		Status:     "PENDING",
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	raw, _ := json.Marshal(sess)
	if err := s.cache.Set(ctx, "tv:pair:"+code, string(raw), 600*time.Second); err != nil {
		return nil, fmt.Errorf("failed to store TV pairing code: %w", err)
	}

	return map[string]any{
		"code":             code,
		"uniqueCode":       code,
		"deviceId":         did,
		"deviceName":       dname,
		"platform":         plat,
		"expiresInSeconds": 600,
		"activateUrl":      "/tvactivate",
	}, nil
}

func (s *Service) PollTVCode(ctx context.Context, rawCode string) (map[string]any, error) {
	code := strings.ToUpper(strings.TrimSpace(rawCode))
	if code == "" {
		return nil, errors.New("TV pairing code is required")
	}
	key := "tv:pair:" + code
	raw, ok := s.cache.Get(ctx, key)
	if !ok || raw == "" {
		return map[string]any{"status": "EXPIRED", "code": code}, nil
	}
	var sess tvPairSession
	if err := json.Unmarshal([]byte(raw), &sess); err != nil {
		return map[string]any{"status": "EXPIRED", "code": code}, nil
	}
	if sess.Status == "AUTHORIZED" {
		_ = s.cache.Del(ctx, key)
		return map[string]any{
			"status":     "AUTHORIZED",
			"code":       code,
			"deviceId":   sess.DeviceID,
			"deviceName": sess.DeviceName,
			"platform":   sess.Platform,
			"auth":       sess.Auth,
		}, nil
	}
	return map[string]any{
		"status":     "PENDING",
		"code":       code,
		"deviceId":   sess.DeviceID,
		"deviceName": sess.DeviceName,
	}, nil
}

func (s *Service) ActivateTVCode(ctx context.Context, userID int64, rawCode, customDeviceName string) (map[string]any, error) {
	code := strings.ToUpper(strings.TrimSpace(rawCode))
	if len(code) < 4 {
		return nil, errors.New("please enter a valid 6-character TV pairing code")
	}
	key := "tv:pair:" + code
	raw, ok := s.cache.Get(ctx, key)
	if !ok || raw == "" {
		return nil, errors.New("invalid or expired TV pairing code")
	}
	var sess tvPairSession
	if err := json.Unmarshal([]byte(raw), &sess); err != nil {
		return nil, errors.New("invalid TV pairing session")
	}
	if strings.TrimSpace(customDeviceName) != "" {
		sess.DeviceName = strings.TrimSpace(customDeviceName)
	}

	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, errors.New("user not found")
	}
	authRes, err := s.issueSession(ctx, &user)
	if err != nil {
		return nil, err
	}

	_, _ = s.RegisterDevice(ctx, userID, RegisterDeviceInput{
		DeviceID:   sess.DeviceID,
		DeviceName: sess.DeviceName,
		Platform:   sess.Platform,
		DeviceType: "TV",
	})

	sess.Status = "AUTHORIZED"
	sess.UserID = &userID
	sess.Auth = authRes
	updated, _ := json.Marshal(sess)
	if err := s.cache.Set(ctx, key, string(updated), 120*time.Second); err != nil {
		return nil, err
	}

	return map[string]any{
		"activated":  true,
		"code":       code,
		"deviceId":   sess.DeviceID,
		"deviceName": sess.DeviceName,
		"platform":   sess.Platform,
	}, nil
}

// --- Sub-Profiles & Avatar ---

func (s *Service) CreateSubProfile(ctx context.Context, userID int64, name, avatarURL string, isKids bool) (*models.Profile, error) {
	clean := strings.TrimSpace(name)
	if clean == "" {
		return nil, errors.New("profile name is required")
	}
	now := time.Now().UTC()
	prof := models.Profile{
		UserId:    userID,
		Name:      clean,
		IsKids:    &isKids,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if strings.TrimSpace(avatarURL) != "" {
		a := strings.TrimSpace(avatarURL)
		prof.AvatarUrl = &a
	}
	if err := s.db.WithContext(ctx).Create(&prof).Error; err != nil {
		return nil, err
	}
	return &prof, nil
}

func (s *Service) RemoveAvatar(ctx context.Context, userID int64) (map[string]any, error) {
	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Updates(map[string]any{
		"avatar_url": nil,
		"updated_at": time.Now().UTC(),
	}).Error; err != nil {
		return nil, err
	}
	return s.GetProfile(ctx, userID)
}

// --- Devices Summary, Registration (with Plan Max Devices Eviction) & Revocation ---

type RegisterDeviceInput struct {
	DeviceID    string `json:"deviceId"`
	DeviceName  string `json:"deviceName"`
	DeviceModel string `json:"deviceModel"`
	DeviceType  string `json:"deviceType"`
	Platform    string `json:"platform"`
	OSVersion   string `json:"osVersion"`
	AppVersion  string `json:"appVersion"`
	FCMToken    string `json:"fcmToken"`
}

func (s *Service) GetDeviceSummary(ctx context.Context, userID int64) (map[string]any, error) {
	now := time.Now().UTC()

	planInfo := map[string]any{
		"planId":               nil,
		"planName":             "Free Plan",
		"planStatus":           "FREE",
		"expiresAt":            nil,
		"maxDevices":           2,
		"maxConcurrentStreams": 1,
		"maxProfiles":          1,
		"maxResolution":        "720p",
	}

	var activeSub models.Subscription
	if s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", userID, now).
		Order("end_date DESC").First(&activeSub).Error == nil {
		planInfo["planStatus"] = "ACTIVE"
		planInfo["expiresAt"] = activeSub.EndDate.Format(time.RFC3339)
		var p models.Plan
		if s.db.WithContext(ctx).First(&p, activeSub.PlanId).Error == nil {
			planInfo["planId"] = p.ID
			planInfo["planName"] = p.Name
			maxDev := 2
			if p.MaxDevices != nil && *p.MaxDevices > 0 {
				maxDev = int(*p.MaxDevices)
			}
			maxStreams := 1
			if p.MaxConcurrentStreams != nil && *p.MaxConcurrentStreams > 0 {
				maxStreams = int(*p.MaxConcurrentStreams)
			}
			maxProf := 4
			if p.MaxProfiles != nil && *p.MaxProfiles > 0 {
				maxProf = int(*p.MaxProfiles)
			}
			planInfo["maxDevices"] = maxDev
			planInfo["maxConcurrentStreams"] = maxStreams
			planInfo["maxProfiles"] = maxProf
			if p.MaxResolution != nil && *p.MaxResolution != "" {
				planInfo["maxResolution"] = *p.MaxResolution
			} else if p.MaxVideoQuality != nil && *p.MaxVideoQuality != "" {
				planInfo["maxResolution"] = *p.MaxVideoQuality
			}
		}
	}

	cutoff := now.Add(-2 * time.Minute)
	var sessions []models.PlaybackSession
	_ = s.db.WithContext(ctx).Where("user_id = ? AND is_active = TRUE", userID).Find(&sessions).Error
	streamingIDs := make(map[string]bool)
	activeStreams := 0
	for _, sess := range sessions {
		ts := sess.LastHeartbeatAt
		if ts == nil {
			ts = sess.LastHeartbeat
		}
		if ts == nil {
			ts = sess.StartedAt
		}
		if ts != nil && ts.After(cutoff) {
			activeStreams++
			if sess.DeviceId != nil && strings.TrimSpace(*sess.DeviceId) != "" {
				streamingIDs[*sess.DeviceId] = true
			}
		}
	}

	var devs []models.Device
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("is_active DESC, last_active_at DESC").
		Find(&devs).Error; err != nil {
		return nil, err
	}

	activeDevs := 0
	devItems := make([]map[string]any, 0, len(devs))
	for _, d := range devs {
		isAct := d.IsActive == nil || *d.IsActive
		if isAct {
			activeDevs++
		}
		var lastAct *string
		if d.LastActiveAt != nil {
			s := d.LastActiveAt.Format(time.RFC3339)
			lastAct = &s
		} else if d.LastSeen != nil {
			s := d.LastSeen.Format(time.RFC3339)
			lastAct = &s
		}
		devItems = append(devItems, map[string]any{
			"id":           d.ID,
			"deviceId":     d.DeviceId,
			"deviceName":   d.DeviceName,
			"deviceModel":  d.DeviceModel,
			"deviceType":   d.DeviceType,
			"platform":     d.Platform,
			"osVersion":    d.OsVersion,
			"isActive":     isAct,
			"isStreaming":  isAct && streamingIDs[d.DeviceId],
			"lastActiveAt": lastAct,
			"createdAt":    d.CreatedAt.Format(time.RFC3339),
		})
	}

	var profCount int64
	_ = s.db.WithContext(ctx).Model(&models.Profile{}).Where("user_id = ?", userID).Count(&profCount).Error
	if profCount < 1 {
		profCount = 1
	}

	return map[string]any{
		"plan": planInfo,
		"usage": map[string]any{
			"activeDevicesCount":      activeDevs,
			"totalDevicesCount":       len(devs),
			"activeConcurrentStreams": activeStreams,
			"profilesCount":           profCount,
		},
		"devices": devItems,
	}, nil
}

func (s *Service) RegisterDevice(ctx context.Context, userID int64, in RegisterDeviceInput) (*models.Device, error) {
	did := strings.TrimSpace(in.DeviceID)
	if did == "" {
		return nil, errors.New("deviceId is required")
	}
	now := time.Now().UTC()
	plat := strings.ToUpper(strings.TrimSpace(in.Platform))
	if plat == "" {
		plat = "WEB"
	}
	dtype := strings.ToUpper(strings.TrimSpace(in.DeviceType))

	var existing models.Device
	err := s.db.WithContext(ctx).Where("user_id = ? AND device_id = ?", userID, did).First(&existing).Error
	if err == nil {
		upd := map[string]any{
			"last_seen":      now,
			"last_active_at": now,
			"is_active":      true,
			"platform":       plat,
		}
		if v := strings.TrimSpace(in.DeviceName); v != "" {
			upd["device_name"] = v
		}
		if v := strings.TrimSpace(in.DeviceModel); v != "" {
			upd["device_model"] = v
		}
		if dtype != "" {
			upd["device_type"] = dtype
		}
		if v := strings.TrimSpace(in.OSVersion); v != "" {
			upd["os_version"] = v
		}
		if v := strings.TrimSpace(in.AppVersion); v != "" {
			upd["app_version"] = v
		}
		if v := strings.TrimSpace(in.FCMToken); v != "" {
			upd["fcm_token"] = v
		}
		_ = s.db.WithContext(ctx).Model(&existing).Updates(upd).Error
		_ = s.db.WithContext(ctx).First(&existing, existing.ID).Error
		return &existing, nil
	}

	dname := strings.TrimSpace(in.DeviceName)
	if dname == "" {
		dname = "Web Browser"
	}
	if dtype == "" {
		dtype = "WEB"
	}
	active := true
	dev := models.Device{
		UserId:       userID,
		DeviceId:     did,
		DeviceName:   &dname,
		DeviceType:   &dtype,
		Platform:     &plat,
		IsActive:     &active,
		LastSeen:     &now,
		LastActiveAt: &now,
		CreatedAt:    now,
	}
	if v := strings.TrimSpace(in.DeviceModel); v != "" {
		dev.DeviceModel = &v
	}
	if v := strings.TrimSpace(in.OSVersion); v != "" {
		dev.OsVersion = &v
	}
	if v := strings.TrimSpace(in.AppVersion); v != "" {
		dev.AppVersion = &v
	}
	if v := strings.TrimSpace(in.FCMToken); v != "" {
		dev.FcmToken = &v
	}
	if err := s.db.WithContext(ctx).Create(&dev).Error; err != nil {
		return nil, err
	}

	// Enforce plan max_devices by evicting oldest active devices
	maxDevices := 2
	var activeSub models.Subscription
	if s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", userID, now).
		Order("end_date DESC").First(&activeSub).Error == nil {
		var p models.Plan
		if s.db.WithContext(ctx).First(&p, activeSub.PlanId).Error == nil {
			if p.MaxDevices != nil && *p.MaxDevices > 0 {
				maxDevices = int(*p.MaxDevices)
			} else if p.MaxRegisteredDevices != nil && *p.MaxRegisteredDevices > 0 {
				maxDevices = int(*p.MaxRegisteredDevices)
			}
		}
	}
	var activeDevs []models.Device
	if s.db.WithContext(ctx).
		Where("user_id = ? AND is_active = TRUE", userID).
		Order("last_active_at ASC").Find(&activeDevs).Error == nil && len(activeDevs) > maxDevices {
		toEvict := len(activeDevs) - maxDevices
		for i := 0; i < toEvict && i < len(activeDevs); i++ {
			if activeDevs[i].ID == dev.ID {
				continue
			}
			_ = s.db.WithContext(ctx).Model(&models.Device{}).Where("id = ?", activeDevs[i].ID).Update("is_active", false).Error
		}
	}
	return &dev, nil
}

func (s *Service) RevokeDevice(ctx context.Context, userID int64, deviceID string) error {
	return database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		var dev models.Device
		err := tx.Where("user_id = ? AND device_id = ?", userID, deviceID).First(&dev).Error
		if err != nil {
			if numID, parseErr := strconv.ParseInt(deviceID, 10, 64); parseErr == nil {
				err = tx.Where("user_id = ? AND id = ?", userID, numID).First(&dev).Error
			}
		}
		if err != nil {
			return nil
		}
		if err := tx.Model(&dev).Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&models.PlaybackSession{}).
			Where("user_id = ? AND device_id = ? AND is_active = ?", userID, dev.DeviceId, true).
			Update("is_active", false).Error
	})
}

func (s *Service) RevokeOtherDevices(ctx context.Context, userID int64, currentDeviceID string) (int, error) {
	curr := strings.TrimSpace(currentDeviceID)
	revoked := 0
	err := database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		var devs []models.Device
		if err := tx.Where("user_id = ? AND is_active = ?", userID, true).Order("id ASC").Find(&devs).Error; err != nil {
			return err
		}
		for _, d := range devs {
			if curr != "" && d.DeviceId == curr {
				continue
			}
			if err := tx.Model(&models.Device{}).Where("id = ?", d.ID).Update("is_active", false).Error; err != nil {
				return err
			}
			revoked++
			if err := tx.Model(&models.PlaybackSession{}).
				Where("user_id = ? AND device_id = ? AND is_active = ?", userID, d.DeviceId, true).
				Update("is_active", false).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return revoked, err
}

// --- Referrals (Exact Rust referrals.rs parity) ---

func (s *Service) EnsureReferralCode(ctx context.Context, userID int64) (string, error) {
	var existing struct {
		ReferralCode *string `gorm:"column:referral_code"`
	}
	if err := s.db.WithContext(ctx).Raw("SELECT referral_code FROM users WHERE id = ?", userID).Scan(&existing).Error; err != nil {
		return "", err
	}
	if existing.ReferralCode != nil && strings.TrimSpace(*existing.ReferralCode) != "" {
		return strings.ToUpper(strings.TrimSpace(*existing.ReferralCode)), nil
	}

	for i := 0; i < 10; i++ {
		raw := strings.ReplaceAll(uuid.NewString(), "-", "")
		candidate := "MAXX" + strings.ToUpper(raw[:6])

		var collides int64
		_ = s.db.WithContext(ctx).Raw("SELECT COUNT(*) FROM marketing_agents WHERE UPPER(agent_code) = ?", candidate).Scan(&collides).Error
		if collides > 0 {
			continue
		}
		res := s.db.WithContext(ctx).Exec(
			"UPDATE users SET referral_code = ?, updated_at = NOW() WHERE id = ? AND (referral_code IS NULL OR TRIM(referral_code) = '')",
			candidate, userID,
		)
		if res.Error == nil && res.RowsAffected > 0 {
			return candidate, nil
		}
	}
	return "", errors.New("failed to generate unique referral code")
}

func (s *Service) GetMyReferrals(ctx context.Context, userID int64) (map[string]any, error) {
	myCode, err := s.EnsureReferralCode(ctx, userID)
	if err != nil {
		return nil, err
	}

	var applied any
	var userRef struct {
		ReferralCode string `gorm:"column:referral_code"`
		Status       string `gorm:"column:status"`
		RewardDays   int32  `gorm:"column:reward_days"`
		ReferrerName string `gorm:"column:referrer_name"`
	}
	if s.db.WithContext(ctx).Raw(`
		SELECT ur.referral_code, ur.status, ur.reward_days,
		       COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''), 'A Friend') AS referrer_name
		FROM user_referrals ur
		JOIN users u ON u.id = ur.referrer_user_id
		WHERE ur.referred_user_id = ? LIMIT 1`, userID).Scan(&userRef).Error == nil && userRef.ReferralCode != "" {
		applied = map[string]any{
			"codeType":     "USER_REFERRAL",
			"referralCode": userRef.ReferralCode,
			"status":       userRef.Status,
			"rewardDays":   userRef.RewardDays,
			"referrerName": userRef.ReferrerName,
		}
	} else {
		var agentRef struct {
			AgentCode string `gorm:"column:agent_code"`
			FullName  string `gorm:"column:full_name"`
		}
		if s.db.WithContext(ctx).Raw(`
			SELECT ma.agent_code, ma.full_name
			FROM marketing_agent_members mam
			JOIN marketing_agents ma ON ma.id = mam.agent_id
			WHERE mam.user_id = ? LIMIT 1`, userID).Scan(&agentRef).Error == nil && agentRef.AgentCode != "" {
			applied = map[string]any{
				"codeType":     "MARKETING_AGENT",
				"referralCode": agentRef.AgentCode,
				"status":       "LINKED",
				"rewardDays":   0,
				"referrerName": agentRef.FullName,
			}
		}
	}

	var histRows []struct {
		ID             int64      `gorm:"column:id"`
		ReferredUserID int64      `gorm:"column:referred_user_id"`
		FriendName     string     `gorm:"column:friend_name"`
		ReferralCode   string     `gorm:"column:referral_code"`
		Status         string     `gorm:"column:status"`
		RewardType     string     `gorm:"column:reward_type"`
		RewardDays     int32      `gorm:"column:reward_days"`
		RewardAmount   float64    `gorm:"column:reward_amount"`
		CreditedAt     *time.Time `gorm:"column:credited_at"`
		CreatedAt      time.Time  `gorm:"column:created_at"`
	}
	_ = s.db.WithContext(ctx).Raw(`
		SELECT ur.id, ur.referred_user_id, ur.referral_code, ur.status, ur.reward_type,
		       ur.reward_days, COALESCE(ur.reward_amount, 0)::float8 AS reward_amount,
		       ur.credited_at, ur.created_at,
		       COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''), 'MaxxPixels Member') AS friend_name
		FROM user_referrals ur
		JOIN users u ON u.id = ur.referred_user_id
		WHERE ur.referrer_user_id = ?
		ORDER BY ur.created_at DESC LIMIT 100`, userID).Scan(&histRows).Error

	history := make([]map[string]any, 0, len(histRows))
	var pendingCount, rewardedCount, totalDays int64
	var totalAmount float64
	for _, r := range histRows {
		if r.Status == "REWARDED" {
			rewardedCount++
			totalDays += int64(r.RewardDays)
			totalAmount += r.RewardAmount
		} else if r.Status == "SIGNED_UP" {
			pendingCount++
		}
		var credited *string
		if r.CreditedAt != nil {
			s := r.CreditedAt.Format(time.RFC3339)
			credited = &s
		}
		history = append(history, map[string]any{
			"id":             r.ID,
			"referredUserId": r.ReferredUserID,
			"friendName":     r.FriendName,
			"referralCode":   r.ReferralCode,
			"status":         r.Status,
			"rewardType":     r.RewardType,
			"rewardDays":     r.RewardDays,
			"rewardAmount":   r.RewardAmount,
			"creditedAt":     credited,
			"createdAt":      r.CreatedAt.Format(time.RFC3339),
		})
	}

	return map[string]any{
		"referralCode":   myCode,
		"reference_code": myCode,
		"rewardConfig": map[string]any{
			"rewardType": "VIP_DAYS",
			"rewardDays": DefaultReferralRewardDays,
		},
		"stats": map[string]any{
			"totalInvited":      len(history),
			"pendingCount":      pendingCount,
			"rewardedCount":     rewardedCount,
			"totalRewardDays":   totalDays,
			"totalRewardAmount": totalAmount,
		},
		"appliedReferral": applied,
		"history":         history,
	}, nil
}

func (s *Service) ApplyReferralCode(ctx context.Context, userID int64, rawCode string) (map[string]any, int, error) {
	clean := strings.ToUpper(strings.TrimSpace(rawCode))
	if len(clean) < 3 || len(clean) > 32 {
		return nil, 400, errors.New("please enter a valid referral or partner code")
	}

	var hasUserRef, hasAgentRef int64
	_ = s.db.WithContext(ctx).Raw("SELECT COUNT(*) FROM user_referrals WHERE referred_user_id = ?", userID).Scan(&hasUserRef).Error
	_ = s.db.WithContext(ctx).Raw("SELECT COUNT(*) FROM marketing_agent_members WHERE user_id = ?", userID).Scan(&hasAgentRef).Error
	if hasUserRef > 0 || hasAgentRef > 0 {
		return nil, 409, errors.New("a referral or partner code has already been applied to your account")
	}

	// Priority 1: Active Marketing Agent code
	var agent struct {
		ID        int64  `gorm:"column:id"`
		AgentCode string `gorm:"column:agent_code"`
		FullName  string `gorm:"column:full_name"`
	}
	if s.db.WithContext(ctx).Raw(
		"SELECT id, agent_code, full_name FROM marketing_agents WHERE UPPER(agent_code) = ? AND status = 'ACTIVE' LIMIT 1",
		clean,
	).Scan(&agent).Error == nil && agent.ID > 0 {
		var phone *string
		_ = s.db.WithContext(ctx).Raw("SELECT phone FROM users WHERE id = ? LIMIT 1", userID).Scan(&phone).Error
		if err := s.db.WithContext(ctx).Exec(
			"INSERT INTO marketing_agent_members (agent_id, user_id, phone_number, created_at) VALUES (?, ?, ?, NOW()) ON CONFLICT (user_id) DO NOTHING",
			agent.ID, userID, phone,
		).Error; err != nil {
			return nil, 500, err
		}
		return map[string]any{
			"applied":      true,
			"codeType":     "MARKETING_AGENT",
			"referralCode": agent.AgentCode,
			"referrerName": agent.FullName,
			"rewardDays":   0,
		}, 200, nil
	}

	// Priority 2: User Referral code
	var referrer struct {
		ID           int64  `gorm:"column:id"`
		ReferrerName string `gorm:"column:referrer_name"`
	}
	if s.db.WithContext(ctx).Raw(`
		SELECT id, COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(SPLIT_PART(COALESCE(email, ''), '@', 1), ''), 'A Friend') AS referrer_name
		FROM users WHERE UPPER(referral_code) = ? LIMIT 1`, clean).Scan(&referrer).Error != nil || referrer.ID == 0 {
		return nil, 404, errors.New("code not found; please check the referral or partner code and try again")
	}
	if referrer.ID == userID {
		return nil, 400, errors.New("you cannot apply your own referral code")
	}

	if err := s.db.WithContext(ctx).Exec("UPDATE users SET referred_by_user_id = ?, updated_at = NOW() WHERE id = ?", referrer.ID, userID).Error; err != nil {
		return nil, 500, err
	}
	if err := s.db.WithContext(ctx).Exec(`
		INSERT INTO user_referrals (referrer_user_id, referred_user_id, referral_code, status, reward_type, reward_days, reward_amount)
		VALUES (?, ?, ?, 'SIGNED_UP', 'VIP_DAYS', ?, 0)
		ON CONFLICT (referred_user_id) DO NOTHING`,
		referrer.ID, userID, clean, DefaultReferralRewardDays,
	).Error; err != nil {
		return nil, 500, err
	}

	return map[string]any{
		"applied":      true,
		"codeType":     "USER_REFERRAL",
		"referralCode": clean,
		"referrerName": referrer.ReferrerName,
		"rewardDays":   DefaultReferralRewardDays,
	}, 200, nil
}

// --- Admin Users Full CRUD ---

type AdminUserInput struct {
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Phone       string `json:"phone"`
	Password    string `json:"password"`
	Status      string `json:"status"`
}

func (s *Service) AdminCreateUser(ctx context.Context, in AdminUserInput) (map[string]any, error) {
	name := strings.TrimSpace(strings.TrimSpace(in.FirstName) + " " + strings.TrimSpace(in.LastName))
	if name == "" {
		name = strings.TrimSpace(in.FullName)
	}
	if name == "" {
		name = "OTT Viewer"
	}
	phone := strings.TrimSpace(in.PhoneNumber)
	if phone == "" {
		phone = strings.TrimSpace(in.Phone)
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if phone == "" && email == "" {
		return nil, errors.New("mobile number or email is required")
	}

	var pwHash *string
	if strings.TrimSpace(in.Password) != "" {
		h, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(in.Password)), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hs := string(h)
		pwHash = &hs
	}

	status := strings.ToUpper(strings.TrimSpace(in.Status))
	if status == "" {
		status = "ACTIVE"
	}
	now := time.Now().UTC()
	authMethod := "SMS_OTP"
	phoneVer := phone != ""
	emailVer := false

	u := models.User{
		Uuid:          uuid.NewString(),
		FullName:      &name,
		PasswordHash:  pwHash,
		AuthMethod:    &authMethod,
		Status:        status,
		PhoneVerified: &phoneVer,
		EmailVerified: &emailVer,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if email != "" {
		u.Email = &email
	}
	if phone != "" {
		u.PhoneNumber = &phone
		u.Phone = &phone
	}
	if err := s.db.WithContext(ctx).Create(&u).Error; err != nil {
		return nil, err
	}

	var roleRow models.Role
	if s.db.WithContext(ctx).Where("name = ?", "ROLE_USER").First(&roleRow).Error == nil {
		_ = s.db.WithContext(ctx).Create(&models.UserRole{UserId: u.ID, RoleId: roleRow.ID}).Error
	}
	return s.buildUserPayload(ctx, &u), nil
}

func (s *Service) AdminGetUser(ctx context.Context, id int64) (map[string]any, error) {
	var u models.User
	if err := s.db.WithContext(ctx).First(&u, id).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return s.buildUserPayload(ctx, &u), nil
}

func (s *Service) AdminUpdateUser(ctx context.Context, id int64, in AdminUserInput) (map[string]any, error) {
	var u models.User
	if err := s.db.WithContext(ctx).First(&u, id).Error; err != nil {
		return nil, errors.New("user not found")
	}
	upd := map[string]any{"updated_at": time.Now().UTC()}
	name := strings.TrimSpace(strings.TrimSpace(in.FirstName) + " " + strings.TrimSpace(in.LastName))
	if name == "" {
		name = strings.TrimSpace(in.FullName)
	}
	if name != "" {
		upd["full_name"] = name
	}
	if in.Email != "" {
		upd["email"] = strings.ToLower(strings.TrimSpace(in.Email))
	}
	phone := strings.TrimSpace(in.PhoneNumber)
	if phone == "" {
		phone = strings.TrimSpace(in.Phone)
	}
	if phone != "" {
		upd["phone_number"] = phone
		upd["phone"] = phone
	}
	if st := strings.ToUpper(strings.TrimSpace(in.Status)); st != "" {
		upd["status"] = st
	}
	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	return s.AdminGetUser(ctx, id)
}

func (s *Service) AdminUpdateStatus(ctx context.Context, id int64, status string) (map[string]any, error) {
	clean := strings.ToUpper(strings.TrimSpace(status))
	if clean == "" {
		return nil, errors.New("status is required")
	}
	res := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", id).Updates(map[string]any{
		"status":     clean,
		"updated_at": time.Now().UTC(),
	})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, errors.New("user not found")
	}
	return s.AdminGetUser(ctx, id)
}

func (s *Service) AdminToggleStatus(ctx context.Context, id int64) (map[string]any, error) {
	var u models.User
	if err := s.db.WithContext(ctx).First(&u, id).Error; err != nil {
		return nil, errors.New("user not found")
	}
	next := "ACTIVE"
	if strings.EqualFold(u.Status, "ACTIVE") {
		next = "SUSPENDED"
	}
	return s.AdminUpdateStatus(ctx, id, next)
}

func (s *Service) AdminRevokeAllDevices(ctx context.Context, userID int64) (int64, error) {
	var count int64
	err := database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		res := tx.Model(&models.Device{}).
			Where("user_id = ? AND is_active = ?", userID, true).
			Update("is_active", false)
		if res.Error != nil {
			return res.Error
		}
		count = res.RowsAffected
		if err := tx.Model(&models.PlaybackSession{}).
			Where("user_id = ? AND is_active = ?", userID, true).
			Update("is_active", false).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).
			Where("user_id = ? AND revoked = ?", userID, false).
			Update("revoked", true).Error
	})
	return count, err
}

func (s *Service) AdminSoftDeleteUser(ctx context.Context, id int64) error {
	return database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		if err := tx.Model(&models.Device{}).Where("user_id = ? AND is_active = ?", id, true).Update("is_active", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.PlaybackSession{}).Where("user_id = ? AND is_active = ?", id, true).Update("is_active", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.RefreshToken{}).Where("user_id = ? AND revoked = ?", id, false).Update("revoked", true).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", id).Updates(map[string]any{
			"status":     "DELETED",
			"updated_at": time.Now().UTC(),
		}).Error
	})
}

func (s *Service) AdminResetPassword(ctx context.Context, id int64, newPassword string) error {
	if len(strings.TrimSpace(newPassword)) < 6 {
		return errors.New("password must be at least 6 characters")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(newPassword)), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", id).Updates(map[string]any{
		"password_hash": string(h),
		"updated_at":    time.Now().UTC(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}
