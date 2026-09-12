# Upgrade from ORVYN Pulse 1.0

1. Stop the old application with Ctrl+C.
2. Extract `ORVYN-Pulse-Live-Accounts.zip` into a new directory. Do not merge the folders: the previous release contains scripts that no longer belong to this version.
3. Copy **only your existing `server/.env`** into the new project's `server` directory. Do not upload or share that file.
4. Keep `MONGODB_URI` unchanged to reuse your database. Keep `TOKEN_ENCRYPTION_KEY` unchanged if you have encrypted account tokens.
5. Fill in your Meta app ID and secret. Verify `APP_URL` and `META_REDIRECT_URI` match the URLs you will use. For standard local development these are `http://localhost:5173` and `http://localhost:4000/api/meta/callback`.
6. Clear the value of `META_FB_REACH_METRIC` unless you have verified that the configured metric is supported for reach on your app's Graph version. The previous release used `post_impressions_unique`; do not replace reach with views.
7. Run `npm.cmd ci`, `npm.cmd run check:config`, then `npm.cmd run dev` from the new folder.
8. Open Connected accounts, complete the Meta setup, and select Connect with Meta.

## Existing database records

Users, workspaces, and role membership are preserved. Real connected accounts and reports explicitly marked `filters.source=live` remain accessible. Old sample accounts, posts, comments, and reports are excluded by the API, including direct report-ID requests. They are not converted into live data or automatically deleted. No database cleanup is required to use this release.

## New behavior

- The application opens on real-account analytics without a source switch.
- The sample generator and seed command have been removed.
- Requests that explicitly select a non-live source are rejected.
- Empty analytics cannot be saved as a report.
- Account and dashboard data refresh every 15 seconds.
- New account fields track synchronization attempts, imported post count, and followers.
- OAuth failures redirect to the application with an actionable message.

## What you still need

An Atlas username/password alone is insufficient. Complete `docs/REAL_ACCOUNTS_SETUP.md` using your Meta developer app. The update cannot grant access to your social accounts automatically or bypass Meta permissions and review.
