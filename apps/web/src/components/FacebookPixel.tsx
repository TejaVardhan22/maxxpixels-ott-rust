'use client';

import Script from 'next/script';

/** FB Pixel IDs are numeric; strip anything else to keep inline script valid. */
function sanitizePixelId(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Facebook Pixel — loaded via official snippet as a single inline script string
 * to avoid bundler/parsing issues with nested template literals in `layout.tsx`.
 */
export function FacebookPixel() {
  const raw = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() ?? '';
  const pixelId = sanitizePixelId(raw);
  if (!pixelId) return null;

  const __html = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
`.trim();

  return (
    <Script
      id="fb-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html }}
    />
  );
}
