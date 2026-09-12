# Connect your real Facebook and Instagram accounts

## 1. Prepare the social accounts

Use a Facebook account that has the required management access to your Facebook Page. For Instagram, use a Business or Creator account linked to that Page. This implementation discovers Instagram through Facebook Pages; it does not use the separate Instagram Login API.

If Instagram does not appear during selection, check both the Page linkage and the Instagram permissions granted to the application. The account picker can still show Facebook Pages when Instagram access is missing.

## 2. Configure a Meta developer application

Open https://developers.facebook.com/apps/ and create or select your application. Configure the appropriate business use case and Facebook Login capability. Meta's dashboard options depend on the app type and use case.

Obtain the **App ID** and **App Secret**. These are neither your Facebook password nor your MongoDB password. Never put the secret into React, browser storage, a screenshot, or a report.

If your app uses Facebook Login for Business with a login configuration, supply that configuration ID through `META_LOGIN_CONFIG_ID`. Leave it blank for a flow that does not require it. Configure permission scopes consistently in your Meta app.

## 3. Set server configuration

Run `node scripts/setup.mjs` for a new installation. It generates the token encryption key. If upgrading, preserve your existing `.env` and key.

```env
PORT=4000
APP_URL=http://localhost:5173
NODE_ENV=development
META_APP_ID=YOUR_NUMERIC_APP_ID
META_APP_SECRET=YOUR_APP_SECRET
META_LOGIN_CONFIG_ID=
META_API_VERSION=v25.0
META_REDIRECT_URI=http://localhost:4000/api/meta/callback
META_SCOPES=pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,instagram_manage_comments
META_FB_REACH_METRIC=
SYNC_INTERVAL_MINUTES=60
```

Keep your configured `MONGODB_URI` and 64-hex-character `TOKEN_ENCRYPTION_KEY`. `v25.0` is the supplied configurable baseline, not a claim that it is the latest version. Check the version offered and supported for your Meta app.

Register the exact `META_REDIRECT_URI` in your Meta login settings. The application URL and callback must share a hostname so the browser can return the login session. Do not mix `localhost` with `127.0.0.1`.

If Meta requires HTTPS for your app configuration, use the built application through an HTTPS host or tunnel targeting port 4000. Set `APP_URL=https://YOUR_HOST`, `META_REDIRECT_URI=https://YOUR_HOST/api/meta/callback`, and `NODE_ENV=production`. Register that exact callback at Meta. Changing tunnel hostnames also requires updating these settings. For this flow run `npm.cmd run build` and `npm.cmd start`; do not expose the Vite development server as the production app.

## 4. Permissions and app access

The application checks the permissions returned by Meta. Page discovery requires `pages_show_list` and `pages_read_engagement`. It also requests `read_insights`, `instagram_basic`, `instagram_manage_insights`, and `instagram_manage_comments` for the relevant analytics and comments.

Account and post permissions vary. Reading some Facebook user-created content can require an additional approved permission such as `pages_read_user_content`. Add it to the configured scopes only when applicable and approved for your use case.

In development mode, test with accounts allowed to use your app. Connecting unrelated clients may require app review, advanced access, business verification, and published privacy/data-deletion arrangements. Approval is performed by Meta, not by this application. Configure only permissions required by your use case.

## 5. Start and connect

```powershell
npm.cmd run check:config
npm.cmd run dev
```

Open http://localhost:5173 and sign in as the workspace owner. Navigate to **Connected accounts**. The setup panel shows configuration checks without revealing secrets. These checks validate format; they do not authenticate the app with Meta.

1. Select **Connect with Meta**.
2. Sign in on Meta's own screen and grant access to the intended Pages and linked Instagram accounts.
3. Return to ORVYN Pulse and select the discovered accounts.
4. Confirm the selection. The server encrypts the tokens and starts importing content.
5. Watch the status change from synchronizing to connected, or inspect a reported error.
6. Open Overview or Content performance. Results refresh automatically every 15 seconds. Change the date range if the account's posts are older than 30 days.

Reconnecting updates the token for the same workspace/platform/account identity. Existing imported records use idempotent upserts.

## 6. Reach and other metrics

Instagram reach, saved, and shares are requested independently as optional media insights. Facebook posts import reaction summaries, comment counts, and shares. Follower counts are requested during sync. Availability depends on account and permissions.

Facebook reach has no default metric in this release. Set `META_FB_REACH_METRIC` only to a reach metric supported by the selected Graph version and post type. When reach is unavailable, content counts still import and reach-based calculations show unavailable. Views are not reach and must not be substituted. Optional permission and metric failures are visible on account cards.

## 7. Verify your real connection

- Confirm the account picker shows your actual Page/Instagram name.
- Confirm an imported post caption, permalink, and publication timestamp against the original post.
- Check counts against the platform, allowing for synchronization delay and permission differences.
- Confirm the follower snapshot and last synchronized time.
- Read any metric or comment warning; absence of a metric is not proof of zero activity.
- Revoke or expire test access and confirm the account requests reconnection.
- Verify a different workspace cannot read the connected account or its reports.

## Troubleshooting

- **Setup incomplete:** inspect the checks, edit `server/.env`, and restart Node.
- **Callback mismatch:** match scheme, hostname, port, and `/api/meta/callback` exactly.
- **Sign in again:** the ORVYN browser session expired; sign in and restart authorization.
- **No Pages:** check Page management access, permission grants, login configuration, and app mode.
- **No Instagram:** check professional account type, Page linkage, and `instagram_basic` permission.
- **Permission error:** review app access and scopes, then reconnect to request declined permissions again.
- **Reconnect required:** Meta access was revoked or expired.
- **Rate limited:** wait before requesting another synchronization.
- **No posts:** check the reporting dates, account content, last sync, and warnings. This release does not populate missing account data with examples.

## Verification and official references

The integration code is tested using provider-contract responses. Live authorization and imports must still be tested with your app and accounts. Official Meta pages were unavailable to the build environment due to rate limits, so version-specific permission and insight availability must be verified during app configuration.

- https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/
- https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/
- https://developers.facebook.com/docs/pages-api/
- https://developers.facebook.com/docs/graph-api/changelog/
