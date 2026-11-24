'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { avatarUrl, getUserToken, queryKeys } from '@ott/shared';
import { PageShell } from '@/components/layout/PageChrome';
import { showToast } from '@/components/ui/ToastHost';
import { setStoredUser, useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { ArrowLeft, Camera, CheckCircle2, Loader2, Lock, Mail, Phone, Trash2, User } from 'lucide-react';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfilePage() {
  const queryClient = useQueryClient();
  const { user, isLoggedIn } = useStoredUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.mobile_number ?? '');
    setAvatarFailed(false);
  }, [user?.full_name, user?.email, user?.mobile_number, user?.image]);

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextImage = e.target.files?.[0] ?? null;
    setMessage('');
    setError('');

    if (!nextImage) {
      setImage(null);
      return;
    }
    if (!ACCEPTED_PROFILE_IMAGE_TYPES.includes(nextImage.type)) {
      e.target.value = '';
      setImage(null);
      setError('Choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (nextImage.size > MAX_PROFILE_IMAGE_BYTES) {
      e.target.value = '';
      setImage(null);
      setError('Profile image must be 5 MB or smaller.');
      return;
    }

    setAvatarFailed(false);
    setImage(nextImage);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setMessage('');
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      const token = getUserToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
        : {};

      let uploadedAvatarUrl: string | undefined;

      // 1. Upload profile photo first via dedicated multipart avatar endpoint
      if (image) {
        const fd = new FormData();
        fd.append('file', image);
        const uploadRes = await fetch('/api/v1/profile/avatar', {
          method: 'POST',
          headers: authHeader,
          body: fd,
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadJson?.message || uploadJson?.error || 'Failed to upload profile photo.');
        }
        uploadedAvatarUrl =
          uploadJson?.data?.avatarUrl ||
          uploadJson?.data?.image ||
          uploadJson?.result?.avatarUrl ||
          uploadJson?.avatarUrl;
      }

      // 2. Update name & email via JSON profile endpoint
      const profileRes = await fetch('/api/v1/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          fullName: name.trim(),
          email: cleanEmail,
          ...(uploadedAvatarUrl ? { avatarUrl: uploadedAvatarUrl } : {}),
        }),
      });
      const profileJson = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok) {
        throw new Error(profileJson?.message || profileJson?.error || 'Unable to update profile.');
      }

      const finalAvatar =
        uploadedAvatarUrl ||
        profileJson?.data?.avatarUrl ||
        profileJson?.result?.avatarUrl ||
        user.image;

      setStoredUser({
        ...user,
        full_name: name.trim(),
        email: cleanEmail,
        image: finalAvatar || '',
        avatarUrl: finalAvatar || '',
        auth_token: user.auth_token,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      setImage(null);
      setAvatarFailed(false);
      setMessage('Profile updated successfully.');
      showToast({
        title: 'Profile Saved',
        message: uploadedAvatarUrl
          ? 'Your profile details and photo have been updated.'
          : 'Your profile details have been updated.',
        variant: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update profile.';
      setError(msg);
      showToast({ title: 'Update Failed', message: msg, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.id) return;
    setError('');
    setMessage('');
    setRemovingPhoto(true);
    try {
      const token = getUserToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
        : {};
      const res = await fetch('/api/v1/profile/avatar', {
        method: 'DELETE',
        headers: authHeader,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || 'Unable to remove profile photo.');
      }
      setImage(null);
      setImagePreview('');
      setAvatarFailed(false);
      setStoredUser({
        ...user,
        image: '',
        avatarUrl: '',
        auth_token: user.auth_token,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      setMessage('Profile photo removed.');
      showToast({
        title: 'Photo Removed',
        message: 'Your profile picture has been removed.',
        variant: 'info',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to remove profile photo.';
      setError(msg);
      showToast({ title: 'Remove Failed', message: msg, variant: 'error' });
    } finally {
      setRemovingPhoto(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <PageShell className="grid min-h-[calc(100vh-5rem)] place-items-center">
        <div className="mx-auto max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-black text-white">Sign in to Edit Profile</h2>
          <p className="mt-2 text-sm text-zinc-400">Please sign in before editing profile details.</p>
          <Link
            href="/login?redirect=/editprofile"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-sm font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110"
          >
            Sign In
          </Link>
        </div>
      </PageShell>
    );
  }

  const displayName = name.trim() || user?.full_name || user?.email?.split('@')[0] || 'Member';
  const initial = displayName.charAt(0).toUpperCase();
  const savedAvatar = user?.image ? avatarUrl(user.image) : '';
  const activePhotoSrc = imagePreview || (!avatarFailed && user?.image ? savedAvatar : '');
  const inputClass =
    'h-12 w-full rounded-md border border-white/15 bg-[#181818] px-4 text-sm font-medium text-white placeholder:text-zinc-500 transition focus:border-[#FF6D2E] focus:outline-none focus:ring-1 focus:ring-[#FF6D2E]/40';

  return (
    <PageShell className="pb-24 pt-4">
      <div className="mx-auto max-w-[740px]">
        <Link
          href={userPageHref(user, 'myspace')}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          <span>Back to My Space</span>
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Edit Profile</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Update your profile picture, display name, and contact email.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] p-6 sm:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Row */}
            <div className="flex flex-col items-center gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center">
              <label className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-2 ring-white/15 transition hover:ring-[#FF6D2E]">
                {activePhotoSrc ? (
                  <img
                    src={activePhotoSrc}
                    alt={displayName}
                    onError={() => setAvatarFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#FF6D2E] to-[#FF5500] text-3xl font-black text-white">
                    {initial}
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera size={22} className="text-white" />
                </div>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>

              <div className="flex-1 text-center sm:text-left">
                <p className="text-base font-bold text-white">{displayName}</p>
                <p className="mt-0.5 text-xs text-zinc-400">JPG, PNG, or WEBP up to 5 MB</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-white/[0.07] px-4 text-xs font-semibold text-white transition hover:border-[#FF6D2E]/70 hover:bg-white/[0.12]">
                    <Camera size={14} className="text-[#FF8A54]" />
                    {activePhotoSrc ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                  {image && (
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-zinc-400 transition hover:text-white"
                    >
                      Discard
                    </button>
                  )}
                  {!image && Boolean(user?.image) && (
                    <button
                      type="button"
                      disabled={removingPhoto}
                      onClick={handleRemovePhoto}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-3.5 text-xs font-semibold text-red-400 transition hover:border-red-500/45 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      {removingPhoto ? 'Removing...' : 'Remove Photo'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <User size={13} className="text-zinc-500" />
                  Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Mail size={13} className="text-zinc-500" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-zinc-500" />
                  Mobile Number
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  <Lock size={10} /> Locked
                </span>
              </label>
              <input
                type="tel"
                value={phone}
                disabled
                readOnly
                className="h-12 w-full cursor-not-allowed rounded-md border border-white/10 bg-[#0A0A0A] px-4 text-sm font-medium text-zinc-400"
                title="Mobile phone number cannot be modified once registered"
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Registered mobile number cannot be changed.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-4 py-2.5 text-xs font-medium text-[#FFB088]">
                {error}
              </div>
            )}
            {message && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 size={15} />
                <span>{message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href={userPageHref(user, 'myspace')}
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-6 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.12]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-8 text-xs font-bold text-white shadow-[0_6px_20px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
