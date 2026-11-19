import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchHistory } from '../entities/watch-history.entity';
import { Watchlist } from '../entities/watchlist.entity';
import { Profile } from '../../users/entities/profile.entity';
import { Content } from '../../content/entities/content.entity';
import { ContentMapper } from '../../content/services/content.mapper';
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';

@Injectable()
export class WatchService {
  constructor(
    @InjectRepository(WatchHistory)
    private readonly historyRepo: Repository<WatchHistory>,
    @InjectRepository(Watchlist)
    private readonly watchlistRepo: Repository<Watchlist>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    private readonly kafkaService: KafkaService,
  ) {}

  private async resolveProfileId(userId: any, profileId?: any): Promise<number | null> {
    if (profileId) return Number(profileId);
    if (!userId) return null;
    const profile = await this.profileRepo.findOne({
      where: { userId: Number(userId) },
      order: { id: 'ASC' },
    });
    return profile ? Number(profile.id) : null;
  }

  async getContinueWatching(userId: string, profileId?: string): Promise<any[]> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (!effectiveProfileId) return [];

    const qb = this.historyRepo
      .createQueryBuilder('wh')
      .leftJoinAndSelect('wh.content', 'c')
      .leftJoinAndSelect('c.movie', 'm')
      .where('wh.profileId = :profileId', { profileId: effectiveProfileId })
      .andWhere('wh.completed = false')
      .andWhere('wh.positionSeconds > 0')
      .orderBy('wh.lastWatchedAt', 'DESC')
      .take(20);

    const rows = await qb.getMany();
    return rows.map((r) => this.mapHistoryRow(r));
  }

  async getWatchHistory(userId: string, limit = 50, profileId?: string): Promise<any[]> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (!effectiveProfileId) return [];

    const rows = await this.historyRepo.find({
      where: { profileId: effectiveProfileId },
      relations: ['content', 'content.movie'],
      order: { lastWatchedAt: 'DESC' },
      take: Math.min(100, Number(limit || 50)),
    });
    return rows.map((r) => this.mapHistoryRow(r));
  }

  async saveWatchProgress(userId: string, body: any): Promise<any> {
    const effectiveProfileId = await this.resolveProfileId(userId, body?.profileId);
    if (!effectiveProfileId) return { saved: false, message: 'Profile not found' };

    const contentId = body?.contentId ? Number(body.contentId) : null;
    const episodeId = body?.episodeId ? Number(body.episodeId) : null;
    const watched = Number(
      body?.watchedDurationSeconds ??
        body?.currentPositionSeconds ??
        body?.positionSeconds ??
        0,
    );
    const total = Number(body?.totalDurationSeconds ?? body?.durationSeconds ?? 0);

    const whereClause: any = { profileId: effectiveProfileId };
    if (episodeId) whereClause.episodeId = episodeId;
    else if (contentId) whereClause.contentId = contentId;
    else return { saved: false };

    let record = await this.historyRepo.findOne({ where: whereClause });
    const effectiveTotal = total || record?.durationSeconds || 0;
    const isCompleted =
      body?.completed !== undefined
        ? Boolean(body.completed)
        : effectiveTotal > 0 && watched / effectiveTotal >= 0.9;
    const percentage = effectiveTotal > 0 ? (watched / effectiveTotal) * 100 : 0;

    if (!record) {
      record = this.historyRepo.create({
        profileId: effectiveProfileId,
        contentId,
        episodeId,
        positionSeconds: watched,
        durationSeconds: effectiveTotal,
        percentage,
        completed: isCompleted,
        lastWatchedAt: new Date(),
      });
    } else {
      record.positionSeconds = watched;
      if (effectiveTotal > 0) record.durationSeconds = effectiveTotal;
      record.percentage = percentage;
      record.completed = isCompleted;
      record.lastWatchedAt = new Date();
    }

    const saved = await this.historyRepo.save(record);

    // Publish progress to the Redis Streams bus so watch-history persistence is
    // handled by the async worker (ott.watch.history) and replayable via outbox.
    await this.kafkaService
      .publish('ott.watch.history', String(userId || effectiveProfileId), {
        userId,
        profileId: effectiveProfileId,
        contentId: saved.contentId,
        episodeId: saved.episodeId,
        watchedDurationSeconds: saved.positionSeconds,
        totalDurationSeconds: saved.durationSeconds,
        isCompleted: saved.completed,
      })
      .catch(() => undefined);

    return {
      saved: true,
      id: saved.id,
      contentId: saved.contentId,
      episodeId: saved.episodeId,
      watchedDurationSeconds: saved.positionSeconds,
      totalDurationSeconds: saved.durationSeconds,
      isCompleted: saved.completed,
    };
  }

  async removeWatchProgress(userId: string, contentOrHistoryId: number, profileId?: string): Promise<any> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (effectiveProfileId) {
      await this.historyRepo.delete({ profileId: effectiveProfileId, contentId: contentOrHistoryId });
      await this.historyRepo.delete({ profileId: effectiveProfileId, id: contentOrHistoryId });
    }
    return { removed: true, id: contentOrHistoryId };
  }

  // ==================== WATCHLIST / BOOKMARKS ====================

  async getWatchlist(userId: string, profileId?: string): Promise<any[]> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (!effectiveProfileId) return [];

    const items = await this.watchlistRepo.find({
      where: { profileId: effectiveProfileId },
      relations: ['content', 'content.movie'],
      order: { createdAt: 'DESC' },
    });

    return items
      .filter((i) => i.content)
      .map((i) => ({
        watchlistId: i.id,
        addedAt: i.createdAt,
        ...ContentMapper.toDto(i.content, { isWatchlisted: true }),
      }));
  }

  async toggleWatchlist(userId: string, contentId: number, profileId?: string): Promise<any> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (!effectiveProfileId) return { error: 'Profile not found' };

    const existing = await this.watchlistRepo.findOne({
      where: { profileId: effectiveProfileId, contentId },
    });

    if (existing) {
      await this.watchlistRepo.remove(existing);
      return { contentId, isWatchlisted: false, action: 'REMOVED' };
    }

    const created = await this.watchlistRepo.save(
      this.watchlistRepo.create({
        profileId: effectiveProfileId,
        contentId,
      }),
    );

    return {
      id: created.id,
      contentId,
      isWatchlisted: true,
      action: 'ADDED',
    };
  }

  async removeFromWatchlist(userId: string, contentId: number, profileId?: string): Promise<any> {
    const effectiveProfileId = await this.resolveProfileId(userId, profileId);
    if (effectiveProfileId) {
      await this.watchlistRepo.delete({ profileId: effectiveProfileId, contentId });
    }
    return { contentId, isWatchlisted: false };
  }

  private mapHistoryRow(row: WatchHistory): Record<string, any> {
    const contentDto = row.content ? ContentMapper.toDto(row.content) : {};
    const progressPercent =
      row.totalDurationSeconds > 0
        ? Math.min(100, Math.round((row.watchedDurationSeconds / row.totalDurationSeconds) * 100))
        : 0;

    return {
      ...contentDto,
      historyId: row.id,
      contentId: row.contentId,
      episodeId: row.episodeId,
      episodeTitle: row.episode?.title || null,
      episodeNumber: row.episode?.episodeNumber || null,
      watchedDurationSeconds: row.watchedDurationSeconds,
      positionSeconds: row.watchedDurationSeconds,
      totalDurationSeconds: row.totalDurationSeconds,
      durationSeconds: row.totalDurationSeconds,
      progressPercent,
      isCompleted: row.isCompleted,
      lastWatchedAt: row.lastWatchedAt,
    };
  }
}
