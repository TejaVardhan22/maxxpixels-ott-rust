'use client';

import { useNotifications, useReadNotification } from '@ott/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStoredUser } from '@/lib/auth';

export default function StreamNotificationsPage() {
  const { session, isLoggedIn, user } = useStoredUser();
  const notificationsQ = useNotifications(session);
  const readMut = useReadNotification();
  const notifications = notificationsQ.data?.result ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-desc-text">Live updates from the MaxxPixels backend.</p>

      {!isLoggedIn && (
        <Card className="mt-6 border-white/10 bg-white/[0.03]">
          <CardContent className="p-6 text-center text-sm text-desc-text">Sign in to view notifications.</CardContent>
        </Card>
      )}

      {isLoggedIn && (
        <div className="mt-6 space-y-3">
          {notificationsQ.isLoading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
          {!notificationsQ.isLoading && notifications.length === 0 && (
            <Card className="border-white/10 bg-white/[0.03]">
              <CardContent className="p-6 text-center text-sm text-desc-text">No notifications yet.</CardContent>
            </Card>
          )}
          {notifications.map((n) => (
            <Card key={String(n.id ?? n.title)} className="border-primary/20 bg-primary/[0.045]">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base font-semibold">{String(n.title ?? 'Notification')}</CardTitle>
                <Badge variant="default" className="shrink-0 text-[10px]">
                  {String(n.type ?? 'update')}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-body-text">{String(n.message ?? '')}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-text">{String(n.created_at ?? '')}</p>
                  {n.id && user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={readMut.isPending}
                      onClick={() => readMut.mutate({ notification_id: n.id, user_id: user.id })}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
