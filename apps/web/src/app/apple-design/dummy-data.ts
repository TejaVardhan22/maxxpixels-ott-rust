/**
 * Placeholder content for `/apple-design`.
 * Swap this module’s export for a server fetch / React Query call when the backend is ready.
 */

export type NavItem = { label: string; href: string };

export type SubNavLink = { label: string; href: string };

export type CtaPair = {
  secondary?: { label: string; href: string };
  primary?: { label: string; href: string };
};

export type ProductImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Passed to next/image priority when true */
  priority?: boolean;
};

export type HeroTile = {
  id: string;
  variant: 'light' | 'dark' | 'parchment' | 'dark-2';
  heading: string;
  /** Plain lead text, or structured copy with one inline link (dark tiles) */
  lead:
    | { kind: 'plain'; text: string }
    | { kind: 'withLink'; before: string; link: { text: string; href: string }; after: string };
  ctas?: CtaPair;
  /** Optional store-style actions (buttons instead of links) */
  actions?: {
    storeHero?: { label: string; href: string };
    pearl?: { label: string; href: string };
  };
  image?: ProductImage;
};

export type FinishOption = { id: string; label: string; selected?: boolean };

export type StoreAccessory = {
  id: string;
  title: string;
  price: string;
  imageSrc: string;
  buyLabel: string;
  buyHref: string;
};

export type FooterColumn = { title: string; links: NavItem[] };

export type AppleDesignPageData = {
  homeHref: string;
  globalNav: NavItem[];
  subNav: {
    title: string;
    links: SubNavLink[];
    primaryCta: { label: string; href: string };
  };
  heroTiles: HeroTile[];
  finishSection: {
    heading: string;
    options: FinishOption[];
  };
  store: {
    heading: string;
    searchPlaceholder: string;
    accessories: StoreAccessory[];
  };
  environment: {
    imageSrc: string;
    eyebrow: string;
    heading: string;
    cta: { label: string; href: string };
  };
  utilityDemo: {
    heading: string;
    body: string;
    actions: NavItem[];
  };
  footer: {
    columns: FooterColumn[];
    legal: string;
  };
  stickyBar: {
    priceLead: string;
    priceEmphasis: string;
    priceTrail: string;
    addLabel: string;
    addHref?: string;
  };
};

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

export const appleDesignDummyData: AppleDesignPageData = {
  homeHref: '/apple-design',
  globalNav: [
    { label: 'Store', href: '#' },
    { label: 'Mac', href: '#' },
    { label: 'iPad', href: '#' },
    { label: 'iPhone', href: '#' },
    { label: 'Watch', href: '#' },
    { label: 'Vision', href: '#' },
    { label: 'AirPods', href: '#' },
    { label: 'TV & Home', href: '#' },
    { label: 'Entertainment', href: '#' },
    { label: 'Accessories', href: '#' },
    { label: 'Support', href: '#' },
  ],
  subNav: {
    title: 'iPhone',
    links: [
      { label: 'Overview', href: '#' },
      { label: 'Switch', href: '#' },
      { label: 'Tech Specs', href: '#' },
    ],
    primaryCta: { label: 'Buy', href: '#' },
  },
  heroTiles: [
    {
      id: 'hero-light',
      variant: 'light',
      heading: 'Phone 17 Pro',
      lead: { kind: 'plain', text: 'Pro titanium design. Pro camera system.' },
      ctas: {
        secondary: { label: 'Learn more', href: '#' },
        primary: { label: 'Buy', href: '#' },
      },
      image: {
        src: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80',
        width: 720,
        height: 900,
        alt: 'Hero device',
        priority: true,
      },
    },
    {
      id: 'hero-dark',
      variant: 'dark',
      heading: 'A camera that thinks in Pro.',
      lead: {
        kind: 'withLink',
        before: 'A new sensor captures more light with',
        link: { text: 'low‑light portraits', href: '#' },
        after: '.',
      },
      ctas: {
        secondary: { label: 'Learn more', href: '#' },
        primary: { label: 'Buy', href: '#' },
      },
      image: {
        src: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
        width: 720,
        height: 720,
        alt: 'Product on dark tile',
      },
    },
    {
      id: 'hero-parchment',
      variant: 'parchment',
      heading: 'Accessories that finish the story.',
      lead: { kind: 'plain', text: 'Cases, power, and everyday essentials.' },
      actions: {
        storeHero: { label: 'Shop accessories', href: '#' },
        pearl: { label: 'Compare finishes', href: '#' },
      },
    },
  ],
  finishSection: {
    heading: 'Choose a finish.',
    options: [
      { id: 'natural', label: 'Natural titanium', selected: true },
      { id: 'blue', label: 'Blue titanium' },
      { id: 'white', label: 'White titanium' },
      { id: 'black', label: 'Black titanium' },
    ],
  },
  store: {
    heading: 'Featured picks',
    searchPlaceholder: 'Search accessories',
    accessories: [
      { id: 'a1', title: 'Silicone Case', price: '$49', imageSrc: img('acc-a'), buyLabel: 'Buy', buyHref: '#' },
      { id: 'a2', title: 'Leather Wallet', price: '$59', imageSrc: img('acc-b'), buyLabel: 'Buy', buyHref: '#' },
      { id: 'a3', title: 'MagSafe Charger', price: '$39', imageSrc: img('acc-c'), buyLabel: 'Buy', buyHref: '#' },
      { id: 'a4', title: 'USB-C Cable', price: '$19', imageSrc: img('acc-d'), buyLabel: 'Buy', buyHref: '#' },
      { id: 'a5', title: 'Screen Shield', price: '$29', imageSrc: img('acc-e'), buyLabel: 'Buy', buyHref: '#' },
    ],
  },
  environment: {
    imageSrc:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=80',
    eyebrow: 'Nature 2030',
    heading: 'Every product carbon neutral by 2030.',
    cta: { label: 'Learn more', href: '#' },
  },
  utilityDemo: {
    heading: 'Actions that stay quiet.',
    body: 'Utility buttons at 14px / 400 with an 8px radius and press scale.',
    actions: [
      { label: 'Sign In', href: '#' },
      { label: 'Bag', href: '#' },
    ],
  },
  footer: {
    columns: [
      {
        title: 'Shop and Learn',
        links: [
          { label: 'Store', href: '#' },
          { label: 'Mac', href: '#' },
          { label: 'iPad', href: '#' },
          { label: 'iPhone', href: '#' },
          { label: 'Watch', href: '#' },
        ],
      },
      {
        title: 'Services',
        links: [
          { label: 'Apple Music', href: '#' },
          { label: 'Apple TV+', href: '#' },
          { label: 'Apple Arcade', href: '#' },
          { label: 'iCloud', href: '#' },
        ],
      },
      {
        title: 'Apple Store',
        links: [
          { label: 'Find a Store', href: '#' },
          { label: 'Genius Bar', href: '#' },
          { label: 'Today at Apple', href: '#' },
        ],
      },
      {
        title: 'For Business',
        links: [
          { label: 'Apple and Business', href: '#' },
          { label: 'Shop for Business', href: '#' },
        ],
      },
    ],
    legal: 'Reference layout for DESIGN.md tokens. Images: Unsplash / Picsum.',
  },
  stickyBar: {
    priceLead: 'From ',
    priceEmphasis: '$999',
    priceTrail: ' or $41.62/mo. for 24 mo.*',
    addLabel: 'Add to Bag',
    addHref: '#',
  },
};

/** Future: replace body with `await fetch(...)` or your Ott API client. */
export function getAppleDesignPageData(): AppleDesignPageData {
  return appleDesignDummyData;
}
