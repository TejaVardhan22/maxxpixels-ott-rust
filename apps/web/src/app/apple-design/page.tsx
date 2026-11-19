import Image from 'next/image';
import { Apple, Menu, Search, ShoppingBag } from 'lucide-react';
import type { AppleDesignPageData, HeroTile } from './dummy-data';
import { getAppleDesignPageData } from './dummy-data';

function tileClass(variant: HeroTile['variant']): string {
  const map: Record<HeroTile['variant'], string> = {
    light: 'ap-tile ap-tile--light',
    dark: 'ap-tile ap-tile--dark',
    parchment: 'ap-tile ap-tile--parchment',
    'dark-2': 'ap-tile ap-tile--dark-2',
  };
  return map[variant];
}

function HeroTileSection({
  tile,
  headingLevel,
}: {
  tile: HeroTile;
  headingLevel: 'h1' | 'h2';
}) {
  const HeadingTag = headingLevel;
  const lead =
    tile.lead.kind === 'plain' ? (
      <p className="ap-lead">{tile.lead.text}</p>
    ) : (
      <p className="ap-lead">
        {tile.lead.before}{' '}
        <a className="ap-link" href={tile.lead.link.href}>
          {tile.lead.link.text}
        </a>
        {tile.lead.after}
      </p>
    );

  return (
    <section className={tileClass(tile.variant)} aria-labelledby={tile.id}>
      <div className="ap-tile__stack">
        <HeadingTag id={tile.id} className={headingLevel === 'h1' ? 'ap-hero-display' : 'ap-display-lg'}>
          {tile.heading}
        </HeadingTag>
        {lead}
        {tile.ctas ? (
          <div className="ap-tile__ctas">
            {tile.ctas.secondary ? (
              <a className="ap-btn-secondary-pill" href={tile.ctas.secondary.href}>
                {tile.ctas.secondary.label}
              </a>
            ) : null}
            {tile.ctas.primary ? (
              <a className="ap-btn-primary" href={tile.ctas.primary.href}>
                {tile.ctas.primary.label}
              </a>
            ) : null}
          </div>
        ) : null}
        {tile.actions ? (
          <div className="ap-tile__ctas">
            {tile.actions.storeHero ? (
              <a className="ap-btn-store-hero" href={tile.actions.storeHero.href}>
                {tile.actions.storeHero.label}
              </a>
            ) : null}
            {tile.actions.pearl ? (
              <a className="ap-pearl-btn" href={tile.actions.pearl.href}>
                {tile.actions.pearl.label}
              </a>
            ) : null}
          </div>
        ) : null}
        {tile.image ? (
          <div className="ap-product-wrap">
            <Image
              className="ap-product-img"
              src={tile.image.src}
              alt={tile.image.alt}
              width={tile.image.width}
              height={tile.image.height}
              priority={tile.image.priority}
              sizes="(max-width: 720px) 100vw, 720px"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AppleDesignShowcaseContent({ data }: { data: AppleDesignPageData }) {
  const { subNav, finishSection, store, environment, utilityDemo, footer, stickyBar } = data;

  return (
    <>
      <header className="ap-global-nav" aria-label="Global">
        <div className="ap-global-nav__inner">
          <button type="button" className="ap-nav-toggle" aria-label="Open menu">
            <Menu size={22} strokeWidth={1.5} />
          </button>
          <a className="ap-logo ap-logo--mark" href={data.homeHref} aria-label="Home">
            <Apple size={22} strokeWidth={1.25} aria-hidden />
          </a>
          <nav aria-label="Primary">
            <ul className="ap-global-nav__links">
              {data.globalNav.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ap-global-nav__icons">
            <button type="button" className="ap-icon-btn" aria-label="Search">
              <Search size={20} strokeWidth={1.5} />
            </button>
            <button type="button" className="ap-icon-btn" aria-label="Bag">
              <ShoppingBag size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="ap-sub-nav">
        <div className="ap-sub-nav__inner">
          <h2 className="ap-sub-nav__title">{subNav.title}</h2>
          <div className="ap-sub-nav__links">
            {subNav.links.map((l) => (
              <a key={`${l.label}-${l.href}`} href={l.href}>
                {l.label}
              </a>
            ))}
            <a className="ap-btn-primary" href={subNav.primaryCta.href}>
              {subNav.primaryCta.label}
            </a>
          </div>
        </div>
      </div>

      {data.heroTiles.map((tile, index) => (
        <HeroTileSection key={tile.id} tile={tile} headingLevel={index === 0 ? 'h1' : 'h2'} />
      ))}

      <section className="ap-tile ap-tile--light" aria-labelledby="finish-heading">
        <h2 id="finish-heading" className="ap-display-lg" style={{ marginBottom: 24 }}>
          {finishSection.heading}
        </h2>
        <div className="ap-chip-grid">
          {finishSection.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={opt.selected ? 'ap-config-chip ap-config-chip--selected' : 'ap-config-chip'}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="ap-store-band" aria-labelledby="store-heading">
        <h2 id="store-heading" className="ap-display-lg" style={{ textAlign: 'center', marginBottom: 32 }}>
          {store.heading}
        </h2>
        <div className="ap-search-row">
          <label className="ap-search-input" htmlFor="ap-search">
            <Search size={18} strokeWidth={1.5} aria-hidden />
            <input
              id="ap-search"
              name="q"
              type="search"
              placeholder={store.searchPlaceholder}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="ap-store-grid">
          {store.accessories.map((item) => (
            <article key={item.id} className="ap-utility-card">
              <Image
                className="ap-utility-card__img"
                src={item.imageSrc}
                alt={item.title}
                width={400}
                height={400}
                sizes="(max-width: 640px) 100vw, 280px"
              />
              <h3 className="ap-body-strong">{item.title}</h3>
              <p className="ap-price">{item.price}</p>
              <a className="ap-card-link" href={item.buyHref}>
                {item.buyLabel}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section
        className="ap-env-band"
        style={{ backgroundImage: `url(${environment.imageSrc})` }}
        aria-labelledby="env-heading"
      >
        <div className="ap-env-band__inner">
          <p className="ap-env-eyebrow">{environment.eyebrow}</p>
          <h2 id="env-heading" className="ap-display-lg">
            {environment.heading}
          </h2>
          <a className="ap-btn-primary" href={environment.cta.href}>
            {environment.cta.label}
          </a>
        </div>
      </section>

      <section className="ap-tile ap-tile--dark-2" aria-labelledby="utility-heading">
        <div className="ap-tile__stack">
          <h2 id="utility-heading" className="ap-display-lg">
            {utilityDemo.heading}
          </h2>
          <p className="ap-body" style={{ color: 'var(--ap-body-muted)', textAlign: 'center' }}>
            {utilityDemo.body}
          </p>
          <div className="ap-tile__ctas">
            {utilityDemo.actions.map((a) => (
              <a key={a.label} className="ap-btn-dark-utility" href={a.href}>
                {a.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="ap-footer">
        <div className="ap-footer__grid">
          {footer.columns.map((col) => (
            <div key={col.title} className="ap-footer__col">
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="ap-footer__legal">{footer.legal}</p>
      </footer>

      <div className="ap-sticky-bar" role="region" aria-label="Configurator">
        <div className="ap-sticky-bar__inner">
          <p className="ap-body" style={{ margin: 0, color: 'var(--ap-ink)' }}>
            {stickyBar.priceLead}
            <strong>{stickyBar.priceEmphasis}</strong>
            {stickyBar.priceTrail}
          </p>
          {stickyBar.addHref ? (
            <a className="ap-btn-primary" href={stickyBar.addHref}>
              {stickyBar.addLabel}
            </a>
          ) : (
            <button type="button" className="ap-btn-primary">
              {stickyBar.addLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function AppleDesignShowcasePage() {
  const data = getAppleDesignPageData();
  return <AppleDesignShowcaseContent data={data} />;
}
