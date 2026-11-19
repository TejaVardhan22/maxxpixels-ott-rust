'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  ChevronRight,
  Crown,
  Edit3,
  Film,
  Gift,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Phone,
  Play,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Tv,
  User,
  Zap,
} from 'lucide-react';
import {
  avatarUrl,
  useBookmarks,
  useContinueWatching,
  useProfile,
  useUserRentContent,
} from '@ott/shared';
import ContentRail from '@/components/home/ContentRail';
import { PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';

const settingsOptions = [
  {
    icon: Bookmark,
    title: 'My Watchlist',
    desc: 'Saved movies, series and shows',
    href: '/watchlist',
    badge: 'Saved',
    color: 'from-blue-600/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    icon: KeyRound,
    title: 'Rentals & Store',
    desc: 'Active movie rentals and purchases',
    href: '/store',
    badge: 'Store',
    color: 'from-amber-600/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  },
  {
    icon: Bell,
    title: 'Notifications & Alerts',
    desc: 'New releases and account activity',
    href: '/notifications',
    badge: 'Alerts',
    color: 'from-purple-600/20 to-pink-500/20 text-purple-400 border-purple-500/30',
  },
  {
    icon: Gift,
    title: 'Refer & Earn Rewards',
    desc: 'Invite friends and unlock free VIP days',
    href: '/referandearn',
    badge: 'Rewards',
    color: 'from-emerald-600/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: Tv,
    title: 'Activate Smart TV',
    desc: 'Pair code to watch on TV screens',
    href: '/tvactivate',
    badge: 'TV Sync',
    color: 'from-indigo-600/20 to-blue-500/20 text-indigo-400 border-indigo-500/30',
  },
  {
    icon: Settings,
    title: 'Account & Device Settings',
    desc: 'Manage logged-in devices and parental lock',
    href: '/settings',
    badge: 'Security',
    color: 'from-slate-600/20 to-gray-500/20 text-slate-300 border-slate-500/30',
  },
];

export default function MySpacePage() {
  const { user, session, isLoggedIn, logout } = useStoredUser();
  const profileQ = useProfile(user?.id);
  const bookmarksQ = useBookmarks(session);
  const cwQ = useContinueWatching(session);
  const rentalsQ = useUserRentContent(user?.id ?? 0);

  const [activeTab, setActiveTab] = useState<'all' | 'watchlist' | 'continue' | 'rentals'>('all');

  const profile = profileQ.data?.result?.[0] ?? user;
  const bookmarks = (bookmarksQ.data?.result ?? [])
    .filter((item) => Number(item.is_bookmark ?? 0) === 1)
    .map((item) => ({ ...item, stop_time: 0 }));
  const cw = cwQ.data?.result ?? [];
  const rentals = rentalsQ.data?.result ?? [];
  const hasLibrary = cw.length > 0 || bookmarks.length > 0 || rentals.length > 0;
  const isVip = profile?.is_buy === 1;

  if (!isLoggedIn) {
    return (
      <PageShell className="grid min-h-[calc(100vh-5rem)] place-items-center bg-[#06080E]">
        <div className="mx-auto max-w-md text-center p-8 rounded-3xl border border-white/10 bg-[#0C101A]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-[#E50914] to-red-600 text-white shadow-[0_0_30px_rgba(229,9,20,0.5)]">
            <Lock size={36} />
          </div>
          <h2 className="text-3xl font-black text-white">Sign in to My Space</h2>
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            Access your personalized watchlist, resume videos where you left off, and manage your 4K VIP subscription.
          </p>
          <Link
            href="/login?redirect=/myspace"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E50914] py-4 text-sm font-black text-white shadow-[0_0_20px_rgba(229,9,20,0.5)] transition hover:bg-red-600"
          >
            <ShieldCheck size={18} /> Sign In to Account
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-24 pt-2">
      {/* TOP PROFILE HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-r from-[#0E1320] via-[#0A0D17] to-[#06080E] p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        {/* Glow ambient background elements */}
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[#E50914]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          
          {/* USER PROFILE INFO */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl p-1 bg-gradient-to-tr from-[#E50914] via-amber-500 to-orange-500 shadow-[0_0_30px_rgba(229,9,20,0.4)]">
                <img
                  src={avatarUrl(profile?.image)}
                  alt={profile?.full_name ?? 'Profile'}
                  className="h-full w-full rounded-[22px] object-cover bg-[#090C15]"
                />
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#E50914] text-white shadow-lg border border-white/20">
                <Sparkles size={16} />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {profile?.full_name || 'MaxxPixels Subscriber'}
                </h1>
                {isVip ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-600/25 px-3.5 py-1 text-xs font-black text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                    <Crown size={14} className="text-amber-400 animate-pulse" /> 4K VIP MEMBER
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                    Free Member
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs font-bold text-white/70">
                {profile?.mobile_number && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
                    <Phone size={13} className="text-emerald-400" /> {profile.mobile_number}
                  </span>
                )}
                {profile?.email && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
                    <Mail size={13} className="text-cyan-400" /> {profile.email}
                  </span>
                )}
                {(profile?.date_of_birth || profile?.dateOfBirth || profile?.dob) && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
                    <Calendar size={13} className="text-amber-400" /> {profile.date_of_birth || profile.dateOfBirth || profile.dob}
                  </span>
                )}
                {profile?.profession && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
                    <Briefcase size={13} className="text-purple-400" /> {profile.profession}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS & VIP QUICK LINK */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/editprofile"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-xs font-black text-white transition hover:bg-white/20 hover:border-white/30 shadow-lg"
            >
              <Edit3 size={16} /> Edit Profile
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-xs font-black text-red-400 transition hover:bg-red-500/20"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* VIP SUBSCRIPTION HERO BANNER */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-900/25 p-6 shadow-[0_15px_40px_rgba(245,158,11,0.15)] backdrop-blur-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-600 text-black shadow-[0_0_25px_rgba(245,158,11,0.6)]">
              <Crown size={28} fill="currentColor" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">
                  {isVip ? profile?.package_name || 'VIP 4K Subscription Plan' : 'Unlock MaxxPixels VIP 4K'}
                </h2>
                <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {isVip ? 'ACTIVE' : 'UPGRADE'}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/60">
                {isVip
                  ? 'Unlimited 4K Ultra HD streaming, multi-screen access, and offline downloads enabled.'
                  : 'Stream thousands of blockbuster movies, web series, and live sports in 4K.'}
              </p>
            </div>
          </div>

          <Link
            href="/subscription"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-600 px-6 py-3.5 text-xs font-black text-black shadow-[0_0_25px_rgba(245,158,11,0.5)] transition hover:scale-[1.02]"
          >
            <Zap size={16} fill="currentColor" />
            <span>{isVip ? 'Manage Subscription' : 'Upgrade to VIP'}</span>
          </Link>
        </div>
      </div>

      {/* QUICK STATS METRIC TILES */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`group rounded-3xl border p-5 text-left transition-all duration-200 shadow-xl ${
            activeTab === 'watchlist'
              ? 'border-cyan-500/50 bg-[#0C1220] shadow-[0_0_20px_rgba(6,182,212,0.2)]'
              : 'border-white/10 bg-[#0C101A]/80 hover:border-white/20 hover:bg-[#0E1422]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-white/60">Saved Watchlist</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Bookmark size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{bookmarks.length}</p>
        </button>

        <button
          onClick={() => setActiveTab('continue')}
          className={`group rounded-3xl border p-5 text-left transition-all duration-200 shadow-xl ${
            activeTab === 'continue'
              ? 'border-primary/50 bg-[#160A10] shadow-[0_0_20px_rgba(229,9,20,0.2)]'
              : 'border-white/10 bg-[#0C101A]/80 hover:border-white/20 hover:bg-[#0E1422]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-white/60">In Progress</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{cw.length}</p>
        </button>

        <button
          onClick={() => setActiveTab('rentals')}
          className={`group rounded-3xl border p-5 text-left transition-all duration-200 shadow-xl ${
            activeTab === 'rentals'
              ? 'border-amber-500/50 bg-[#18120A] shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'border-white/10 bg-[#0C101A]/80 hover:border-white/20 hover:bg-[#0E1422]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-white/60">Rentals &amp; Pass</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <KeyRound size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{rentals.length}</p>
        </button>
      </div>

      {/* FILTER TAB BAR */}
      <div className="mt-10 flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none">
        {[
          { id: 'all', label: 'All Shelves', icon: Sparkles },
          { id: 'watchlist', label: `Watchlist (${bookmarks.length})`, icon: Bookmark },
          { id: 'continue', label: `Continue Watching (${cw.length})`, icon: Play },
          { id: 'rentals', label: `Rentals (${rentals.length})`, icon: KeyRound },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black transition-all ${
              activeTab === id
                ? 'bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.5)]'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* CONTINUE WATCHING SHELF */}
      {(activeTab === 'all' || activeTab === 'continue') && cw.length > 0 && (
        <div className="mt-6 -mx-4 sm:-mx-6 lg:-mx-12">
          <ContentRail title="Continue Watching" items={cw} landscape resume seeAllHref="/continuewatching" />
        </div>
      )}

      {/* WATCHLIST SHELF */}
      {(activeTab === 'all' || activeTab === 'watchlist') && bookmarks.length > 0 && (
        <div className="mt-6 -mx-4 sm:-mx-6 lg:-mx-12">
          <ContentRail title="My Watchlist" items={bookmarks} seeAllHref="/watchlist" />
        </div>
      )}

      {/* RENTALS SHELF */}
      {(activeTab === 'all' || activeTab === 'rentals') && rentals.length > 0 && (
        <div className="mt-6 -mx-4 sm:-mx-6 lg:-mx-12">
          <ContentRail title="My Rentals" items={rentals} seeAllHref="/store" />
        </div>
      )}

      {/* EMPTY SHELF PLACEHOLDER */}
      {!hasLibrary && !cwQ.isLoading && !bookmarksQ.isLoading && !rentalsQ.isLoading && (
        <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-[#0C101A] to-[#06080E] p-10 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E50914]/15 text-[#E50914] border border-[#E50914]/30 shadow-[0_0_25px_rgba(229,9,20,0.3)]">
            <Bookmark size={36} />
          </div>
          <h3 className="text-2xl font-black text-white">Your Personal Space is Ready</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-white/60 leading-relaxed">
            Start streaming movies, web series, or save titles to your watchlist. Your personalized shelves will appear here automatically!
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#E50914] px-6 py-3.5 text-xs font-black text-white shadow-[0_0_20px_rgba(229,9,20,0.5)] transition hover:bg-red-600"
            >
              <Film size={16} /> Browse Movies &amp; Shows
            </Link>
            <Link
              href="/?type=3"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-xs font-extrabold text-white transition hover:bg-white/10"
            >
              <Tv size={16} /> Watch Live TV
            </Link>
          </div>
        </div>
      )}

      {/* ACCOUNT & PREFERENCES GRID */}
      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Account &amp; Services</h2>
            <p className="text-xs text-white/50 mt-0.5">Manage your preferences, rewards, and paired devices</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsOptions.map(({ icon: Icon, title, desc, href, badge, color }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex items-center gap-4 rounded-3xl border border-white/10 bg-[#0C101A]/80 p-5 transition-all duration-200 hover:border-white/25 hover:bg-[#101624] shadow-xl"
            >
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color} border shadow-md`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="block text-sm font-black text-white group-hover:text-primary-light transition-colors">
                    {title}
                  </span>
                </div>
                <span className="block truncate text-xs text-white/45 mt-1">{desc}</span>
              </div>
              <ChevronRight size={18} className="text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
