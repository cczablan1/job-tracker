# Job Tracker

A responsive application tracker with email-link login, per-account Supabase storage, document checklists, deadline urgency, sorting, grouping, and iPhone Home Screen installation.

## 1. Create the database and login service

1. Create a Supabase project at https://supabase.com/dashboard.
2. Run `supabase/schema.sql` in its SQL Editor.
3. Under Authentication, enable Email authentication and email signups for the first login. Signups may be disabled once your account exists.
4. Set Authentication → URL Configuration → Site URL to your exact deployed URL, including the repository path and trailing slash. Add that same URL to Redirect URLs. Add `http://localhost:5174/` only for local development.
5. Copy the Project URL and **publishable** key from the project API settings. Never use a secret or service-role key in this app.
6. Configure a custom SMTP provider under Authentication for reliable email delivery. Supabase's default email sender is limited and may require recipient addresses to be authorized; see https://supabase.com/docs/guides/auth/auth-smtp.

## 2. Publish with GitHub Pages

Create a repository named `job-tracker` under `cczablan1` and upload **this folder's contents as the repository root**. Use a fresh repository, not the parent Sites repository/history: the parent contains the original personal application data.

Set these repository Actions **variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

In Settings → Pages, choose GitHub Actions as the source. Push to main; the included workflow builds and deploys. For that repository name the expected address is https://cczablan1.github.io/job-tracker/ (verify the actual address in Pages after deployment).

GitHub Free Pages generally requires a public repository. Source can be public because personal records live only in the protected database, but never commit private exports or secret keys. Private repository Pages requires an eligible GitHub plan. See https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages.

## Alternative: Vercel

Import the same repository. Vercel detects Vite; build is `npm run build`, output is `dist`. Set the two VITE variables above and `BASE_PATH=/`. Update the Supabase Site URL and redirect allowlist to the Vercel URL. A private GitHub repository is suitable for this route.

## 3. Sign in and import your applications

Open the tracker and enter your email. Open the email link in the same browser that requested it; the link verifies your address and signs you in. If the private owner setup script was installed, the original seven rows appear automatically after the owner email is verified. Open Account & data → Import applications and select your private JSON export. The seven original spreadsheet rows were prepared separately at `../.sites-runtime/owner-applications.json` in the original local workspace. They are deliberately absent from this repository and public build.

Imports are assigned to the currently signed-in account by the database's row-level policies. Existing IDs are skipped, so importing again does not overwrite edits. Other users start with an empty tracker. If you changed records in the old hosted tracker after the original import, migrate an up-to-date export instead of the original seven rows.

## Local development

Copy .env.example to .env.local, fill the two public project settings, then:
```sh
npm ci
npm run dev -- --port 5174
npm run build
```

Install on iPhone: open the deployed site in Safari, Share → Add to Home Screen. The manifest works under GitHub repository paths. An internet connection is required. Private application responses are never service-worker cached.

## Security and checks

- Database RLS restricts reads and writes to auth.uid(); signed-out users have no table privileges.
- Owner/id are immutable; updates use optimistic concurrency to prevent overwriting another device's changes.
- No service-role key or personal application fixture belongs in this source tree.
- Run `supabase/security-check.sql` in a development project after applying the schema. The test rolls back all fixtures.
- Live authentication, email delivery, and RLS must be verified against your actual project before migration is considered complete.
## Versions and rollback

Stable releases are tagged as `vMAJOR.MINOR.PATCH` and described in `CHANGELOG.md`.

Before a risky update, create a new version tag. To restore a prior release, create a new branch from its tag, verify it, and then merge or deploy that branch. Avoid deleting or moving old version tags. A local Git bundle backup is also kept outside the public repository for disaster recovery.

## Posting extraction and net salary

In Save job, paste a posting URL and select **Extract from link**, or choose **Paste description instead**. Review the suggested fields before adding them. Existing fields are unchecked; saved document progress is preserved. Link extraction supports approved posting hosts and needs the setup in [supabase/EXTRACTION-SETUP.md](supabase/EXTRACTION-SETUP.md). Pasted text stays on the device.

Under Optional details → Net salary, record posted net pay, compute approximate net using an explicit total deduction percentage, or estimate from similar jobs already in your tracker. A source column distinguishes posted net, posted gross with estimated net, guessed net and older entries with no recorded source. Missing information remains unknown. These are reviewable planning estimates, not a country-specific tax calculation.

Version 1.0.0 remains available for code rollback. Version 1.1.0 adds optional salary metadata to existing JSON records without changing the database schema. If rolling back to 1.0.0, export account data first: old validation does not accept this new metadata when editing affected records. A code rollback does not restore or delete database data.
