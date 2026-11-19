'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUpdateProfile } from '@ott/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setStoredUser, useStoredUser } from '@/lib/auth';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn } = useStoredUser();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile_number ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setMobile(user?.mobile_number ?? '');
  }, [user?.full_name, user?.email, user?.mobile_number]);

  const save = async () => {
    if (!user?.id) return;
    setError('');
    try {
      const res = await updateProfile.mutateAsync({
        user_id: user.id,
        full_name: name.trim(),
        email: email.trim(),
        mobile_number: mobile.trim(),
      });
      if (res.result?.[0]) {
        setStoredUser({ ...user, ...res.result[0], auth_token: user.auth_token });
      } else {
        setStoredUser({ ...user, full_name: name.trim(), email: email.trim(), mobile_number: mobile.trim() });
      }
      router.push('/stream/profiles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm text-desc-text">Sign in to edit your profile.</p>
        <Button className="mt-4 rounded-full" asChild><Link href="/stream/auth/login">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="font-display">Edit profile</CardTitle>
          <CardDescription>{user?.full_name ?? 'User'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="em">Email</Label>
            <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Phone Number (Locked)</Label>
            <Input id="mobile" value={mobile} disabled readOnly className="opacity-60 cursor-not-allowed bg-white/5" />
            <p className="text-xs text-muted-text">Mobile phone number cannot be changed once registered.</p>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 rounded-full" type="button" disabled={updateProfile.isPending} onClick={save}>
              {updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="/stream/profiles">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
