# Changelog

This project uses version tags so a known working release can be restored if a later change causes a problem.

## 1.2.0 — 2026-09-22

- Replace the per-employer allowlist with public HTTPS address validation, DNS-pinned connections and checked redirects.
- Read page headings, tables, definition lists, JSON-LD and microdata; remove institution-specific extraction rules.
- Add explicitly opt-in Groq AI extraction for links and pasted descriptions, with source quotes and ordinary-parser fallback. A separately configured Groq key is required; stay on Groq's Free plan to avoid provider charges.
- Keep account records out of AI requests; validate returned fields and preserve stronger structured metadata.
- Reject ambiguous pages with multiple job postings rather than combine unrelated details.
- The updated Supabase function must be redeployed. EXTRA_POSTING_HOSTS is no longer used.

## 1.1.1 — 2026-09-19

- Parse written-out application deadlines and preserve the advertised time/timezone in notes.
- Extract prose headings and flexible start dates; identify ETH organization/location with an explicit inference notice.
- Read multiline salary progression, select the first-year amount, and preserve later-year figures without labelling them net pay.
- Add ETH posting hosts to the function defaults. Existing deployments can enable these through EXTRA_POSTING_HOSTS without replacing function code.
- Add regression tests for prose, flattened text, dates, and host validation.

## 1.1.0 — 2026-09-19

- Review extracted job fields from pasted descriptions or supported posting URLs. Link extraction requires a separately deployed Supabase function; see supabase/EXTRACTION-SETUP.md.
- Add net salary and salary-source columns, including posted, guessed, and calculated estimates.
- Calculate approximate monthly net from gross pay using an explicit deduction percentage, pay frequency and paid hours where applicable.
- Estimate missing net salary from comparable entries in the private tracker; preserve evidence and label it as guessed.
- Preserve existing records and completed document progress; allow horizontal table scrolling on phones.

## 1.0.0 — 2026-09-19

- Added the responsive application dashboard and five-step workflow.
- Added Supabase email authentication and account-specific storage.
- Added sortable and groupable applications, document tracking, and deadline urgency.
- Added GitHub Pages deployment and iPhone Home Screen support.