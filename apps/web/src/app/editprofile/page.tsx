'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { avatarUrl, useUpdateProfile } from '@ott/shared';
import { GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import { setStoredUser, useStoredUser } from '@/lib/auth';
import { Camera, UserCog } from 'lucide-react';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfilePage() {
  const updateMut = useUpdateProfile();
  const { user, isLoggedIn } = useStoredUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.mobile_number ?? '');
  }, [user?.full_name, user?.email, user?.mobile_number]);

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

    try {
      const payload = new FormData();
      payload.append('user_id', String(user.id));
      payload.append('full_name', name.trim());
      payload.append('email', cleanEmail);
      payload.append('mobile_number', phone.trim());
      if (image) {
        payload.append('image_type', '1');
        payload.append('image', image);
      }

      const res = await updateMut.mutateAsync(payload);
      const updated = res.result?.[0];
      setStoredUser({
        ...user,
        ...(updated ?? {}),
        full_name: name.trim(),
        email: cleanEmail,
        auth_token: user.auth_token,
      });
      setImage(null);
      setMessage(res.message || 'Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    }
  };

  if (!isLoggedIn) {
    return (
      <PageShell narrow>
        <PageHero backHref="/profile" eyebrow="Profile" title="Edit Profile" description="Sign in to update your profile." icon={UserCog} />
        <GlassPanel>
          <p className="mb-4 text-sm text-desc-text">Please sign in before editing profile details.</p>
          <Link href="/login" className="btn-primary inline-flex rounded-full px-6 py-3 text-sm">
            Sign In
          </Link>
        </GlassPanel>
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHero backHref="/profile" eyebrow="Profile" title="Edit Profile" description="Keep your account identity fresh and ready across screens." icon={UserCog} />
      <GlassPanel>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col items-center gap-3 pb-3">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/5">
              <img
                src={imagePreview || avatarUrl(user?.image)}
                alt={name.trim() || 'Profile image'}
                className="h-full w-full object-cover"
              />
            </div>
            <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm">
              <Camera size={16} />
              Upload Profile Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
            <p className="text-center text-xs text-muted-text">JPG, PNG, or WEBP. Maximum size 5 MB.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-desc-text">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ott-input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-desc-text">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ott-input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-desc-text">Mobile Phone Number (Locked)</label>
            <input
              type="tel"
              value={phone}
              disabled
              readOnly
              className="ott-input opacity-60 cursor-not-allowed bg-white/5"
              title="Mobile phone number cannot be modified once registered"
            />
            <p className="mt-1 text-xs text-muted-text">Mobile phone number cannot be changed once registered.</p>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <button type="submit" disabled={updateMut.isPending} className="btn-primary w-full rounded-full py-3 text-sm disabled:opacity-50">
            {updateMut.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </GlassPanel>
    </PageShell>
  );
}
