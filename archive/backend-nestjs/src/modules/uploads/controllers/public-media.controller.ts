import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../../../common/decorators/auth.decorators';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
};

@ApiTags('Public Static Media & Posters')
@Public()
@Controller()
export class PublicMediaController {
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads');
  private readonly bunnyCdnUrl = (
    process.env.BUNNY_STORAGE_CDN_URL ||
    process.env.BUNNY_PULL_ZONE_DOMAIN ||
    process.env.CDN_DOMAIN ||
    'https://maxxpixels-images.b-cdn.net'
  )
    .trim()
    .replace(/\/+$/, '');

  @Get([
    'uploads/:folder/:fileName',
    'uploads/:fileName',
    'posters/:fileName',
    'banners/:fileName',
    'api/v1/uploads/:folder/:fileName',
    'api/v1/uploads/:fileName',
    'api/v1/posters/:fileName',
    'api/v1/banners/:fileName',
    'api/uploads/:folder/:fileName',
    'api/uploads/:fileName',
    'api/posters/:fileName',
    'api/banners/:fileName',
    'uploads/*',
    'posters/*',
    'banners/*',
    'api/v1/uploads/*',
    'api/v1/posters/*',
    'api/v1/banners/*',
    'api/uploads/*',
    'api/posters/*',
    'api/banners/*',
  ])
  @ApiOperation({ summary: 'Serve public poster, banner, and upload images with fuzzy name matching and zero-404 SVG fallback' })
  async serveFile(
    @Param('folder') folderParam: string | undefined,
    @Param('fileName') fileNameParam: string | undefined,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const rawUrl = (req.raw?.url || req.url || '').split('?')[0];

    // Strip leading /api/v1 or /api
    const pathWithoutApi = rawUrl.replace(/^\/api\/v1\//, '/').replace(/^\/api\//, '/');

    // Determine target folder and file name from route or URL
    let folder = folderParam || 'posters';
    let fileName = fileNameParam || folderParam || '';

    if (pathWithoutApi.startsWith('/posters/')) {
      folder = 'posters';
      fileName = pathWithoutApi.replace('/posters/', '');
    } else if (pathWithoutApi.startsWith('/banners/')) {
      folder = 'banners';
      fileName = pathWithoutApi.replace('/banners/', '');
    } else if (pathWithoutApi.startsWith('/uploads/')) {
      const parts = pathWithoutApi.replace('/uploads/', '').split('/');
      if (parts.length >= 2) {
        folder = parts[0];
        fileName = parts.slice(1).join('/');
      } else {
        folder = 'posters';
        fileName = parts[0];
      }
    }

    // Sanitize each path segment while preserving nested relative paths.
    fileName = decodeURIComponent(fileName)
      .split('/')
      .filter(Boolean)
      .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'))
      .join('/');

    // 1. Direct match on local filesystem
    const exactLocalPath = path.join(this.uploadsRoot, folder, fileName);
    if (fs.existsSync(exactLocalPath) && fs.statSync(exactLocalPath).isFile()) {
      return this.streamLocalFile(res, exactLocalPath);
    }

    // Also check cross-folders (posters vs banners vs root uploads)
    const inPosters = path.join(this.uploadsRoot, 'posters', fileName);
    if (fs.existsSync(inPosters) && fs.statSync(inPosters).isFile()) {
      return this.streamLocalFile(res, inPosters);
    }
    const inBanners = path.join(this.uploadsRoot, 'banners', fileName);
    if (fs.existsSync(inBanners) && fs.statSync(inBanners).isFile()) {
      return this.streamLocalFile(res, inBanners);
    }

    // 2. Fuzzy match by stripping leading hash or timestamp prefix
    // (e.g. "2e133478_Hum_Hum_Hain_..." matches "1793331207936-Hum_Hum_Hain_...")
    const baseName = fileName
      .replace(/^[0-9a-fA-F]{8}_/, '')
      .replace(/^[0-9]{13}[-_]/, '')
      .replace(/^[0-9a-fA-F-]{36}[-_]/, '');

    const candidateFolders = [
      path.join(this.uploadsRoot, folder),
      path.join(this.uploadsRoot, 'posters'),
      path.join(this.uploadsRoot, 'banners'),
      path.join(this.uploadsRoot, 'media'),
      this.uploadsRoot,
    ];

    for (const cDir of candidateFolders) {
      if (fs.existsSync(cDir)) {
        try {
          const files = fs.readdirSync(cDir);
          const bLower = (baseName || fileName).toLowerCase();
          const found = files.find((f) => {
            const fLower = f.toLowerCase();
            return fLower.endsWith(bLower) || fLower.includes(bLower);
          });
          if (found) {
            const fullFound = path.join(cDir, found);
            if (fs.statSync(fullFound).isFile()) {
              return this.streamLocalFile(res, fullFound);
            }
          }
        } catch {}
      }
    }

    // 3. Check Bunny.net Storage/CDN and return the full image bytes when available.
    const bunnyBuffer = await this.fetchFromBunny(folder, fileName, baseName, rawUrl);
    if (bunnyBuffer) {
      fs.promises
        .mkdir(path.dirname(exactLocalPath), { recursive: true })
        .then(() => fs.promises.writeFile(exactLocalPath, bunnyBuffer))
        .catch(() => {});
      const ext = path.extname(fileName).toLowerCase();
      const contentType = MIME_MAP[ext] || 'image/jpeg';
      res.header('Content-Type', contentType);
      res.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.send(bunnyBuffer);
    }

    // 4. Clean SVG fallback poster to guarantee zero 404s
    return this.sendFallbackSvg(res, baseName || fileName);
  }

  private async fetchFromBunny(
    folder: string,
    fileName: string,
    baseName?: string,
    rawUrl = '',
  ): Promise<Buffer | null> {
    // Storage API first: it is authenticated and keeps working even when the public pull
    // zone is suspended (it currently answers 403 for every object). The CDN is used as a
    // fallback for deployments that do not configure storage API credentials.
    const storageBuf = await this.fetchFromBunnyStorage(folder, fileName, baseName);
    if (storageBuf) return storageBuf;
    return this.fetchFromBunnyCdn(folder, fileName, baseName, rawUrl);
  }

  private async fetchFromBunnyCdn(folder: string, fileName: string, baseName?: string, rawUrl = ''): Promise<Buffer | null> {
    if (!this.bunnyCdnUrl) return null;

    const safe = (p: string) => p.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
    const candidates = new Set<string>();
    const names = Array.from(new Set([fileName, baseName].filter(Boolean) as string[]));

    for (const name of names) {
      const encoded = encodeURIComponent(name);
      candidates.add(safe(`${folder}/${encoded}`));
      candidates.add(safe(`posters/${encoded}`));
      candidates.add(safe(`banners/${encoded}`));
      candidates.add(safe(`content/${encoded}`));
      candidates.add(safe(`uploads/${folder}/${encoded}`));
      candidates.add(safe(`uploads/posters/${encoded}`));
      candidates.add(safe(`uploads/banners/${encoded}`));
      candidates.add(safe(encoded));
    }

    // Also try exact requested path segments (e.g. /api/v1/uploads/posters/x.jpg)
    const reqPath = (rawUrl || '').replace(/^\/api\/v1\//, '/').replace(/^\/api\//, '/').replace(/^\/+/, '');
    if (reqPath) {
      candidates.add(safe(reqPath));
      candidates.add(safe(reqPath.replace(/^uploads\//i, '')));
    }

    for (const rel of candidates) {
      try {
        const resp = await fetch(`${this.bunnyCdnUrl}/${rel}`, { method: 'GET' });
        if (!resp.ok) continue;
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        // Avoid caching HTML/error pages as images
        if (ct.includes('text/html')) continue;
        const ab = await resp.arrayBuffer();
        if (ab && ab.byteLength > 0) return Buffer.from(ab);
      } catch {}
    }
    return null;
  }

  private async fetchFromBunnyStorage(folder: string, fileName: string, baseName?: string): Promise<Buffer | null> {
    const storageApiKey =
      process.env.BUNNY_STORAGE_API_KEY ||
      process.env.BUNNY_STORAGE_ZONE_PASSWORD ||
      '';
    const storageZone =
      process.env.BUNNY_STORAGE_ZONE ||
      process.env.BUNNY_STORAGE_ZONE_NAME ||
      'maxxpixels-images';
    let storageEndpoint = (
      process.env.BUNNY_STORAGE_ENDPOINT || 'https://storage.bunnycdn.com'
    ).replace(/\/+$/, '');
    if (!storageEndpoint.startsWith('http')) storageEndpoint = `https://${storageEndpoint}`;

    if (!storageApiKey || !storageZone) return null;

    const names = Array.from(new Set([fileName, baseName].filter(Boolean) as string[]));
    const candidatePaths = new Set<string>();
    for (const name of names) {
      const encoded = encodeURIComponent(name);
      candidatePaths.add(`/${storageZone}/${folder}/${encoded}`);
      candidatePaths.add(`/${storageZone}/posters/${encoded}`);
      candidatePaths.add(`/${storageZone}/banners/${encoded}`);
      candidatePaths.add(`/${storageZone}/content/${encoded}`);
      candidatePaths.add(`/${storageZone}/uploads/${folder}/${encoded}`);
      candidatePaths.add(`/${storageZone}/uploads/posters/${encoded}`);
      candidatePaths.add(`/${storageZone}/uploads/banners/${encoded}`);
      candidatePaths.add(`/${storageZone}/${encoded}`);
    }

    for (const remotePath of candidatePaths) {
      try {
        const url = `${storageEndpoint}${remotePath}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { AccessKey: storageApiKey },
        });
        if (!resp.ok) continue;
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) continue;
        const ab = await resp.arrayBuffer();
        if (ab && ab.byteLength > 0) return Buffer.from(ab);
      } catch {}
    }

    return null;
  }

  private streamLocalFile(res: FastifyReply, filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.header('Content-Type', contentType);
    res.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.send(stream);
  }

  private sendFallbackSvg(res: FastifyReply, label: string) {
    const cleanLabel = label.replace(/[._-]/g, ' ').replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 30);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="300" cy="400" r="64" fill="#312e81" opacity="0.5"/>
  <polygon points="285,370 330,400 285,430" fill="#a855f7"/>
  <text x="300" y="520" text-anchor="middle" fill="#f8fafc" font-size="22" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="600">${cleanLabel || 'MaxxPixels Media'}</text>
  <text x="300" y="560" text-anchor="middle" fill="#64748b" font-size="14" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">MAXXPIXELS ENTERTAINMENT</text>
</svg>`;
    res.header('Content-Type', 'image/svg+xml');
    res.header('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(svg);
  }
}

