'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StreamOtpPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">OTP login</CardTitle>
          <CardDescription>Phone OTP is handled by the main backend-connected login flow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full rounded-full" asChild>
            <Link href="/login">Open phone OTP login</Link>
          </Button>
          <Button variant="secondary" className="w-full rounded-full" asChild>
            <Link href="/stream/auth/login">Use email login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
