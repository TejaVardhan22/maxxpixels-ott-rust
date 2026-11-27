package monetization

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

// --- Public Ads Extras ---

func (s *Service) GetAdsTxt(ctx context.Context) string {
	var setting models.SystemSetting
	if s.db.WithContext(ctx).Where("setting_key = ?", "ads_txt_content").First(&setting).Error == nil && setting.SettingValue != nil && strings.TrimSpace(*setting.SettingValue) != "" {
		return *setting.SettingValue
	}
	return "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n"
}

func (s *Service) GetAdConfig(ctx context.Context, contentID int64) (map[string]any, error) {
	var placements []models.AdPlacement
	_ = s.db.WithContext(ctx).Where("COALESCE(is_active, TRUE) = TRUE").Find(&placements).Error
	campaigns, _ := s.ListActiveCampaigns(ctx)
	vastURL := fmt.Sprintf("%s/api/v1/ads/vast?contentId=%d", s.publicBaseURL, contentID)
	return map[string]any{
		"contentId":  contentID,
		"adsEnabled": len(campaigns) > 0,
		"vastTagUrl": vastURL,
		"placements": placements,
		"campaigns":  campaigns,
	}, nil
}

func (s *Service) CreateAdSession(ctx context.Context, contentID int64, userID *int64) map[string]any {
	sid := uuid.NewString()
	return map[string]any{
		"sessionId":  sid,
		"contentId":  contentID,
		"userId":     userID,
		"vastTagUrl": fmt.Sprintf("%s/api/v1/ads/vast?contentId=%d&sessionId=%s", s.publicBaseURL, contentID, sid),
		"createdAt":  time.Now().UTC().Format(time.RFC3339),
	}
}

func (s *Service) GetAdRevenue(ctx context.Context) (map[string]any, error) {
	var impressions, clicks int64
	var totalSpent float64
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.AdEvent{}).Where("UPPER(event_type) = 'IMPRESSION'").Count(&impressions).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.AdEvent{}).Where("UPPER(event_type) = 'CLICK'").Count(&clicks).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Raw("SELECT COALESCE(SUM(COALESCE(spent_budget, 0)), 0) FROM ad_campaigns").Scan(&totalSpent).Error
		return nil
	})
	_ = g.Wait()
	var ctr float64
	if impressions > 0 {
		ctr = (float64(clicks) / float64(impressions)) * 100
	}
	return map[string]any{
		"totalImpressions": impressions,
		"totalClicks":      clicks,
		"ctrPercent":       ctr,
		"grossRevenue":     totalSpent,
	}, nil
}

func (s *Service) GetProducerRevenue(ctx context.Context) ([]models.ProducerAdRevenue, error) {
	var rows []models.ProducerAdRevenue
	err := s.db.WithContext(ctx).Order("id DESC").Limit(100).Find(&rows).Error
	return rows, err
}

// --- Admin Ads Providers, Placements & Campaigns CRUD ---

