import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallback map used only if Redis server is unreachable in local/test mode
  private readonly memoryFallback = new Map<string, { value: string; expiresAt: number }>();
  private readonly inFlightPromises = new Map<string, Promise<any>>();

  private hits = 0;
  private misses = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_REDIS_CONNECT === 'true') {
      return;
    }

    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password', '');
    const db = this.configService.get<number>('redis.db', 0);

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 5) return null; // fall back gracefully
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.debug(`Redis connection notice: ${err.message}`);
      });

      await this.client.connect().catch(() => {
        this.isConnected = false;
        this.logger.warn(`Redis unavailable at ${host}:${port}; using resilient fallback cache.`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Redis initialization warning: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  getClient(): Redis | null {
    return this.isConnected ? this.client : null;
  }

  /**
   * Dedicated connection for blocking commands (Redis Streams `XREADGROUP`).
   * Never share the cache connection with blocking reads.
   */
  async createClient(): Promise<Redis | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const duplicate = this.client.duplicate({
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      await duplicate.connect();
      return duplicate;
    } catch (err: any) {
      this.logger.warn(`Could not open a dedicated Redis connection: ${err?.message || err}`);
      return null;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getMetrics(): { hits: number; misses: number; hitRatio: number; connected: boolean } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(4)) : 1,
      connected: this.isConnected,
    };
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (this.isConnected && this.client) {
        const raw = await this.client.get(key);
        if (raw !== null) {
          this.hits++;
          return JSON.parse(raw) as T;
        }
        this.misses++;
        return null;
      }
    } catch {
      // fall through to memory
    }

    const entry = this.memoryFallback.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.hits++;
      return JSON.parse(entry.value) as T;
    }
    if (entry) {
      this.memoryFallback.delete(key);
    }
    this.misses++;
    return null;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    const serialized = JSON.stringify(value);
    try {
      if (this.isConnected && this.client) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
        return;
      }
    } catch {
      // fall through
    }
    this.memoryFallback.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Cache-Aside with Single-Flight Stampede Protection & Jittered TTL.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const existingPromise = this.inFlightPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const freshValue = await factory();
        // Add up to 10% positive jitter to prevent synchronized cache stampedes
        const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(ttlSeconds * 0.1)));
        await this.set(key, freshValue, ttlSeconds + jitter);
        return freshValue;
      } finally {
        this.inFlightPromises.delete(key);
      }
    })();

    this.inFlightPromises.set(key, promise);
    return promise;
  }

  async del(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      }
    } catch {
      // ignore
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const k of this.memoryFallback.keys()) {
      if (k.startsWith(prefix)) {
        this.memoryFallback.delete(k);
      }
    }

    try {
      if (this.isConnected && this.client) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.client.del(...keys);
          }
        } while (cursor !== '0');
      }
    } catch {
      // ignore
    }
  }

  /**
   * Distributed Lock (SET NX PX) for payment verification & playback concurrency checks.
   */
  async acquireLock(lockKey: string, ttlMs = 15000): Promise<string | null> {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const fullKey = `lock:${lockKey}`;
    try {
      if (this.isConnected && this.client) {
        const res = await this.client.set(fullKey, token, 'PX', ttlMs, 'NX');
        return res === 'OK' ? token : null;
      }
    } catch {
      // fallback
    }

    const existing = this.memoryFallback.get(fullKey);
    if (existing && existing.expiresAt > Date.now()) {
      return null;
    }
    this.memoryFallback.set(fullKey, { value: token, expiresAt: Date.now() + ttlMs });
    return token;
  }

  async releaseLock(lockKey: string, token: string): Promise<boolean> {
    const fullKey = `lock:${lockKey}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      if (this.isConnected && this.client) {
        const res = await this.client.eval(luaScript, 1, fullKey, token);
        return res === 1;
      }
    } catch {
      // fallback
    }

    const existing = this.memoryFallback.get(fullKey);
    if (existing && existing.value === token) {
      this.memoryFallback.delete(fullKey);
      return true;
    }
    return false;
  }

  /**
   * Sliding-window rate limiter using Redis atomic INCR + EXPIRE.
   */
  async checkRateLimit(bucketKey: string, limit: number, windowSeconds = 60): Promise<{
    allowed: boolean;
    current: number;
    remaining: number;
    resetSeconds: number;
  }> {
    const fullKey = `ratelimit:${bucketKey}`;
    try {
      if (this.isConnected && this.client) {
        const current = await this.client.incr(fullKey);
        if (current === 1) {
          await this.client.expire(fullKey, windowSeconds);
        }
        const ttl = await this.client.ttl(fullKey);
        return {
          allowed: current <= limit,
          current,
          remaining: Math.max(0, limit - current),
          resetSeconds: ttl > 0 ? ttl : windowSeconds,
        };
      }
    } catch {
      // fallback
    }

    const now = Date.now();
    const existing = this.memoryFallback.get(fullKey);
    let count = 1;
    let expiresAt = now + windowSeconds * 1000;
    if (existing && existing.expiresAt > now) {
      count = parseInt(existing.value, 10) + 1;
      expiresAt = existing.expiresAt;
    }
    this.memoryFallback.set(fullKey, { value: String(count), expiresAt });

    return {
      allowed: count <= limit,
      current: count,
      remaining: Math.max(0, limit - count),
      resetSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  /**
   * JWT Token Blacklist for immediate logout / revocation.
   */
  async blacklistToken(tokenSignatureOrJti: string, ttlSeconds = 86400): Promise<void> {
    await this.set(`jwt:blacklist:${tokenSignatureOrJti}`, true, ttlSeconds);
  }

  async isTokenBlacklisted(tokenSignatureOrJti: string): Promise<boolean> {
    const res = await this.get<boolean>(`jwt:blacklist:${tokenSignatureOrJti}`);
    return res === true;
  }
}

