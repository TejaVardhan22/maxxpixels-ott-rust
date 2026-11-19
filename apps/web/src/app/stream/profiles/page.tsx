'use client';

import Link from 'next/link';
import { Monitor, Pencil } from 'lucide-react';
import { useAvatars, useDeviceSyncList, avatarUrl, resolveImageUrl } from '@ott/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useStoredUser } from '@/lib/auth';

export default function StreamProfilesPage() {
  const { user, isLoggedIn, logout } = useStoredUser();
  const avatarsQ = useAvatars();
  const devicesQ = useDeviceSyncList(user?.id);
  const avatars = avatarsQ.data?.result ?? [];
  const devices = devicesQ.data?.result ?? [];

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold">Profiles</h1>
        <p className="mt-2 text-sm text-desc-text">Sign in to manage your MaxxPixels profile.</p>
        <Button className="mt-6 rounded-full" asChild>
          <Link href="/stream/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Who&apos;s watching?</h1>
      <p className="mt-1 text-sm text-desc-text">Your stream profile is synced with the backend user account.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/50 bg-primary/10 ring-1 ring-primary/40">
          <CardHeader className="items-center text-center">
            <Avatar className="h-20 w-20 border border-white/10">
              <AvatarImage src={avatarUrl(user?.image)} alt={user?.full_name ?? 'User'} />
              <AvatarFallback>{String(user?.full_name ?? 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-base">{user?.full_name ?? 'User'}</CardTitle>
            <CardDescription>{user?.parent_control_status === 1 ? 'Kids mode' : 'Standard profile'}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-4">
            <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
              <Link href="/stream/profiles/edit">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </CardContent>
        </Card>
        {avatars.slice(0, 5).map((avatar) => (
          <Card key={String(avatar.id)} className="border-white/10 bg-white/[0.03]">
            <CardHeader className="items-center text-center">
              <Avatar className="h-20 w-20 border border-white/10">
                <AvatarImage src={resolveImageUrl(avatar.image)} alt="Avatar" />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <CardTitle className="text-base">Avatar {avatar.id}</CardTitle>
              <CardDescription>Backend avatar</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Separator className="my-10" />

      <div className="space-y-4 text-sm text-desc-text">
        <p>
          <Link href="/stream/watchlist" className="text-primary-light hover:underline">Watchlist</Link>
          {' . '}
          <Link href="/stream/continue" className="text-primary-light hover:underline">Continue watching</Link>
        </p>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center gap-2 text-white">
            <Monitor className="h-4 w-4 text-gold" />
            <span className="font-semibold">Synced devices</span>
          </div>
          {devices.length === 0 ? (
            <p>No device sessions returned by backend.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={String(device.id ?? device.device_id)} className="rounded-xl bg-white/[0.04] px-3 py-2">
                  {String(device.device_name ?? device.device_id ?? 'Device')}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" className="mt-4 rounded-full border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
