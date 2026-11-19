'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDeviceSyncList, useKidsMode } from '@ott/shared';
import type { DeviceSync } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { EmptyState, GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import { ChevronRight, Monitor, Settings, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const { user, session, isLoggedIn } = useStoredUser();
  const [kidsMode, setKidsMode] = useState(user?.parent_control_status === 1);
  const kidsMut = useKidsMode();
  const devicesQ = useDeviceSyncList(user?.id);
  const devices = (devicesQ.data?.result ?? []) as DeviceSync[];

  useEffect(() => {
    setKidsMode(user?.parent_control_status === 1 || session?.isKidsProfile === true);
  }, [session?.isKidsProfile, user?.parent_control_status]);

  const toggleKids = () => {
    if (!user?.id) return;
    const val = !kidsMode;
    setKidsMode(val);
    kidsMut.mutate(
      { user_id: user.id, kids_mode: val ? 1 : 0, device_id: session?.deviceId ?? `web-${user.id}` },
      { onError: () => setKidsMode(!val) },
    );
  };

  const settingsItems = [
    { label: 'Edit Profile', href: '/editprofile' },
    { label: 'Subscription', href: '/subscription' },
    { label: 'TV Activate', href: '/tvactivate' },
    { label: 'Refer & Earn', href: '/referandearn' },
    { label: 'About & Compliance', href: '/about' },
  ];

  return (
    <PageShell narrow>
      <PageHero eyebrow="Control room" title="Settings" description="Tune account, profile, family, and device preferences." icon={Settings} />

      <GlassPanel className="mb-6 divide-y divide-white/10 p-0">
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold/15 text-gold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-bold text-white">Kids Mode</p>
              <p className="text-xs text-desc-text">Keep playback family-safe on this device.</p>
            </div>
          </div>
          <button
            onClick={toggleKids}
            className={`relative h-7 w-12 rounded-full transition-colors ${kidsMode ? 'bg-gold' : 'bg-white/12'}`}
            aria-label="Toggle kids mode"
          >
            <div className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${kidsMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-body-text transition-colors hover:bg-white/[0.055] hover:text-white">
            {item.label}
            <ChevronRight size={16} className="text-muted-text" />
          </Link>
        ))}
      </GlassPanel>

      {devices.length > 0 && (
        <GlassPanel>
          <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-black text-white">
            <Monitor size={19} className="text-gold" />
            Connected Devices
          </h3>
          <div className="space-y-3">
            {devices.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-bold text-white">{d.device_name || d.device_type || 'Device'}</p>
                <p className="mt-1 text-xs text-muted-text">{d.device_id}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {!isLoggedIn && (
        <EmptyState title="Sign in to manage settings" description="Account controls unlock after login." actionHref="/login" actionLabel="Sign In" icon={Settings} />
      )}
    </PageShell>
  );
}
