# My, Oh My

QR-based restaurant ordering and staff operations for My, Oh My in Andheri West, Mumbai. Built with Next.js, React, TypeScript, Prisma, and PostgreSQL.

## Guest and staff workflows

- Guests scan table QR codes, browse menu categories and Chef's Specials, order more at any time, and see all items ordered for the table, including delivered items. Menu nutrition is optional and should only be entered by staff using verified per-serving values. Payment is collected at the restaurant counter only.
- Staff use the Admin Desk at `/admin/counter` to review table orders, settle bills, and print bills. Menu, table QR, and service-request tools are available from the Admin Desk.
- The Admin Desk, Kitchen, and Service queue refresh from their APIs while open. Staff accounts, menu inventory, and operations metrics sync periodically and when a staff member returns to the tab; manual sync controls always request fresh server data and display failures instead of silently appearing successful.
- Owners, managers, and cashiers can use `/admin/history` to find current and past table visits, including orders and settlement/payment details. History is retained in PostgreSQL after a table is cleared; local development stores it in `.data` JSON files.
- Kitchen staff use `/admin/kitchen` to view incoming orders as large notifications and mark each dish done individually; an order is delivered when all its dishes are done. New orders are accepted by default.

## Local development

```bash
npm install
npx prisma generate
npm run dev
```

Without a database, local development uses `.data` JSON files and mock staff PINs. Use `1111` for the local Owner account in the Admin Desk; the Kitchen demo PIN is `3456`. These mock credentials are disabled in production.

## Production setup

This application requires a persistent Node.js deployment, PostgreSQL, and a mounted persistent volume for uploaded images. Do not deploy it to an ephemeral/serverless runtime unless uploads are moved to a durable object-storage provider.

1. Provision PostgreSQL with automated backups. Set production secrets from `.env.example` in the hosting provider (do not commit `.env`):
   - `DATABASE_URL`: production PostgreSQL connection string with TLS.
   - `NEXT_PUBLIC_APP_URL`: the restaurant's public HTTPS URL.
   - `RESEND_API_KEY` and `EMAIL_FROM`: verified Resend sender credentials for staff account invitations and PIN reset links.
   - `STAFF_JWT_SECRET`: at least 32 characters; use 64 cryptographically random bytes encoded as hex, generated with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
   - `INITIAL_OWNER_EMAIL`: a valid, unique email for the initial owner (recommended for staff account recovery).
   - `INITIAL_OWNER_PIN`: unique PIN of at least 8 digits, set only for initial seeding (never use the local `1111` demo PIN).
   - `UPLOADS_DIR`: absolute path to the host's persistent mounted volume.
   Keep `STAFF_JWT_SECRET` stable across restarts. Remove `INITIAL_OWNER_PIN` from the host configuration immediately after the initial seed; rerunning the seed with it set resets the owner's PIN.
2. From the project directory, apply the schema and seed the restaurant:
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```
   Back up the database before schema changes. The seed generates random table QR tokens, seeds categories/dishes and default carousel slides, and creates the initial owner PIN hash. Deliver the initial PIN securely, rotate it after setup, and remove it from host configuration immediately after seeding. Reprint QR standees from the live admin interface; the counter and QR generator load active tables from PostgreSQL, so never use development sample QR tokens.
3. Build and run the app on a persistent Node.js host using Node.js 20.19+ or 22.13+:
   ```bash
   npm ci
   npx prisma generate
   npm run build
   npm run start
   ```
   Configure the host to build from the project directory and run `npm run start` with the production environment variables set.
4. Configure the host to mount the same durable volume at `UPLOADS_DIR` on every app instance. Uploaded images are served through `/api/uploads/[filename]`.
5. Configure edge-level rate limiting for `/api/auth/staff/login`. The app also throttles failed logins per process, but that is not a distributed limiter.
6. Configure the host health check to call `/api/health`. It returns success only when PostgreSQL is reachable.
7. Verify staff accounts and roles, live menu and prices, table QR tokens, kitchen/counter devices, backup restore, and connectivity before opening.

The login route only authenticates staff stored in the production database. Development PINs are disabled in production. Menu, carousel, upload, service-queue, session, and order-management APIs enforce staff authorization where applicable. Production data routes do not fall back to local JSON when PostgreSQL is unavailable.

## Restaurant operations caveats

- Guests do not pay online; the app records payment at the counter.
- Tax, invoice numbering, discounts, receipts, and settlement workflows must be reviewed and configured with the restaurant's accountant and POS provider before use. The current invoice screen is a print-oriented application flow, not a certified GST/POS integration.
- The owner or a manager can provision staff at `/admin/staff`. Search and filter team accounts, check their last sign-in, send a secure PIN setup/reset link, or activate/deactivate access. Each account uses a unique email and role; staff set their own unique 6–8 digit PIN through a one-time email link. Configure PostgreSQL, `RESEND_API_KEY`, and `EMAIL_FROM` before using these actions. PIN changes and account deactivation revoke existing staff sessions.
- Guest-facing order status links require the table QR token and do not return customer contact details. Staff operational data is scoped to the restaurant assigned to the signed-in account.
- Apply schema changes with `npx prisma db push` after backups, including the staff PIN token and session-version fields.
- Use HTTPS for guest QR links and staff sessions.

## Validation

```bash
npm run lint
npm run build
```
