# OTT Web (standalone)

Next.js consumer website. **This folder is an independent project** — it does not use the `ott-platform` workspace or a separate `@ott/shared` npm package.

## API client

Consumer API client, React Query hooks, and types are vendored under [`lib/shared`](./lib/shared). Imports use `@ott/shared`, resolved via `tsconfig.json` paths.

## Setup

```bash
npm install
npm run dev
```

For local NestJS integration, start the backend on port `8081` and keep these values in `.env.local`:

```bash
API_BACKEND_URL=http://127.0.0.1:8081
NEXT_PUBLIC_API_BASE_URL=/api/v1
```

The browser calls the API via Next.js rewrites. For production packaging and
systemd setup, see the [bare VPS deployment guide](../../deploy/bare-metal/BARE_METAL_DEPLOYMENT_GUIDE.md).

## Scripts

- `npm run dev` — development
- `npm run build` / `npm run start` — production
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm run test:e2e` — Playwright (optional)
