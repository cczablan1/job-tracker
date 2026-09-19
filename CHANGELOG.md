# Changelog

This project uses version tags so a known working release can be restored if a later change causes a problem.

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