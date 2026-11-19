'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Compass, Home, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/stream', label: 'Home', icon: Home },
  { href: '/stream/categories', label: 'Browse', icon: Compass },
  { href: '/stream/search', label: 'Search', icon: Search },
  { href: '/stream/plans', label: 'Premium', icon: Sparkles },
  { href: '/stream/watchlist', label: 'Saved', icon: Clapperboard },
];

export function StreamBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/70 backdrop-blur-2xl lg:hidden pb-safe">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/stream' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
                active ? 'text-gold' : 'text-muted-text',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-gold')} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
