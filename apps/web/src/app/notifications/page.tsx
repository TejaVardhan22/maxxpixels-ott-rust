'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, BellRing, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import {
  useNotifications,
  useReadNotification,
  resolveImageUrl,
  getContentUrl,
} from '@ott/shared';
import type { Notification } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { PageShell } from '@/components/layout/PageChrome';
import { enableWebPushNotifications } from '@/providers/OneSignalProvider';

export default function NotificationsPage() {
  const { user, session, isLoggedIn } = useStoredUser();
  const notifsQ = useNotifications(session);
  const readMut = useReadNotification();
  const notifications = ((notifsQ.data as any)?.result ?? (notifsQ.data as any)?.data ?? []) as Notification[];
  const [pushStatus, setPushStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);

  const enablePush = async () => {
    setEnablingPush(true);
    setPushStatus(null);
    try {
      const enabled = await enableWebPushNotifications();
      setPushStatus({
        ok: enabled,
        text: enabled
          ? 'Browser push notifications are enabled.'
          : 'Notification permission was not granted.',
      });
    } catch (error) {
      setPushStatus({
        ok: false,
        text: error instanceof Error ? error.message : 'Unable to enable browser notifications.',
      });
    } finally {
      setEnablingPush(false);
    }
  };

  if (!isLoggedIn && !notifsQ.isLoading) {
    return (
      <PageShell className="grid min-h-[calc(100vh-5rem)] place-items-center">
        <div className="mx-auto max-w-md rounded-xl border border-white/[0.1] bg-[#141414] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6D2E]/15 text-[#FF6D2E]">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-black text-white">Sign in to Notifications</h2>
          <p className="mt-2 text-sm text-zinc-400">
            We will keep release updates and account alerts ready for you.
          </p>
          <Link
            href="/login?redirect=/notifications"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-sm font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110"
          >
            Sign In
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-24 pt-4">
      <div className="mx-auto max-w-[760px]">
        <Link
          href={userPageHref(user, 'myspace')}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          <span>Back to My Space</span>
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Notifications</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          New releases, reminders, and account updates
        </p>

        {/* Push Notifications Card */}
        {isLoggedIn && (
          <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[#FF8A54]">
                  <BellRing size={19} />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Browser Push Alerts</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Get instant alerts for new releases and account activity.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={enablePush}
                disabled={enablingPush}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,109,46,0.35)] transition hover:brightness-110 disabled:opacity-50"
              >
                <Bell size={13} />
                <span>{enablingPush ? 'Enabling…' : 'Enable Push'}</span>
              </button>
            </div>

            {pushStatus && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-xs font-medium ${
                  pushStatus.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-[#0A0A0A] text-zinc-300'
                }`}
              >
                {pushStatus.ok && <CheckCircle2 size={14} />}
                <span>{pushStatus.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Netflix-Style Grouped Notifications List */}
        {notifications.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.1] bg-[#141414] divide-y divide-white/[0.08]">
            {notifications.map((n) => {
              const href = n.video_id
                ? getContentUrl({
                    id: n.video_id,
                    video_id: n.video_id,
                    video_type: n.video_type,
                    name: (n as any).title,
                  })
                : '#';
              const isUnread = Number((n as any).is_read ?? (n as any).read ?? 0) === 0;

              return (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => {
                    if (user?.id) {
                      readMut.mutate({ user_id: user.id, notification_id: n.id });
                    }
                  }}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                >
                  {n.image ? (
                    <img
                      src={resolveImageUrl(n.image)}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-md bg-[#0A0A0A] object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-28 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[#FF8A54]">
                      <Bell size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF6D2E]" />
                      )}
                      <p className="truncate text-sm font-bold text-white transition-colors group-hover:text-[#FF8A54]">
                        {n.title}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{n.message}</p>
                    {n.created_at && (
                      <p className="mt-1.5 text-[11px] text-zinc-500">{n.created_at}</p>
                    )}
                  </div>

                  {n.video_id && (
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {isLoggedIn && notifications.length === 0 && !notifsQ.isLoading && (
          <div className="mt-6 rounded-xl border border-white/[0.1] bg-[#141414] px-6 py-14 text-center">
            <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-zinc-400">
              <Bell size={22} />
            </div>
            <h3 className="text-base font-bold text-white">No notifications yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
              You are all caught up. New releases and account updates will appear here.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-xs font-bold text-white transition hover:brightness-110"
            >
              Browse Catalog
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
