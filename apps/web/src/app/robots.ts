import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maxxpixels.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/movies',
          '/movies/*',
          '/shows',
          '/shows/*',
          '/genres',
          '/genres/*',
          '/languages',
          '/languages/*',
          '/cast/*',
          '/channels/*',
          '/search',
          '/about',
          '/legal/*',
        ],
        disallow: [
          '/api/*',
          '/profile',
          '/profile/*',
          '/editprofile',
          '/settings',
          '/wallet',
          '/wallethistory',
          '/downloads',
          '/auth/*',
          '/login',
          '/login/*',
          '/register',
          '/payment/*',
          '/stream/*',
          '/details/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

