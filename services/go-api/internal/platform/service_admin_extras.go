package platform

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/backup"
	"github.com/maxxpixels/go-api/pkg/models"
	"github.com/maxxpixels/go-api/pkg/notify"
)

const backupsDir = "./backups"

// --- Settings Rollback & Security Matrix / Settings ---

func (s *Service) RollbackSetting(ctx context.Context, historyID int64, actor string) (map[string]any, error) {
	var h struct {
		SettingKey string  `gorm:"column:setting_key"`
		OldValue   *string `gorm:"column:old_value"`
	}
	if err := s.db.WithContext(ctx).Table("system_setting_history").
		Select("setting_key, old_value").Where("id = ?", historyID).First(&h).Error; err != nil || h.SettingKey == "" {
		return nil, errors.New("setting history entry not found")
	}
	val := ""
	if h.OldValue != nil {
		val = *h.OldValue
	}
	if err := s.AdminUpdateSettings(ctx, map[string]string{h.SettingKey: val}, actor); err != nil {
		return nil, err
	}
	return map[string]any{"rolledBack": true, "key": h.SettingKey, "value": val}, nil
}

func (s *Service) GetJSONSetting(ctx context.Context, key string, fallback any) any {
	var row models.SystemSetting
	if s.db.WithContext(ctx).Where("setting_key = ?", key).First(&row).Error == nil && row.SettingValue != nil && strings.TrimSpace(*row.SettingValue) != "" {
		var out any
		if json.Unmarshal([]byte(*row.SettingValue), &out) == nil {
			return out
		}
	}
	return fallback
}

func (s *Service) SaveJSONSetting(ctx context.Context, key string, payload any, actor string) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.AdminUpdateSettings(ctx, map[string]string{key: string(raw)}, actor)
}

// --- DRM Rules CRUD (stored in drm_rules table or JSON fallback) ---

func (s *Service) ListDRMRules(ctx context.Context) []map[string]any {
	var rows []map[string]any
	if err := s.db.WithContext(ctx).Table("drm_rules").Order("id DESC").Find(&rows).Error; err == nil && rows != nil {
		return rows
	}
	if v, ok := s.GetJSONSetting(ctx, "drm_rules_json", []map[string]any{}).([]any); ok {
		out := make([]map[string]any, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	}
	return []map[string]any{}
}

func (s *Service) UpsertDRMRule(ctx context.Context, id int64, body map[string]any, actor string) (map[string]any, error) {
	rules := s.ListDRMRules(ctx)
	if id == 0 {
		id = time.Now().UnixMilli()
		body["id"] = id
		body["createdAt"] = time.Now().UTC().Format(time.RFC3339)
		rules = append([]map[string]any{body}, rules...)
	} else {
		body["id"] = id
		body["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
		found := false
		for i, r := range rules {
			if int64(pi64(r, "id")) == id {
				rules[i] = body
				found = true
				break
			}
		}
		if !found {
			rules = append(rules, body)
		}
	}
	if err := s.SaveJSONSetting(ctx, "drm_rules_json", rules, actor); err != nil {
		return nil, err
	}
	return body, nil
}

func (s *Service) DeleteDRMRule(ctx context.Context, id int64, actor string) error {
	rules := s.ListDRMRules(ctx)
	filtered := make([]map[string]any, 0, len(rules))
	for _, r := range rules {
		if int64(pi64(r, "id")) != id {
			filtered = append(filtered, r)
		}
	}
	return s.SaveJSONSetting(ctx, "drm_rules_json", filtered, actor)
}

// --- Admin Backups & Migrations ---

func (s *Service) ListMigrations(ctx context.Context) []map[string]any {
	var rows []map[string]any
	_ = s.db.WithContext(ctx).Table("rust_schema_migrations").Order("version ASC").Find(&rows).Error
	if rows == nil {
		rows = []map[string]any{}
	}
	return rows
}

func (s *Service) ListBackups() []map[string]any {
	_ = os.MkdirAll(backupsDir, 0o755)
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		return []map[string]any{}
	}
	out := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, map[string]any{
			"filename":  e.Name(),
			"sizeBytes": info.Size(),
			"createdAt": info.ModTime().UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i]["filename"].(string) > out[j]["filename"].(string)
	})
	return out
}

func (s *Service) TriggerBackup(ctx context.Context) (map[string]any, error) {
	results, err := backup.RunAllDatabasesBackup(ctx, s.db, backupsDir)
	if err != nil {
		return nil, err
	}
	first := results[0]
	return map[string]any{
		"filename":      first.Filename,
		"sizeBytes":     first.SizeBytes,
		"bunnyUploaded": first.BunnyUploaded,
		"bunnyPath":     first.BunnyPath,
		"bunnyError":    first.BunnyError,
		"databases":     results,
		"createdAt":     first.CreatedAt,
	}, nil
}

func (s *Service) ReadBackup(filename string) ([]byte, error) {
	clean := filepath.Base(filename)
	if clean == "" || clean == "." || strings.Contains(filename, "..") {
		return nil, errors.New("invalid filename")
	}
	return os.ReadFile(filepath.Join(backupsDir, clean))
}

func (s *Service) DeleteBackup(filename string) error {
	clean := filepath.Base(filename)
	if clean == "" || clean == "." || strings.Contains(filename, "..") {
		return errors.New("invalid filename")
	}
	return os.Remove(filepath.Join(backupsDir, clean))
}

// --- WhatsApp via MSG91 ---

func (s *Service) AdminSendWhatsApp(ctx context.Context, phones []string, templateName, message string) (map[string]any, error) {
	msg91 := notify.NewMSG91FromEnv()
	count, provider, err := msg91.SendWhatsApp(ctx, phones, templateName, message)
	if err != nil {
		return map[string]any{"sent": false, "provider": provider, "error": err.Error()}, err
	}
	return map[string]any{"sent": true, "provider": provider, "recipientCount": count}, nil
}
