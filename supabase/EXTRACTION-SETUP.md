# Extraction setup (v1.2.0)

The website update and the Supabase function are separate deployments. No SQL or database migration is needed.

## 1. Update the existing function

1. In Supabase open **Edge Functions → extract-job → Code**.
2. Replace all of index.ts with this repository's `supabase/functions/extract-job/index.ts`.
3. Click **Deploy updates** and wait for success.
4. Keep **Verify JWT with legacy secret** off. The handler validates the signed-in user's access token with Supabase Auth before any fetching or AI call.

Fresh projects: Edge Functions → Deploy a new function → Via Editor, name it `extract-job`, paste the same code and deploy.

The source is a single file, including its pinned npm HTML parser import. Supabase bundles the dependency during deployment. Do not omit the import.

## 2. Optional free-tier AI

1. Create an account at https://console.groq.com and stay on the **Free** plan. Do not enable paid billing if you want zero AI charges.
2. Create an API key at https://console.groq.com/keys.
3. In Supabase **Edge Functions → Secrets**, add `GROQ_API_KEY` with the key as its value, then Save. Never put this key into GitHub, frontend environment variables, or chat.
4. In the tracker, check **Use AI to help extract details (Groq)** before extracting a link or pasted description.

The integration uses `openai/gpt-oss-20b` on Groq, not the OpenAI API. No ChatGPT subscription or OpenAI API key is used. The app cannot determine the billing plan of your key: if you upgrade your Groq account, Groq may bill requests. There is no paid-provider fallback or automatic retry.

Only the posting text, limited to its first 20,000 characters, is sent to Groq. It receives no tracker records, email address, login token or documents. The service returns suggestions with quotes; these require review. Quotes are checked against the input, but that cannot prove every interpretation is correct. Missing keys, quotas or invalid responses fall back to metadata/text extraction. With AI unchecked, pasted text stays on your device.

## What general-site support means

No employer enable list is used. The old `EXTRA_POSTING_HOSTS` setting can be left alone; this version ignores it. HTTPS links must resolve to public IPv4 addresses. Every redirect is independently checked and connections are pinned to the checked IP while TLS verifies the original hostname. Local/private addresses, custom ports, oversized responses, invalid framing and long-running requests are rejected. No credentials are forwarded to posting sites.

The function reads HTML; it does not log in, solve CAPTCHAs, run page scripts, or follow PDF guidelines. Blocked, PDF and JavaScript-only pages need pasted text. IPv6-only sites are not supported. Per-user throttling is best-effort per function instance, not a durable global quota.

Metadata extraction supports JSON-LD JobPosting and microdata. The ordinary prose parser recognizes common English labels, dates and salary patterns; it is not a general language model. Missing facts remain blank. Salary progression selects first-year pay and records later years in notes. Gross/net is left unknown unless supported. The date-only tracker preserves an advertised deadline time/timezone in notes; urgency badges do not count down to that exact time.

References: https://supabase.com/docs/guides/functions/quickstart-dashboard, https://console.groq.com/docs/structured-outputs, https://console.groq.com/docs/rate-limits, https://console.groq.com/docs/billing-faqs.
