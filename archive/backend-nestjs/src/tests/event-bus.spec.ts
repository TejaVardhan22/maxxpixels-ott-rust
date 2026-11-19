import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { KafkaService } from '../infrastructure/kafka/kafka.service';
import { RedisService } from '../infrastructure/redis/redis.service';

const STREAM_KEY = 'test:events:stream';
const DLQ_KEY = 'test:events:dlq';
const GROUP = 'test-workers';

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Integration coverage for the Redis Streams event bus.
 *
 * Requires a local Redis on 127.0.0.1:6379 (uses DB 15 and flushes it).
 * The suite is skipped automatically when Redis is not reachable.
 */
describe('KafkaService (Redis Streams event bus)', () => {
  let available = false;
  let probe: Redis | null = null;
  let redisService: RedisService | null = null;
  let bus: KafkaService | null = null;

  beforeAll(async () => {
    process.env.EVENT_BUS_ENABLED = 'true';
    process.env.EVENT_BUS_STREAM_KEY = STREAM_KEY;
    process.env.EVENT_BUS_DLQ_KEY = DLQ_KEY;
    process.env.EVENT_BUS_CONSUMER_GROUP = GROUP;
    process.env.EVENT_BUS_MAX_ATTEMPTS = '2';
    process.env.EVENT_BUS_RECLAIM_MIN_IDLE_MS = '100';
    delete process.env.SKIP_REDIS_CONNECT;

    probe = new Redis({
      host: '127.0.0.1',
      port: 6379,
      db: 15,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    try {
      await probe.connect();
      await probe.ping();
      await probe.flushdb();
      available = true;
    } catch {
      available = false;
      probe.disconnect();
      probe = null;
      return;
    }

    redisService = new RedisService(
      new ConfigService({
        redis: { host: '127.0.0.1', port: 6379, db: 15, password: '' },
      }),
    );
    await redisService.onModuleInit();

    bus = new KafkaService(
      { get: () => true } as any,
      {
        enqueue: async () => ({}),
        fetchPendingBatch: async () => [],
        markPublished: async () => undefined,
        markFailed: async () => undefined,
      } as any,
      redisService,
      { isInitialized: false } as any,
    );
    await bus.onModuleInit();
  }, 20000);

  afterAll(async () => {
    if (bus) await bus.onModuleDestroy();
    if (redisService) await redisService.onModuleDestroy();
    if (available && probe) {
      await probe.flushdb().catch(() => undefined);
    }
    probe?.disconnect();
  });

  it('delivers every published event exactly once', async () => {
    if (!available || !bus) return;

    const seen: string[] = [];
    bus.registerTopicHandler('test.topic', async (payload) => {
      seen.push(String(payload.eventId));
    });

    await bus.publish('test.topic', 'k1', { value: 1 });
    await bus.publish('test.topic', 'k2', { value: 2 });

    await waitFor(() => seen.length >= 2);

    expect(seen).toHaveLength(2);
    expect(new Set(seen).size).toBe(2);
  }, 15000);

  it('ignores a redelivered event id (Redis dedupe)', async () => {
    if (!available || !bus) return;

    let handled = 0;
    bus.registerTopicHandler('test.dedupe', async () => {
      handled += 1;
    });

    await bus.publish('test.dedupe', 'k', { eventId: 'fixed-event-1' });
    await bus.publish('test.dedupe', 'k', { eventId: 'fixed-event-1' });

    await waitFor(() => handled >= 1);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(handled).toBe(1);
  }, 15000);

  it('retries failed events and moves them to the dead-letter stream', async () => {
    if (!available || !bus) return;

    let attempts = 0;
    bus.registerTopicHandler('test.fail', async () => {
      attempts += 1;
      throw new Error('boom');
    });

    await bus.publish('test.fail', 'k', { value: 'will-fail' });

    await waitFor(() => attempts >= 2, 12000);
    const dlqLength = await probe!.xlen(DLQ_KEY).catch(() => 0);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(dlqLength).toBeGreaterThanOrEqual(1);
  }, 20000);
});
