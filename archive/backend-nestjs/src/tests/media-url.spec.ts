import { ContentMapper } from '../modules/content/services/content.mapper';

describe('ContentMapper.ensureAbsoluteMediaUrl', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = 'https://api.maxxpixels.com';
    delete process.env.MEDIA_DIRECT_CDN;
    delete process.env.BUNNY_CDN_ENABLED;
    delete process.env.BUNNY_STORAGE_CDN_URL;
    delete process.env.CDN_DOMAIN;
    delete process.env.S3_CDN_DOMAIN;
    process.env.BUNNY_PULL_ZONE_DOMAIN = 'https://maxxpixels-images.b-cdn.net';
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rewrites Bunny storage pull-zone URLs to the backend media proxy', () => {
    expect(
      ContentMapper.ensureAbsoluteMediaUrl(
        'https://maxxpixels-images.b-cdn.net/posters/poster-one.png',
      ),
    ).toBe('https://api.maxxpixels.com/api/v1/uploads/posters/poster-one.png');
  });

  it('keeps an already-proxied public upload URL stable', () => {
    expect(
      ContentMapper.ensureAbsoluteMediaUrl(
        'https://api.maxxpixels.com/api/v1/uploads/banners/banner.jpg',
      ),
    ).toBe('https://api.maxxpixels.com/api/v1/uploads/banners/banner.jpg');
  });

  it('resolves relative and legacy upload paths', () => {
    expect(ContentMapper.ensureAbsoluteMediaUrl('/uploads/posters/a.jpg')).toBe(
      'https://api.maxxpixels.com/api/v1/uploads/posters/a.jpg',
    );
    expect(ContentMapper.ensureAbsoluteMediaUrl('posters/a.jpg')).toBe(
      'https://api.maxxpixels.com/api/v1/uploads/posters/a.jpg',
    );
  });

  it('never rewrites Bunny Stream playlists', () => {
    const stream = 'https://vz-bb76d46f-94f.b-cdn.net/9f8e7d6c/playlist.m3u8';
    expect(ContentMapper.ensureAbsoluteMediaUrl(stream)).toBe(stream);
  });

  it('uses direct pull-zone URLs only when explicitly enabled', () => {
    process.env.MEDIA_DIRECT_CDN = 'true';
    expect(
      ContentMapper.ensureAbsoluteMediaUrl(
        'https://maxxpixels-images.b-cdn.net/posters/poster-one.png',
      ),
    ).toBe('https://maxxpixels-images.b-cdn.net/posters/poster-one.png');
  });
});
