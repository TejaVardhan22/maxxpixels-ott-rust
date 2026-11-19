import { NextResponse, type NextRequest } from 'next/server';

function cdnRedirectUrl(value: string): string | null {
  const decoded = decodeURIComponent(value);
  if (/^(https?|blob:|data:)/i.test(decoded)) return null;
  const embedded = decoded.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (!embedded) return null;
  return `https://${embedded}`;
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  if (nextUrl.pathname === '/_next/image') {
    const originalUrl = nextUrl.searchParams.get('url');
    if (originalUrl && /\.b-cdn\.net\//i.test(originalUrl)) {
      return NextResponse.redirect(originalUrl, 302);
    }
  }

  const cdnUrl = cdnRedirectUrl(nextUrl.pathname);
  if (cdnUrl) {
    return NextResponse.redirect(cdnUrl, 302);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
