function normalizeApiBackend(raw) {
  const fallback = 'http://127.0.0.1:8080';
  const value = (raw || fallback).replace(/\/+$/, '');
  return value;
}

function backendOriginFromApi(raw) {
  const apiBase = normalizeApiBackend(raw);
  try {
    const url = new URL(apiBase);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return apiBase.replace(/\/api(?:\/v1)?$/i, '');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: buildImageRemotePatterns(),
  },
  async redirects() {
    return [
      {
        source: '/movie/:slug',
        destination: '/movies/:slug',
        permanent: true,
      },
      {
        source: '/series/:slug',
        destination: '/shows/:slug',
        permanent: true,
      },
      {
        source: '/title/:slug',
        destination: '/movies/:slug',
        permanent: true,
      },
      {
        source: '/details/:videoType/:typeId/:videoId/:slug',
        destination: '/movies/:slug',
        permanent: true,
      },
      {
        source: '/details/:videoType/:typeId/:videoId',
        destination: '/movies/:videoId',
        permanent: true,
      },
      {
        source: '/details',
        destination: '/movies',
        permanent: true,
      },
      {
        source: '/commanpages',
        destination: '/about',
        permanent: true,
      },
      {
        source: '/bycategory/:id',
        destination: '/genres/:id',
        permanent: true,
      },
      {
        source: '/category/:slug',
        destination: '/genres/:slug',
        permanent: true,
      },
      {
        source: '/bylanguage/:id',
        destination: '/languages/:id',
        permanent: true,
      },
      {
        source: '/bychannel/:id',
        destination: '/channels/:id',
        permanent: true,
      },
      {
        source: '/bycast/:id',
        destination: '/cast/:id',
        permanent: true,
      },
      {
        source: '/stream/title/:id',
        destination: '/movies/:id',
        permanent: true,
      },
      {
        source: '/stream/watch/:id',
        destination: '/watch/:id',
        permanent: true,
      },
      {
        source: '/stream',
        destination: '/',
        permanent: true,
      },
      {
        source: '/stream/categories',
        destination: '/genres',
        permanent: true,
      },
      {
        source: '/stream/watchlist',
        destination: '/watchlist',
        permanent: true,
      },
      {
        source: '/stream/continue',
        destination: '/continuewatching',
        permanent: true,
      },
      {
        source: '/stream/search',
        destination: '/search',
        permanent: true,
      },
      {
        source: '/stream/plans',
        destination: '/subscription',
        permanent: true,
      },
      {
        source: '/app-ads.tx',
        destination: '/app-ads.txt',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backendOrigin = backendOriginFromApi(process.env.API_BACKEND_URL || 'http://127.0.0.1:8080');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin}/api/v1/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendOrigin}/uploads/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${backendOrigin}/storage/:path*`,
      },
      {
        source: '/content/:path*',
        destination: `${backendOrigin}/content/:path*`,
      },
      {
        source: '/posters/:path*',
        destination: `${backendOrigin}/posters/:path*`,
      },
      {
        source: '/banners/:path*',
        destination: `${backendOrigin}/banners/:path*`,
      },
      {
        source: '/branding/:path*',
        destination: `${backendOrigin}/branding/:path*`,
      },
      {
        source: '/notification/:path*',
        destination: `${backendOrigin}/notification/:path*`,
      },
      {
        source: '/ads/:path*',
        destination: `${backendOrigin}/ads/:path*`,
      },
    ];
  },
};

function buildImageRemotePatterns() {
  const patterns = [
    { protocol: 'https', hostname: 'ui-avatars.com', pathname: '/api/**' },
    // Lorem Picsum (placeholders); CDN may serve from i.picsum.photos after redirect
    { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
    { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
    { protocol: 'https', hostname: 'i.picsum.photos', pathname: '/**' },
    { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/**' },
    { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/**' },
    { protocol: 'http', hostname: '127.0.0.1', port: '8080', pathname: '/**' },
    { protocol: 'http', hostname: 'localhost', port: '8082', pathname: '/**' },
    { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/**' },
    { protocol: 'http', hostname: '127.0.0.1', port: '3000', pathname: '/**' },
    { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/**' },
    { protocol: 'http', hostname: '127.0.0.1', port: '3002', pathname: '/**' },
    { protocol: 'http', hostname: 'localhost', port: '3002', pathname: '/**' },
  ];

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (base) {
    try {
      const u = new URL(base);
      const protocol = u.protocol.replace(':', '') === 'http' ? 'http' : 'https';
      patterns.push({
        protocol,
        hostname: u.hostname,
        pathname: '/**',
        ...(u.port ? { port: u.port } : {}),
      });
    } catch {
      /* ignore invalid URL */
    }
  }

  // Zata.ai S3 path-style public URLs (Central India — add other region hosts via env below)
  patterns.push({
    protocol: 'https',
    hostname: 'idr01.zata.ai',
    pathname: '/**',
  });

  // Unsplash
  patterns.push({
    protocol: 'https',
    hostname: 'images.unsplash.com',
    pathname: '/**',
  });

  // Placeholder image host used by seeded content and fallback posters.
  patterns.push({
    protocol: 'https',
    hostname: 'placehold.co',
    pathname: '/**',
  });

  // Bunny CDN / B-cdn image hosts and Bunny Stream delivery hosts used by catalog assets and video thumbnails.
  patterns.push(
    {
      protocol: 'https',
      hostname: 'b-cdn.net',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: '**.b-cdn.net',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'bunnycdn.com',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: '**.bunnycdn.com',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'iframe.mediadelivery.net',
      pathname: '/**',
    },
  );

  // Fallback and public media domains
  patterns.push(
    { protocol: 'https', hostname: 'commondatastorage.googleapis.com', pathname: '/**' },
    { protocol: 'https', hostname: 'maxxpixels.tv', pathname: '/**' },
    { protocol: 'https', hostname: 'maxxpixels.com', pathname: '/**' },
    { protocol: 'https', hostname: 'api.maxxpixels.com', pathname: '/**' },
  );

  const extraHosts = process.env.NEXT_PUBLIC_EXTRA_IMAGE_HOSTS;
  if (extraHosts) {
    for (const raw of extraHosts.split(',')) {
      const hostname = raw.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!hostname) continue;
      patterns.push({ protocol: 'https', hostname, pathname: '/**' });
    }
  }

  return patterns;
}

// The analyzer is a development-only dependency. Loading it unconditionally makes
// `next start` fail after production dependencies are pruned during deployment.
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? (await import('@next/bundle-analyzer')).default({ enabled: true })
  : (config) => config;

export default withBundleAnalyzer(nextConfig);
