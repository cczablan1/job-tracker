# Enable posting-link extraction

Pasted-text extraction and salary calculations work in the browser immediately.
Link extraction needs the `extract-job` Edge Function in the same Supabase project.
No database migration or paid AI service is needed. Do not rerun schema.sql.

1. Open your Supabase dashboard → Edge Functions → Deploy a new function → Via Editor.
2. Name the function `extract-job` and replace index.ts with the complete contents of `functions/extract-job/index.ts` in this folder.
3. Deploy. In the function settings, disable the legacy gateway “Verify JWT” option. The function itself verifies the user's access token with Supabase Auth before fetching anything. Anonymous requests remain rejected.
4. Sign in to Job Tracker, add a supported HTTPS posting URL, and select **Extract from link**. Review the fields before using them and saving.

Alternatively, after signing in with the Supabase CLI:

```sh
supabase functions deploy extract-job --project-ref YOUR_PROJECT_REF
```

The built-in `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables are supplied by Supabase. Do not add a service-role key or private credentials to the website or repository.

Only explicitly approved hostnames are fetched, including the original posting hosts, Lever, Greenhouse and LinkedIn. Some sites, particularly LinkedIn, block automated access. Use pasted text for those. To support another trusted site, set the function's `EXTRA_POSTING_HOSTS` environment variable to comma-separated exact hostnames. Only add known public posting sites, including any legitimate redirect destination; do not add user-controlled proxies. Every redirect is checked. HTTPS, DNS checks, byte limits and timeouts apply. The per-user rate limit is best-effort per running function instance, not a global quota.

Extraction is deterministic: JobPosting structured data first, then labelled lines and conservative text patterns. It cannot fill information absent from the posting. Document matches need manual confirmation. Unknown salary gross/net basis is never silently converted.

Net estimates use a user-entered total employee deduction percentage, not a statutory tax engine. Annual pay is divided by 12; monthly pay supports extra payments and hourly pay requires paid hours/week. Salary guesses use the range of recorded net pay for the same country/type/currency in the user's own tracker. Guessed entries and computed gross-to-net estimates are excluded from that comparison. Existing entries may be unverified; the evidence field states this. No external market-pay data or AI is used.

References: [Supabase dashboard deployment](https://supabase.com/docs/guides/functions/quickstart-dashboard), [Supabase Auth validation](https://supabase.com/docs/reference/javascript/auth-getuser), [EU tax circumstances](https://europa.eu/youreurope/citizens/work/taxes/income-taxes-abroad/faq/index_en.htm).

### Enable ETH on an existing v1.1.0 deployment

Open Edge Functions → Secrets and add `EXTRA_POSTING_HOSTS` with value `ai.ethz.ch,ethz.ch,www.ethz.ch`. If this setting exists, append those hosts instead of removing existing ones. This is a non-sensitive configuration value. Save it; no SQL migration or website key changes are needed. The v1.1.1 function source also includes these defaults for fresh deployments.

The v1.1.1 browser extractor handles written dates and salary progression. It keeps deadline time/timezone in notes because the tracker deadline field is date-only; its urgency badges do not count down to the exact time. An institution-derived location is explicitly marked as inferred. Pasted text does not automatically fetch linked PDF requirements.
