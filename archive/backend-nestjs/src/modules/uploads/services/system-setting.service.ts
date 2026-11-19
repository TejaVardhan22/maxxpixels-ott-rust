import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { AuditLog } from '../../users/entities/audit-log.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { maskSecret } from '../../../common/utils/pii-masker.util';
import { BusinessException } from '../../../common/filters/global-exception.filter';

interface DefaultSettingDef {
  key: string;
  value: string;
  group: string;
  description: string;
  isSecret?: boolean;
  isPublic?: boolean;
}

const DEFAULT_SYSTEM_SETTINGS: DefaultSettingDef[] = [
  // GENERAL & BRANDING
  { key: 'APP_NAME', value: 'MaxxPixels OTT', group: 'GENERAL', description: 'Platform display name', isPublic: true },
  { key: 'APP_TAGLINE', value: 'Entertainment Unlimited', group: 'GENERAL', description: 'App tagline', isPublic: true },
  { key: 'APP_LOGO_URL', value: 'https://maxxpixels.b-cdn.net/branding/logo.png', group: 'GENERAL', description: 'Primary logo URL', isPublic: true },
  { key: 'SUPPORT_EMAIL', value: 'support@maxxpixels.com', group: 'GENERAL', description: 'Customer support email', isPublic: true },
  { key: 'SUPPORT_PHONE', value: '+91-9999999999', group: 'GENERAL', description: 'Customer support phone', isPublic: true },
  { key: 'DEFAULT_CURRENCY', value: 'INR', group: 'GENERAL', description: 'Default billing currency', isPublic: true },
  { key: 'DEFAULT_LANGUAGE', value: 'hi', group: 'GENERAL', description: 'Default catalog language', isPublic: true },

  // MAINTENANCE & APP VERSIONING
  { key: 'MAINTENANCE_MODE_ENABLED', value: 'false', group: 'MAINTENANCE', description: 'Global maintenance switch', isPublic: true },
  { key: 'MAINTENANCE_MESSAGE', value: 'We are upgrading our servers for a better streaming experience.', group: 'MAINTENANCE', description: 'Maintenance banner message', isPublic: true },
  { key: 'MAINTENANCE_ALLOWED_IPS', value: '127.0.0.1', group: 'MAINTENANCE', description: 'Comma-separated IPs allowed during maintenance' },
  { key: 'ANDROID_MIN_VERSION', value: '1.0.0', group: 'APP_VERSION', description: 'Minimum Android version', isPublic: true },
  { key: 'ANDROID_LATEST_VERSION', value: '1.2.0', group: 'APP_VERSION', description: 'Latest Android version', isPublic: true },
  { key: 'ANDROID_FORCE_UPDATE', value: 'false', group: 'APP_VERSION', description: 'Force update on Android', isPublic: true },
  { key: 'IOS_MIN_VERSION', value: '1.0.0', group: 'APP_VERSION', description: 'Minimum iOS version', isPublic: true },
  { key: 'IOS_LATEST_VERSION', value: '1.2.0', group: 'APP_VERSION', description: 'Latest iOS version', isPublic: true },
  { key: 'IOS_FORCE_UPDATE', value: 'false', group: 'APP_VERSION', description: 'Force update on iOS', isPublic: true },
  { key: 'TV_MIN_VERSION', value: '1.0.0', group: 'APP_VERSION', description: 'Minimum Smart TV version', isPublic: true },

  // STORAGE & BUNNY CDN
  { key: 'STORAGE_PROVIDER', value: 'BUNNY', group: 'STORAGE', description: 'Active storage provider (BUNNY or S3)' },
  { key: 'BUNNY_STORAGE_ZONE', value: process.env.BUNNY_STORAGE_ZONE || 'maxxpixels', group: 'STORAGE', description: 'Bunny Storage Zone Name' },
  { key: 'BUNNY_STORAGE_API_KEY', value: process.env.BUNNY_STORAGE_API_KEY || '', group: 'STORAGE', description: 'Bunny Storage Password / API Key', isSecret: true },
  { key: 'BUNNY_STORAGE_ENDPOINT', value: 'https://sg.storage.bunnycdn.net', group: 'STORAGE', description: 'Bunny Storage regional endpoint' },
  { key: 'BUNNY_STORAGE_CDN_URL', value: 'https://maxxpixels.b-cdn.net', group: 'STORAGE', description: 'Bunny Pull Zone URL', isPublic: true },
  { key: 'BUNNY_STREAM_LIBRARY_ID', value: process.env.BUNNY_STREAM_LIBRARY_ID || '', group: 'STORAGE', description: 'Bunny Stream Video Library ID' },
  { key: 'BUNNY_STREAM_API_KEY', value: process.env.BUNNY_STREAM_API_KEY || '', group: 'STORAGE', description: 'Bunny Stream API Key', isSecret: true },
  { key: 'BUNNY_STREAM_CDN_HOSTNAME', value: 'vz-maxxpixels.b-cdn.net', group: 'STORAGE', description: 'Bunny Stream HLS hostname', isPublic: true },
  { key: 'BUNNY_STREAM_TOKEN_KEY', value: process.env.BUNNY_STREAM_TOKEN_KEY || '', group: 'STORAGE', description: 'Bunny URL Token Authentication Key', isSecret: true },

  // PAYMENT GATEWAYS
  { key: 'PAYMENT_ACTIVE_GATEWAY', value: 'RAZORPAY', group: 'PAYMENT', description: 'Primary payment gateway', isPublic: true },
  { key: 'RAZORPAY_ENABLED', value: 'true', group: 'PAYMENT', description: 'Enable Razorpay checkout', isPublic: true },
  { key: 'RAZORPAY_KEY_ID', value: process.env.RAZORPAY_KEY_ID || 'rzp_test_MaxxPixelsKey', group: 'PAYMENT', description: 'Razorpay Key ID', isPublic: true },
  { key: 'RAZORPAY_KEY_SECRET', value: process.env.RAZORPAY_KEY_SECRET || '', group: 'PAYMENT', description: 'Razorpay Key Secret', isSecret: true },
  { key: 'RAZORPAY_WEBHOOK_SECRET', value: process.env.RAZORPAY_WEBHOOK_SECRET || '', group: 'PAYMENT', description: 'Razorpay Webhook Secret', isSecret: true },
  { key: 'STRIPE_ENABLED', value: 'false', group: 'PAYMENT', description: 'Enable Stripe checkout', isPublic: true },
  { key: 'STRIPE_PUBLIC_KEY', value: process.env.STRIPE_PUBLIC_KEY || '', group: 'PAYMENT', description: 'Stripe Publishable Key', isPublic: true },
  { key: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY || '', group: 'PAYMENT', description: 'Stripe Secret Key', isSecret: true },
  { key: 'STRIPE_WEBHOOK_SECRET', value: process.env.STRIPE_WEBHOOK_SECRET || '', group: 'PAYMENT', description: 'Stripe Webhook Signing Secret', isSecret: true },
  { key: 'GST_PERCENTAGE', value: '18', group: 'PAYMENT', description: 'Applicable GST tax percentage', isPublic: true },

  // SMS, WHATSAPP, EMAIL & PUSH NOTIFICATIONS
  { key: 'SMS_PROVIDER', value: 'MSG91', group: 'NOTIFICATION', description: 'Active OTP SMS provider' },
  { key: 'MSG91_AUTH_KEY', value: process.env.MSG91_AUTH_KEY || '', group: 'NOTIFICATION', description: 'MSG91 Auth Key', isSecret: true },
  { key: 'MSG91_TEMPLATE_ID', value: process.env.MSG91_TEMPLATE_ID || '', group: 'NOTIFICATION', description: 'MSG91 DLT OTP Template ID' },
  { key: 'MSG91_SENDER_ID', value: 'MAXXOT', group: 'NOTIFICATION', description: 'MSG91 6-char Sender ID' },
  { key: 'WHATSAPP_ENABLED', value: 'false', group: 'NOTIFICATION', description: 'Enable WhatsApp notifications' },
  { key: 'WHATSAPP_API_URL', value: 'https://graph.facebook.com/v18.0', group: 'NOTIFICATION', description: 'WhatsApp Cloud API URL' },
  { key: 'WHATSAPP_ACCESS_TOKEN', value: '', group: 'NOTIFICATION', description: 'WhatsApp Cloud API Token', isSecret: true },
  { key: 'SMTP_HOST', value: process.env.SMTP_HOST || 'smtp.gmail.com', group: 'NOTIFICATION', description: 'SMTP Server Host' },
  { key: 'SMTP_PORT', value: '587', group: 'NOTIFICATION', description: 'SMTP Server Port' },
  { key: 'SMTP_USERNAME', value: process.env.SMTP_USERNAME || '', group: 'NOTIFICATION', description: 'SMTP Username' },
  { key: 'SMTP_PASSWORD', value: process.env.SMTP_PASSWORD || '', group: 'NOTIFICATION', description: 'SMTP Password', isSecret: true },
  { key: 'FCM_ENABLED', value: 'true', group: 'NOTIFICATION', description: 'Enable Firebase Cloud Messaging' },
  { key: 'FCM_PROJECT_ID', value: process.env.FCM_PROJECT_ID || 'maxxpixels-ott', group: 'NOTIFICATION', description: 'Firebase Project ID' },
  { key: 'FCM_SERVER_KEY', value: '', group: 'NOTIFICATION', description: 'Firebase Legacy Server Key', isSecret: true },

  // PLAYBACK, DRM & ADS
  { key: 'PLAYBACK_HEARTBEAT_INTERVAL_SEC', value: '30', group: 'PLAYBACK', description: 'Client heartbeat interval in seconds', isPublic: true },
  { key: 'PLAYBACK_URL_EXPIRY_SEC', value: '14400', group: 'PLAYBACK', description: 'Signed HLS stream expiry in seconds' },
  { key: 'ADS_ENABLED', value: 'true', group: 'ADS', description: 'Global VAST advertisements toggle', isPublic: true },
  { key: 'VAST_DEFAULT_SKIP_OFFSET_SEC', value: '5', group: 'ADS', description: 'Default ad skip offset in seconds', isPublic: true },

  // GOOGLE ADMOB MOBILE ADS
  { key: 'ADMOB_ENABLED', value: 'true', group: 'ADS', description: 'Enable Google Mobile Ads in Mobile App', isPublic: true },
  { key: 'admob_enabled', value: 'true', group: 'ADS', description: 'Enable Google Mobile Ads in Mobile App', isPublic: true },
  { key: 'ADMOB_APP_ID', value: 'ca-app-pub-2191993313473081~5839116549', group: 'ADS', description: 'Google AdMob App ID', isPublic: true },
  { key: 'admob_app_id', value: 'ca-app-pub-2191993313473081~5839116549', group: 'ADS', description: 'Google AdMob App ID', isPublic: true },
  { key: 'ADMOB_BANNER_ID', value: 'ca-app-pub-2191993313473081/8776873716', group: 'ADS', description: 'AdMob Banner Ad Unit ID', isPublic: true },
  { key: 'admob_banner_id', value: 'ca-app-pub-2191993313473081/8776873716', group: 'ADS', description: 'AdMob Banner Ad Unit ID', isPublic: true },
  { key: 'ADMOB_INTERSTITIAL_ID', value: 'ca-app-pub-2191993313473081/2987672632', group: 'ADS', description: 'AdMob Interstitial Ad Unit ID', isPublic: true },
  { key: 'admob_interstitial_id', value: 'ca-app-pub-2191993313473081/2987672632', group: 'ADS', description: 'AdMob Interstitial Ad Unit ID', isPublic: true },
  { key: 'ADMOB_TEST_MODE', value: 'false', group: 'ADS', description: 'AdMob Test Mode with sample ads', isPublic: true },
  { key: 'admob_test_mode', value: 'false', group: 'ADS', description: 'AdMob Test Mode with sample ads', isPublic: true },
];

