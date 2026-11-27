package identity

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	cache  *cache.Store
	tokens *auth.TokenManager
}

func NewService(db *gorm.DB, cacheStore *cache.Store, tokens *auth.TokenManager) *Service {
	return &Service{db: db, cache: cacheStore, tokens: tokens}
}

type AuthResult struct {
	AccessToken  string         `json:"accessToken"`
	Token        string         `json:"token"`
	RefreshToken string         `json:"refreshToken"`
	User         map[string]any `json:"user"`
}

func (s *Service) Login(ctx context.Context, identifier, password string) (*AuthResult, error) {
	id := strings.TrimSpace(identifier)
	if id == "" || password == "" {
		return nil, errors.New("email/phone and password are required")
	}

	var user models.User
	err := s.db.WithContext(ctx).
		Where("LOWER(email) = LOWER(?) OR phone_number = ? OR phone = ?", id, id, id).
		First(&user).Error
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if strings.EqualFold(user.Status, "BLOCKED") || strings.EqualFold(user.Status, "SUSPENDED") {
		return nil, errors.New("account is blocked or suspended")
	}

	if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)) != nil {
		return nil, errors.New("invalid credentials")
	}

	now := time.Now().UTC()
	_ = s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", user.ID).
		Updates(map[string]any{"last_login_at": now, "last_active_at": now}).Error

	return s.issueSession(ctx, &user)
}

func (s *Service) Register(ctx context.Context, fullName, email, phone, password string) (*AuthResult, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	phone = strings.TrimSpace(phone)
	if email == "" && phone == "" {
		return nil, errors.New("email or phone number is required")
	}
	if len(password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	var existing int64
	q := s.db.WithContext(ctx).Model(&models.User{})
	if email != "" && phone != "" {
		q = q.Where("LOWER(email) = ? OR phone_number = ? OR phone = ?", email, phone, phone)
	} else if email != "" {
		q = q.Where("LOWER(email) = ?", email)
	} else {
		q = q.Where("phone_number = ? OR phone = ?", phone, phone)
	}
	if err := q.Count(&existing).Error; err == nil && existing > 0 {
		return nil, errors.New("account already exists with this email or phone")
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	hashStr := string(hashBytes)
	now := time.Now().UTC()
	authMethod := "PASSWORD"
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = "Subscriber"
	}

	user := models.User{
		Uuid:         uuid.NewString(),
		FullName:     &name,
		PasswordHash: &hashStr,
		AuthMethod:   &authMethod,
		Status:       "ACTIVE",
		LastLoginAt:  &now,
		LastActiveAt: &now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if email != "" {
		user.Email = &email
	}
	if phone != "" {
		user.PhoneNumber = &phone
		user.Phone = &phone
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		isKids := false
		prof := models.Profile{
			UserId:    user.ID,
			Name:      name,
			IsKids:    &isKids,
			CreatedAt: now,
			UpdatedAt: now,
		}
		return tx.Create(&prof).Error
	})
	if err != nil {
		return nil, err
	}

	return s.issueSession(ctx, &user)
}

func (s *Service) SendOTP(ctx context.Context, phone string) (string, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return "", errors.New("phone number is required")
	}
	allowed, _ := s.cache.AllowRate(ctx, "otp:"+phone, 5, 5*time.Minute)
	if !allowed {
		return "", errors.New("too many OTP requests, please wait a few minutes")
	}

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)
	_ = s.cache.Set(ctx, "otp:code:"+phone, code, 5*time.Minute)
	return code, nil
}

func (s *Service) VerifyOTP(ctx context.Context, phone, otp, fullName string) (*AuthResult, error) {
	phone = strings.TrimSpace(phone)
	otp = strings.TrimSpace(otp)
	if phone == "" || otp == "" {
		return nil, errors.New("phone and otp are required")
	}

	stored, ok := s.cache.Get(ctx, "otp:code:"+phone)
	if !ok || stored != otp {
		return nil, errors.New("invalid or expired OTP")
	}
	_ = s.cache.Del(ctx, "otp:code:"+phone)

	var user models.User
	err := s.db.WithContext(ctx).Where("phone_number = ? OR phone = ?", phone, phone).First(&user).Error
	now := time.Now().UTC()
	if errors.Is(err, gorm.ErrRecordNotFound) {
		name := strings.TrimSpace(fullName)
		if name == "" {
			name = "Subscriber"
		}
		verified := true
		authMethod := "OTP"
		user = models.User{
			Uuid:          uuid.NewString(),
			FullName:      &name,
			PhoneNumber:   &phone,
			Phone:         &phone,
			PhoneVerified: &verified,
			AuthMethod:    &authMethod,
			Status:        "ACTIVE",
			LastLoginAt:   &now,
			LastActiveAt:  &now,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		_ = s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", user.ID).
			Updates(map[string]any{"last_login_at": now, "last_active_at": now, "phone_verified": true}).Error
	}

	return s.issueSession(ctx, &user)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	claims, err := s.tokens.Parse(refreshToken)
	if err != nil || claims.TokenType != "refresh" {
		return nil, errors.New("invalid refresh token")
	}
	uid, err := claims.ParsedUserID()
	if err != nil {
		return nil, errors.New("invalid token subject")
	}
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, uid).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return s.issueSession(ctx, &user)
}

