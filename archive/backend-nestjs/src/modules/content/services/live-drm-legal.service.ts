import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveChannel } from '../entities/live-channel.entity';
import { LiveEvent } from '../entities/live-event.entity';
import { DrmRule } from '../entities/drm-rule.entity';
import { LegalPage } from '../entities/legal-page.entity';

@Injectable()
export class LiveDrmLegalService {
  constructor(
    @InjectRepository(LiveChannel)
    private readonly channelRepo: Repository<LiveChannel>,
    @InjectRepository(LiveEvent)
    private readonly eventRepo: Repository<LiveEvent>,
    @InjectRepository(DrmRule)
    private readonly drmRepo: Repository<DrmRule>,
    @InjectRepository(LegalPage)
    private readonly legalRepo: Repository<LegalPage>,
  ) {}

  // ==================== LIVE CHANNELS & EVENTS ====================

  async listLiveChannels(onlyActive = true): Promise<LiveChannel[]> {
    const whereClause = onlyActive ? { isActive: true } : {};
    return this.channelRepo.find({
      where: whereClause,
      order: { displayOrder: 'ASC', channelNumber: 'ASC', id: 'ASC' },
    });
  }

  async getLiveChannelById(id: number): Promise<LiveChannel> {
    const ch = await this.channelRepo.findOne({ where: { id } });
    if (!ch) throw new NotFoundException(`Live channel ${id} not found`);
    return ch;
  }

