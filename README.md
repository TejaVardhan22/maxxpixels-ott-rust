# MaxxPixels OTT — Docker Deployment Guide

Clean monorepo structure and one-command Docker Compose deployment designed for a VPS where **PostgreSQL runs natively on the host (outside Docker)**, **Redis runs inside Docker**, and **Host Nginx** handles SSL/domains.

---

## Folder Structure

```text
.
├── apps/                       # User-facing applications
│   ├── web/                    # Next.js 14 storefront (Docker -> 127.0.0.1:3001)
│   ├── admin/                  # Angular 17 Admin & Producer panel (Docker -> 127.0.0.1:4200)
│   └── mobile/                 # React Native Android/iOS app (native store builds)
│
├── services/                   # Backend microservices
│   ├── api/                    # Rust + Axum main OTT API (Docker -> 127.0.0.1:8081)
│   ├── games/                  # Rust PlayforFun games & coins service (Docker -> 127.0.0.1:8090)
│   └── media-streamer/         # Go Google Drive -> Bunny Stream tool (optional profile -> 127.0.0.1:8085)
│
├── infra/                      # Infrastructure & operations
│   ├── nginx/                  # Host VPS Nginx vhost config for Docker ports
│   ├── sql/                    # Schema init, parity & cleanup SQL scripts
│   ├── scripts/                # Superadmin, CDN, and backup helper scripts
│   └── bare-metal/             # Previous bare-metal deployment reference
│
├── archive/                    # Replaced / legacy services kept for reference
│   ├── backend-nestjs/         # Previous NestJS backend
│   ├── games-service-go/       # Go rewrite of games service (kept for future cutover)
│   └── backups/                # Local SQL database backups
│
├── docker-compose.yml          # Full Docker stack (Redis + API + Games + Web + Admin)
├── .env.example                # Production environment template
├── deploy.sh                   # One-command build, deploy & health-check script
└── Makefile                    # Shortcut commands (make deploy, make logs, make health)
```

---

## 1. One-Time Host PostgreSQL Setup (on VPS)

Because PostgreSQL runs on the VPS host outside Docker, containers connect to it via `host.docker.internal:5432` (`extra_hosts: host.docker.internal:host-gateway`).

Make sure your host PostgreSQL accepts connections from the Docker bridge subnet:

1. Find your PostgreSQL config directory (e.g. `/etc/postgresql/16/main/`):
   - In `postgresql.conf`, ensure it listens on the Docker gateway (or `*` if UFW blocks external port `5432`):
     ```ini
     listen_addresses = 'localhost,172.17.0.1'
     # or '*' (ensure UFW denies 5432 from public internet!)
     ```
   - In `pg_hba.conf`, allow the Docker private subnet (`172.16.0.0/12`):
     ```text
     host    all             all             172.16.0.0/12           scram-sha-256
     ```
2. Reload/restart PostgreSQL:
   ```bash
   sudo systemctl restart postgresql
   ```
3. If using UFW, allow Docker containers to reach host port `5432` (without opening it publicly):
   ```bash
   sudo ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
   ```
4. Test connectivity from Docker:
   ```bash
   make check-db
   ```

---

## 2. Configure Environment

Environment config is split by service and combined into the root `.env` that Docker Compose reads:

```bash
# Fill in secrets in the two source files
nano .env.ott     # API, web, admin, storage, payments, notifications
nano .env.games   # games DB, PlayforFun, coin grants, games-only ports

# Regenerate the combined .env (do not edit .env by hand)
make env-combine

# Validate the two source files without rewriting .env
make env-check
```

`.env.ott.example` and `.env.games.example` show templates for the two source files.

Key settings to verify:
- `DATABASE_URL` — use `host.docker.internal:5432` (URL-encode special characters in the password, e.g. `@` -> `%40`, `!` -> `%21`).
- `GAMES_DATABASE_URL` — separate `maxxpixels_games` database on `host.docker.internal:5432`.
- `JWT_SECRET` — shared between `api` and `games`; must be identical in `.env.ott` and `.env.games`.
- Bunny.net, Razorpay, MSG91, PlayforFun, and `NEXT_PUBLIC_*` keys.

---

## 3. Deploy

```bash
./deploy.sh
# or
make deploy
```

### Everyday Commands

| Command | What it does |
| --- | --- |
| `make deploy` | Pull `origin/main`, regenerate `.env`, stop/remove this stack's containers, rebuild & start all services, run health checks |
| `./deploy.sh --all-containers` | Same as `make deploy`, but also stops/removes every Docker container on the host |
| `make ps` | Show running container status |
| `make logs` | Tail logs from all containers |
| `make health` | Check HTTP status of API, Games, Web, and Admin |
| `make restart-api` | Rebuild & restart only the Rust API |
| `make restart-games` | Rebuild & restart only the Go Games service |
| `make restart-web` | Rebuild & restart only the Next.js Web app |
| `make restart-admin` | Rebuild & restart only the Angular Admin panel |
| `make tools-up` | Also start the optional `media-streamer` service (`127.0.0.1:8085`) |
| `make down` | Stop all containers |

---

## 4. Host Nginx Reverse Proxy

All containers bind strictly to `127.0.0.1`:

| Service | Local Docker Port | Domain |
| --- | --- | --- |
| Rust API | `127.0.0.1:8081` | `api.maxxpixels.com` |
| Rust Games | `127.0.0.1:8090` | `api.maxxpixels.com/api/v1/games/*` |
| Next.js Web | `127.0.0.1:3001` | `maxxpixels.com`, `www.maxxpixels.com` |
| Angular Admin | `127.0.0.1:4200` | `admin.maxxpixels.com`, `producer.maxxpixels.com` |

See [`infra/nginx/maxxpixels-docker.conf`](infra/nginx/maxxpixels-docker.conf) for the complete host Nginx upstream and location blocks (keep your existing Certbot SSL certificates).
# maxxpixels-ott-rust
