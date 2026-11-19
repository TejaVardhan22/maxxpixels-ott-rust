import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["user-token"]',
            'req.headers.cookie',
            'req.body.password',
            'req.body.newPassword',
            'req.body.currentPassword',
            'req.body.otp',
            'req.body.refreshToken',
            'req.body.secret',
            'req.body.apiKey',
          ],
          censor: '***REDACTED***',
        },
        autoLogging: {
          ignore: (req: any) => {
            const url = req.url || '';
            return url.includes('/health') || url.includes('/ping') || url.includes('/prometheus');
          },
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}

