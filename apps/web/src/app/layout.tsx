import Script from 'next/script';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';
import { ConditionalChrome } from '@/components/layout/ConditionalChrome';
import { FacebookPixel } from '@/components/FacebookPixel';
import { serverPostJson } from '@/lib/ott-api-server';
import { parseBrandSettings, FALLBACK_BRAND } from '@/lib/branding';
import type { ApiListResponse, GeneralSettingRow } from '@ott/shared';

const inter = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-inter',
  display: 'swap',
});

const outfit = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-outfit',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  let brand = FALLBACK_BRAND;
  try {
    const result = await serverPostJson<ApiListResponse<GeneralSettingRow[]>>('general_setting', {});
    brand = parseBrandSettings(result.result);
  } catch {
    // Keep fallback branding if configuration is unavailable during rendering.
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maxxpixels.com';

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${brand.name} - Stream Movies, Short Films & Web Series`,
      template: `%s | ${brand.name}`,
    },
    description: brand.description,
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
    openGraph: {
      siteName: brand.name,
      title: `${brand.name} - Stream Movies, Short Films & Web Series`,
      description: brand.description,
      type: 'website',
      url: siteUrl,
      images: [
        {
          url: brand.logoUrl || '/logo.png',
          alt: brand.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${brand.name} - Stream Movies, Short Films & Web Series`,
      description: brand.description,
      images: [brand.logoUrl || '/logo.png'],
    },
    other: {
      ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { 'google-site-verification': process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : {}),
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-KLGH8XL4';

  return (
    <html lang="en" className={`dark ${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
          }}
        />
        {/* End Google Tag Manager */}

        {/* Google AdSense Integration (Standard script tag avoids Next.js data-nscript attribute check error) */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID || 'ca-pub-2191993313473081'}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased min-h-screen bg-app-bg text-white" suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <AppProviders>
          <ConditionalChrome>{children}</ConditionalChrome>
        </AppProviders>
        <FacebookPixel />
      </body>
    </html>
  );
}