func (s *Service) AdminListProviders(ctx context.Context) ([]models.AdProvider, error) {
	var rows []models.AdProvider
	err := s.db.WithContext(ctx).Order("id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertProvider(ctx context.Context, id int64, body map[string]any) (*models.AdProvider, error) {
	now := time.Now().UTC()
	if id == 0 {
		name := sVal(body, "name")
		code := strings.ToUpper(sVal(body, "code"))
		if code == "" {
			code = strings.ToUpper(strings.ReplaceAll(name, " ", "_"))
		}
		if name == "" {
			return nil, errors.New("provider name is required")
		}
		active := true
		st := "ACTIVE"
		row := models.AdProvider{
			Code:        code,
			Name:        name,
			Type:        pStr(sVal(body, "type")),
			NetworkCode: pStr(sVal(body, "networkCode", "network_code")),
			PublisherId: pStr(sVal(body, "publisherId", "publisher_id")),
			AppId:       pStr(sVal(body, "appId", "app_id")),
			AccountId:   pStr(sVal(body, "accountId", "account_id")),
			IsActive:    &active,
			Status:      &st,
			CreatedAt:   &now,
			UpdatedAt:   &now,
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	upd := map[string]any{"updated_at": now}
	for _, m := range [][2]string{{"name", "name"}, {"code", "code"}, {"type", "type"}, {"networkCode", "network_code"}, {"publisherId", "publisher_id"}, {"status", "status"}} {
		if v := sVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = bVal(body, "isActive")
	}
	_ = s.db.WithContext(ctx).Model(&models.AdProvider{}).Where("id = ?", id).Updates(upd).Error
	var out models.AdProvider
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminListPlacements(ctx context.Context) ([]models.AdPlacement, error) {
	var rows []models.AdPlacement
	err := s.db.WithContext(ctx).Order("id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertPlacement(ctx context.Context, id int64, body map[string]any) (*models.AdPlacement, error) {
	now := time.Now().UTC()
	if id == 0 {
		name := sVal(body, "name")
		code := strings.ToUpper(sVal(body, "code"))
		if code == "" {
			code = strings.ToUpper(strings.ReplaceAll(name, " ", "_"))
		}
		if name == "" {
			return nil, errors.New("placement name is required")
		}
		active := true
		row := models.AdPlacement{
			Code:      code,
			Name:      name,
			Format:    pStr(sVal(body, "format")),
			Platform:  pStr(sVal(body, "platform")),
			IsActive:  &active,
			CreatedAt: &now,
			UpdatedAt: &now,
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	upd := map[string]any{"updated_at": now}
	for _, m := range [][2]string{{"name", "name"}, {"code", "code"}, {"format", "format"}, {"platform", "platform"}} {
		if v := sVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = bVal(body, "isActive")
	}
	_ = s.db.WithContext(ctx).Model(&models.AdPlacement{}).Where("id = ?", id).Updates(upd).Error
	var out models.AdPlacement
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminGetCampaign(ctx context.Context, id int64) (*models.AdCampaign, error) {
	var c models.AdCampaign
	if err := s.db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, errors.New("campaign not found")
	}
	return &c, nil
}

func (s *Service) AdminUpsertCampaign(ctx context.Context, id int64, body map[string]any) (*models.AdCampaign, error) {
	name := sVal(body, "campaignName", "campaign_name", "name")
	if id == 0 {
		if name == "" {
			return nil, errors.New("campaignName is required")
		}
		st := strings.ToUpper(sVal(body, "status"))
		if st == "" {
			st = "ACTIVE"
		}
		row := models.AdCampaign{
			CampaignName:   name,
			Name:           &name,
			AdvertiserName: pStr(sVal(body, "advertiserName", "advertiser_name")),
			AdBreakType:    pStr(sVal(body, "adBreakType", "ad_break_type", "adType")),
			AdType:         pStr(sVal(body, "adType", "adBreakType")),
			VideoUrl:       pStr(sVal(body, "videoUrl", "video_url")),
			ClickUrl:       pStr(sVal(body, "clickUrl", "click_url")),
			ThumbnailUrl:   pStr(sVal(body, "thumbnailUrl", "thumbnail_url")),
			VastTagUrl:     pStr(sVal(body, "vastTagUrl", "vast_tag_url")),
			BunnyVideoGuid: pStr(sVal(body, "bunnyVideoGuid", "bunny_video_guid")),
			Provider:       pStr(sVal(body, "provider")),
			Status:         &st,
			CreatedAt:      time.Now().UTC(),
		}
		if d := i32Val(body, "durationSeconds", "duration_seconds"); d > 0 {
			row.DurationSeconds = &d
		}
		if sk := i32Val(body, "skipOffsetSeconds", "skip_offset_seconds"); sk > 0 {
			row.SkipOffsetSeconds = &sk
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	upd := map[string]any{}
	for _, m := range [][2]string{
		{"campaignName", "campaign_name"}, {"name", "name"}, {"advertiserName", "advertiser_name"},
		{"adBreakType", "ad_break_type"}, {"videoUrl", "video_url"}, {"clickUrl", "click_url"},
		{"thumbnailUrl", "thumbnail_url"}, {"vastTagUrl", "vast_tag_url"}, {"status", "status"},
	} {
		if v := sVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if err := s.db.WithContext(ctx).Model(&models.AdCampaign{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	return s.AdminGetCampaign(ctx, id)
}

func (s *Service) AdminToggleCampaign(ctx context.Context, id int64) (*models.AdCampaign, error) {
	c, err := s.AdminGetCampaign(ctx, id)
	if err != nil {
		return nil, err
	}
	next := "ACTIVE"
	if c.Status != nil && strings.EqualFold(*c.Status, "ACTIVE") {
		next = "PAUSED"
	}
	_ = s.db.WithContext(ctx).Model(c).Update("status", next).Error
	c.Status = &next
	return c, nil
}

func (s *Service) AdminDeleteCampaign(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.AdCampaign{}, id).Error
}

// --- Producer Portal & Admin Producer Management ---

func (s *Service) ProducerRegister(ctx context.Context, body map[string]any) (*models.ProducerProfile, error) {
	company := sVal(body, "companyName", "company_name", "productionName")
	email := strings.ToLower(sVal(body, "email"))
	phone := sVal(body, "phone", "phoneNumber", "mobile")
	contact := sVal(body, "contactPerson", "fullName", "name")
	if company == "" {
		company = contact
	}
	if company == "" || (email == "" && phone == "") {
		return nil, errors.New("companyName and email or phone are required")
	}

	var out models.ProducerProfile
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		var user models.User
		q := tx.Model(&models.User{})
		if email != "" {
			q = q.Where("LOWER(email) = ?", email)
		} else {
			q = q.Where("phone_number = ? OR phone = ?", phone, phone)
		}
		if err := q.First(&user).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			pw := sVal(body, "password")
			var hashPtr *string
			if pw != "" {
				h, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
				hs := string(h)
				hashPtr = &hs
			}
			user = models.User{
				Uuid:         uuid.NewString(),
				FullName:     pStr(firstStr(contact, company)),
				Email:        pStr(email),
				PhoneNumber:  pStr(phone),
				Phone:        pStr(phone),
				PasswordHash: hashPtr,
				Status:       "ACTIVE",
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
		}
		var roleRow models.Role
		if tx.Where("name = ?", "ROLE_PRODUCER").First(&roleRow).Error == nil {
			_ = tx.FirstOrCreate(&models.UserRole{}, models.UserRole{UserId: user.ID, RoleId: roleRow.ID}).Error
		}
		kyc := "PENDING"
		onb := "PENDING"
		active := true
		share := 60.0
		out = models.ProducerProfile{
			UserId:              user.ID,
			CompanyName:         company,
			ContactPerson:       pStr(contact),
			Email:               pStr(email),
			Phone:               pStr(phone),
			Status:              "PENDING",
			OnboardingStatus:    &onb,
			KycStatus:           &kyc,
			RevenueShare:        &share,
			RevenueSharePercent: &share,
			IsActive:            &active,
			CreatedAt:           now,
			UpdatedAt:           &now,
		}
		return tx.Create(&out).Error
	})
	return &out, err
}

func (s *Service) GetProducerByUser(ctx context.Context, userID int64) (*models.ProducerProfile, error) {
	var p models.ProducerProfile
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error; err != nil {
		return nil, errors.New("producer profile not found")
	}
	return &p, nil
}

func (s *Service) UpdateProducerKYC(ctx context.Context, producerID int64, body map[string]any) (*models.ProducerProfile, error) {
	now := time.Now().UTC()
	upd := map[string]any{"updated_at": now, "kyc_status": "SUBMITTED", "onboarding_status": "UNDER_REVIEW"}
	for _, m := range [][2]string{
		{"panNumber", "pan_number"}, {"panDocUrl", "pan_doc_url"},
		{"aadharNumber", "aadhar_number"}, {"aadharDocUrl", "aadhar_doc_url"}, {"aadharBackDocUrl", "aadhar_back_doc_url"},
		{"gstNumber", "gst_number"}, {"gstDocUrl", "gst_doc_url"},
		{"bankName", "bank_name"}, {"bankAccountNumber", "bank_account_number"}, {"ifscCode", "ifsc_code"}, {"bankIfsc", "bank_ifsc"}, {"bankDocUrl", "bank_doc_url"},
		{"signedAgreementUrl", "signed_agreement_url"}, {"agreementUrl", "agreement_url"},
	} {
		if v := sVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if err := s.db.WithContext(ctx).Model(&models.ProducerProfile{}).Where("id = ?", producerID).Updates(upd).Error; err != nil {
		return nil, err
	}
	var out models.ProducerProfile
	err := s.db.WithContext(ctx).First(&out, producerID).Error
	return &out, err
}

func (s *Service) CollectSendOTP(ctx context.Context, contact string) (map[string]any, error) {
	clean := strings.TrimSpace(contact)
	if clean == "" {
		return nil, errors.New("phone or email is required")
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	code := fmt.Sprintf("%06d", n.Int64()+100000)
	_ = s.cache.Set(ctx, "producer:kyc:otp:"+clean, code, 10*time.Minute)
	return map[string]any{"sent": true, "contact": clean}, nil
}

func (s *Service) CollectVerifyOTP(ctx context.Context, contact, otp string) (map[string]any, error) {
	clean := strings.TrimSpace(contact)
	stored, ok := s.cache.Get(ctx, "producer:kyc:otp:"+clean)
	if !ok || stored != strings.TrimSpace(otp) {
		return nil, errors.New("invalid or expired OTP")
	}
	token := uuid.NewString()
	_ = s.cache.Set(ctx, "producer:kyc:tok:"+token, clean, 2*time.Hour)
	return map[string]any{"verified": true, "token": token}, nil
}

func (s *Service) ProducerSubmitContent(ctx context.Context, producerID *int64, body map[string]any) (*models.Content, error) {
	title := sVal(body, "title")
	if title == "" {
		return nil, errors.New("title is required")
	}
	ct := strings.ToUpper(sVal(body, "contentType", "content_type"))
	if ct == "" {
		ct = "MOVIE"
	}
	now := time.Now().UTC()
	c := models.Content{
		Title:                title,
		Slug:                 fmt.Sprintf("sub-%d", now.UnixMilli()),
		Description:          pStr(sVal(body, "description", "synopsis")),
		ContentType:          &ct,
		Status:               "PENDING_REVIEW",
		OriginalLanguageCode: pStr(sVal(body, "language", "originalLanguageCode")),
		PosterUrl:            pStr(sVal(body, "posterUrl")),
		TrailerUrl:           pStr(sVal(body, "trailerUrl")),
		ProducerId:           producerID,
		ProductionName:       pStr(sVal(body, "productionName", "companyName")),
		ProducerContactPhone: pStr(sVal(body, "producerContactPhone", "phone")),
		ProducerEmail:        pStr(sVal(body, "producerEmail", "email")),
		GoogleDriveLink:      pStr(sVal(body, "googleDriveLink", "driveLink")),
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if err := s.db.WithContext(ctx).Create(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Service) ProducerAnalytics(ctx context.Context, producerID int64) (map[string]any, error) {
	var titles []models.Content
	_ = s.db.WithContext(ctx).Where("producer_id = ?", producerID).Find(&titles).Error
	var totalViews int64
	for _, t := range titles {
		if t.ViewCount != nil {
			totalViews += *t.ViewCount
		}
	}
	var revRows []models.ProducerAdRevenue
	_ = s.db.WithContext(ctx).Where("producer_id = ?", producerID).Find(&revRows).Error
	var totalRev float64
	var totalImp int64
	for _, r := range revRows {
		if r.ProducerAmount != nil {
			totalRev += *r.ProducerAmount
		}
		if r.TotalImpressions != nil {
			totalImp += *r.TotalImpressions
		}
	}
	return map[string]any{
		"totalTitles":      len(titles),
		"totalViews":       totalViews,
		"totalImpressions": totalImp,
		"totalRevenue":     totalRev,
		"titles":           titles,
		"revenueBreakdown": revRows,
	}, nil
}

func (s *Service) AdminReviewProducer(ctx context.Context, id int64, status, reason string) (*models.ProducerProfile, error) {
	st := strings.ToUpper(strings.TrimSpace(status))
	if st == "" {
		st = "APPROVED"
	}
	now := time.Now().UTC()
	upd := map[string]any{
		"status":            st,
		"onboarding_status": st,
		"kyc_status":        st,
		"updated_at":        now,
	}
	if strings.TrimSpace(reason) != "" {
		upd["rejection_reason"] = strings.TrimSpace(reason)
	}
	if err := s.db.WithContext(ctx).Model(&models.ProducerProfile{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	var out models.ProducerProfile
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminToggleProducer(ctx context.Context, id int64) (*models.ProducerProfile, error) {
	var p models.ProducerProfile
	if err := s.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, errors.New("producer not found")
	}
	next := !(p.IsActive == nil || *p.IsActive)
	_ = s.db.WithContext(ctx).Model(&p).Update("is_active", next).Error
	p.IsActive = &next
	return &p, nil
}

func (s *Service) AdminListSubmissions(ctx context.Context) ([]models.Content, error) {
	var rows []models.Content
	err := s.db.WithContext(ctx).
		Where("producer_id IS NOT NULL OR status = 'PENDING_REVIEW'").
		Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminReviewSubmission(ctx context.Context, id int64, decision string) (map[string]any, error) {
	next := "PUBLISHED"
	if strings.EqualFold(decision, "REJECT") || strings.EqualFold(decision, "REJECTED") {
		next = "REJECTED"
	}
	if err := s.db.WithContext(ctx).Model(&models.Content{}).Where("id = ?", id).
		Updates(map[string]any{"status": next, "updated_at": time.Now().UTC()}).Error; err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "status": next}, nil
}

// --- Admin Marketing Agents CRUD ---

func (s *Service) AdminCreateAgent(ctx context.Context, body map[string]any) (*models.MarketingAgent, error) {
	name := sVal(body, "fullName", "full_name", "name")
	mobile := sVal(body, "mobileNumber", "mobile_number", "phone")
	email := strings.ToLower(sVal(body, "email"))
	code := strings.ToUpper(sVal(body, "agentCode", "agent_code"))
	if code == "" {
		raw := strings.ReplaceAll(uuid.NewString(), "-", "")
		code = "AGT" + strings.ToUpper(raw[:6])
	}
	if name == "" {
		return nil, errors.New("fullName is required")
	}
	now := time.Now().UTC()
	row := models.MarketingAgent{
		AgentCode:     code,
		FullName:      name,
		MobileNumber:  mobile,
		Email:         email,
		AadhaarNumber: pStr(sVal(body, "aadhaarNumber", "aadhaar_number")),
		PanNumber:     pStr(sVal(body, "panNumber", "pan_number")),
		AadhaarDocUrl: pStr(sVal(body, "aadhaarDocUrl", "aadhaar_doc_url")),
		PanDocUrl:     pStr(sVal(body, "panDocUrl", "pan_doc_url")),
		Status:        "ACTIVE",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Service) AdminGetAgent(ctx context.Context, id int64) (*models.MarketingAgent, error) {
	var a models.MarketingAgent
	if err := s.db.WithContext(ctx).First(&a, id).Error; err != nil {
		return nil, errors.New("marketing agent not found")
	}
	return &a, nil
}

func (s *Service) AdminToggleAgent(ctx context.Context, id int64) (*models.MarketingAgent, error) {
	a, err := s.AdminGetAgent(ctx, id)
	if err != nil {
		return nil, err
	}
	next := "ACTIVE"
	if strings.EqualFold(a.Status, "ACTIVE") {
		next = "INACTIVE"
	}
	_ = s.db.WithContext(ctx).Model(a).Updates(map[string]any{"status": next, "updated_at": time.Now().UTC()}).Error
	a.Status = next
	return a, nil
}

func (s *Service) AdminListAgentMembers(ctx context.Context, agentID int64) ([]models.MarketingAgentMember, error) {
	var rows []models.MarketingAgentMember
	err := s.db.WithContext(ctx).Where("agent_id = ?", agentID).Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func sVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func bVal(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if b, ok := v.(bool); ok {
				return b
			}
		}
	}
	return false
}

func i32Val(m map[string]any, keys ...string) int32 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return int32(f)
			}
		}
	}
	return 0
}

func pStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func firstStr(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
