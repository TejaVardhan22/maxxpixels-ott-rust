import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const content = `# Google AdSense / Ad Manager & InMobi Ads.txt Verification File
google.com, pub-2191993313473081, DIRECT, f08c47fec0942fa0
inmobi.com, b0e3f3a3b99e4ed7b9a82cd25cc59481, DIRECT, 83e75a7ae333ca9d
inmobi.com, 8839a620596f46169ed937f1568740db, DIRECT, 83e75a7ae333ca9d
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
