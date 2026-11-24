'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crown,
  Edit3,
  Film,
  Gift,
  Home,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  MonitorSmartphone,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tv,
  Users,
} from 'lucide-react';
import {
  avatarUrl,
  getUserToken,
  useBookmarks,
  useContinueWatching,
  useKidsMode,
  useProfile,
  useUserRentContent,
} from '@ott/shared';
import ContentRail from '@/components/home/ContentRail';
import { PageShell } from '@/components/layout/PageChrome';
import { showToast } from '@/components/ui/ToastHost';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';

type SectionTab =
  | 'overview'
  | 'membership'
  | 'security'
  | 'devices'
  | 'profiles'
  | 'library'
  | 'tvactivate';

interface DeviceSummaryDto {
  plan?: {
    planName?: string;
    planStatus?: string;
    expiresAt?: string | null;
    maxDevices?: number;
    maxConcurrentStreams?: number;
    maxProfiles?: number;
    maxResolution?: string | null;
  };
  usage?: {
    activeDevicesCount?: number;
    activeConcurrentStreams?: number;
    profilesCount?: number;
  };
  devices?: Array<{
    id: number;
    deviceId: string;
    deviceName?: string | null;
    deviceType?: string | null;
    platform?: string | null;
    isActive: boolean;
    isStreaming: boolean;
    lastActiveAt?: string | null;
  }>;
}

