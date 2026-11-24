'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserToken, useKidsMode } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { PageShell } from '@/components/layout/PageChrome';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Crown,
  Gift,
  Globe,
  Info,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Radio,
  ShieldCheck,
  Smartphone,
  Tablet,
  Tv,
  User,
  Users,
} from 'lucide-react';

interface PlanLimitsDto {
  planId?: number | null;
  planName: string;
  planStatus: string;
  expiresAt?: string | null;
  maxDevices: number;
  maxConcurrentStreams: number;
  maxProfiles: number;
  maxResolution?: string | null;
}

interface AccountUsageDto {
  activeDevicesCount: number;
  totalDevicesCount: number;
  activeConcurrentStreams: number;
  profilesCount: number;
}

interface DeviceSummaryItemDto {
  id: number;
  deviceId: string;
  deviceName?: string | null;
  deviceModel?: string | null;
  deviceType?: string | null;
  platform?: string | null;
  osVersion?: string | null;
  isActive: boolean;
  isStreaming: boolean;
  lastActiveAt?: string | null;
  createdAt: string;
}

interface DeviceSummaryDto {
  plan: PlanLimitsDto;
  usage: AccountUsageDto;
  devices: DeviceSummaryItemDto[];
}

function detectWebDeviceInfo(): {
  deviceName: string;
  deviceModel: string;
  deviceType: string;
  platform: string;
  osVersion: string;
} {
  if (typeof navigator === 'undefined') {
    return {
      deviceName: 'Web Browser',
      deviceModel: 'Desktop Web',
      deviceType: 'WEB',
      platform: 'WEB',
      osVersion: '',
    };
  }
  const ua = navigator.userAgent || '';
  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  let os = 'Desktop';
  let deviceType = 'DESKTOP';
  if (/Android/i.test(ua)) {
    os = 'Android';
    deviceType = /Mobile/i.test(ua) ? 'MOBILE' : 'TABLET';
  } else if (/iPhone/i.test(ua)) {
    os = 'iPhone';
    deviceType = 'MOBILE';
  } else if (/iPad/i.test(ua)) {
    os = 'iPad';
    deviceType = 'TABLET';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  return {
    deviceName: `${browser} on ${os}`,
    deviceModel: `${browser} (${os})`,
    deviceType,
    platform: 'WEB',
    osVersion: os,
  };
}

function formatPlatformMeta(d: DeviceSummaryItemDto): {
  label: string;
  kind: 'android' | 'ios' | 'tv' | 'tablet' | 'web' | 'mobile';
} {
  const raw = `${d.platform || ''} ${d.deviceType || ''} ${d.deviceName || ''}`.toLowerCase();
  if (raw.includes('tv') || raw.includes('firetv') || raw.includes('roku') || raw.includes('tizen') || raw.includes('webos')) {
    return { label: raw.includes('android') ? 'Android TV' : 'Smart TV', kind: 'tv' };
  }
  if (raw.includes('web') || raw.includes('chrome') || raw.includes('safari') || raw.includes('firefox') || raw.includes('edge')) {
    return { label: d.deviceType?.toUpperCase() === 'MOBILE' ? 'Mobile Web' : 'Web', kind: 'web' };
  }
  if (raw.includes('android')) {
    return { label: raw.includes('tablet') ? 'Android Tablet' : 'Android', kind: raw.includes('tablet') ? 'tablet' : 'android' };
  }
  if (raw.includes('ios') || raw.includes('iphone') || raw.includes('ipad')) {
    return { label: raw.includes('ipad') ? 'iPad' : 'iOS', kind: raw.includes('ipad') ? 'tablet' : 'ios' };
  }
  if (raw.includes('mobile') || raw.includes('phone')) {
    return { label: 'Mobile', kind: 'mobile' };
  }
  return { label: (d.platform || d.deviceType || 'Web').toUpperCase(), kind: 'web' };
}

function DevicePlatformIcon({ kind }: { kind: 'android' | 'ios' | 'tv' | 'tablet' | 'web' | 'mobile' }) {
  switch (kind) {
    case 'tv':
      return <Tv size={18} />;
    case 'tablet':
      return <Tablet size={18} />;
    case 'android':
    case 'ios':
    case 'mobile':
      return <Smartphone size={18} />;
    case 'web':
    default:
      return <Laptop size={18} />;
  }
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Recently active';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'Recently active';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Active just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session, isLoggedIn, logout } = useStoredUser();
  const [kidsMode, setKidsMode] = useState(user?.parent_control_status === 1);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const kidsMut = useKidsMode();

  const currentDeviceId = useMemo(
    () => session?.deviceId || (user?.id ? `web-${user.id}` : ''),
    [session?.deviceId, user?.id],
  );

  // Register/heartbeat current web device so it appears with its real name & platform
  useEffect(() => {
    if (!isLoggedIn || !user?.id || !currentDeviceId) return;
    const token = getUserToken();
    if (!token) return;
    const info = detectWebDeviceInfo();
    fetch('/api/v1/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId: currentDeviceId,
        deviceName: info.deviceName,
        deviceModel: info.deviceModel,
        deviceType: info.deviceType,
        platform: info.platform,
        osVersion: info.osVersion,
      }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['device-summary', user.id] });
      })
      .catch(() => {});
  }, [isLoggedIn, user?.id, currentDeviceId, queryClient]);

  const summaryQ = useQuery<DeviceSummaryDto | null>({
    queryKey: ['device-summary', user?.id],
    enabled: Boolean(isLoggedIn && user?.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      const token = getUserToken();
      if (!token) return null;
      const res = await fetch('/api/v1/devices/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.data ?? json?.result ?? json) as DeviceSummaryDto;
    },
  });

  useEffect(() => {
    setKidsMode(user?.parent_control_status === 1 || session?.isKidsProfile === true);
  }, [session?.isKidsProfile, user?.parent_control_status]);

  const toggleKids = () => {
    if (!user?.id) return;
    const val = !kidsMode;
    setKidsMode(val);
    kidsMut.mutate(
      { user_id: user.id, kids_mode: val ? 1 : 0, device_id: currentDeviceId || `web-${user.id}` },
      { onError: () => setKidsMode(!val) },
    );
  };

  const handleLogoutDevice = async (device: DeviceSummaryItemDto) => {
    const token = getUserToken();
    if (!token) return;
    setRevokingId(device.deviceId);
    setDeviceNotice(null);
    try {
      const res = await fetch(`/api/v1/devices/${encodeURIComponent(device.deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setDeviceNotice('Unable to sign out that device. Please try again.');
        return;
      }
      if (device.deviceId === currentDeviceId) {
        logout();
        router.push('/login');
        return;
      }
      setDeviceNotice(`Signed out "${device.deviceName || device.platform || 'device'}".`);
      await queryClient.invalidateQueries({ queryKey: ['device-summary', user?.id] });
    } catch {
      setDeviceNotice('Network error while signing out device.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutOtherDevices = async () => {
    const token = getUserToken();
    if (!token) return;
    setRevokingOthers(true);
    setDeviceNotice(null);
    try {
      const res = await fetch('/api/v1/devices/logout-others', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentDeviceId }),
      });
      if (res.ok) {
        setDeviceNotice('Signed out all other active devices.');
        await queryClient.invalidateQueries({ queryKey: ['device-summary', user?.id] });
      }
    } finally {
      setRevokingOthers(false);
    }
  };

  const summary = summaryQ.data;
  const allDevices = summary?.devices ?? [];
  const activeDevices = allDevices.filter((d) => d.isActive);
  const inactiveDevices = allDevices.filter((d) => !d.isActive);

  const settingsItems = [
    {
      label: 'Edit Profile',
      description: 'Update your name, email, and profile photo',
      href: userPageHref(user, 'editprofile'),
      icon: User,
    },
    {
      label: 'Subscription & Billing',
      description: 'Manage your VIP plan, renewals, and invoices',
      href: userPageHref(user, 'subscription'),
      icon: Crown,
    },
    {
      label: 'Notifications',
      description: 'Manage alerts, browser push, and release updates',
      href: userPageHref(user, 'notifications'),
      icon: Bell,
    },
    {
      label: 'Activate Smart TV',
      description: 'Link your living room TV using a pairing code',
      href: userPageHref(user, 'tvactivate'),
      icon: Tv,
    },
    {
      label: 'Refer & Earn',
      description: 'Invite friends and earn free VIP days',
      href: userPageHref(user, 'referandearn'),
      icon: Gift,
    },
    {
      label: 'About & Compliance',
      description: 'Terms, privacy policy, and platform details',
      href: '/about',
      icon: Info,
    },
  ];

  const devicePct = summary
    ? Math.min(100, Math.round((summary.usage.activeDevicesCount / Math.max(1, summary.plan.maxDevices)) * 100))
    : 0;
  const streamPct = summary
    ? Math.min(
        100,
        Math.round((summary.usage.activeConcurrentStreams / Math.max(1, summary.plan.maxConcurrentStreams)) * 100),
      )
    : 0;
  const profilePct = summary
    ? Math.min(100, Math.round((summary.usage.profilesCount / Math.max(1, summary.plan.maxProfiles)) * 100))
    : 0;

  return (
    <PageShell className="pb-24 pt-4">
      <div className="mx-auto max-w-[780px]">
        <Link
          href={userPageHref(user, 'myspace')}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          <span>Back to My Space</span>
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Settings</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Manage your plan limits, active devices, family safety, and account preferences.
        </p>

        {!isLoggedIn ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
              <Lock size={22} />
            </div>
            <h2 className="text-xl font-black text-white">Sign in to manage settings</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Account controls, Kids Mode, plan limits, and device management unlock after login.
            </p>
            <Link
              href="/login?redirect=/settings"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-xs font-bold text-white transition hover:brightness-110"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* 1. OPTED PLAN & ACCOUNT LIMITS */}
            <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#FF6D2E]/15 text-[#FF8A54]">
                    <Crown size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-extrabold tracking-tight text-white">
                        {summary?.plan.planName || 'Loading Plan...'}
                      </h2>
                      {summary && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            summary.plan.planStatus === 'ACTIVE'
                              ? 'bg-[#FF6D2E]/15 text-[#FF8A54]'
                              : 'bg-white/[0.06] text-zinc-400'
                          }`}
                        >
                          {summary.plan.planStatus === 'ACTIVE' ? 'VIP Active' : 'Free Tier'}
                        </span>
                      )}
                      {summary?.plan.maxResolution && (
                        <span className="rounded bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-bold text-zinc-300 ring-1 ring-white/10">
                          {summary.plan.maxResolution}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {summary?.plan.expiresAt
                        ? `Valid until ${new Date(summary.plan.expiresAt).toLocaleDateString()}`
                        : 'Upgrade for more concurrent screens, devices, and 4K streaming.'}
                    </p>
                  </div>
                </div>
                <Link
                  href={userPageHref(user, 'subscription')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,109,46,0.35)] transition hover:brightness-110"
                >
                  {summary?.plan.planStatus === 'ACTIVE' ? 'Manage Plan' : 'Upgrade Plan'}
                </Link>
              </div>

              {/* Plan Quota Meters */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
                      <Monitor size={14} className="text-[#FF8A54]" />
                      Active Devices
                    </span>
                    <span className="font-extrabold text-white">
                      {summary ? `${summary.usage.activeDevicesCount} / ${summary.plan.maxDevices}` : '—'}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        summary && summary.usage.activeDevicesCount >= summary.plan.maxDevices
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500]'
                      }`}
                      style={{ width: `${devicePct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {summary && summary.usage.activeDevicesCount >= summary.plan.maxDevices
                      ? 'Device limit reached — log out a device to add another.'
                      : 'Signed-in devices allowed by your plan.'}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
                      <Radio size={14} className="text-emerald-400" />
                      Concurrent Streams
                    </span>
                    <span className="font-extrabold text-white">
                      {summary
                        ? `${summary.usage.activeConcurrentStreams} / ${summary.plan.maxConcurrentStreams}`
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        summary && summary.usage.activeConcurrentStreams >= summary.plan.maxConcurrentStreams
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${streamPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {summary && summary.usage.activeConcurrentStreams > 0
                      ? `${summary.usage.activeConcurrentStreams} screen(s) streaming right now.`
                      : `Up to ${summary?.plan.maxConcurrentStreams ?? 1} simultaneous screen(s).`}
                  </p>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
                      <Users size={14} className="text-[#FF8A54]" />
                      Account Profiles
                    </span>
                    <span className="font-extrabold text-white">
                      {summary ? `${summary.usage.profilesCount} / ${summary.plan.maxProfiles}` : '—'}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] transition-all"
                      style={{ width: `${profilePct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Viewer profiles under this account.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. ACTIVE & CONNECTED DEVICES WITH PER-DEVICE LOGOUT */}
            <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-[#FF8A54]">
                    <Globe size={17} />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight text-white">
                      Active Devices ({activeDevices.length})
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Manage signed-in Web, Mobile, and Smart TV sessions.
                    </p>
                  </div>
                </div>

                {activeDevices.length > 1 && (
                  <button
                    type="button"
                    disabled={revokingOthers}
                    onClick={handleLogoutOtherDevices}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    {revokingOthers ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                    Log Out Other Devices
                  </button>
                )}
              </div>

              {deviceNotice && (
                <div className="mb-4 rounded-md border border-[#FF6D2E]/30 bg-[#FF6D2E]/10 px-4 py-2.5 text-xs font-semibold text-[#FF8A54]">
                  {deviceNotice}
                </div>
              )}

              {summaryQ.isLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-zinc-400">
                  <Loader2 size={16} className="mr-2 animate-spin text-[#FF6D2E]" />
                  Loading active devices...
                </div>
              ) : activeDevices.length === 0 ? (
                <div className="rounded-lg border border-white/[0.08] bg-[#0A0A0A] px-4 py-6 text-center text-xs text-zinc-400">
                  No active devices recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.08] overflow-hidden rounded-lg border border-white/[0.08] bg-[#0A0A0A]">
                  {activeDevices.map((d) => {
                    const meta = formatPlatformMeta(d);
                    const isCurrent = d.deviceId === currentDeviceId;
                    const displayName =
                      d.deviceName || d.deviceModel || `${meta.label} Device`;

                    return (
                      <div
                        key={d.id ?? d.deviceId}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                              isCurrent
                                ? 'bg-[#FF6D2E]/15 text-[#FF8A54]'
                                : 'bg-white/[0.05] text-zinc-300'
                            }`}
                          >
                            <DevicePlatformIcon kind={meta.kind} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-white">{displayName}</p>
                              <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                                {meta.label}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-[#FF6D2E]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8A54]">
                                  This Device
                                </span>
                              )}
                              {d.isStreaming && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                                  Streaming Now
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">
                              {d.deviceModel && d.deviceModel !== displayName ? `${d.deviceModel} · ` : ''}
                              {formatRelativeTime(d.lastActiveAt)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={revokingId === d.deviceId}
                          onClick={() => handleLogoutDevice(d)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-500/45 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        >
                          {revokingId === d.deviceId ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <LogOut size={13} />
                          )}
                          {isCurrent ? 'Log Out' : 'Sign Out'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Signed-Out Devices History */}
              {inactiveDevices.length > 0 && (
                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Signed-Out Devices ({inactiveDevices.length})
                  </p>
                  <div className="space-y-2">
                    {inactiveDevices.slice(0, 5).map((d) => {
                      const meta = formatPlatformMeta(d);
                      return (
                        <div
                          key={d.id ?? d.deviceId}
                          className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0A0A0A]/80 px-3.5 py-2.5 opacity-70"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500">
                              <DevicePlatformIcon kind={meta.kind} />
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-zinc-300">
                                {d.deviceName || d.deviceModel || `${meta.label} Device`}
                                <span className="ml-2 text-[10px] uppercase text-zinc-500">
                                  {meta.label}
                                </span>
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                Last seen {formatRelativeTime(d.lastActiveAt)}
                              </p>
                            </div>
                          </div>
                          <span className="rounded bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                            Signed Out
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. FAMILY SAFETY / KIDS MODE */}
            <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[#FF8A54]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white sm:text-base">Kids Mode</p>
                    <p className="text-xs text-zinc-400">
                      Keep playback family-safe with age-appropriate titles on this device.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={kidsMode}
                  onClick={toggleKids}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6D2E]/50 ${
                    kidsMode ? 'bg-[#FF6D2E]' : 'bg-white/20'
                  }`}
                  aria-label="Toggle kids mode"
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      kidsMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 4. ACCOUNT & APP LINKS */}
            <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04] sm:px-6"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        <p className="text-xs text-zinc-400">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  </Link>
                );
              })}
            </div>

            {/* 5. SIGN OUT */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-5 text-sm font-bold text-zinc-200 transition hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
