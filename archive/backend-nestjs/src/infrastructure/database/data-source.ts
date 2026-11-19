import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { ALL_ENTITIES } from './entities';
import { BaselineSchemaAndIndexes1730000000000 } from '../../migrations/1730000000000-BaselineSchemaAndIndexes';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'maxxott',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: ALL_ENTITIES,
  migrations: [BaselineSchemaAndIndexes1730000000000],
  migrationsTableName: 'typeorm_migrations',
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '25', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
  },
});

