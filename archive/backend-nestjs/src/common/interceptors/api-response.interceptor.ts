import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';
import { IS_RAW_RESPONSE_KEY } from '../decorators/auth.decorators';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, any> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const isRaw = this.reflector.getAllAndOverride<boolean>(IS_RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const url: string = request.url || '';

    // Actuator / health / VAST XML / ads.txt / binary downloads bypass envelope wrapping if returned raw
    if (
      url.includes('/actuator/') ||
      url.includes('/ads/vast') ||
      url.includes('/ads/tracking/') ||
      url.endsWith('/app-ads.txt') ||
      url.endsWith('/ads.txt')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data instanceof ApiResponse) {
          return data;
        }
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'status' in data &&
          'timestamp' in data
        ) {
          return data;
        }
        return ApiResponse.success(data);
      }),
    );
  }
}

