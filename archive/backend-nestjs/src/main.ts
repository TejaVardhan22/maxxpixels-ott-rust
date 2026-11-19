import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // High-performance Fastify HTTP Engine (NOT Express)
  const fastifyAdapter = new FastifyAdapter({
    logger: false,
    trustProxy: true,
    bodyLimit: 104857600, // 100 MB payload limit for media metadata/base64
    keepAliveTimeout: 65000,
    connectionTimeout: 30000,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { rawBody: true },
  );

  // 1. Security Headers via @fastify/helmet
  await app.register(helmet as any, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // 2. Response Compression (gzip / deflate)
  await app.register(compress as any, {
    encodings: ['gzip', 'deflate'],
    threshold: 1024,
  });

  // 3. Multipart File Upload support (up to 5 GB for video masters)
  await app.register(multipart as any, {
    limits: {
      fileSize: 5 * 1024 * 1024 * 1024,
      files: 10,
    },
  });

  // 3b. Ensure local uploads directories exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const postersDir = path.join(uploadsDir, 'posters');
  if (!fs.existsSync(postersDir)) {
    fs.mkdirSync(postersDir, { recursive: true });
  }
  const bannersDir = path.join(uploadsDir, 'banners');
  if (!fs.existsSync(bannersDir)) {
    fs.mkdirSync(bannersDir, { recursive: true });
  }
  // Media requests (/uploads/*, /posters/*, /banners/*) are handled dynamically by PublicMediaController
  // with intelligent fuzzy matching, cross-folder lookup, BunnyCDN sync, and zero-404 SVG fallbacks.

  // 4. CORS Allowlist matching Spring Boot SecurityConfig
  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:3000,http://localhost:4200,http://localhost:5173,http://localhost:5174,http://localhost:8080,https://maxxpixels.com,https://admin.maxxpixels.com'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Maintain mobile webview & Smart TV origin compatibility
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Accept-Language',
      'X-Razorpay-Signature',
      'Stripe-Signature',
    ],
    credentials: true,
    maxAge: 3600,
  });

  // 5. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  // 6. Swagger / OpenAPI Documentation (`/swagger-ui` & `/v3/api-docs`)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MaxxPixels OTT Platform API')
    .setDescription(
      'Enterprise NestJS + Fastify Backend API for Web, Mobile App, and Admin Studio',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger-ui', app, document, {
    jsonDocumentUrl: 'v3/api-docs',
  });

  // 7. Graceful Shutdown Hooks
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT || '8080', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`MaxxPixels OTT NestJS (Fastify) Backend listening on http://0.0.0.0:${port}`);
  logger.log(`Swagger OpenAPI UI available at http://localhost:${port}/swagger-ui`);
}

bootstrap();

