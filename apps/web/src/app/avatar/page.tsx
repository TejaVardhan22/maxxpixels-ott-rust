'use client';

import { useAvatars, useUpdateProfile, resolveImageUrl } from '@ott/shared';
import type { Avatar } from '@ott/shared';
import { Check, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStoredUser, setStoredUser } from '@/lib/auth';
import { PageHero, PageShell } from '@/components/layout/PageChrome';

export default function AvatarPage() {
  const router = useRouter();
  const { user } = useStoredUser();
  const avatarsQ = useAvatars();
  const updateProfile = useUpdateProfile();
  const avatars = (avatarsQ.data?.result ?? []) as Avatar[];
  const [selected, setSelected] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (selected === null || !user?.id) return;
    setSaveError('');
    try {
      const res = await updateProfile.mutateAsync({
        user_id: user.id,
        image: String(selected),
        image_type: 2,
      });
      if (res.status === 200 && res.result?.[0]) {
        setStoredUser({ ...user, ...res.result[0], auth_token: user.auth_token });
        router.push('/editprofile');
      } else {
        setSaveError(res.message || 'Failed to save avatar.');
      }
    } catch {
      setSaveError('Something went wrong. Please try again.');
    }
  };

  return (
    <PageShell narrow>
      <PageHero backHref="/editprofile" backLabel="Back to Profile" eyebrow="Identity" title="Choose Avatar" description="Pick a profile face that feels at home in your watch space." icon={UserCircle} />
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-5 md:grid-cols-6">
        {avatars.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id ?? null)}
            className={`relative aspect-square overflow-hidden rounded-[1.35rem] border-2 transition-all ${
              selected === a.id ? 'scale-110 border-gold shadow-glow' : 'border-white/10 hover:border-gold/40'
            }`}
          >
            <img src={resolveImageUrl(a.image)} alt="" className="h-full w-full object-cover" />
            {selected === a.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-gold/30">
                <Check size={24} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="mt-8 text-center">
          {saveError && <p className="mb-3 text-sm text-accent">{saveError}</p>}
          <button onClick={handleSave} disabled={updateProfile.isPending} className="btn-primary rounded-full px-8 py-3 text-sm disabled:opacity-50">
            {updateProfile.isPending ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      )}
    </PageShell>
  );
}