export default function MySpacePage() {
  const queryClient = useQueryClient();
  const { user, session, isLoggedIn, logout } = useStoredUser();
  const profileQ = useProfile(user?.id);
  const bookmarksQ = useBookmarks(session);
  const cwQ = useContinueWatching(session);
  const rentalsQ = useUserRentContent(user?.id ?? 0);
  const kidsMut = useKidsMode();
  const [isKidsMode, setIsKidsMode] = useState(Boolean(session?.isKidsProfile));

  const [section, setSection] = useState<SectionTab>('profiles');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [tvCode, setTvCode] = useState('');
  const [tvActivating, setTvActivating] = useState(false);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);

  const devicesQ = useQuery<DeviceSummaryDto | null>({
    queryKey: ['myspace-devices-summary', user?.id],
    enabled: Boolean(isLoggedIn && user?.id),
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
    staleTime: 30_000,
  });

  const profile = profileQ.data?.result?.[0] ?? user;
  const rawBookmarks =
    (bookmarksQ.data as any)?.result ??
    (bookmarksQ.data as any)?.data ??
    (Array.isArray(bookmarksQ.data) ? bookmarksQ.data : []);
  const bookmarks = (Array.isArray(rawBookmarks) ? rawBookmarks : [])
    .filter((item: any) => item && (item.is_bookmark === undefined || Number(item.is_bookmark) === 1))
    .map((item: any) => {
      const cid = Number(item.contentId ?? item.content_id ?? item.video_id ?? item.id ?? 0);
      return {
        ...item,
        id: cid || item.id,
        video_id: cid || item.video_id,
        content_id: cid || item.content_id,
        name: item.title ?? item.name,
        thumbnail: item.posterUrl ?? item.poster_url ?? item.thumbnail,
        landscape: item.backdropUrl ?? item.backdrop_url ?? item.landscape,
        is_bookmark: 1,
        stop_time: 0,
      };
    });
  const cw = cwQ.data?.result ?? [];
  const rentals = rentalsQ.data?.result ?? [];
  const hasLibrary = cw.length > 0 || bookmarks.length > 0 || rentals.length > 0;
  const isVip = profile?.is_buy === 1;

  const displayName = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Member';
  const initial = displayName.charAt(0).toUpperCase();
  const rawAvatar = profile?.image ? avatarUrl(profile.image) : '';
  const showPhoto = Boolean(profile?.image && rawAvatar && !avatarFailed);

  const devices = devicesQ.data?.devices ?? [];
  const planLimits = devicesQ.data?.plan;
  const usage = devicesQ.data?.usage;

  const handleRemoveDevice = async (deviceId: string) => {
    const token = getUserToken();
    if (!token) return;
    setLoggingOutId(deviceId);
    try {
      const res = await fetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast({ title: 'Device signed out', message: 'The selected device has been logged out.', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['myspace-devices-summary'] });
      } else {
        showToast({ title: 'Action failed', message: 'Unable to log out device.', variant: 'error' });
      }
    } finally {
      setLoggingOutId(null);
    }
  };

  const handleLogoutOthers = async () => {
    const token = getUserToken();
    if (!token) return;
    setLoggingOutOthers(true);
    try {
      const res = await fetch('/api/v1/devices/logout-others', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast({ title: 'Signed out other devices', message: 'All other active sessions were terminated.', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['myspace-devices-summary'] });
      } else {
        showToast({ title: 'Action failed', message: 'Could not log out other devices.', variant: 'error' });
      }
    } finally {
      setLoggingOutOthers(false);
    }
  };

  const handleActivateTv = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tvCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleaned.length < 4) {
      showToast({ title: 'Enter TV code', message: 'Please enter the 6-character code shown on your Smart TV.', variant: 'error' });
      return;
    }
    const token = getUserToken();
    if (!token) return;
    setTvActivating(true);
    try {
      const res = await fetch('/api/v1/auth/tv/activate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTvCode('');
        showToast({ title: 'Smart TV Linked!', message: 'Your TV is now signed in and ready to stream.', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['myspace-devices-summary'] });
      } else {
        showToast({ title: 'Activation failed', message: json?.message || 'Invalid or expired TV code.', variant: 'error' });
      }
    } finally {
      setTvActivating(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <PageShell className="grid min-h-[calc(100vh-5rem)] place-items-center">
        <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-[#141414] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-black text-white">Sign in to My Space</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
            Access your profiles, membership, watchlist, and connected devices across platforms.
          </p>
          <Link
            href="/login?redirect=/myspace"
            className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-sm font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110"
          >
            <ShieldCheck size={17} /> Sign In
          </Link>
        </div>
      </PageShell>
    );
  }

  const navItems: Array<{ id: SectionTab; label: string; icon: any; dividerBefore?: boolean }> = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'membership', label: 'Membership', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
    { id: 'profiles', label: 'Profiles', icon: Users },
    { id: 'library', label: 'My List & History', icon: Bookmark },
    { id: 'tvactivate', label: 'Activate Smart TV', icon: Tv, dividerBefore: true },
  ];

  return (
    <PageShell className="pb-24 pt-6">
      <div className="mx-auto max-w-[1140px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          {/* LEFT STICKY SIDEBAR (Rock-solid pinned position across all tabs) */}
          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[240px] lg:self-start">
            <div>
              <Link
                href="/"
                className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
              >
                <ArrowLeft size={15} />
                <span>Back to Home</span>
              </Link>

              <nav
                className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
                aria-label="Account navigation"
              >
                {navItems.map(({ id, label, icon: Icon, dividerBefore }) => {
                  const active = section === id;
                  return (
                    <div key={id} className="contents lg:block">
                      {dividerBefore && (
                        <div className="my-2 hidden border-t border-white/[0.08] lg:block" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSection(id);
                          if (typeof window !== 'undefined' && window.scrollY > 80) {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors lg:w-full ${
                          active
                            ? 'bg-white/[0.08] font-bold text-white'
                            : 'font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-[#FF6D2E]' : 'text-zinc-500'} />
                        <span>{label}</span>
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={logout}
                  className="hidden w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 lg:flex"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* RIGHT CONTENT AREA (Consistent min-height prevents layout/scroll jump between tabs) */}
          <div className="min-h-[680px] min-w-0 flex-1">
            {/* ==================== TAB: OVERVIEW ==================== */}
            {section === 'overview' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Account
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">Membership details</p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414]">
                    <div className="px-5 py-5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-3 py-1 text-[11px] font-bold text-white">
                        <Crown size={12} />
                        {isVip ? planLimits?.planName || profile?.package_name || 'VIP Member' : 'Free Member'}
                      </span>

                      <h3 className="mt-3 text-lg font-bold text-white">
                        {isVip ? 'Active Subscription Plan' : 'Upgrade for Ad-Free 4K Streaming'}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-400">
                        {profile?.email || profile?.mobile_number || displayName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSection('membership')}
                      className="flex w-full items-center justify-between border-t border-white/[0.08] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.04]"
                    >
                      <span>{isVip ? 'Manage membership' : 'View subscription plans'}</span>
                      <ChevronRight size={18} className="text-zinc-500" />
                    </button>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-zinc-400">Quick links</h2>

                  <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setSection('library')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                          <Bookmark size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">My List &amp; History</p>
                          <p className="text-xs text-zinc-400">
                            {bookmarks.length} saved • {cw.length} in progress
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSection('devices')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                          <MonitorSmartphone size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Manage access and devices</p>
                          <p className="text-xs text-zinc-400">
                            {usage?.activeDevicesCount ?? devices.length} active devices connected
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSection('security')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                          <Shield size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Security &amp; parental controls</p>
                          <p className="text-xs text-zinc-400">Kids mode &amp; active session management</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </button>

                    <Link
                      href={userPageHref(user, 'notifications')}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                          <Bell size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Notifications</p>
                          <p className="text-xs text-zinc-400">New releases &amp; account alerts</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </Link>

                    <Link
                      href={userPageHref(user, 'referandearn')}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-300">
                          <Gift size={18} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Refer &amp; Earn</p>
                          <p className="text-xs text-zinc-400">Invite friends and earn rewards</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: MEMBERSHIP ==================== */}
            {section === 'membership' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Membership
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">Plan details &amp; streaming limits</p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    <div className="px-5 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-3 py-1 text-[11px] font-bold text-white">
                            <Crown size={12} />
                            {planLimits?.planName || (isVip ? profile?.package_name || 'VIP Plan' : 'Free Plan')}
                          </span>
                          <p className="mt-2.5 text-sm text-zinc-300">
                            Status:{' '}
                            <span className="font-bold text-white">
                              {planLimits?.planStatus || (isVip ? 'ACTIVE' : 'FREE')}
                            </span>
                            {planLimits?.expiresAt && (
                              <span className="text-zinc-400">
                                {' '}
                                • Renews / expires {new Date(planLimits.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {planLimits && (
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[11px] text-zinc-400">Max Devices</p>
                            <p className="mt-1 text-lg font-black text-white">{planLimits.maxDevices ?? 1}</p>
                          </div>
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[11px] text-zinc-400">Streams</p>
                            <p className="mt-1 text-lg font-black text-white">{planLimits.maxConcurrentStreams ?? 1}</p>
                          </div>
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[11px] text-zinc-400">Profiles</p>
                            <p className="mt-1 text-lg font-black text-white">{planLimits.maxProfiles ?? 1}</p>
                          </div>
                          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                            <p className="text-[11px] text-zinc-400">Quality</p>
                            <p className="mt-1 text-lg font-black text-[#FF8A54]">{planLimits.maxResolution || 'HD'}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Link
                      href={userPageHref(user, 'subscription')}
                      className="flex items-center justify-between px-5 py-4 text-sm font-bold text-white transition-colors hover:bg-white/[0.04]"
                    >
                      <span>{isVip ? 'Change or renew plan' : 'Upgrade to VIP'}</span>
                      <ChevronRight size={18} className="text-[#FF6D2E]" />
                    </Link>

                    <Link
                      href={userPageHref(user, 'store')}
                      className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <KeyRound size={16} className="text-zinc-400" />
                        My Rentals ({rentals.length})
                      </span>
                      <ChevronRight size={18} className="text-zinc-500" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: SECURITY ==================== */}
            {section === 'security' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Security
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Account details, parental controls &amp; session security
                  </p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    {/* Kids Safe Mode Toggle */}
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                          <ShieldAlert size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Kids Safe Mode</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Restrict catalog to family-friendly &amp; kids titles
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isKidsMode;
                          setIsKidsMode(next);
                          kidsMut.mutate({ user_id: user?.id, is_kids_profile: next ? 1 : 0 });
                          showToast({
                            title: next ? 'Kids Mode Enabled' : 'Kids Mode Disabled',
                            message: next
                              ? 'Showing family-friendly catalog.'
                              : 'Full catalog restored.',
                            variant: 'info',
                          });
                        }}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          isKidsMode ? 'bg-[#FF6D2E]' : 'bg-white/20'
                        }`}
                        aria-label="Toggle Kids Safe Mode"
                      >
                        <span
                          className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                            isKidsMode ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Log out other devices */}
                    <button
                      type="button"
                      disabled={loggingOutOthers}
                      onClick={handleLogoutOthers}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-60"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                          <LogOut size={19} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Sign out of all other devices</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            End active playback sessions on phones, browsers, and TVs
                          </p>
                        </div>
                      </div>
                      {loggingOutOthers ? (
                        <Loader2 size={18} className="animate-spin text-[#FF6D2E]" />
                      ) : (
                        <ChevronRight size={18} className="text-zinc-500" />
                      )}
                    </button>

                    <Link
                      href={userPageHref(user, 'settings')}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                          <ShieldCheck size={19} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Advanced account settings</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Full playback, language &amp; privacy preferences
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-zinc-500" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: DEVICES ==================== */}
            {section === 'devices' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Devices
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Manage signed-in browsers, phones &amp; Smart TVs
                  </p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    {devicesQ.isLoading ? (
                      <div className="flex items-center justify-center gap-2 px-5 py-10 text-xs text-zinc-400">
                        <Loader2 size={16} className="animate-spin text-[#FF6D2E]" />
                        Loading connected devices...
                      </div>
                    ) : devices.length === 0 ? (
                      <div className="px-5 py-10 text-center text-xs text-zinc-400">
                        No registered devices found yet.
                      </div>
                    ) : (
                      devices.map((dev) => {
                        const dt = String(dev.deviceType || dev.platform || '').toUpperCase();
                        const Icon = dt.includes('TV')
                          ? Tv
                          : dt.includes('MOBILE') || dt.includes('ANDROID') || dt.includes('IOS')
                          ? Smartphone
                          : Laptop;
                        return (
                          <div
                            key={dev.id ?? dev.deviceId}
                            className="flex items-center justify-between gap-4 px-5 py-4"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                                <Icon size={19} />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-bold text-white">
                                    {dev.deviceName || dev.platform || 'Connected Device'}
                                  </p>
                                  {dev.isStreaming && (
                                    <span className="rounded bg-[#FF6D2E]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8A54]">
                                      Streaming Now
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-zinc-400">
                                  {dev.platform || dev.deviceType || 'Web'}
                                  {dev.lastActiveAt
                                    ? ` • Active ${new Date(dev.lastActiveAt).toLocaleDateString()}`
                                    : ''}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={loggingOutId === dev.deviceId}
                              onClick={() => handleRemoveDevice(dev.deviceId)}
                              className="shrink-0 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                            >
                              {loggingOutId === dev.deviceId ? 'Signing out...' : 'Sign Out'}
                            </button>
                          </div>
                        );
                      })
                    )}

                    {devices.length > 1 && (
                      <div className="px-5 py-4">
                        <button
                          type="button"
                          disabled={loggingOutOthers}
                          onClick={handleLogoutOthers}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.08] text-xs font-bold text-white transition hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50"
                        >
                          <LogOut size={14} />
                          <span>{loggingOutOthers ? 'Signing out...' : 'Sign Out All Other Devices'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: PROFILES (Exact Netflix Reference Layout) ==================== */}
            {section === 'profiles' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Profiles
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Parental controls and permissions
                  </p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setSection('security')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                          <ShieldAlert size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Adjust parental controls</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Set maturity ratings, kids lock &amp; viewing PIN
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSection('tvactivate')}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-200">
                          <Tv size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">Link a Smart TV</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Activate your TV with a 6-digit login code
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
                    </button>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-zinc-400">Profile settings</h2>

                  <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
                    <Link
                      href={userPageHref(user, 'editprofile')}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
                          {showPhoto ? (
                            <img
                              src={rawAvatar}
                              alt={displayName}
                              onError={() => setAvatarFailed(true)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#FF6D2E] to-[#FF5500] text-base font-black text-white">
                              {initial}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{displayName}</p>
                          <p className="truncate text-xs text-zinc-400">
                            {profile?.email || profile?.mobile_number || 'Edit avatar & personal details'}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded bg-[#FF6D2E]/15 px-2.5 py-1 text-[11px] font-bold text-[#FF8A54] ring-1 ring-[#FF6D2E]/30">
                          Now watching
                        </span>
                        <ChevronRight size={18} className="text-zinc-500" />
                      </div>
                    </Link>

                    <div className="px-5 py-4">
                      <Link
                        href={userPageHref(user, 'editprofile')}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.08] text-sm font-bold text-white transition-colors hover:bg-white/[0.14]"
                      >
                        <Edit3 size={15} />
                        <span>Edit Profile &amp; Photo</span>
                      </Link>
                      <p className="mt-2.5 text-center text-xs text-zinc-500">
                        Manage your profile picture, display name, and account preferences.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB: MY LIST & HISTORY ==================== */}
            {section === 'library' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    My List &amp; History
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Your continue watching, saved titles, and rentals
                  </p>
                </div>

                {cw.length > 0 && (
                  <div className="-mx-4 sm:-mx-6 lg:-mx-12">
                    <ContentRail
                      title="Continue Watching"
                      items={cw}
                      landscape
                      resume
                      seeAllHref={userPageHref(user, 'continuewatching')}
                    />
                  </div>
                )}

                {bookmarks.length > 0 && (
                  <div className="-mx-4 sm:-mx-6 lg:-mx-12">
                    <ContentRail
                      title="My List"
                      items={bookmarks}
                      seeAllHref={userPageHref(user, 'watchlist')}
                    />
                  </div>
                )}

                {rentals.length > 0 && (
                  <div className="-mx-4 sm:-mx-6 lg:-mx-12">
                    <ContentRail
                      title="My Rentals"
                      items={rentals}
                      seeAllHref={userPageHref(user, 'store')}
                    />
                  </div>
                )}

                {!hasLibrary && !cwQ.isLoading && !bookmarksQ.isLoading && !rentalsQ.isLoading && (
                  <div className="max-w-[740px] rounded-xl border border-white/[0.1] bg-[#141414] px-6 py-12 text-center">
                    <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF8A54]">
                      <Play size={20} />
                    </div>
                    <h3 className="text-base font-bold text-white">Your library is empty</h3>
                    <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
                      Watch a title or tap + My List on any movie or show to see it here.
                    </p>
                    <Link
                      href="/"
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
                    >
                      <Film size={14} />
                      <span>Browse Catalog</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB: ACTIVATE SMART TV ==================== */}
            {section === 'tvactivate' && (
              <div className="max-w-[740px] space-y-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Activate Smart TV
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Enter the 6-character code displayed on your TV screen
                  </p>

                  <form
                    onSubmit={handleActivateTv}
                    className="mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] p-6"
                  >
                    <label htmlFor="tv-code-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                      TV Activation Code
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        id="tv-code-input"
                        type="text"
                        maxLength={8}
                        value={tvCode}
                        onChange={(e) => setTvCode(e.target.value.toUpperCase())}
                        placeholder="e.g. A7K9P2"
                        className="h-12 flex-1 rounded-lg border border-white/15 bg-[#0A0A0A] px-4 text-center font-mono text-lg font-black tracking-[0.35em] text-white placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-zinc-500 focus:border-[#FF6D2E] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={tvActivating}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-sm font-bold text-white shadow-[0_6px_20px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:opacity-60"
                      >
                        {tvActivating ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        <span>{tvActivating ? 'Activating...' : 'Link TV'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
