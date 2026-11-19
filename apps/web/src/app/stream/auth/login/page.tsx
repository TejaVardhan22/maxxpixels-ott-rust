'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLogin } from '@ott/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { setStoredUser } from '@/lib/auth';

export default function StreamLoginPage() {
  const router = useRouter();
  const loginMut = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await loginMut.mutateAsync({ type: 4, email: email.trim(), password });
      if (res.status === 200 && res.result?.[0]) {
        setStoredUser(res.result[0]);
        router.push('/stream');
      } else {
        setError(res.message || 'Invalid email or password.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in with the MaxxPixels backend account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-accent">{error}</p>}
            <Button className="w-full rounded-full" type="submit" disabled={loginMut.isPending}>
              {loginMut.isPending ? 'Signing in...' : 'Continue'}
            </Button>
          </form>
          <Button variant="secondary" className="mt-3 w-full rounded-full" asChild>
            <Link href="/login?redirect=/stream">Use phone or email OTP</Link>
          </Button>
          <Separator className="my-4 bg-white/10" />
          <p className="text-center text-xs text-desc-text">
            <Link href="/stream/auth/forgot" className="text-primary-light hover:underline">
              Forgot password
            </Link>
            {' . '}
            <Link href="/stream/auth/register" className="text-primary-light hover:underline">
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
