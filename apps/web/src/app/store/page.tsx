'use client';

import { useMemo, useState } from 'react';
import { KeyRound, Library, Loader2, ShoppingBag } from 'lucide-react';
import { useRentContent, useUserRentContent, type ContentItem } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';

export default function StorePage() {
  const { user, session } = useStoredUser();
  const [tab, setTab] = useState<'store' | 'mine'>('store');
  const ctx = user?.id
    ? { userId: user.id, deviceId: session?.deviceId ?? 'web' }
    : { userId: 0, deviceId: 'web' };
  const storeQ = useRentContent(1, ctx);
  const mineQ = useUserRentContent(user?.id ?? 0);

  const storeItems = useMemo(
    () => (storeQ.data?.pages.flatMap((page) => page.result ?? []) ?? []) as ContentItem[],
    [storeQ.data],
  );
  const rentedItems = (mineQ.data?.result ?? []) as ContentItem[];
  const items = tab === 'store' ? storeItems : rentedItems;
  const loading = tab === 'store' ? storeQ.isLoading : mineQ.isLoading;

  return (
    <PageShell>
      <PageHero
        eyebrow="Premium rentals"
        title="Rent premieres"
        description="Watch selected releases without a subscription. Your access duration and price are shown before payment."
        icon={ShoppingBag}
      >
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setTab('store')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
              tab === 'store' ? 'bg-primary text-white' : 'text-desc-text hover:text-white'
            }`}
          >
            <ShoppingBag size={15} /> Available
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
              tab === 'mine' ? 'bg-primary text-white' : 'text-desc-text hover:text-white'
            }`}
          >
            <Library size={15} /> My Rentals
          </button>
        </div>
      </PageHero>

      {tab === 'mine' && !user?.id ? (
        <EmptyState
          title="Sign in to view your rentals"
          description="Active rentals and their expiry dates are linked to your MaxxPixels account."
          actionHref="/login?redirect=/store"
          actionLabel="Sign In"
          icon={KeyRound}
        />
      ) : loading ? (
        <div className="grid min-h-[260px] place-items-center">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === 'store' ? 'No rentals available yet' : 'You have no active rentals'}
          description={
            tab === 'store'
              ? 'Set a resource to TVOD in the admin panel and it will appear here.'
              : 'Titles you rent will remain here until their rental period expires.'
          }
          actionHref={tab === 'store' ? '/' : '/store'}
          actionLabel={tab === 'store' ? 'Browse Home' : 'Browse Rentals'}
          icon={tab === 'store' ? ShoppingBag : Library}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => (
              <div key={`${item.video_type}-${item.id}`} className="min-w-0">
                <ContentCard item={item} />
                <div className="mt-2 px-1 text-xs">
                  {tab === 'store' ? (
                    <p className="font-bold text-gold">
                      ₹{Number(item.rent_price ?? item.price ?? 0).toFixed(2)} · {Number(item.rent_day ?? 1)} days
                    </p>
                  ) : (
                    <p className="truncate text-desc-text">
                      {item.rent_expiry_date ? `Expires ${item.rent_expiry_date}` : 'Active rental'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {tab === 'store' && storeQ.hasNextPage && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => storeQ.fetchNextPage()}
                disabled={storeQ.isFetchingNextPage}
                className="rounded-full border border-gold/40 px-6 py-3 text-sm font-black text-gold hover:bg-gold/10 disabled:opacity-60"
              >
                {storeQ.isFetchingNextPage ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
