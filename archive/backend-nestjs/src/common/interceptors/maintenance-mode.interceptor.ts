import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class MaintenanceModeInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const url: string = request.url || '';

    // Always allow health checks, admin endpoints, auth login, and legal pages
    if (
      url.includes('/admin') ||
      url.includes('/auth') ||
      url.includes('/health') ||
      url.includes('/ping') ||
      url.includes('/prometheus')
    ) {
      return next.handle();
    }

    const maintenanceEnabled = await this.redisService.get<string>('settings:MAINTENANCE_MODE_ENABLED');
    if (maintenanceEnabled !== 'true') {
      return next.handle();
    }

    // Check if user is an admin
    const userRoles: string[] = request.user?.roles || [];
    if (userRoles.some((r) => r.includes('ADMIN'))) {
      return next.handle();
    }

    // Check IP allowlist
    const allowedIpsRaw = (await this.redisService.get<string>('settings:MAINTENANCE_ALLOWED_IPS')) || '';
    const clientIp =
      (request.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      '';

    if (allowedIpsRaw && clientIp && allowedIpsRaw.split(',').map((s) => s.trim()).includes(clientIp)) {
      return next.handle();
    }

    const message =
      (await this.redisService.get<string>('settings:MAINTENANCE_MESSAGE')) ||
      'Platform is currently undergoing scheduled maintenance. Please check back soon.';

    throw new HttpException(
      {
        success: false,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        code: 'MAINTENANCE_MODE',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

