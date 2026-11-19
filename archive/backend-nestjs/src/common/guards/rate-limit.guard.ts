import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const url: string = request.url || '';
    const method: string = request.method || 'GET';

    // Skip rate limiting for health/prometheus probes
    if (url.includes('/health') || url.includes('/ping') || url.includes('/prometheus')) {
      return true;
    }

    const ip =
      (request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      '127.0.0.1';

    let bucketCategory = 'general';
    let limit = 600; // 600 requests/min general API

    if (
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/otp') ||
      url.includes('/user_login') ||
      url.includes('/user_registration')
    ) {
      bucketCategory = 'auth';
      limit = 30; // 30 requests/min on auth endpoints
    } else if (url.includes('/payments/') && method !== 'GET') {
      bucketCategory = 'payment';
      limit = 30; // 30 requests/min on payment mutation endpoints
    }

    const result = await this.redisService.checkRateLimit(`${bucketCategory}:${ip}`, limit, 60);

    if (response?.header) {
      response.header('X-RateLimit-Limit', String(limit));
      response.header('X-RateLimit-Remaining', String(result.remaining));
      response.header('X-RateLimit-Reset', String(result.resetSeconds));
    }

    if (!result.allowed) {
      throw new HttpException(
        {
          success: false,
          status: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please slow down and try again shortly.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

