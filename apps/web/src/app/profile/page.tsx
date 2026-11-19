'use client';

import Link from 'next/link';
import { User, Edit, Crown, LogOut, AlertCircle } from 'lucide-react';
import { avatarUrl, useProfile } from '@ott/shared';
import { clearStoredUser, useStoredUser } from '@/lib/auth';
import { GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';

export default function ProfilePage() {
  const { user, isLoggedIn } = useStoredUser();
  const profileQ = useProfile(user?.id);
  const profile = profileQ.data?.result?.[0] ?? user;

  const missingList: string[] = [];
  if (!profile?.full_name || profile?.full_name === 'Guest User' || profile?.full_name === 'Subscriber') missingList.push('Full Legal Name');
  if (!profile?.email) missingList.push('Email Address');
  if (!profile?.date_of_birth && !profile?.dateOfBirth && !profile?.dob) missingList.push('Date of Birth');
  if (!profile?.profession) missingList.push('Profession');
  if (!profile?.pincode && !(profile as any)?.pin_code) missingList.push('Area Pincode');

  const isProfileIncomplete = missingList.length > 0;

  return (
    <PageShell narrow>
      <PageHero eyebrow="Account" title="Profile" description="Your MaxxPixels identity, plan, and account actions." icon={User} />

      {isLoggedIn && isProfileIncomplete && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 backdrop-blur-xl shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-amber-300 text-sm">Action Required: Complete Your Profile Data</h4>
                <p className="mt-1 text-xs text-amber-200/80">
                  Missing required fields: <strong className="text-white">{missingList.join(', ')}</strong>. Please update your profile to keep your account secure.
                </p>
              </div>
            </div>
            <Link href="/editprofile" className="btn-primary flex-shrink-0 rounded-full px-5 py-2.5 text-xs font-bold shadow-md">
              Update Missing Details
            </Link>
          </div>
        </div>
      )}

      <GlassPanel className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-24 w-24 flex-shrink-0 place-items-center overflow-hidden rounded-[2rem] bg-gold/15 text-gold ring-1 ring-gold/25">
          {profile?.image ? (
            <img src={avatarUrl(profile.image)} alt={profile.full_name ?? 'User'} className="h-full w-full object-cover" />
          ) : (
            <User size={38} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-black text-white">{profile?.full_name || 'Guest User'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-desc-text">
            {profile?.email && <span>{profile.email}</span>}
            {profile?.mobile_number && <span>• {profile.mobile_number}</span>}
            {(profile?.date_of_birth || profile?.dateOfBirth || profile?.dob) && (
              <span>• DOB: {profile.date_of_birth || profile.dateOfBirth || profile.dob}</span>
            )}
            {profile?.profession && <span>• {profile.profession}</span>}
            {(profile?.pincode || profile?.pin_code) && <span>• PIN: {profile.pincode || profile.pin_code}</span>}
          </div>
          {profile?.is_buy === 1 && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-black text-gold">
              <Crown size={13} />
              Premium
            </span>
          )}
        </div>
        <Link href="/editprofile" className="btn-secondary rounded-full px-5 py-3 text-sm">
          <Edit size={16} />
          Edit Profile
        </Link>
      </GlassPanel>

      <GlassPanel className="mb-6">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-black text-white">
          <Crown size={20} className="text-gold" />
          Subscription
        </h3>
        <p className="text-sm text-desc-text">
          {profile?.is_buy === 1 ? (profile.package_name || 'Active plan') : 'No active plan'}
        </p>
        <Link href="/subscription" className="btn-primary mt-5 rounded-full px-6 py-3 text-sm">
          {user?.is_buy === 1 ? 'Manage Plan' : 'Subscribe Now'}
        </Link>
      </GlassPanel>

      {isLoggedIn ? (
        <button onClick={clearStoredUser} className="btn-secondary w-full rounded-full py-3 text-sm">
          <LogOut size={16} />
          Sign Out
        </button>
      ) : (
        <Link href="/login" className="btn-primary block w-full rounded-full py-3 text-center text-sm">
          Sign In
        </Link>
      )}
    </PageShell>
  );
}
