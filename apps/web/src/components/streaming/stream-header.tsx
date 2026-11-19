'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, Search } from 'lucide-react';
import { avatarUrl } from '@ott/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const links = [
  { href: '/stream', label: 'Home' },
  { href: '/stream/categories', label: 'Categories' },
  { href: '/stream/watchlist', label: 'Watchlist' },
  { href: '/stream/plans', label: 'Plans' },
];

export function StreamHeader() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useStoredUser();
  const profileName = user?.full_name ?? 'Guest';
  const planLabel = user?.package_name ?? (user?.is_buy === 1 ? 'premium' : 'free');

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-6">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            pathname === item.href ? 'bg-white/12 text-white' : 'text-desc-text hover:bg-white/5 hover:text-white',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden flex-col border-r border-white/[0.06] bg-stream-bg/95 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-56 3xl:w-64 tv:w-72">
        <Link href="/stream" className="flex items-center gap-2 px-6 py-5">
          <span className="font-display text-xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-gold via-white to-gold bg-clip-text text-transparent">MAXX</span>
            <span className="text-white">STREAM</span>
          </span>
        </Link>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <div className="border-t border-white/5 p-4 text-[10px] uppercase tracking-widest text-muted-text">
          {planLabel} plan . backend account
        </div>
      </aside>

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/55 backdrop-blur-2xl lg:pl-56 3xl:pl-64 tv:pl-72">
        <div className="mx-auto flex h-14 max-w-[2200px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,320px)] border-white/10">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <NavLinks onClick={() => setSheetOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/stream" className="font-display text-lg font-bold sm:hidden">
              <span className="text-gold">MAXX</span>
              <span className="text-white">S</span>
            </Link>
          </div>

          <div className="mx-4 hidden max-w-xl flex-1 md:flex lg:mx-8">
            <Link
              href="/stream/search"
              className="flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-desc-text transition-colors hover:border-gold/30 hover:text-white"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span>Titles, genres, languages...</span>
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className="text-white md:hidden" asChild>
              <Link href="/stream/search" aria-label="Search">
                <Search className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative text-white" asChild>
              <Link href="/stream/notifications" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {isLoggedIn && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full border border-white/10 p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl(user?.image)} alt={profileName} />
                    <AvatarFallback>{profileName[0]}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/stream/profiles">Manage profiles</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={isLoggedIn ? '/stream/profiles/edit' : '/stream/auth/login'}>
                    {isLoggedIn ? 'Account settings' : 'Sign in'}
                  </Link>
                </DropdownMenuItem>
                {isLoggedIn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
