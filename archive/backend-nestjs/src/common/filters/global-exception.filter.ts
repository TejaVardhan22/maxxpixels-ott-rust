import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiResponse } from '../dto/api-response.dto';

export class BusinessException extends HttpException {
  public readonly errorCode?: string;
  public readonly details?: any;

  constructor(
    statusOrMessage: number | string,
    messageOrCode?: string,
    errorCode?: string,
    details?: any,
  ) {
    const status = typeof statusOrMessage === 'number' ? statusOrMessage : HttpStatus.BAD_REQUEST;
    const message = typeof statusOrMessage === 'string' ? statusOrMessage : messageOrCode || 'Business rule violation';
    const code = typeof statusOrMessage === 'string' ? messageOrCode : errorCode;
    super({ status, message, code, errors: details }, status);
    this.errorCode = code;
    this.details = details;
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please try again later.';
    let code: string | undefined;
    let errors: any;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      message = exception.message;
      code = exception.errorCode;
      errors = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
          errors = resObj.message;
        } else {
          message = resObj.message || exception.message;
          code = resObj.code || resObj.error;
          errors = resObj.errors;
        }
      }
    } else if (exception instanceof Error) {
      const errName = exception.name;
      if (errName === 'IllegalArgumentException' || exception.message?.startsWith('BAD_REQUEST:')) {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message.replace(/^BAD_REQUEST:\s*/, '');
        code = 'BAD_REQUEST';
      } else if (errName === 'IllegalStateException') {
        status = HttpStatus.CONFLICT;
        message = exception.message;
        code = 'CONFLICT';
      } else {
        this.logger.error(
          `Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
          exception.stack,
        );
        message =
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : exception.message || 'Internal server error';
        code = 'INTERNAL_SERVER_ERROR';
      }
    }

    const payload = ApiResponse.error(status, message, code, errors);
    reply.status(status).send(payload);
  }
}
