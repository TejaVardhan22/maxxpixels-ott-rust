'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setStoredUser } from '@/lib/auth';
import VerifiedSignupForm from '@/components/auth/VerifiedSignupForm';

export default function StreamRegisterPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Create account</CardTitle>
          <CardDescription>Verify your mobile number by SMS. Password comes after OTP.</CardDescription>
        </CardHeader>
        <CardContent>
          <VerifiedSignupForm
            submitLabel="Register"
            onRegistered={(user) => {
              setStoredUser(user);
              router.push('/stream');
            }}
          />
          <p className="mt-4 text-center text-xs text-desc-text">
            Already have an account?{' '}
            <Link href="/stream/auth/login" className="text-primary-light hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
