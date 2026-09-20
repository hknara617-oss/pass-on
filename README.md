# PASS ON — production recovery source

PASS ON is a parent-to-child family legacy archive for the moments, words, photos, voice notes and links a parent wants to leave to a child.

## Production

| Item | Value |
| --- | --- |
| Production URL | https://pass-on-jet.vercel.app |
| Source repository | https://github.com/hknara617-oss/pass-on |
| Vercel project | `pass-on` |
| Supabase project ref | `tjiawbipafgkopvojnok` |

## Architecture

Next.js App Router, React and TypeScript with Supabase Auth, Postgres and Storage. The browser client uses `@supabase/ssr` cookie storage and PKCE. Server requests use `getUser()` and all data access uses the public anon key with the user session, so the existing RLS policies remain in force. No service-role key is used by the application.

Capture supports text, photo, voice and links for a recipient child. Capture retries use stable UUIDs and immutable storage paths. Archive keeps existing records, including records already soft-deleted, read-only unless the user adds a new note.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`, session cookies, exports or secret keys.

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing public or publishable Supabase key |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin |
| `VERCEL_TOKEN` | Vercel CLI only; store securely |
| `VERCEL_ORG_ID` | Vercel deployment scope |
| `VERCEL_PROJECT_ID` | Existing Vercel project ID |

Do not put a Supabase service-role or secret key in any `NEXT_PUBLIC_*` variable.

## Authentication and recovery

- `/login` supports password sign-in and links to **비밀번호를 잊으셨나요?**.
- `/forgot-password` calls `resetPasswordForEmail` and directs the default Supabase recovery link to `/auth/recovery`. It never creates an account or signs out an existing session. It returns the same confirmation text for registered and unregistered addresses.
- `/auth/callback` exchanges recovery codes and opens `/auth/update-password`.
- `supabase/templates/recovery.html` provides the cross-browser recovery option. It forwards a recovery `token_hash` to `/auth/confirm`, which requires an explicit button press before `verifyOtp({ type: 'recovery' })` and opens the password form.
- The password form confirms the authenticated user and calls `updateUser({ password })`. The existing Supabase identity and every database foreign key remain unchanged.
- `/data` → **보안** → `/data/security` provides the same password change flow for a signed-in user, including Supabase reauthentication nonce support when required.
- The only sign-out is user initiated and local to that browser. The app does not deliberately invalidate an existing iPhone session.

## Supabase release configuration

Before release, preserve existing Auth configuration and add the production callback URLs:

- `https://pass-on-jet.vercel.app/auth/callback`
- `https://pass-on-jet.vercel.app/auth/callback?next=/capture`
- `https://pass-on-jet.vercel.app/auth/recovery`

Configure a working SMTP sender. To support cross-browser recovery, install `supabase/templates/recovery.html` as the Supabase Reset Password email template. Validate email delivery and recovery against the existing account before release. Do not reset the database, replace users, change ownership, rotate signing keys or clear sessions.

## Local verification

```sh
npm ci
npm run check
npm run audit:source
npm run build
node scripts/http-smoke.mjs
npm run dev
```

The test suite uses isolated doubles. It does not sign into production, send recovery mail, create an account or change a password. GitHub Actions runs the same source checks for pushes and pull requests.

## Deployment

1. Connect this repository to the existing Vercel project named `pass-on`; retain its existing production alias and environment values.
2. Check the production environment variables without revealing their values, then run the local verification commands.
3. Deploy a preview and complete authenticated recovery, sign-in, Archive and Capture checks before promoting it.
4. Promote only the verified deployment to the existing production alias and verify the production URL.
5. Perform a read-only data audit before and after deployment. Never reset or migrate the existing database as part of deployment.

Production source, infrastructure configuration and secrets have separate responsibilities: source is versioned here; secrets remain in Vercel and Supabase.
