# ORVYN Pulse 1.1 — Facebook and Instagram analytics

MERN application for connecting Facebook Pages and their linked Instagram professional accounts through Meta authorization. All account lists, analytics, and accessible reports use imported live-account data. There is no sample-data loading action or seeding endpoint.

## Updating your existing installation

Read **UPGRADE.md** first. Keep your existing `server/.env`, including the MongoDB URI and encryption key. Extract this release into a **new folder**, copy your configuration there, and install dependencies. Your users and workspaces remain in MongoDB.

## Run on Windows PowerShell

Requires Node.js 22.12+ and MongoDB Atlas or a local MongoDB server.

```powershell
cd "C:\path\to\orvyn-pulse"
npm.cmd ci
node scripts/setup.mjs
notepad .\server\.env
npm.cmd run check:config
npm.cmd run dev
```

The setup script preserves an existing `.env`. Set `MONGODB_URI`, `META_APP_ID`, `META_APP_SECRET`, and the registered callback. Keep the generated `TOKEN_ENCRYPTION_KEY`. Open **http://localhost:5173**, register or sign in, and open **Connected accounts**. Select **Connect with Meta**, authorize your Page access, choose accounts, and wait for synchronization. Analytics and status refresh every 15 seconds.

**MongoDB credentials do not connect Instagram or Facebook.** A Meta developer application and eligible social accounts are also required. Complete **docs/REAL_ACCOUNTS_SETUP.md** before attempting authorization. Format checks do not verify credentials with Meta or grant app permissions.

## Supported connection path

- Facebook Pages you are authorized to manage.
- Instagram Business or Creator accounts linked to those Pages.
- Facebook Login, with optional `META_LOGIN_CONFIG_ID` for a configured Facebook Login for Business flow.
- Personal Facebook-profile analytics and personal Instagram accounts are outside this integration.

## Features

- Independent registration/login and revocable cookie sessions.
- Brand workspaces with owner, analyst, and viewer access.
- OAuth state validation, encrypted provider tokens, account selection.
- Page discovery continues when Instagram permissions are unavailable; the interface explains missing permissions.
- Imported content, reactions/likes, comment counts, shares, supported Instagram insights, and comment samples.
- Nullable reach, historical publishing windows, English sentiment scoring, and saved JSON reports.
- Automatic refresh, synchronization status, follower snapshots, warnings, and reconnect handling.

No engagement is fabricated when an account has not been connected. Missing optional counters may be represented as zero, accompanied by warnings. Reach is kept unavailable when not returned. See **docs/METHODOLOGY.md**.

## Local built version

Set `APP_URL=http://localhost:4000`, then:

```powershell
npm.cmd run build
npm.cmd start
```

Visit **http://localhost:4000**. For public HTTPS, set `NODE_ENV=production`, set the real `APP_URL`, and register `META_REDIRECT_URI` on the same hostname ending in `/api/meta/callback`. Use the built application behind HTTPS on port 4000. Configuration and provider approval are required before deployment to other users.

## Docker

With Docker Desktop running and `server/.env` configured:

```powershell
docker compose up --build
```

The supplied Compose file runs Node and MongoDB with local HTTP settings and a persistent volume. It serves port 4000 on localhost. It overrides the MongoDB URI to use the Compose database; use normal `npm.cmd run dev` if you want your existing Atlas database.

## Verification

```powershell
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:integration
```

The production frontend builds successfully. **27 unit, HTTP, and provider-contract tests passed.** Contract tests mock Meta responses and database methods; they verify filtering and response handling, not your actual account permissions.

The database integration suite is included for local execution. The earlier execution environment denied MongoDB a required filesystem operation; no passing database integration result is claimed here. No Meta app credentials or eligible accounts were available for live OAuth testing. Complete the real-account acceptance steps in the setup guide.

## Project files

- `server/src/app.js`: routes, authorization, live-data filters, OAuth callback.
- `server/src/meta.js`: account discovery, Graph requests, imports, scheduler.
- `server/src/meta-config.js`: safe setup diagnostics without exposing secrets.
- `server/src/live-data.js`: centralized live-only query rules.
- `server/src/models.js`: MongoDB schemas and indexes.
- `server/src/analytics.js`: metrics and insight calculations.
- `client/src/App.jsx`: dashboard, account setup and connection interface.
- `docs/REAL_ACCOUNTS_SETUP.md`: Meta and account configuration.
- `UPGRADE.md`: existing installation upgrade instructions.

The Node process must remain running for scheduled synchronization. Imports are bounded to 60 posts and 50 comments per post. Paid billing, password recovery, comprehensive data-deletion callbacks, durable queues, and automatic backups are not included.
