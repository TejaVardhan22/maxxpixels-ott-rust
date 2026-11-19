import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import * as client from 'prom-client';
import { Public, RawResponse } from '../common/decorators/auth.decorators';
import { RedisService } from '../infrastructure/redis/redis.service';
import { KafkaService } from '../infrastructure/kafka/kafka.service';
import { CircuitBreakerRegistry } from '../common/utils/circuit-breaker.util';

// Register default Node.js & V8 Prometheus metrics once
const register = new client.Registry();
register.setDefaultLabels({ app: 'maxxott-nestjs-backend' });
client.collectDefaultMetrics({ register });

@ApiTags('Health & Observability')
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get(['api/v1/ping', 'api/ping', 'ping'])
  @ApiOperation({ summary: 'Lightweight liveness ping' })
  ping() {
    return {
      status: 'UP',
      service: 'MaxxPixels OTT Backend (NestJS + Fastify)',
      timestamp: new Date().toISOString(),
    };
  }

  @Get([
    'api/v1/health',
    'api/health',
    'health',
    'api/v1/actuator/health',
    'api/actuator/health',
    'actuator/health',
  ])
  @ApiOperation({ summary: 'Comprehensive health check matching Spring Boot Actuator & HealthController' })
  async checkHealth() {
    let dbHealthy = false;
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbHealthy = true;
      }
    } catch {
      dbHealthy = false;
    }

    const redisMetrics = this.redisService.getMetrics();
    const eventBusHealthy = this.kafkaService.isHealthy();
    const mem = process.memoryUsage();

    return {
      status: dbHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        db: {
          status: dbHealthy ? 'UP' : 'DOWN',
          database: 'PostgreSQL',
        },
        redis: {
          status: redisMetrics.connected ? 'UP' : 'FALLBACK',
          hitRatio: redisMetrics.hitRatio,
          hits: redisMetrics.hits,
          misses: redisMetrics.misses,
        },
        eventBus: {
          status: eventBusHealthy ? 'UP' : 'DOWN',
          mode: this.kafkaService.getMode(),
          transport:
            this.kafkaService.getMode() === 'redis-streams' ? 'redis-streams' : 'in-process',
        },
        kafka: {
          status: eventBusHealthy ? 'UP' : 'OUTBOX_FALLBACK',
          replacedBy: 'redis-streams',
          enabled: false,
        },
        circuitBreakers: CircuitBreakerRegistry.getAllStates(),
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        },
      },
    };
  }

  @Get(['actuator/prometheus', 'api/v1/actuator/prometheus', 'metrics'])
  @RawResponse()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  async getPrometheusMetrics(): Promise<string> {
    return register.metrics();
  }
}

