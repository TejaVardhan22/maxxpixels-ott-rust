import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { hostname } from 'os';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { OutboxService } from '../database/outbox.service';
import { RedisService } from '../redis/redis.service';
import { PlaybackSession, WatchHistory, Content, UserInteraction, Profile } from '../database/entities';

export type KafkaMessageHandler = (payload: any, key?: string) => Promise<void>;

/**
 * Async domain event bus backed by Redis Streams.
 *
 * - `publish()` appends to the `ott:events:stream` stream (XADD).
 * - A consumer group (`ott-workers`) reads with XREADGROUP on a dedicated
 *   blocking connection, so every event is delivered to exactly one API
 *   instance and acknowledged (XACK) only after the handler succeeds.
 * - Failed messages stay pending and are re-claimed (XAUTOCLAIM) with a
 *   delivery-count limit; exhausted messages move to `ott:events:dlq`.
 * - Event ids are deduplicated in Redis (`events:dedup:*`), so a redelivery
 *   is a no-op instead of a double view/revenue increment.
 * - If Redis is unreachable the bus degrades to in-process dispatch and each
 *   failed dispatch is persisted to `outbox_events` for the 5-second relay.
 *
 * The class name is kept for compatibility with the existing DI wiring.
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private isConnected = false;
  private readonly customHandlers = new Map<string, KafkaMessageHandler[]>();
  private readonly pendingTasks = new Set<Promise<void>>();

  private readonly streamKey = process.env.EVENT_BUS_STREAM_KEY || 'ott:events:stream';
  private readonly deadLetterKey = process.env.EVENT_BUS_DLQ_KEY || 'ott:events:dlq';
  private readonly consumerGroup = process.env.EVENT_BUS_CONSUMER_GROUP || 'ott-workers';
  private readonly consumerName = `${hostname()}-${process.pid}`;
  private readonly maxAttempts = Math.max(1, Number(process.env.EVENT_BUS_MAX_ATTEMPTS || 5));
  private readonly reclaimMinIdleMs = Math.max(
    1,
    Number(process.env.EVENT_BUS_RECLAIM_MIN_IDLE_MS || 30_000),
  );
  private consumerClient: Redis | null = null;
  private consumerRunning = false;
  private consumerLoop: Promise<void> | null = null;
  private isStartingConsumer = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<boolean>('kafka.enabled', true);
    if (!enabled || process.env.SKIP_KAFKA_CONNECT === 'true') {
      this.logger.log('Async event bus skipped via configuration.');
      return;
    }

    this.isConnected = true;
    this.consumerClient = await this.redisService.createClient();

    if (!this.consumerClient) {
      this.logger.warn(
        'Redis unavailable — async event bus running in-process with the outbox relay as fallback.',
      );
      return;
    }

    await this.startConsumer();
  }

  /**
   * Upgrades the bus to Redis Streams after a late Redis start (systemd/service
   * ordering) without requiring an API restart.
   */
  @Cron('*/60 * * * * *')
  async ensureStreamConsumer(): Promise<void> {
    if (!this.isConnected || this.consumerClient || this.isStartingConsumer) return;
    if (!this.redisService.isHealthy()) return;

    this.isStartingConsumer = true;
    try {
      this.consumerClient = await this.redisService.createClient();
      if (!this.consumerClient) return;
      await this.startConsumer();
      this.logger.log('Redis Streams consumer connection re-established.');
    } finally {
      this.isStartingConsumer = false;
    }
  }

  private async startConsumer(): Promise<void> {
    if (!this.consumerClient) return;

    try {
      await this.consumerClient.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
    } catch (err: any) {
      const message = String(err?.message || err);
      if (!message.includes('BUSYGROUP')) {
        this.logger.warn(`Could not create Redis Stream consumer group: ${message}`);
      }
    }

    this.consumerRunning = true;
    this.consumerLoop = this.runConsumerLoop();
    this.logger.log(
      `Async event bus initialized on Redis Streams (stream=${this.streamKey}, group=${this.consumerGroup}, consumer=${this.consumerName}).`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.consumerRunning = false;
    if (this.consumerLoop) {
      await this.consumerLoop.catch(() => undefined);
    }
    if (this.consumerClient) {
      try {
        await this.consumerClient.quit();
      } catch {
        this.consumerClient.disconnect();
      }
      this.consumerClient = null;
    }
    // Allow in-flight async tasks to settle briefly on shutdown.
    if (this.pendingTasks.size > 0) {
      await Promise.allSettled([...this.pendingTasks]);
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getMode(): 'redis-streams' | 'in-process' | 'disabled' {
    if (!this.isConnected) return 'disabled';
    return this.consumerClient ? 'redis-streams' : 'in-process';
  }

  registerTopicHandler(topic: string, handler: KafkaMessageHandler): void {
    const list = this.customHandlers.get(topic) || [];
    list.push(handler);
    this.customHandlers.set(topic, list);
  }

  /**
   * Publishes an event to the Redis Stream (falling back to in-process dispatch
   * when Redis is unavailable). Never throws: telemetry must not break a request.
   */
  async publish(topic: string, key: string, payload: Record<string, any>): Promise<void> {
    const enrichedPayload = {
      ...payload,
      eventId: payload.eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    if (this.consumerClient) {
      try {
        await this.enqueue(topic, key, enrichedPayload, 0);
        return;
      } catch (err: any) {
        this.logger.warn(`Redis Streams publish failed for ${topic}: ${err?.message || err}`);
      }
    }

    this.dispatchAsync(topic, key, enrichedPayload);
  }

  private async enqueue(
    topic: string,
    key: string | undefined,
    payload: Record<string, any>,
    attempts: number,
  ): Promise<void> {
    if (!this.consumerClient) throw new Error('Redis Streams connection unavailable');
    await (this.consumerClient as any).xadd(
      this.streamKey,
      'MAXLEN',
      '~',
      10_000,
      '*',
      'topic',
      topic,
      'key',
      key ?? '',
      'payload',
      JSON.stringify(payload),
      'attempts',
      String(attempts),
    );
  }

  /**
   * Transactional Outbox Relay Worker — polls `outbox_events` every 5 seconds
   * and re-publishes them onto the Redis Stream.
   */
  @Cron('*/5 * * * * *')
  async relayOutboxEvents(): Promise<void> {
    if (!this.dataSource.isInitialized) return;

    const batch = await this.outboxService.fetchPendingBatch(50);
    if (batch.length === 0) return;

    for (const event of batch) {
      const payload = {
        ...event.payload,
        outboxEventId: event.id,
        eventId: event.payload?.eventId || `outbox-${event.id}`,
        eventType: event.eventType,
      };

      try {
        if (this.consumerClient) {
          await this.enqueue(event.topic, event.aggregateId, payload, 0);
        } else {
          await this.processMessageWithIdempotency(event.topic, event.aggregateId, payload);
        }
        await this.outboxService.markPublished(event.id);
      } catch (err: any) {
        await this.outboxService.markFailed(event, err?.message || 'Unknown publish error');
      }
    }
  }

  private dispatchAsync(topic: string, key: string | undefined, payload: Record<string, any>): void {
    const task = (async () => {
      try {
        await this.processMessageWithIdempotency(topic, key, payload);
      } catch (err: any) {
        this.logger.warn(`Async event dispatch failed for topic ${topic}: ${err?.message || err}`);
        if (this.dataSource.isInitialized) {
          try {
            await this.outboxService.enqueue({
              aggregateType: 'ASYNC_EVENT_FALLBACK',
              aggregateId: key || 'system',
              eventType: topic,
              topic,
              payload,
            });
          } catch {
            // ignore enqueue failures
          }
        }
      }
    })();

    this.pendingTasks.add(task);
    void task.finally(() => this.pendingTasks.delete(task));
  }

  /**
   * Idempotent dispatch: the Redis dedupe key is written only after a
   * successful handler run, so a failed event can be retried safely.
   */
  private async processMessageWithIdempotency(
    topic: string,
    key: string | undefined,
    payload: any,
  ): Promise<void> {
    const eventId = payload?.eventId || payload?.outboxEventId;
    let dedupKey: string | null = null;
    let lockKey: string | null = null;
    let lockToken: string | null = null;

    if (eventId) {
      dedupKey = `events:dedup:${topic}:${eventId}`;
      const alreadyProcessed = await this.redisService.get<boolean>(dedupKey).catch(() => null);
      if (alreadyProcessed) return;

      lockKey = `eventdispatch:${topic}:${eventId}`;
      lockToken = await this.redisService.acquireLock(lockKey, 60_000).catch(() => null);
      // Another worker owns this event right now.
      if (lockToken === null) return;
    }

    try {
      await this.dispatchToHandlers(topic, key, payload);
      if (dedupKey) {
        await this.redisService.set(dedupKey, true, 3600).catch(() => undefined);
      }
    } finally {
      if (lockKey && lockToken) {
        await this.redisService.releaseLock(lockKey, lockToken).catch(() => undefined);
      }
    }
  }

  private async dispatchToHandlers(topic: string, key: string | undefined, payload: any): Promise<void> {
    // Built-in domain consumers
    if (topic === 'ott.telemetry.heartbeat') {
      await this.handleTelemetryHeartbeat(payload);
    } else if (topic === 'ott.content.views') {
      await this.handleContentViewIncrement(payload);
    } else if (topic === 'ott.watch.history') {
      await this.handleWatchHistorySync(payload);
    }

    // Custom registered handlers (e.g. Notifications, Payments)
    const handlers = this.customHandlers.get(topic) || [];
    for (const handler of handlers) {
      await handler(payload, key);
    }
  }

  private async runConsumerLoop(): Promise<void> {
    let readTick = 0;

    while (this.consumerRunning && this.consumerClient) {
      try {
        const response = (await (this.consumerClient as any).xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerName,
          'COUNT',
          32,
          'BLOCK',
          2000,
          'STREAMS',
          this.streamKey,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (response) {
          for (const [, messages] of response) {
            for (const [id, fields] of messages) {
              await this.handleStreamMessage(id, fields);
            }
          }
        }

        // Re-claim messages left pending by crashed/restarted instances or by
        // handlers that threw (at-least-once delivery with attempt counting).
        if (++readTick >= 2) {
          readTick = 0;
          await this.reclaimStaleMessages();
        }
      } catch (err: any) {
        if (!this.consumerRunning) break;
        this.logger.warn(`Redis Stream read failed: ${err?.message || err}`);
        await this.sleep(2000);
      }
    }
  }

  private async handleStreamMessage(id: string, fields: string[]): Promise<void> {
    const message = this.parseFields(fields);
    const topic = String(message.topic || '');

    let payload: any;
    try {
      payload = message.payload ? JSON.parse(message.payload) : {};
    } catch {
      this.logger.warn(`Dropping malformed event ${id} on ${topic || 'unknown'}`);
      await this.ack(id);
      return;
    }

    try {
      await this.processMessageWithIdempotency(topic, message.key || undefined, payload);
      await this.ack(id);
    } catch (err: any) {
      const attempts = await this.deliveryCount(id);
      if (attempts >= this.maxAttempts) {
        await this.moveToDeadLetter(id, topic, message.key || undefined, payload, err);
        return;
      }
      // Leave the message pending: reclaimStaleMessages() redelivers it later.
      this.logger.warn(
        `Event ${id} on ${topic} failed (attempt ${attempts}/${this.maxAttempts}); leaving it pending for retry.`,
      );
    }
  }

  private async reclaimStaleMessages(): Promise<void> {
    if (!this.consumerClient) return;
    try {
      const result = (await (this.consumerClient as any).xautoclaim(
        this.streamKey,
        this.consumerGroup,
        this.consumerName,
        this.reclaimMinIdleMs,
        '0-0',
        'COUNT',
        20,
      )) as [string, Array<[string, string[]]>, string[]] | null;

      const messages = Array.isArray(result?.[1]) ? result[1] : [];
      for (const entry of messages) {
        const [id, fields] = entry || [];
        if (!id || !fields || fields.length === 0) continue;
        await this.handleStreamMessage(id, fields);
      }
    } catch (err: any) {
      this.logger.debug(`Stale event reclaim skipped: ${err?.message || err}`);
    }
  }

  private async deliveryCount(id: string): Promise<number> {
    if (!this.consumerClient) return 1;
    try {
      const pending = (await (this.consumerClient as any).xpending(
        this.streamKey,
        this.consumerGroup,
        id,
        id,
        1,
      )) as Array<[string, string, number, number]> | null;
      const entry = pending?.[0];
      return entry ? Number(entry[3]) || 1 : 1;
    } catch {
      return 1;
    }
  }

  private async moveToDeadLetter(
    id: string,
    topic: string,
    key: string | undefined,
    payload: any,
    err: any,
  ): Promise<void> {
    try {
      await this.enqueueDeadLetter(topic, key, payload, err, id);
    } catch (dlqErr: any) {
      this.logger.error(`Could not write dead letter for event ${id}: ${dlqErr?.message || dlqErr}`);
    }
    await this.ack(id);
    this.logger.error(
      `Event ${id} on ${topic} moved to ${this.deadLetterKey}: ${err?.message || err}`,
    );
  }

  private async enqueueDeadLetter(
    topic: string,
    key: string | undefined,
    payload: any,
    err: any,
    sourceId: string,
  ): Promise<void> {
    if (!this.consumerClient) return;
    await (this.consumerClient as any).xadd(
      this.deadLetterKey,
      'MAXLEN',
      '~',
      5_000,
      '*',
      'topic',
      topic,
      'key',
      key ?? '',
      'payload',
      JSON.stringify(payload),
      'error',
      String(err?.message || err).slice(0, 1000),
      'sourceId',
      sourceId,
      'failedAt',
      new Date().toISOString(),
    );
  }

  private async ack(id: string): Promise<void> {
    if (!this.consumerClient) return;
    try {
      await (this.consumerClient as any).xack(this.streamKey, this.consumerGroup, id);
    } catch (err: any) {
      this.logger.debug(`Could not acknowledge event ${id}: ${err?.message || err}`);
    }
  }

  private parseFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i + 1 < fields.length; i += 2) {
      result[fields[i]] = fields[i + 1];
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async handleTelemetryHeartbeat(payload: any): Promise<void> {
    if (!this.dataSource.isInitialized) return;
    const { sessionToken, userId, contentId, episodeId, currentPositionSeconds, totalDurationSeconds } = payload;

    if (sessionToken) {
      const position = Number(currentPositionSeconds || 0);
      const duration = Number(totalDurationSeconds || 0);
      try {
        await this.dataSource.getRepository(PlaybackSession).update(
          { sessionId: String(sessionToken) },
          {
            lastHeartbeat: new Date(),
            status: 'ACTIVE',
            ...(position > 0 ? { currentPositionSeconds: Math.floor(position) } : {}),
            ...(duration > 0 ? { totalDurationSeconds: Math.floor(duration) } : {}),
          },
        );
      } catch (err: any) {
        this.logger.warn(`Heartbeat session update failed: ${err?.message || err}`);
      }
    }

    if (userId && (contentId || episodeId)) {
      await this.handleWatchHistorySync({
        userId,
        contentId,
        episodeId,
        watchedDurationSeconds: currentPositionSeconds || 0,
        totalDurationSeconds: totalDurationSeconds || 0,
      });
    }
  }

  private async handleContentViewIncrement(payload: any): Promise<void> {
    if (!this.dataSource.isInitialized) return;
    const contentId = Number(payload?.contentId);
    if (!contentId || Number.isNaN(contentId)) return;

    // Collapse repeat opens of the same title by the same user (double-click, player
    // remounts) into one view for 30 minutes so the counter stays meaningful.
    if (payload.userId) {
      const dedupKey = `view:dedup:${payload.userId}:${contentId}`;
      const alreadyCounted = await this.redisService.get<boolean>(dedupKey).catch(() => null);
      if (alreadyCounted) return;
      await this.redisService.set(dedupKey, true, 1800).catch(() => undefined);
    }

    await this.dataSource
      .createQueryBuilder()
      .update(Content)
      .set({ viewCount: () => 'COALESCE(view_count, 0) + 1' })
      .where('id = :id', { id: contentId })
      .execute();

    if (payload.userId) {
      const interactionRepo = this.dataSource.getRepository(UserInteraction);
      await interactionRepo.save(
        interactionRepo.create({
          userId: payload.userId,
          contentId,
          interactionType: 'VIEW',
          durationSeconds: payload.watchDurationSeconds || 0,
        }),
      );
    }
  }

  private async handleWatchHistorySync(payload: any): Promise<void> {
    if (!this.dataSource.isInitialized) return;
    const { userId, contentId, episodeId, watchedDurationSeconds, totalDurationSeconds } = payload;
    if (!userId) return;

    // watch_history is keyed by profile, not user.
    let profileId = payload.profileId ? Number(payload.profileId) : null;
    if (!profileId) {
      const profile = await this.dataSource
        .getRepository(Profile)
        .findOne({ where: { userId: Number(userId) }, order: { id: 'ASC' } })
        .catch(() => null);
      profileId = profile?.id ? Number(profile.id) : null;
    }
    if (!profileId) return;

    const repo = this.dataSource.getRepository(WatchHistory);
    const whereClause: any = { profileId };
    if (episodeId) whereClause.episodeId = Number(episodeId);
    else if (contentId) whereClause.contentId = Number(contentId);
    else return;

    let record = await repo.findOne({ where: whereClause });
    const watched = Math.floor(Number(watchedDurationSeconds || 0));
    const total = Math.floor(Number(totalDurationSeconds || record?.durationSeconds || 0));
    const percentage = total > 0 ? Math.min(100, Math.round((watched / total) * 10000) / 100) : 0;
    const isCompleted = total > 0 && watched / total >= 0.9;

    if (record) {
      record.positionSeconds = watched;
      if (total > 0) record.durationSeconds = total;
      record.percentage = percentage;
      record.completed = isCompleted;
      record.lastWatchedAt = new Date();
      await repo.save(record);
    } else {
      record = repo.create({
        profileId,
        contentId: contentId ? Number(contentId) : null,
        episodeId: episodeId ? Number(episodeId) : null,
        positionSeconds: watched,
        durationSeconds: total,
        percentage,
        completed: isCompleted,
        lastWatchedAt: new Date(),
      });
      await repo.save(record);
    }
  }
}
