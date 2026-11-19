import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanTier } from '@/lib/streaming/types';

interface StreamingStoreState {
  activeProfileId: string;
  watchlistIds: string[];
  progressByTitle: Record<string, number>;
  subscription: PlanTier;
  recentSearches: string[];
  setProfile: (id: string) => void;
  toggleWatchlist: (titleId: string) => void;
  setProgress: (titleId: string, pct: number) => void;
  setSubscription: (tier: PlanTier) => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
}

export const useStreamingStore = create<StreamingStoreState>()(
  persist(
    (set) => ({
      activeProfileId: 'backend-user',
      watchlistIds: [],
      progressByTitle: {},
      subscription: 'free',
      recentSearches: [],
      setProfile: (id) => set({ activeProfileId: id }),
      toggleWatchlist: (titleId) =>
        set((s) => ({
          watchlistIds: s.watchlistIds.includes(titleId)
            ? s.watchlistIds.filter((x) => x !== titleId)
            : [...s.watchlistIds, titleId],
        })),
      setProgress: (titleId, pct) =>
        set((s) => ({
          progressByTitle: { ...s.progressByTitle, [titleId]: Math.min(100, Math.max(0, pct)) },
        })),
      setSubscription: (tier) => set({ subscription: tier }),
      addRecentSearch: (q) => {
        const trimmed = q.trim();
        if (!trimmed) return;
        set((s) => ({
          recentSearches: [trimmed, ...s.recentSearches.filter((x) => x !== trimmed)].slice(0, 10),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'ott-stream-ui',
      partialize: (s) => ({
        activeProfileId: s.activeProfileId,
        watchlistIds: s.watchlistIds,
        progressByTitle: s.progressByTitle,
        subscription: s.subscription,
        recentSearches: s.recentSearches,
      }),
    },
  ),
);

export function useIsInWatchlist(titleId: string) {
  return useStreamingStore((s) => s.watchlistIds.includes(titleId));
}

const tierOrder: PlanTier[] = ['free', 'basic', 'premium'];

export function useCanPlayTitle(requiresPlan: PlanTier) {
  const tier = useStreamingStore((s) => s.subscription);
  return tierOrder.indexOf(tier) >= tierOrder.indexOf(requiresPlan);
}

export function getEffectiveProgress(titleId: string, fallback?: number) {
  const fromStore = useStreamingStore.getState().progressByTitle[titleId];
  if (fromStore != null) return fromStore;
  return fallback ?? 0;
}
