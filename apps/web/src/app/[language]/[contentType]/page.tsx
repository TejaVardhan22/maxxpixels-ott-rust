import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HomePageClient } from '../../home-page-client';
import { fetchHomeInitialData } from '@/lib/ott-api-server';
import { BannerSkeleton } from '@/components/ui/Skeleton';
import { USER_SCOPED_PAGES } from '@/lib/userRoutes';

import MySpacePage from '../../myspace/page';
import WatchlistPage from '../../watchlist/page';
import ContinueWatchingPage from '../../continuewatching/page';
import EditProfilePage from '../../editprofile/page';
import NotificationsPage from '../../notifications/page';
import ReferAndEarnPage from '../../referandearn/page';
import SettingsPage from '../../settings/page';
import ProfilePage from '../../profile/page';
import TvActivatePage from '../../tvactivate/page';
import SubscriptionPage from '../../subscription/page';
import StorePage from '../../store/page';

export const revalidate = 60;

interface PageProps {
  params: { language: string; contentType: string };
}

function formatSegment(value: string): string {
  return decodeURIComponent(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const USER_PAGE_TITLES: Record<string, string> = {
  myspace: 'My Space',
  watchlist: 'My Watchlist',
  continuewatching: 'Continue Watching',
  editprofile: 'Edit Profile',
  notifications: 'Notifications',
  referandearn: 'Refer & Earn',
  settings: 'Settings',
  profile: 'Profile',
  tvactivate: 'Activate Smart TV',
  subscription: 'Subscription Plans',
  store: 'Rentals & Store',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const rawSecond = decodeURIComponent(params.contentType || '').toLowerCase().trim();
  if (USER_SCOPED_PAGES.has(rawSecond)) {
    const label = USER_PAGE_TITLES[rawSecond] ?? formatSegment(rawSecond);
    return {
      title: `${label} | MaxxPixels`,
      description: `Manage your ${label.toLowerCase()} on MaxxPixels.`,
    };
  }
  const langLabel = formatSegment(params.language);
  const typeLabel = formatSegment(params.contentType);
  return {
    title: `${langLabel} ${typeLabel} | MaxxPixels`,
    description: `Watch ${langLabel} ${typeLabel} online on MaxxPixels.`,
  };
}

export default async function LanguageOrUserScopedPage({ params }: PageProps) {
  const rawFirst = decodeURIComponent(params.language || '').toLowerCase().trim();
  const rawSecond = decodeURIComponent(params.contentType || '').toLowerCase().trim();

  if (
    !rawFirst ||
    !rawSecond ||
    rawFirst.includes('.') ||
    rawSecond.includes('.') ||
    rawFirst.startsWith('_')
  ) {
    notFound();
  }

  // User-specific routes: /<username>/<page>
  switch (rawSecond) {
    case 'myspace':
      return <MySpacePage />;
    case 'watchlist':
      return <WatchlistPage />;
    case 'continuewatching':
      return <ContinueWatchingPage />;
    case 'editprofile':
      return <EditProfilePage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'referandearn':
      return <ReferAndEarnPage />;
    case 'settings':
      return <SettingsPage />;
    case 'profile':
      return <ProfilePage />;
    case 'tvactivate':
      return <TvActivatePage />;
    case 'subscription':
      return <SubscriptionPage />;
    case 'store':
      return <StorePage />;
    default:
      break;
  }

  // Catalog browse route: /<language>/<contentType>
  const initial = await fetchHomeInitialData();
  return (
    <Suspense fallback={<BannerSkeleton />}>
      <HomePageClient
        initial={initial}
        typeId={0}
        language={rawFirst}
        contentTypeSlug={rawSecond}
      />
    </Suspense>
  );
}
