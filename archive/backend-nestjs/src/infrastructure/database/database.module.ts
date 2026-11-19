import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ALL_ENTITIES, OutboxEvent } from './entities';
import { OutboxService } from './outbox.service';
import { DataInitializerService } from './data-initializer.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host', 'localhost'),
        port: configService.get<number>('database.port', 5432),
        username: configService.get<string>('database.username', 'postgres'),
        password: configService.get<string>('database.password', 'postgres'),
        database: configService.get<string>('database.database', 'maxxott'),
        entities: ALL_ENTITIES,
        synchronize: false, // Strictly false per Phase 3 production requirement
        logging: configService.get<boolean>('database.logging', false),
        extra: {
          max: configService.get<number>('database.poolMax', 25),
          min: configService.get<number>('database.poolMin', 2),
          idleTimeoutMillis: configService.get<number>('database.idleTimeoutMillis', 30000),
          connectionTimeoutMillis: configService.get<number>('database.connectionTimeoutMillis', 10000),
        },
      }),
    }),
    TypeOrmModule.forFeature([OutboxEvent]),
  ],
  providers: [OutboxService, DataInitializerService],
  exports: [TypeOrmModule, OutboxService, DataInitializerService],
})
export class DatabaseModule {}

