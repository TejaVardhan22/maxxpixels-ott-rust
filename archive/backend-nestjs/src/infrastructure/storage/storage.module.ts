import { Global, Module } from '@nestjs/common';
import { BunnyService } from './bunny.service';
import { S3Service } from './s3.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [BunnyService, S3Service, StorageService],
  exports: [BunnyService, S3Service, StorageService],
})
export class StorageModule {}