func (s *Service) GetProfile(ctx context.Context, userID int64) (map[string]any, error) {
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return s.buildUserPayload(ctx, &user), nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID int64, updates map[string]any) (map[string]any, error) {
	allowed := map[string]any{"updated_at": time.Now().UTC()}
	for _, k := range []string{"full_name", "email", "avatar_url", "pincode", "profession", "date_of_birth", "preferred_languages"} {
		if v, ok := updates[k]; ok {
			allowed[k] = v
		}
	}
	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Updates(allowed).Error; err != nil {
		return nil, err
	}
	return s.GetProfile(ctx, userID)
}

func (s *Service) ListSubProfiles(ctx context.Context, userID int64) ([]models.Profile, error) {
	var profiles []models.Profile
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("id ASC").Find(&profiles).Error
	return profiles, err
}

func (s *Service) ListDevices(ctx context.Context, userID int64) ([]models.Device, error) {
	var devices []models.Device
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("last_active_at DESC").Find(&devices).Error
	return devices, err
}

func (s *Service) AdminListUsers(ctx context.Context, page, size int, search string) ([]models.User, int64, error) {
	if size <= 0 || size > 100 {
		size = 20
	}
	if page < 0 {
		page = 0
	}
	q := s.db.WithContext(ctx).Model(&models.User{})
	if sTrim := strings.TrimSpace(search); sTrim != "" {
		like := "%" + sTrim + "%"
		q = q.Where("full_name ILIKE ? OR email ILIKE ? OR phone_number ILIKE ?", like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []models.User
	err := q.Order("id DESC").Offset(page * size).Limit(size).Find(&users).Error
	return users, total, err
}

func (s *Service) issueSession(ctx context.Context, user *models.User) (*AuthResult, error) {
	roles := s.getUserRoles(ctx, user.ID)
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	phone := ""
	if user.PhoneNumber != nil {
		phone = *user.PhoneNumber
	}

	accessTok, err := s.tokens.SignAccessToken(user.ID, email, phone, roles)
	if err != nil {
		return nil, err
	}
	refreshTok, exp, err := s.tokens.SignRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	revoked := false
	_ = s.db.WithContext(ctx).Create(&models.RefreshToken{
		UserId:    user.ID,
		Token:     refreshTok,
		ExpiresAt: exp,
		Revoked:   &revoked,
		CreatedAt: time.Now().UTC(),
	}).Error

	return &AuthResult{
		AccessToken:  accessTok,
		Token:        accessTok,
		RefreshToken: refreshTok,
		User:         s.buildUserPayload(ctx, user),
	}, nil
}

func (s *Service) getUserRoles(ctx context.Context, userID int64) []string {
	var names []string
	_ = s.db.WithContext(ctx).
		Table("roles").
		Select("roles.name").
		Joins("JOIN user_roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ?", userID).
		Pluck("roles.name", &names).Error
	if len(names) == 0 {
		return []string{"USER"}
	}
	return names
}

func (s *Service) buildUserPayload(ctx context.Context, user *models.User) map[string]any {
	var activeSub models.Subscription
	hasSub := false
	pkgName := "Free"
	expiry := ""
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", user.ID, time.Now().UTC()).
		Order("end_date DESC").
		First(&activeSub).Error
	if err == nil {
		hasSub = true
		expiry = activeSub.EndDate.Format(time.RFC3339)
		var plan models.Plan
		if s.db.WithContext(ctx).First(&plan, activeSub.PlanId).Error == nil && plan.Name != "" {
			pkgName = plan.Name
		} else {
			pkgName = "VIP Membership"
		}
	}

	isBuy := 0
	if hasSub {
		isBuy = 1
	}

	return map[string]any{
		"id":            user.ID,
		"uuid":          user.Uuid,
		"fullName":      derefStr(user.FullName, "Subscriber"),
		"email":         derefStr(user.Email, ""),
		"phoneNumber":   derefStr(user.PhoneNumber, derefStr(user.Phone, "")),
		"avatarUrl":     derefStr(user.AvatarUrl, ""),
		"status":        user.Status,
		"roles":         s.getUserRoles(ctx, user.ID),
		"isBuy":         isBuy,
		"isSubscribed":  hasSub,
		"packageName":   pkgName,
		"expiryDate":    expiry,
		"createdAt":     user.CreatedAt.Format(time.RFC3339),
	}
}

func derefStr(p *string, fallback string) string {
	if p == nil || *p == "" {
		return fallback
	}
	return *p
}