  async upsertLiveChannel(body: any, id?: number): Promise<LiveChannel> {
    let ch = id ? await this.channelRepo.findOne({ where: { id } }) : null;
    const name = String(body?.name || 'Live Channel').trim();
    const slug = body?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!ch) {
      ch = this.channelRepo.create({
        name,
        slug,
        description: body?.description || null,
        logoUrl: body?.logoUrl || body?.logo_url || null,
        posterUrl: body?.posterUrl || body?.poster_url || null,
        streamUrl: body?.streamUrl || body?.stream_url || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        category: body?.category || 'Entertainment',
        languageCode: body?.languageCode || 'hi',
        accessType: body?.accessType || 'FREE',
        channelNumber: body?.channelNumber ? Number(body.channelNumber) : null,
        isLive: body?.isLive !== undefined ? Boolean(body.isLive) : true,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
        displayOrder: Number(body?.displayOrder ?? 0),
      });
    } else {
      if (body.name !== undefined) ch.name = body.name;
      if (body.description !== undefined) ch.description = body.description;
      if (body.logoUrl !== undefined) ch.logoUrl = body.logoUrl;
      if (body.posterUrl !== undefined) ch.posterUrl = body.posterUrl;
      if (body.streamUrl !== undefined) ch.streamUrl = body.streamUrl;
      if (body.category !== undefined) ch.category = body.category;
      if (body.languageCode !== undefined) ch.languageCode = body.languageCode;
      if (body.accessType !== undefined) ch.accessType = body.accessType;
      if (body.isLive !== undefined) ch.isLive = Boolean(body.isLive);
      if (body.isActive !== undefined) ch.isActive = Boolean(body.isActive);
      if (body.displayOrder !== undefined) ch.displayOrder = Number(body.displayOrder);
    }
    return this.channelRepo.save(ch);
  }

  async deleteLiveChannel(id: number): Promise<any> {
    await this.channelRepo.delete(id);
    return { id, deleted: true };
  }

  async listLiveEvents(): Promise<LiveEvent[]> {
    return this.eventRepo.find({
      relations: ['channel'],
      order: { startTime: 'ASC' },
    });
  }

  async upsertLiveEvent(body: any, id?: number): Promise<LiveEvent> {
    let ev = id ? await this.eventRepo.findOne({ where: { id } }) : null;
    if (!ev) {
      ev = this.eventRepo.create({
        title: body?.title || 'Live Broadcast Event',
        description: body?.description || null,
        posterUrl: body?.posterUrl || null,
        streamUrl: body?.streamUrl || null,
        channelId: body?.channelId ? Number(body.channelId) : null,
        startTime: body?.startTime ? new Date(body.startTime) : new Date(),
        endTime: body?.endTime ? new Date(body.endTime) : null,
        status: body?.status || 'SCHEDULED',
        accessType: body?.accessType || 'PREMIUM',
      });
    } else {
      if (body.title !== undefined) ev.title = body.title;
      if (body.description !== undefined) ev.description = body.description;
      if (body.posterUrl !== undefined) ev.posterUrl = body.posterUrl;
      if (body.streamUrl !== undefined) ev.streamUrl = body.streamUrl;
      if (body.status !== undefined) ev.status = body.status;
      if (body.accessType !== undefined) ev.accessType = body.accessType;
    }
    return this.eventRepo.save(ev);
  }

  // ==================== DRM RULES ====================

  async listDrmRules(): Promise<DrmRule[]> {
    let rules = await this.drmRepo.find({ order: { id: 'ASC' } });
    if (!rules || rules.length === 0) {
      // Seed default industry DRM protection profiles if empty
      const defaultRules = [
        this.drmRepo.create({
          name: 'Google Widevine Modular L1/L3',
          drmType: 'Google Widevine (Modular)',
          provider: 'BUNNY_MEDIA_CAGE',
          securityLevel: 'L1 + L3',
          licenseType: 'STREAMING',
          enforceHdcp22: true,
          dynamicKeyRotation: true,
          keyRotationIntervalMinutes: 30,
          invisibleWatermarking: true,
          blockScreenRecording: true,
          blockRootedDevices: true,
          dynamicWatermarking: true,
          status: 'ACTIVE',
          isActive: true,
        }),
        this.drmRepo.create({
          name: 'Apple FairPlay Streaming',
          drmType: 'Apple FairPlay Streaming',
          provider: 'BUNNY_MEDIA_CAGE',
          securityLevel: 'Hardware / Secure Enclave',
          licenseType: 'STREAMING',
          enforceHdcp22: true,
          dynamicKeyRotation: true,
          keyRotationIntervalMinutes: 30,
          invisibleWatermarking: true,
          blockScreenRecording: true,
          blockRootedDevices: true,
          dynamicWatermarking: true,
          status: 'ACTIVE',
          isActive: true,
        }),
        this.drmRepo.create({
          name: 'Microsoft PlayReady SL3000',
          drmType: 'Microsoft PlayReady',
          provider: 'BUNNY_MEDIA_CAGE',
          securityLevel: 'SL3000 Hardware DRM',
          licenseType: 'STREAMING',
          enforceHdcp22: true,
          dynamicKeyRotation: false,
          keyRotationIntervalMinutes: 60,
          invisibleWatermarking: true,
          blockScreenRecording: true,
          blockRootedDevices: true,
          dynamicWatermarking: true,
          status: 'ACTIVE',
          isActive: true,
        }),
      ];
      rules = await this.drmRepo.save(defaultRules);
    }
    return rules;
  }

  async upsertDrmRule(body: any, id?: number): Promise<any> {
    if (Array.isArray(body)) {
      const results: DrmRule[] = [];
      for (const item of body) {
        const saved = await this.upsertSingleDrmRule(item, item.id);
        results.push(saved);
      }
      return results;
    }
    return this.upsertSingleDrmRule(body, id);
  }

  private async upsertSingleDrmRule(body: any, id?: number): Promise<DrmRule> {
    let rule = id ? await this.drmRepo.findOne({ where: { id } }) : null;
    if (!rule) {
      rule = this.drmRepo.create({
        name: body?.name || body?.drmType || 'Custom DRM Policy',
        provider: body?.provider || 'BUNNY_MEDIA_CAGE',
        drmType: body?.drmType || body?.name || 'Widevine',
        widevineLicenseUrl: body?.widevineLicenseUrl || null,
        fairplayLicenseUrl: body?.fairplayLicenseUrl || null,
        fairplayCertificateUrl: body?.fairplayCertificateUrl || null,
        playreadyLicenseUrl: body?.playreadyLicenseUrl || null,
        securityLevel: body?.securityLevel || 'L1',
        hdcpLevel: body?.hdcpLevel || 'HDCP_2_2',
        licenseType: body?.licenseType || 'STREAMING',
        persistentLicense: Boolean(body?.persistentLicense ?? false),
        licenseDurationSeconds: Number(body?.licenseDurationSeconds ?? 86400),
        playbackDurationSeconds: Number(body?.playbackDurationSeconds ?? 14400),
        blockScreenRecording: Boolean(body?.blockScreenRecording ?? true),
        blockRootedDevices: Boolean(body?.blockRootedDevices ?? true),
        dynamicWatermarking: Boolean(body?.dynamicWatermarking ?? true),
        concurrentStreamLimit: Number(body?.concurrentStreamLimit ?? 2),
        enforceHdcp22: body?.enforceHdcp22 !== undefined ? Boolean(body.enforceHdcp22) : true,
        dynamicKeyRotation: body?.dynamicKeyRotation !== undefined ? Boolean(body.dynamicKeyRotation) : true,
        keyRotationIntervalMinutes: Number(body?.keyRotationIntervalMinutes ?? 30),
        invisibleWatermarking: body?.invisibleWatermarking !== undefined ? Boolean(body.invisibleWatermarking) : true,
        status: body?.status || 'ACTIVE',
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      Object.assign(rule, {
        name: body.name ?? rule.name,
        provider: body.provider ?? rule.provider,
        drmType: body.drmType ?? rule.drmType,
        widevineLicenseUrl: body.widevineLicenseUrl ?? rule.widevineLicenseUrl,
        fairplayLicenseUrl: body.fairplayLicenseUrl ?? rule.fairplayLicenseUrl,
        fairplayCertificateUrl: body.fairplayCertificateUrl ?? rule.fairplayCertificateUrl,
        playreadyLicenseUrl: body.playreadyLicenseUrl ?? rule.playreadyLicenseUrl,
        securityLevel: body.securityLevel ?? rule.securityLevel,
        hdcpLevel: body.hdcpLevel ?? rule.hdcpLevel,
        licenseType: body.licenseType ?? rule.licenseType,
        persistentLicense: body.persistentLicense !== undefined ? Boolean(body.persistentLicense) : rule.persistentLicense,
        blockScreenRecording: body.blockScreenRecording !== undefined ? Boolean(body.blockScreenRecording) : rule.blockScreenRecording,
        blockRootedDevices: body.blockRootedDevices !== undefined ? Boolean(body.blockRootedDevices) : rule.blockRootedDevices,
        dynamicWatermarking: body.dynamicWatermarking !== undefined ? Boolean(body.dynamicWatermarking) : rule.dynamicWatermarking,
        concurrentStreamLimit: body.concurrentStreamLimit !== undefined ? Number(body.concurrentStreamLimit) : rule.concurrentStreamLimit,
        enforceHdcp22: body.enforceHdcp22 !== undefined ? Boolean(body.enforceHdcp22) : rule.enforceHdcp22,
        dynamicKeyRotation: body.dynamicKeyRotation !== undefined ? Boolean(body.dynamicKeyRotation) : rule.dynamicKeyRotation,
        keyRotationIntervalMinutes: body.keyRotationIntervalMinutes !== undefined ? Number(body.keyRotationIntervalMinutes) : rule.keyRotationIntervalMinutes,
        invisibleWatermarking: body.invisibleWatermarking !== undefined ? Boolean(body.invisibleWatermarking) : rule.invisibleWatermarking,
        status: body.status ?? rule.status,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : rule.isActive,
      });
    }
    return this.drmRepo.save(rule);
  }

  async deleteDrmRule(id: number): Promise<any> {
    await this.drmRepo.delete(id);
    return { id, deleted: true };
  }

  // ==================== LEGAL PAGES ====================

  async listLegalPages(): Promise<LegalPage[]> {
    return this.legalRepo.find({ order: { slug: 'ASC' } });
  }

  async getLegalPageBySlug(slug: string): Promise<LegalPage> {
    const raw = String(slug || '').toLowerCase().trim();
    const aliasMap: Record<string, string[]> = {
      'privacy-policy': ['privacy-policy', 'privacy', 'privacy-policy.html'],
      'terms-of-service': ['terms-of-service', 'terms', 'terms-conditions', 'terms-and-conditions', 'terms.html'],
      'refund-policy': ['refund-policy', 'refund', 'cancellation-refund', 'cancellation-policy'],
      'cookie-policy': ['cookie-policy', 'cookies'],
      'about-us': ['about-us', 'about'],
      'contact-us': ['contact-us', 'contact'],
    };

    let targetSlugs = [raw];
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(raw)) {
        targetSlugs = [canonical, ...aliases];
        break;
      }
    }

    for (const s of targetSlugs) {
      const page = await this.legalRepo.findOne({ where: { slug: s } });
      if (page) return page;
    }

    // Auto-create standard placeholder if not found so legal page never 404s
    const generatedTitle = raw
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const placeholder = this.legalRepo.create({
      slug: raw,
      title: generatedTitle,
      content: `<h2>${generatedTitle}</h2><p>Welcome to MaxxPixels. This policy outlines our standard operating procedures, data protections, and user agreements. For inquiries, contact legal@maxxpixels.com.</p>`,
      version: '1.0',
      isActive: true,
    });
    return this.legalRepo.save(placeholder);
  }

  async upsertLegalPage(body: any, slugOrId?: string | number): Promise<LegalPage> {
    let page: LegalPage | null = null;
    if (slugOrId) {
      if (!Number.isNaN(Number(slugOrId))) {
        page = await this.legalRepo.findOne({ where: { id: Number(slugOrId) } });
      } else {
        page = await this.legalRepo.findOne({ where: { slug: String(slugOrId).toLowerCase() } });
      }
    }
    if (!page && body?.slug) {
      page = await this.legalRepo.findOne({ where: { slug: String(body.slug).toLowerCase() } });
    }

    const title = body?.title || 'Legal Policy';
    const slug = (body?.slug || (typeof slugOrId === 'string' ? slugOrId : title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))).toLowerCase();

    if (!page) {
      page = this.legalRepo.create({
        slug,
        title,
        content: body?.content || '',
        version: body?.version || '1.0',
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      if (body.title !== undefined) page.title = body.title;
      if (body.content !== undefined) page.content = body.content;
      if (body.version !== undefined) page.version = body.version;
      if (body.isActive !== undefined) page.isActive = Boolean(body.isActive);
    }

    return this.legalRepo.save(page);
  }

  async deleteLegalPage(id: number): Promise<any> {
    await this.legalRepo.delete(id);
    return { id, deleted: true };
  }
}

