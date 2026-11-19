import { Content } from '../entities/content.entity';
import { Episode } from '../entities/episode.entity';
import { Season } from '../entities/season.entity';
import { Banner } from '../entities/banner.entity';
import { Section } from '../entities/section.entity';

export class ContentMapper {
  /**
   * Helper to ensure media URLs resolve to direct CDN/Bunny URLs (not local upload folders)
   * for Web, Mobile App (React Native), and Admin.
   */
  static ensureAbsoluteMediaUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }

    let publicBase = (process.env.PUBLIC_BASE_URL || 'https://api.maxxpixels.com').replace(/\/+$/, '');
    // A loopback PUBLIC_BASE_URL would emit unreachable image URLs in production.
    if (
      process.env.NODE_ENV === 'production' &&
      /\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(publicBase)
    ) {
      publicBase = 'https://api.maxxpixels.com';
    }
    const cdnBase = (
      process.env.BUNNY_STORAGE_CDN_URL ||
      process.env.BUNNY_PULL_ZONE_DOMAIN ||
      process.env.CDN_DOMAIN ||
      process.env.S3_CDN_DOMAIN ||
      ''
    )
      .trim()
      .replace(/\/+$/, '');
    const normalizedCdnBase = cdnBase
      ? cdnBase.startsWith('http://') || cdnBase.startsWith('https://')
        ? cdnBase
        : `https://${cdnBase}`
      : '';

    // The Bunny pull zone may be suspended/unconfigured (returns 403). Unless direct CDN
    // delivery is explicitly enabled, serve media through the backend proxy which reads the
    // full bytes from Bunny Storage/CDN.
    const directCdnEnabled = /^(1|true|yes|on)$/i.test(
      String(process.env.MEDIA_DIRECT_CDN || process.env.BUNNY_CDN_ENABLED || '').trim(),
    );
    const proxyBase = `${publicBase}/api/v1/uploads`;
    const mediaBase = directCdnEnabled && normalizedCdnBase ? normalizedCdnBase : proxyBase;

    // Bunny Stream HLS video URLs must never be rewritten.
    const isStreamUrl = (u: string) =>
      /(?:^|\/\/)(?:vz-|video\.bunnycdn\.com)/i.test(u) || /\.m3u8(?:$|[?#])/i.test(u);

    const stripMediaPrefix = (p: string) =>
      p.replace(/^\/+/, '').replace(/^uploads\//i, '').replace(/^storage\//i, '');

    // Absolute URLs.
    if (/^https?:\/\//i.test(trimmed)) {
      if (isStreamUrl(trimmed)) return trimmed;

      // Known storage/pull-zone hosts -> resolve against the active media base.
      let host = '';
      try {
        host = new URL(trimmed).hostname.toLowerCase();
      } catch {}
      let cdnHost = '';
      try {
        cdnHost = normalizedCdnBase ? new URL(normalizedCdnBase).hostname.toLowerCase() : '';
      } catch {}
      const isStorageCdn =
        host === 'maxxpixels-images.b-cdn.net' || (!!cdnHost && host === cdnHost);

      if (isStorageCdn) {
        const rel = stripMediaPrefix(trimmed.replace(/^https?:\/\/[^/]+\/?/i, ''));
        return rel ? `${mediaBase}/${rel}` : mediaBase;
      }

      // Backend/legacy upload URLs -> resolve against the active media base.
      const apiUploadMatch = trimmed.match(
        /^https?:\/\/(?:localhost|127\.0\.0\.1|admin\.maxxpixels\.com|api\.maxxpixels\.com|www\.maxxpixels\.com|maxxpixels\.com)(?::\d+)?\/(?:api\/v1\/)?(?:uploads\/|storage\/|posters\/|banners\/)?(.*)$/i,
      );
      if (apiUploadMatch) {
        const rel = stripMediaPrefix(apiUploadMatch[1] || '');
        return rel ? `${mediaBase}/${rel}` : mediaBase;
      }

      // Any other absolute URL is kept as-is.
      return trimmed;
    }

    const rel = stripMediaPrefix(trimmed);
    if (!rel) return '';
    return `${mediaBase}/${rel}`;
  }

  /**
   * Maps a Content entity to a clean, modern DTO for Web (Next.js), Mobile App (React Native), and Admin (Angular).
   */
  static toDto(content: Content, options?: { isRented?: boolean; isWatchlisted?: boolean }): Record<string, any> {
    if (!content) return {};

    const isPremium = content.isPremium ?? (content.accessType === 'PREMIUM' || content.accessType === 'SVOD');
    const isRent = content.accessType === 'TVOD' || content.accessType === 'RENT' || content.monetization === 'TVOD';
    const cType = (content.type || content.contentTypeString || 'MOVIE').toUpperCase().trim();
    const isMovie = cType === 'MOVIE' || cType === 'FILM';
    let typeId = 1;
    if (isMovie) typeId = 1;
    else if (cType === 'ALBUM' || cType === 'SONG' || cType === 'MUSIC' || cType === 'SONGS') typeId = 2;
    else if (cType === 'SHORT_FILM' || cType === 'SHORTS' || cType === 'SHORT') typeId = 3;
    else if (cType === 'MICRODRAMA' || cType === 'MICRO-DRAMA' || cType === 'MICRODRAMAS') typeId = 4;
    else if (cType === 'PODCAST' || cType === 'PODCASTS') typeId = 5;
    else if (cType === 'SERIES' || cType === 'SHOWS' || cType === 'WEB-SERIES') typeId = 6;
    else if (cType.startsWith('AI_')) typeId = 7;
    const finalTypeId = typeId;

    const videoUrl = content.movie?.videoUrl || content.movie?.videoAssetId || content.trailerUrl || '';
    const durationSeconds = content.durationSeconds || content.movie?.durationSeconds || (content.movie?.durationMinutes || 0) * 60;
    const durationMinutes = content.movie?.durationMinutes || Math.round(durationSeconds / 60);
    const director = content.movie?.director || '';

    const genres = (content.genres || []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
    }));
    const categories = (content.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    }));
    const languages = (content.languages || []).map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));

    const rawLang = String(content.originalLanguageCode || languages[0]?.code || languages[0]?.name || 'kn').toLowerCase().trim();
    let resolvedLanguageId = languages[0]?.id ? Number(languages[0].id) : undefined;
    let resolvedLanguageCode = 'kn';
    let resolvedLanguageName = 'Kannada';

    if (rawLang === 'kn' || rawLang === 'kannada' || rawLang === 'kan') {
      resolvedLanguageId = resolvedLanguageId || 1;
      resolvedLanguageCode = 'kn';
      resolvedLanguageName = 'Kannada';
    } else if (rawLang === 'hi' || rawLang === 'hindi' || rawLang === 'hin') {
      resolvedLanguageId = resolvedLanguageId || 3;
      resolvedLanguageCode = 'hi';
      resolvedLanguageName = 'Hindi';
    } else if (rawLang === 'ta' || rawLang === 'tamil' || rawLang === 'tam') {
      resolvedLanguageId = resolvedLanguageId || 2;
      resolvedLanguageCode = 'ta';
      resolvedLanguageName = 'Tamil';
    } else if (rawLang === 'te' || rawLang === 'telugu' || rawLang === 'tel') {
      resolvedLanguageId = resolvedLanguageId || 11;
      resolvedLanguageCode = 'te';
      resolvedLanguageName = 'Telugu';
    } else if (rawLang === 'ml' || rawLang === 'malayalam' || rawLang === 'mal') {
      resolvedLanguageId = resolvedLanguageId || 12;
      resolvedLanguageCode = 'ml';
      resolvedLanguageName = 'Malayalam';
    } else if (rawLang === 'en' || rawLang === 'english' || rawLang === 'eng') {
      resolvedLanguageId = resolvedLanguageId || 10;
      resolvedLanguageCode = 'en';
      resolvedLanguageName = 'English';
    } else {
      resolvedLanguageId = resolvedLanguageId || 1;
      resolvedLanguageCode = rawLang || 'kn';
      resolvedLanguageName = content.originalLanguageCode || 'Kannada';
    }

    const cast = (content.castMembers || []).map((cm) => ({
      id: cm.id,
      personId: cm.personId,
      name: cm.person?.name || '',
      characterName: cm.characterName,
      roleType: cm.roleType,
      avatarUrl: cm.person?.avatarUrl || cm.person?.profileImage || null,
      displayOrder: cm.displayOrder,
    }));

    const seasons = (content.series?.seasons || []).map((s) => ContentMapper.toSeasonDto(s));
    const tvodProduct = content.tvodProducts?.[0] || null;
    const rentPrice = tvodProduct?.price || 0;
    const rawPoster = content.posterUrl || '';
    const rawBackdrop = content.backdropUrl || content.landscapeImageUrl || rawPoster;
    const rawBanner = content.bannerImageUrl || content.landscapeImageUrl || rawBackdrop;

    const posterUrl = ContentMapper.ensureAbsoluteMediaUrl(rawPoster);
    const backdropUrl = ContentMapper.ensureAbsoluteMediaUrl(rawBackdrop);
    const bannerUrl = ContentMapper.ensureAbsoluteMediaUrl(rawBanner);
    const masterPlaylistUrl = content.movie?.videoUrl || content.movie?.streamUrl || videoUrl;
    const bunnyVideoId = content.movie?.bunnyVideoGuid || '';
    const producer = content.movie?.productionHouse || (content as any).producer?.companyName || (content as any).productionHouse || '';

    return {
      id: content.id,
      videoId: content.id,
      title: content.title,
      name: content.title,
      slug: content.slug,
      description: content.description || '',
      shortDescription: content.shortDescription || '',
      type: content.type || content.contentTypeString || 'MOVIE',
      contentType: content.type || content.contentTypeString || 'MOVIE',
      status: content.status,
      accessType: content.accessType || content.monetization || 'AVOD',
      monetization: content.monetization || content.accessType || 'AVOD',
      releaseYear: content.releaseYear || (content.releaseDate ? new Date(content.releaseDate).getFullYear() : (content.createdAt ? new Date(content.createdAt).getFullYear() : 2024)),
      releaseDate: content.releaseDate || (content.createdAt ? new Date(content.createdAt).toISOString().split('T')[0] : '2024-08-24'),
      ageRating: content.ageRating || 'U/A 13+',
      maturityRating: content.ageRating || 'U/A 13+',
      imdbRating: content.imdbRating || 0,
      posterUrl,
      backdropUrl,
      landscapeImageUrl: backdropUrl,
      bannerUrl,
      bannerImageUrl: bannerUrl,
      thumbnail: posterUrl,
      landscape: backdropUrl,
      trailerUrl: content.trailerUrl || '',
      videoUrl,
      masterPlaylistUrl,
      bunnyVideoId,
      bunnyVideoGuid: bunnyVideoId,
      producer,
      productionHouse: producer,
      videoAssetId: content.movie?.videoAssetId || videoUrl,
      durationSeconds,
      durationMinutes,
      director,
      originalLanguageCode: resolvedLanguageCode,
      original_language_code: resolvedLanguageCode,
      originalLanguage: resolvedLanguageName,
      original_language: resolvedLanguageName,
      languageId: resolvedLanguageId,
      language_id: resolvedLanguageId,
      languageName: resolvedLanguageName,
      language_name: resolvedLanguageName,
      language: resolvedLanguageName,
      isPremium: Boolean(isPremium),
      isFeatured: Boolean(content.isFeatured),
      isTrending: Boolean(content.isTrending),
      isOriginal: Boolean(content.isOriginal),
      viewCount: Number(content.viewCount || 0),
      contentTypeId: finalTypeId,
      content_type_id: finalTypeId,
      typeId: finalTypeId,
      type_id: finalTypeId,
      videoType: finalTypeId,
      video_type: finalTypeId,
      producerId: content.producerId,
      drmRuleId: content.drmRuleId,
      genres,
      categories,
      category: categories.map((c) => c.name),
      languages,
      cast,
      seasons,
      totalSeasons: content.series?.totalSeasons || seasons.length || 0,
      totalEpisodes: content.series?.totalEpisodes || 0,
      isOngoing: content.series?.isOngoing ?? false,
      isRent: isRent ? 1 : 0,
      rentPrice,
      validityHours: tvodProduct?.rentalDurationHours || tvodProduct?.validityHours || 48,
      rentalDurationHours: tvodProduct?.rentalDurationHours || 48,
      isRented: Boolean(options?.isRented),
      isWatchlisted: Boolean(options?.isWatchlisted),
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  static toSeasonDto(season: Season): Record<string, any> {
    const episodes = (season.episodes || [])
      .slice()
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .map((ep) => ContentMapper.toEpisodeDto(ep));

    return {
      id: season.id,
      seriesId: season.seriesId,
      seasonNumber: season.seasonNumber,
      title: season.title || `Season ${season.seasonNumber}`,
      description: season.description || '',
      posterUrl: season.posterUrl || '',
      releaseYear: season.releaseYear,
      isActive: season.isActive,
      episodes,
    };
  }

  static toEpisodeDto(episode: Episode): Record<string, any> {
    const durationSeconds = episode.durationSeconds || (episode.durationMinutes || 0) * 60;
    return {
      id: episode.id,
      seasonId: episode.seasonId,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      description: episode.description || '',
      durationMinutes: episode.durationMinutes || Math.round(durationSeconds / 60),
      durationSeconds,
      thumbnailUrl: episode.thumbnailUrl || '',
      stillImageUrl: episode.thumbnailUrl || '',
      videoUrl: episode.videoUrl || episode.videoAssetId || '',
      videoAssetId: episode.videoAssetId || episode.videoUrl || '',
      bunnyVideoGuid: episode.bunnyVideoGuid,
      accessType: episode.accessType,
      isPremium: Boolean(episode.isPremium),
      isFreePreview: episode.isFreePreview,
      status: episode.status,
      releaseDate: episode.releaseDate,
      createdAt: episode.createdAt,
    };
  }

  static toBannerDto(banner: Banner): Record<string, any> {
    if (banner.content && banner.content.status && banner.content.status !== 'PUBLISHED') {
      return null as any;
    }
    const contentDto = banner.content ? ContentMapper.toDto(banner.content) : null;
    const rawImageUrl = banner.imageUrl || contentDto?.backdropUrl || contentDto?.posterUrl || '';
    const rawMobileImageUrl = banner.mobileImageUrl || contentDto?.posterUrl || rawImageUrl;
    const imageUrl = ContentMapper.ensureAbsoluteMediaUrl(rawImageUrl);
    const mobileImageUrl = ContentMapper.ensureAbsoluteMediaUrl(rawMobileImageUrl);
    const resolvedPageSlug =
      typeof banner.pageSlug === 'string'
        ? banner.pageSlug
        : (banner.pageSlug as any)?.slug || 'home';

    return {
      id: banner.id,
      title: banner.title || contentDto?.title || '',
      subtitle: banner.subtitle || contentDto?.shortDescription || '',
      imageUrl,
      image: imageUrl,
      landscape: imageUrl,
      mobileImageUrl,
      thumbnail: mobileImageUrl,
      trailerUrl: banner.trailerUrl || contentDto?.trailerUrl || '',
      actionUrl: banner.actionUrl || banner.targetUrl || '',
      targetUrl: banner.targetUrl || banner.actionUrl || '',
      contentId: banner.contentId,
      pageSlug: resolvedPageSlug,
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
      content: contentDto,
      ...(contentDto || {}),
    };
  }

  static toSectionDto(section: Section): Record<string, any> {
    const items = (section.items || [])
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .filter((item) => item.content && (!item.content.status || item.content.status === 'PUBLISHED'))
      .map((item) => ContentMapper.toDto(item.content))
      .filter(Boolean);

    return {
      id: section.id,
      pageId: section.pageId,
      title: section.title,
      subtitle: section.subtitle || '',
      type: section.type || section.sectionType,
      sectionType: section.sectionType || section.type,
      layout: section.layout || section.layoutStyle || 'landscape',
      layoutStyle: section.layoutStyle || section.layout || 'landscape',
      contentTypeFilter: section.contentTypeFilter,
      categoryId: section.categoryId,
      genreId: section.genreId,
      languageCode: section.languageCode,
      autoFetchLimit: section.autoFetchLimit,
      displayOrder: section.displayOrder,
      isActive: section.isActive,
      items,
      data: items,
    };
  }
}
