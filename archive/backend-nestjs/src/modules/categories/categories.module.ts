import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Genre } from './entities/genre.entity';
import { ContentType } from './entities/content-type.entity';
import { Person } from './entities/person.entity';
import { ContentCast } from './entities/content-cast.entity';
import { Language } from '../languages/entities/language.entity';
import { MasterDataService } from './services/master-data.service';
import { AdminCategoryController } from './controllers/admin-category.controller';
import { AdminMasterDataController } from './controllers/admin-master-data.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Genre, ContentType, Person, ContentCast, Language]),
  ],
  controllers: [AdminCategoryController, AdminMasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class CategoriesModule {}

