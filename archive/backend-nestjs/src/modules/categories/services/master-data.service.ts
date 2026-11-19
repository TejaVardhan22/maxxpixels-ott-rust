import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Genre } from '../entities/genre.entity';
import { ContentType } from '../entities/content-type.entity';
import { Person } from '../entities/person.entity';
import { Language } from '../../languages/entities/language.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Genre)
    private readonly genreRepo: Repository<Genre>,
    @InjectRepository(ContentType)
    private readonly contentTypeRepo: Repository<ContentType>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  private toSlug(name: string): string {
    return (
      String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `item-${Date.now()}`
    );
  }

  // ==================== CATEGORIES ====================

  async listCategories(onlyActive = false): Promise<any[]> {
    try {
      const cats = await this.categoryRepo.find({
        order: { id: 'ASC' },
      });
      if (cats && cats.length > 0) return cats;
    } catch {}

    // Fallback to genres from DB
    const genres = await this.genreRepo.find({
      order: { id: 'ASC' },
    });
    return genres.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      imageUrl: '',
      displayOrder: g.id,
      isActive: true,
    }));
  }

  async createCategory(body: any): Promise<Category> {
    const name = String(body?.name || body?.category_name || '').trim();
    if (!name) throw new BadRequestException('Category name is required');
    const slug = body?.slug || this.toSlug(name);

    const cat = this.categoryRepo.create({
      name,
      slug,
      description: body?.description || null,
      imageUrl: body?.imageUrl || body?.image_url || body?.image || null,
      displayOrder: Number(body?.displayOrder ?? body?.display_order ?? 0),
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
    });
    const saved = await this.categoryRepo.save(cat);
    await this.redisService.delByPrefix('catalog:');
    return saved;
  }

  async updateCategory(id: number, body: any): Promise<Category> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);

    if (body.name !== undefined || body.category_name !== undefined) {
      cat.name = String(body.name ?? body.category_name).trim();
    }
    if (body.slug !== undefined) cat.slug = body.slug;
    if (body.description !== undefined) cat.description = body.description;
    if (body.imageUrl !== undefined || body.image_url !== undefined || body.image !== undefined) {
      cat.imageUrl = body.imageUrl ?? body.image_url ?? body.image;
    }
    if (body.displayOrder !== undefined || body.display_order !== undefined) {
      cat.displayOrder = Number(body.displayOrder ?? body.display_order);
    }
    if (body.isActive !== undefined) cat.isActive = Boolean(body.isActive);

    const saved = await this.categoryRepo.save(cat);
    await this.redisService.delByPrefix('catalog:');
    return saved;
  }

  async deleteCategory(id: number): Promise<any> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM content_categories WHERE category_id = $1`, [id]).catch(() => {});
      await manager.remove(Category, cat);
    });
    await this.redisService.delByPrefix('catalog:');
    return { id, deleted: true };
  }

  // ==================== LANGUAGES ====================

  async listLanguages(onlyActive = false): Promise<any[]> {
    const list = await this.languageRepo.find({
      order: { id: 'ASC' },
    });
    return list.map((l) => ({
      id: Number(l.id),
      code: l.code,
      name: l.name,
      nativeName: l.name,
      displayOrder: Number(l.id),
      isActive: true,
    }));
  }

  async upsertLanguage(body: any, codeParam?: string): Promise<Language> {
    const code = String(codeParam || body?.code || body?.language_code || '')
      .trim()
      .toLowerCase();
    const name = String(body?.name || body?.language_name || '').trim();
    if (!code || !name) {
      throw new BadRequestException('Language code and name are required');
    }

    let lang = await this.languageRepo.findOne({ where: { code } });
    if (!lang) {
      lang = this.languageRepo.create({
        code,
        name,
      });
    } else {
      lang.name = name;
    }

    const saved = await this.languageRepo.save(lang);
    await this.redisService.delByPrefix('catalog:');
    return saved;
  }

  /**
   * Mirrors Spring Boot AdminMasterDataController duplicate language consolidation & canonical remapping.
   */
  async consolidateDuplicateLanguages(): Promise<any> {
    const all = await this.languageRepo.find({ order: { id: 'ASC', code: 'ASC' } });
    const byNormalizedName = new Map<string, Language[]>();
    for (const l of all) {
      const key = l.name.trim().toLowerCase();
      const arr = byNormalizedName.get(key) || [];
      arr.push(l);
      byNormalizedName.set(key, arr);
    }

    const merged: Array<{ canonicalCode: string; removedCode: string; name: string }> = [];
    for (const [, group] of byNormalizedName.entries()) {
      if (group.length > 1) {
        // Prefer the shortest ISO-style code as canonical (e.g. 'kn' over 'kannada', 'hi' over 'hindi');
        // tie-break on lowest id.
        const sorted = [...group].sort((a, b) => a.code.length - b.code.length || a.id - b.id);
        const canonical = sorted[0];
        for (const dup of sorted.slice(1)) {
          await this.dataSource
            .query(
              `UPDATE content_languages SET language_code = $1 WHERE language_code = $2 AND NOT EXISTS (
                SELECT 1 FROM content_languages cl2 WHERE cl2.content_id = content_languages.content_id AND cl2.language_code = $1
              )`,
              [canonical.code, dup.code],
            )
            .catch(() => {});
          await this.dataSource
            .query(`DELETE FROM content_languages WHERE language_code = $1`, [dup.code])
            .catch(() => {});
          await this.languageRepo.remove(dup);
          merged.push({ canonicalCode: canonical.code, removedCode: dup.code, name: canonical.name });
        }
      }
    }

    return { mergedCount: merged.length, merged };
  }

  async deleteLanguage(code: string): Promise<any> {
    const lang = await this.languageRepo.findOne({ where: { code } });
    if (!lang) throw new NotFoundException(`Language ${code} not found`);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM content_languages WHERE language_code = $1`, [code]).catch(() => {});
      await manager.remove(Language, lang);
    });
    await this.redisService.delByPrefix('catalog:');
    return { code, deleted: true };
  }

  // ==================== GENRES ====================

  async listGenres(onlyActive = false): Promise<any[]> {
    const list = await this.genreRepo.find({
      order: { id: 'ASC' },
    });
    return list.map((g) => ({
      id: Number(g.id),
      name: g.name,
      slug: g.slug,
      isActive: true,
    }));
  }

  async upsertGenre(body: any, id?: number): Promise<Genre> {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('Genre name is required');
    const slug = body?.slug || this.toSlug(name);

    let genre = id ? await this.genreRepo.findOne({ where: { id } }) : await this.genreRepo.findOne({ where: { slug } });
    if (!genre) {
      genre = this.genreRepo.create({
        name,
        slug,
      });
    } else {
      genre.name = name;
      if (body.slug) genre.slug = body.slug;
    }

    return this.genreRepo.save(genre);
  }

  async deleteGenre(id: number): Promise<any> {
    const genre = await this.genreRepo.findOne({ where: { id } });
    if (!genre) throw new NotFoundException(`Genre ${id} not found`);
    await this.dataSource.query(`DELETE FROM content_genres WHERE genre_id = $1`, [id]).catch(() => {});
    await this.genreRepo.remove(genre);
    return { id, deleted: true };
  }

  // ==================== CONTENT TYPES ====================

  async listContentTypes(onlyActive = false): Promise<any[]> {
    const list = await this.contentTypeRepo.find({
      order: { id: 'ASC' },
    });
    return list.map((ct) => ({
      id: Number(ct.id),
      title: ct.title,
      name: ct.title,
      slug: ct.slug,
      displayOrder: Number(ct.id),
      isActive: true,
    }));
  }

  async upsertContentType(body: any, id?: number): Promise<ContentType> {
    const name = String(body?.title || body?.name || '').trim();
    if (!name) throw new BadRequestException('ContentType title/name is required');
    const slug = body?.slug || this.toSlug(name);

    let ct = id
      ? await this.contentTypeRepo.findOne({ where: { id } })
      : await this.contentTypeRepo.findOne({ where: { slug } });

    if (!ct) {
      ct = this.contentTypeRepo.create({
        title: name,
        slug,
      });
    } else {
      ct.title = name;
      if (body.slug) ct.slug = body.slug;
    }

    return this.contentTypeRepo.save(ct);
  }

  async deleteContentType(id: number): Promise<any> {
    const ct = await this.contentTypeRepo.findOne({ where: { id } });
    if (!ct) throw new NotFoundException(`ContentType ${id} not found`);
    await this.contentTypeRepo.remove(ct);
    return { id, deleted: true };
  }

  // ==================== CAST / PERSONS ====================

  async listPersons(search?: string): Promise<Person[]> {
    const qb = this.personRepo.createQueryBuilder('p').orderBy('p.name', 'ASC').take(200);
    if (search && search.trim()) {
      qb.where('p.name ILIKE :q', { q: `%${search.trim()}%` });
    }
    return qb.getMany();
  }

  async upsertPerson(body: any, id?: number): Promise<Person> {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('Person name is required');

    let person = id ? await this.personRepo.findOne({ where: { id } }) : null;
    if (!person) {
      person = this.personRepo.create({
        name,
        bio: body?.bio || null,
        avatarUrl: body?.avatarUrl || body?.avatar_url || body?.image || null,
        knownForDepartment: body?.knownForDepartment || body?.role || 'Acting',
      });
    } else {
      person.name = name;
      if (body.bio !== undefined) person.bio = body.bio;
      if (body.avatarUrl !== undefined || body.avatar_url !== undefined || body.image !== undefined) {
        person.avatarUrl = body.avatarUrl ?? body.avatar_url ?? body.image;
      }
      if (body.knownForDepartment !== undefined || body.role !== undefined) {
        person.knownForDepartment = body.knownForDepartment ?? body.role;
      }
    }

    return this.personRepo.save(person);
  }

  async deletePerson(id: number): Promise<any> {
    const person = await this.personRepo.findOne({ where: { id } });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    await this.dataSource.query(`DELETE FROM content_cast WHERE person_id = $1`, [id]).catch(() => {});
    await this.personRepo.remove(person);
    return { id, deleted: true };
  }
}

