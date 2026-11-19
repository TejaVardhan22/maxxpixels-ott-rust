'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StreamForgotPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Reset password</CardTitle>
          <CardDescription>Password reset requires OTP verification sent to your registered email or phone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="em">Email</Label>
            <Input id="em" type="email" />
          </div>
          <Button className="w-full rounded-full" type="button" disabled>
            Not available
          </Button>
          <p className="text-center text-xs text-desc-text">
            <Link href="/stream/auth/login" className="text-primary-light hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
