'use client';

import { useNotifications, useReadNotification, resolveImageUrl, getContentUrl } from '@ott/shared';
import type { Notification } from '@ott/shared';
import Link from 'next/link';
import { Bell, Lock } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { enableWebPushNotifications } from '@/providers/OneSignalProvider';
import { useState } from 'react';

export default function NotificationsPage() {
  const { user, session, isLoggedIn } = useStoredUser();
  const notifsQ = useNotifications(session);
  const readMut = useReadNotification();
  const notifications = (notifsQ.data?.result ?? []) as Notification[];
  const [pushMessage, setPushMessage] = useState('');

  const enablePush = async () => {
    try {
      const enabled = await enableWebPushNotifications();
      setPushMessage(enabled ? 'Browser push notifications are enabled.' : 'Notification permission was not granted.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'Unable to enable browser notifications.');
    }
  };

  return (
    <PageShell narrow>
      <PageHero eyebrow="Alerts" title="Notifications" description="Updates, releases, reminders, and account messages in one place." icon={Bell} />

      {isLoggedIn && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <button type="button" onClick={enablePush} className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold">
            Enable Browser Push
          </button>
          {pushMessage && <p className="mt-3 text-xs text-desc-text">{pushMessage}</p>}
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.video_id ? getContentUrl({ id: n.video_id, video_id: n.video_id, video_type: n.video_type, name: (n as any).title }) : '#'}
            onClick={() => {
              if (user?.id) {
                readMut.mutate({ user_id: user.id, notification_id: n.id });
              }
            }}
            className="flex gap-4 rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4 shadow-card backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-gold/35 hover:bg-white/10"
          >
            {n.image ? (
              <img src={resolveImageUrl(n.image)} alt="" className="h-16 w-16 flex-shrink-0 rounded-2xl bg-shimmer object-cover" />
            ) : (
              <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
                <Bell size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{n.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-desc-text">{n.message}</p>
              <p className="mt-2 text-[11px] text-muted-text">{n.created_at}</p>
            </div>
          </Link>
        ))}
      </div>

      {!isLoggedIn && !notifsQ.isLoading && (
        <EmptyState title="Sign in to view notifications" description="We will keep release updates and account alerts ready for you." actionHref="/login" actionLabel="Sign In" icon={Lock} />
      )}
      {isLoggedIn && notifications.length === 0 && !notifsQ.isLoading && (
        <EmptyState title="No notifications" description="You are all caught up." icon={Bell} />
      )}
    </PageShell>
  );
}
