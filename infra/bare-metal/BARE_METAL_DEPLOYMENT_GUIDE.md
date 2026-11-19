# Replace Rust with NestJS on the existing VPS

| Component | Native deployment |
| --- | --- |
| API | NestJS via `maxxpixels-nestjs.service`, `127.0.0.1:8081` |
| Web | Next.js standalone via `maxxpixels-next.service`, `127.0.0.1:3001` |
| Admin and producer | Angular static files in `/opt/maxxpixels-ott/current/admin` |
| Mobile | Existing Android/iOS builds use `https://api.maxxpixels.com/api/v1` |
| PostgreSQL and Redis | Reuse the existing instances and credentials |

The installer starts the new apps alongside the existing stack. It does not
change public routes, databases, firewall rules, TLS certificates, or the old
systemd units. Use a regular deployment account for builds and sudo for install.
The server and any Linux CI artifacts must match in CPU architecture, libc,
and Node major version. Use Node 22 at `/usr/bin/node`, npm, systemd, curl,
iproute2, util-linux, Nginx and the PostgreSQL client tools. Confirm ports
8081 and 3001 are available. Do not run the build from a root shell.

## 1. Configure the NestJS environment

```bash
sudo install -d -m 0750 /etc/maxxpixels-ott
sudo install -m 0600 deploy/bare-metal/env.production.template /etc/maxxpixels-ott/backend.env
sudoedit /etc/maxxpixels-ott/backend.env
```

Run the template copy only the first time. Use the existing PostgreSQL app role
and database name (with appropriate access), an unused Redis logical database,
and a strong JWT secret. To keep existing sessions where compatible, match the
Rust signing secret and test token refresh; some clients may still need to sign
in again. Copy the production Bunny, payment, SMS, push and identity settings
you use, using `backend/.env.example` as the key reference. Use systemd
EnvironmentFile syntax: one KEY=value assignment per line, quote values as
needed, and do not use shell expansion.

Take a fresh PostgreSQL backup. First test on a restored copy with an isolated
Redis database and sandboxed integrations. Startup schema writes and seeding are
disabled by default in this deployment. If the clone needs NestJS schema fixes,
enable `DB_SCHEMA_PATCHES_ENABLED=true` with `SKIP_DB_INIT=true` on the
clone, check the startup journal and verify the app against the resulting schema.
Review and apply required schema changes in a planned maintenance window before
using the live database. Changing the Nginx upstream cannot undo a database
migration. Use the existing backup schedule. The outbox relay stays off during
parallel testing; check for pending jobs and enable it on NestJS only when it
owns those jobs and the old Rust workers have stopped.

Local media are read from `/var/lib/maxxpixels-nestjs/uploads`. If the current
server uses local media, copy the files there after the NestJS service creates
its state directory and give `maxx-nestjs` access. Keep the original files
available for rollback. Keep server-only secrets out of Next.js; browser
`NEXT_PUBLIC_*` variables, including Firebase settings, go in
`web/web/.env.production.local` before building. Optional server runtime
variables go in `/etc/maxxpixels-ott/web.env`.

## 2. Build and install

```bash
bash ./deploy.sh
# Use the absolute release path printed by the previous command:
sudo bash deploy/bare-metal/setup.sh /absolute/path/to/.releases/release.XXXXXXXX
bash deploy/bare-metal/check-api.sh
curl -fsS http://127.0.0.1:3001/
```

Alternatively, extract the `maxxpixels-vps` CI artifact on a compatible VPS
and pass the extracted release directory to `setup.sh`. Next.js is built with
`API_BACKEND_URL=http://127.0.0.1:8081` and the browser uses `/api/v1`.
Standalone output includes the static bundles and public assets. See the
[Next.js 14 standalone guide](https://nextjs.org/docs/14/app/api-reference/next-config-js/output).
The first web build can run before the API is up; test the catalog after the API
is ready. Confirm the test deployment against real catalog data, admin login,
mobile login and refresh, playback, and any active payment and push integrations.
A healthy database connection alone does not prove API or schema compatibility.

## 3. Switch production traffic from Rust

1. Back up the active Nginx config outside any included directory. Preserve your
   existing TLS, domains and redirects. For the existing VPS, the API config in
   `nginx/api.maxxpixels.com.conf` keeps the Certbot certificate and local uploads
   alias, and proxies to NestJS on port 8081. Replace the active API vhost only
   if it matches those paths and contains no other domains; otherwise edit just
   its API `proxy_pass`. The other vhosts are examples. None are installed by
   `setup.sh`.
2. To update the frontend routes, install the snippets and merge the examples
   into your existing HTTPS vhosts. Change the web/admin API and media routes
   to `maxx_api`. To deploy the new frontends too, point the web host at
   `maxx_web` and the admin/producer root at the release's `admin` directory.
   If keeping the old Next.js process, update its server-side `API_BACKEND_URL`
   and rebuild it if its rewrites embed the Rust upstream. Do not enable
   duplicate server blocks for the same host and port.

   ```bash
   sudo install -m 0644 deploy/bare-metal/nginx/ott-upstreams.conf /etc/nginx/conf.d/maxxpixels-upstreams.conf
   sudo install -m 0644 deploy/bare-metal/nginx/proxy-headers.inc /etc/nginx/snippets/maxxpixels-proxy-headers.conf
   sudo install -m 0644 deploy/bare-metal/nginx/admin-routes.inc /etc/nginx/snippets/maxxpixels-admin-routes.conf
   # After editing the active HTTPS virtual hosts:
   sudo nginx -t && sudo systemctl reload nginx
   bash deploy/bare-metal/check-api.sh https://api.maxxpixels.com
   curl -fsS https://maxxpixels.com/api/v1/ping
   curl -fsS https://admin.maxxpixels.com/
   ```

3. Verify the live clients. Stop the old Rust API and any replaced workers only
   after confirming their unit names and that no other clients depend on them.
   Enable NestJS outbox processing in `backend.env` only if needed, then restart
   `maxxpixels-nestjs.service`. Keep Rust available through the rollback window.

To roll back the Rust cutover, start the old Rust service if needed, stop NestJS
outbox processing, restore the previous Nginx routes, test and reload Nginx.
If the previous web used a separate service, leave it available for rollback
too. For subsequent NestJS updates, `setup.sh` restores the previous release
symlink if its startup checks fail. Inspect logs with:

```bash
sudo journalctl -u maxxpixels-nestjs -u maxxpixels-next -n 100 --no-pager
```

If an admin account needs to be created or reset, set `PGHOST`, `PGPORT`,
`PGUSER` and `PGDATABASE` for the intended PostgreSQL instance, authenticate
with `~/.pgpass` or your normal PostgreSQL credentials, and run
`bash deploy/bare-metal/create-admin.sh`. The script prompts for the new
password.

## 4. Mobile releases

Existing installs keep the same HTTPS endpoint. For a new mobile release, build
the React Native project in `mobileapp/` on its mobile build machine. Keep the
release keystore, `android/key.properties` and Firebase files outside Git.
On Windows, run `npm ci` from `mobileapp/` and
`npm run build:bundle:release` for Google Play or
`npm run build:apk:release` for device testing. Use the production signing
configuration and verify the signed build on a physical device. iOS requires a
Mac, Xcode, the production Firebase configuration and the App Store signing
identity; archive the app in Xcode. See
[React Native Android release signing](https://reactnative.dev/docs/signed-apk-android).
Mobile apps are distributed to devices or stores; there is no mobile systemd service.
