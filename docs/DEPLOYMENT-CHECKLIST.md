# KDP Manager — safe deployment checklist

This branch is NOT approved for production deployment until all checks are complete.

## Existing production
- GitHub `main` automatically deploys to `lightcyan-crocodile-248294.hostingersite.com`.
- Existing MySQL tables: `admin_users`, `books`, `sales_records`.
- Never run destructive migrations or modify other Hostinger domains.

## Before merging
1. Confirm latest GitHub Actions workflow passes.
2. Verify Hostinger Node.js environment has working `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
3. Check whether `admin_users` already has an administrator (read-only query). Do not expose password hashes.
4. Provision the first admin through a private Hostinger execution environment using `KDP_ADMIN_USERNAME` and `KDP_ADMIN_PASSWORD`; run `npm run admin:create`. Never commit or paste secrets. The bootstrap script refuses to add another account if any admin exists.
5. Confirm admin row exists with a read-only count query. Do not expose credentials.
6. Arrange rollback to previous known-good `main` commit and backup existing database.
7. Merge only after explicit review; auto-deployment can begin immediately.

## After deployment
1. Check HTTPS and GET `/health`.
2. Confirm anonymous `/` redirects to `/login`, and anonymous `/books` and `/api/summary` return HTTP 401.
3. Log in with the newly provisioned admin; check cookie Secure/HttpOnly/SameSite=Strict.
4. Confirm dashboard loads real books and royalties, with no fictional entries.
5. Test creating and editing a real book only with the owner's permission; never insert dummy production records.
6. Log out and verify the protected routes are no longer accessible.
7. Review Hostinger runtime logs without printing credentials.

## Known limitations
- Sessions are in process memory and disappear on restart. Users must sign in again.
- Login rate limiting is in process memory; multi-process deployments need a shared store.
- This application is not connected to Amazon KDP; sales data is only from local MySQL.
- Current first-admin bootstrap is intended for controlled, one-time execution, not exposed over HTTP.