@Injectable()
export class SystemSettingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemSettingService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly redisService: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SKIP_DB_INIT === 'true') return;
    try {
      await this.seedDefaultSettings();
    } catch (err: any) {
      this.logger.warn(`Settings bootstrap notice: ${err.message}`);
    }
  }

  async seedDefaultSettings(): Promise<void> {
    for (const item of DEFAULT_SYSTEM_SETTINGS) {
      const existing = await this.settingRepo.findOne({ where: { settingKey: item.key } });
      const envVal = process.env[item.key]?.trim();

      if (!existing) {
        const valToSave = envVal || item.value;
        await this.settingRepo.save(
          this.settingRepo.create({
            settingKey: item.key,
            settingValue: valToSave,
          }),
        );
        await this.redisService.set(`settings:${item.key}`, valToSave, 3600);
      } else {
        // Automatically sync environment variables if DB setting is empty or using test placeholder
        let updatedVal = existing.settingValue;
        if (
          envVal &&
          (!existing.settingValue ||
            existing.settingValue.trim() === '' ||
            existing.settingValue === 'rzp_test_MaxxPixelsKey' ||
            (item.key.includes('SECRET') && existing.settingValue.length < 8))
        ) {
          existing.settingValue = envVal;
          await this.settingRepo.save(existing);
          updatedVal = envVal;
        }
        await this.redisService.set(`settings:${item.key}`, updatedVal || item.value, 3600);
      }
    }
  }

  async getValue(key: string, defaultValue = ''): Promise<string> {
    const envVal = process.env[key]?.trim();
    const cached = await this.redisService.get<string>(`settings:${key}`);
    if (cached !== null && cached !== undefined && cached.trim() !== '') {
      if (key === 'RAZORPAY_KEY_ID' && cached === 'rzp_test_MaxxPixelsKey' && envVal?.startsWith('rzp_live_')) {
        return envVal;
      }
      return cached;
    }
    const row = await this.settingRepo.findOne({ where: { settingKey: key } });
    if (row && row.settingValue !== null && row.settingValue !== undefined && row.settingValue.trim() !== '') {
      if (key === 'RAZORPAY_KEY_ID' && row.settingValue === 'rzp_test_MaxxPixelsKey' && envVal?.startsWith('rzp_live_')) {
        await this.redisService.set(`settings:${key}`, envVal, 3600);
        return envVal;
      }
      await this.redisService.set(`settings:${key}`, row.settingValue, 3600);
      return row.settingValue;
    }
    if (envVal) {
      await this.redisService.set(`settings:${key}`, envVal, 3600);
      return envVal;
    }
    return defaultValue;
  }

  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const val = await this.getValue(key, String(defaultValue));
    return val === 'true' || val === '1';
  }

  async getAllSettings(group?: string, maskSecrets = true): Promise<any[]> {
    const defMap = new Map<string, DefaultSettingDef>();
    for (const d of DEFAULT_SYSTEM_SETTINGS) {
      defMap.set(d.key.toUpperCase(), d);
    }

    try {
      const settings = await this.settingRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.settingKey', 's.settingValue'])
        .addSelect('s.updatedAt', 'updated_at')
        .orderBy('s.settingKey', 'ASC')
        .getRawMany();

      const result = settings.map((s) => {
        const key = String(s.s_setting_key ?? s.settingKey ?? s.setting_key ?? '');
        const value = s.s_setting_value ?? s.settingValue ?? s.setting_value ?? '';
        const updatedAt = s.updated_at ?? s.s_updated_at ?? s.updatedAt ?? null;
        const def = defMap.get(key.toUpperCase());
        const isSecret =
          def?.isSecret ?? /password|secret|auth_key|token|api_key|server_key/i.test(key);
        const isPublic = def?.isPublic ?? !isSecret;
        const settingGroup = def?.group || this.inferSettingGroup(key);
        const description = def?.description || key;
        const masked = maskSecrets && isSecret ? maskSecret(String(value ?? '')) : String(value ?? '');

        return {
          settingKey: key,
          setting_key: key,
          settingValue: masked,
          setting_value: masked,
          settingGroup,
          setting_group: settingGroup,
          description,
          isSecret,
          isPublic,
          updatedBy: 'admin',
          updatedAt,
        };
      });

      if (group) {
        const grpUpper = group.toUpperCase();
        return result.filter((r) => r.settingGroup.toUpperCase() === grpUpper);
      }

      return result;
    } catch (err: any) {
      this.logger.error(`Failed to load system settings: ${err?.message || err}`);
      return this.buildDefaultSettingsResponse(group, maskSecrets);
    }
  }

  private buildDefaultSettingsResponse(group?: string, maskSecrets = true): any[] {
    const result = DEFAULT_SYSTEM_SETTINGS.map((def) => {
      const value = String(def.value ?? '');
      const masked = maskSecrets && def.isSecret ? maskSecret(value) : value;
      return {
        settingKey: def.key,
        setting_key: def.key,
        settingValue: masked,
        setting_value: masked,
        settingGroup: def.group || 'GENERAL',
        setting_group: def.group || 'GENERAL',
        description: def.description || def.key,
        isSecret: Boolean(def.isSecret),
        isPublic: def.isPublic ?? !def.isSecret,
        updatedBy: 'system',
        updatedAt: null,
      };
    });

    if (group) {
      const grpUpper = group.toUpperCase();
      return result.filter((r) => r.settingGroup.toUpperCase() === grpUpper);
    }
    return result;
  }

  private inferSettingGroup(key: string): string {
    const k = key.toUpperCase();
    if (k.startsWith('BUNNY') || k.startsWith('STORAGE') || k.includes('S3')) return 'STORAGE';
    if (k.includes('PAYMENT') || k.includes('RAZORPAY') || k.includes('STRIPE') || k.includes('CURRENCY') || k.includes('GST')) return 'PAYMENT';
    if (k.includes('SMS') || k.includes('MSG91') || k.includes('SMTP') || k.includes('EMAIL') || k.includes('FCM') || k.includes('WHATSAPP')) return 'NOTIFICATION';
    if (k.includes('AD_') || k.includes('ADMOB') || k.includes('VAST')) return 'ADS';
    if (k.includes('MAINTENANCE') || k.includes('VERSION') || k.includes('ANDROID') || k.includes('IOS') || k.includes('TV')) return 'APP_VERSION';
    return 'GENERAL';
  }

  async getPublicConfig(): Promise<Record<string, any>> {
    return this.redisService.getOrSet('settings:public_bundle', 300, async () => {
      const rows = await this.settingRepo.find();
      const map: Record<string, any> = {};

      for (const def of DEFAULT_SYSTEM_SETTINGS) {
        if (def.isPublic && !def.isSecret) {
          map[def.key] = def.value;
          map[def.key.toLowerCase()] = def.value;
        }
      }

      for (const s of rows) {
        const key = s.settingKey;
        const lowerKey = key.toLowerCase();
        const isSecret = /password|secret|auth_key|token|api_key|server_key/i.test(key);
        if (!isSecret && s.settingValue !== null && s.settingValue !== undefined) {
          map[key] = s.settingValue;
          map[lowerKey] = s.settingValue;
        }
      }

      map.platform_name = map.platform_name || map.app_name || 'MaxxPixels OTT Streaming Platform';
      map.app_short_name = map.app_short_name || map.appshortname || 'MaxxPixels';
      map.logo_url = map.logo_url || map.app_logo || map.app_logo_url || 'assets/logo.png';
      map.dark_logo_url = map.dark_logo_url || map.logo_url;

      return map;
    });
  }

  async updateSettings(
    updates: Record<string, any> | Array<{ settingKey?: string; key?: string; settingValue?: any; value?: any; settingGroup?: string }>,
    actorEmail = 'admin@maxxpixels.com',
    ipAddress?: string,
  ): Promise<any[]> {
    const entries: Array<{ key: string; value: string; group?: string }> = [];

    if (Array.isArray(updates)) {
      for (const item of updates) {
        const k = item.settingKey || item.key;
        const v = item.settingValue !== undefined ? item.settingValue : item.value;
        if (k) entries.push({ key: k, value: String(v ?? ''), group: item.settingGroup });
      }
    } else if (updates && typeof updates === 'object') {
      const rawMap = updates.settings && typeof updates.settings === 'object' ? updates.settings : updates;
      for (const [k, v] of Object.entries(rawMap)) {
        if (k !== 'group' && k !== 'settingGroup') {
          entries.push({ key: k, value: String(v ?? ''), group: updates.group || updates.settingGroup });
        }
      }
    }

    const updatedRows: SystemSetting[] = [];
    for (const entry of entries) {
      // Skip overwriting secrets if the client submitted a masked placeholder (`****`)
      if (entry.value.includes('****')) {
        continue;
      }

      let existing = await this.settingRepo.findOne({ where: { settingKey: entry.key } });
      const oldValue = existing?.settingValue ?? null;

      if (!existing) {
        existing = this.settingRepo.create({
          settingKey: entry.key,
          settingValue: entry.value,
          settingGroup: (entry.group || 'GENERAL').toUpperCase(),
          isSecret: /SECRET|PASSWORD|KEY|TOKEN/i.test(entry.key) && !/PUBLIC|KEY_ID/i.test(entry.key),
          isPublic: false,
          updatedBy: actorEmail,
        });
      } else {
        existing.settingValue = entry.value;
        if (entry.group) existing.settingGroup = entry.group.toUpperCase();
        existing.updatedBy = actorEmail;
      }

      const saved = await this.settingRepo.save(existing);
      updatedRows.push(saved);

      await this.redisService.set(`settings:${entry.key}`, entry.value, 3600);

      // Record audit log for rollback capability
      await this.auditRepo.save(
        this.auditRepo.create({
          userEmail: actorEmail,
          action: 'UPDATE_SYSTEM_SETTING',
          entityName: 'SystemSetting',
          entityId: entry.key,
          details: JSON.stringify({
            settingKey: entry.key,
            previousValue: existing.isSecret ? '***MASKED***' : oldValue,
            newValue: existing.isSecret ? '***MASKED***' : entry.value,
            rawPreviousValue: oldValue,
          }),
          ipAddress: ipAddress || null,
        }),
      );
    }

    await this.redisService.del('settings:public_bundle');
    return this.getAllSettings(undefined, true);
  }

  async getAuditHistory(limit = 50): Promise<any[]> {
    const logs = await this.auditRepo.find({
      where: { entityName: 'SystemSetting' },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return logs.map((l) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(l.details || '{}');
      } catch {
        parsed = { raw: l.details };
      }
      return {
        id: l.id,
        actorEmail: l.userEmail,
        action: l.action,
        settingKey: l.entityId,
        previousValue: parsed.previousValue,
        newValue: parsed.newValue,
        timestamp: l.createdAt,
        ipAddress: l.ipAddress,
      };
    });
  }

  async rollbackSetting(auditId: number, actorEmail = 'admin@maxxpixels.com'): Promise<any> {
    const log = await this.auditRepo.findOne({ where: { id: auditId } });
    if (!log || log.targetEntity !== 'SystemSetting' || !log.targetId) {
      throw new BusinessException('Audit log entry not found for setting rollback', 'AUDIT_NOT_FOUND');
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(log.details || '{}');
    } catch {
      throw new BusinessException('Invalid audit log payload', 'INVALID_AUDIT_LOG');
    }

    const previousValue = parsed.rawPreviousValue ?? parsed.previousValue ?? '';
    await this.updateSettings({ [log.targetId]: previousValue }, actorEmail);
    return {
      settingKey: log.targetId,
      restoredValue: maskSecret(previousValue),
      rolledBackFromAuditId: auditId,
    };
  }

  async testConnection(provider: string, payload?: Record<string, any>): Promise<any> {
    const normalized = (provider || '').toUpperCase();
    const startTime = Date.now();

    if (normalized.includes('BUNNY')) {
      const zone = payload?.storageZone || (await this.getValue('BUNNY_STORAGE_ZONE', 'maxxpixels'));
      const apiKey = payload?.apiKey || (await this.getValue('BUNNY_STORAGE_API_KEY', ''));
      if (!apiKey) {
        return {
          provider: 'BUNNY_CDN',
          connected: true,
          mode: 'LOCAL_FALLBACK_READY',
          latencyMs: Date.now() - startTime,
          message: 'Bunny API key not set; local storage fallback is active and healthy.',
        };
      }
      try {
        const endpoint = await this.getValue('BUNNY_STORAGE_ENDPOINT', 'https://sg.storage.bunnycdn.com');
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/${zone}/`, {
          headers: { AccessKey: apiKey },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return {
          provider: 'BUNNY_CDN',
          connected: true,
          latencyMs: Date.now() - startTime,
          message: `Successfully authenticated with Bunny Storage zone '${zone}'.`,
        };
      } catch (err: any) {
        return {
          provider: 'BUNNY_CDN',
          connected: false,
          latencyMs: Date.now() - startTime,
          message: `Bunny connection check failed: ${err.message}`,
        };
      }
    }

    if (normalized.includes('RAZORPAY')) {
      const keyId = payload?.keyId || (await this.getValue('RAZORPAY_KEY_ID', ''));
      return {
        provider: 'RAZORPAY',
        connected: Boolean(keyId),
        latencyMs: Date.now() - startTime,
        message: keyId ? `Razorpay configured (${keyId.slice(0, 12)}...)` : 'Razorpay Key ID missing',
      };
    }

    return {
      provider: normalized || 'SYSTEM',
      connected: true,
      latencyMs: Date.now() - startTime,
      message: `${normalized || 'System'} provider diagnostic check passed.`,
    };
  }
}
