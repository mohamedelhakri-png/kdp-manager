# KDP Manager — Unified Publishing Roadmap

## Confirmed requirements
- Existing Amazon KDP books must be managed alongside unpublished books.
- Unpublished book files currently live in one Google Drive folder.
- The dashboard must be usable from an Android phone.
- The only permitted production site is lightcyan-crocodile-248294.hostingersite.com.
- Do not modify other Hostinger sites, delete existing database records, or expose credentials.

## Current verified implementation
- MySQL-backed admin authentication, books, sales records, CSV import, analytics, expenses API/UI, and net profit per currency.
- Production deployment of commit 92b0de6 succeeded on 2026-11-05.
- The production expenses table is not yet verified as created. Expense/profit flows must be tested after migration.
- No live Amazon KDP synchronization or Google Drive OAuth integration is implemented.

## Product workflow
1. **Unpublished**: draft or ready-to-publish book, optional Google Drive source folder/file references, manuscript and cover links, publishing checklist.
2. **Published**: existing book promoted to published state with ASIN/ISBN, marketplace and publication date when known.
3. **Financial**: sales and expenses linked to the same book record; profit calculated per currency and period, without fabricated FX conversion.

## Delivery sequence
### Phase A — Stabilize production
- Verify login, book CRUD, sales CSV import, reports, and mobile UI.
- Run the existing additive expenses migration in the production database using an authorized SQL/shell channel.
- Verify expense entry and monthly net-profit reporting.
- Ensure errors and empty states are readable on mobile.

### Phase B — Unpublished-book workflow
- Extend book metadata with additive, backwards-compatible migration(s) only.
- Add draft/ready/published workflow; preserve existing draft/published/archived values until migration is tested.
- Provide an optional secure source-file link per book without copying manuscripts to Hostinger by default.
- Add filters and empty states for unpublished versus published books.

### Phase C — Google Drive folder connection
- User selects the single authorized folder through Google OAuth, ideally read-only access and least privilege.
- Store encrypted OAuth tokens server-side, never in client JavaScript or Git.
- List supported files and metadata; offer a preview and explicit import confirmation.
- Avoid duplicate imports via stable Drive file IDs and mapping; do not infer book titles solely from filenames without review.
- Handle revoked access, pagination, rate limits, and refresh failures.
- Do not automatically publish or share Drive files.

### Phase D — Amazon KDP ingestion
- Verify available official and policy-compliant access methods before promising direct synchronization.
- Keep manual/CSV import as a supported fallback.
- Import existing books and sales with deduplication, review, and currency fidelity.
- Never request or store Amazon account passwords in the application.

### Phase E — Release verification
- Automated tests for migration, access control, duplicate imports, and financial aggregation.
- Test with user-authorized real books; no fabricated production sales.
- Verify live deployment, mobile layout, and audit/rollback steps.

## Guardrails
- Changes to database schema must be additive and non-destructive.
- Do not enable a production integration until its credentials, scopes, security model, and tests are reviewed.
- No Google Drive folder link or account authorization has been supplied yet.
- Never claim direct Amazon/Drive integration is active before end-to-end verification.
