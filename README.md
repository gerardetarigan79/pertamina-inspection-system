# PHM Intelligence — Asset Integrity Workspace

A Next.js workspace for asset registration, inspection records, corrosion monitoring, production data, and user access control. The repository combines Neon-backed API routes with mock SAP / Direct Viewer endpoints and prototype UI areas; not every business workflow is connected to persisted data yet.

## Repository audit

- **Language:** TypeScript / TSX.
- **Framework:** Next.js App Router 15.5.29 (resolved in the lockfile), React 19.3.1, TypeScript 5.9.3.
- **Database client:** `@neondatabase/serverless` 1.2.1 using parameterized SQL; no ORM.
- **Database:** Neon PostgreSQL.
- **Authentication:** email/password, bcrypt password hashes, signed HTTP-only session cookies, and revocable sessions stored in Neon.
- **Roles:** `admin`, `inspector`, and `viewer`, mapped centrally in `app/lib/permissions.ts`.
- **UI:** React, custom CSS, and Lucide React icons.
- **Deployment:** Vercel-hosted Next.js; no custom `vercel.json` is required.
- **Package manager:** npm with the committed `package-lock.json`.

## Requirements

- Node.js **22.16.x** (see `.nvmrc` and `package.json`).
- npm 10.x.
- A Neon PostgreSQL database.

## Setup from scratch

### Install dependencies

```bash
nvm install
nvm use
npm ci
```

### Configure local environment

Copy the template to a local-only environment file.

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set these values in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon URL for application requests. The hostname should contain `-pooler`; include `?sslmode=require`. |
| `AUTH_SECRET` | Random secret of at least 32 characters for session-cookie signatures and rate-limit key hashing. |
| `DIRECT_URL` | Direct (non-pooler) Neon URL for migrations and one-time admin seeding. Include `?sslmode=require`. |
| `SEED_ADMIN_EMAIL` | Email address for the first administrator, used only by the seed command. |
| `SEED_ADMIN_PASSWORD` | Temporary first-admin password, at least 12 characters and no more than 72 UTF-8 bytes. Used only by the seed command. |

Generate an authentication secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

The application validates `DATABASE_URL` and `AUTH_SECRET` at startup. Do not commit `.env`, `.env.local`, or any real credentials.

### Initialize the database

Back up an existing Neon database before applying schema changes. Then use the **direct** connection URL for the migration and seed commands:

macOS / Linux:

```bash
export DIRECT_URL='postgresql://USER:PASSWORD@ep-example.REGION.aws.neon.tech/DBNAME?sslmode=require'
npm run db:migrate
export SEED_ADMIN_EMAIL='admin@example.com'
read -s SEED_ADMIN_PASSWORD
export SEED_ADMIN_PASSWORD
npm run db:seed-admin
unset SEED_ADMIN_PASSWORD
```

Windows PowerShell:

```powershell
$env:DIRECT_URL = 'postgresql://USER:PASSWORD@ep-example.REGION.aws.neon.tech/DBNAME?sslmode=require'
npm run db:migrate
$env:SEED_ADMIN_EMAIL = 'admin@example.com'
$env:SEED_ADMIN_PASSWORD = Read-Host 'Temporary admin password'
npm run db:seed-admin
Remove-Item Env:SEED_ADMIN_PASSWORD
```

The seed command creates an initial `admin` account that must change its temporary password on first login. If an account with that email already exists, the script does not change its role or password.

### Run checks and start

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run start
```

For development, use `npm run dev`.

## Authentication and roles

- Sign in at `/login`.
- The first sign-in with a temporary password redirects to `/change-password`.
- Sessions expire after eight hours. Session tokens are random and only their SHA-256 hashes are stored in the database.
- The browser cookie is HTTP-only, SameSite=Lax, and Secure in production.
- Logout deletes the current session record and clears the cookie.
- The server checks the active user and current role on every protected API request. Deactivating an account deletes its sessions.
- `admin`: all permissions, including account management.
- `inspector`: workspace read access and inspection write endpoints.
- `viewer`: read-only workspace access.
- Admins manage accounts at `/admin/users`. The API prevents removing the last active admin.

Login failures use a generic credential message. Repeated failures are limited by IP and by per-account temporary lockout.

## Vercel deployment

Vercel should detect the existing Next.js app automatically. Keep the standard settings:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: default Next.js output (`.next`)
- Node.js runtime: 22.16.x
- Production environment variables: `DATABASE_URL` (pooled Neon URL) and `AUTH_SECRET`
- Preview environment variables: `DATABASE_URL` (prefer a separate Neon branch) and `AUTH_SECRET`

`DIRECT_URL`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` are only needed in the trusted shell where database migrations or the one-time seed are run. Do not put the seed password in Vercel.

The CI workflow uses dummy database/auth values for build and server-start checks; it does not connect to Neon.

## Database migrations

Migrations run in filename order through `npm run db:migrate` and are tracked with SHA-256 checksums in `schema_migrations`. Applied migration files must not be edited; create a new migration instead.

- `000_source_tables.sql`: creates the source tables used by the existing API handlers when absent.
- `001_unified_asset_register.sql`: creates the asset register and its source-table foreign keys.
- `002_corrosion_monitoring.sql`: creates corrosion coupon and inhibitor monitoring.
- `003_authentication.sql`: creates users, sessions, and persistent login rate-limit storage.

**Existing database warning:** migration 001 can fail if source rows already exist with asset IDs that are not in `assets`. Resolve those rows with the data owner before applying the migration. The baseline uses `CREATE TABLE IF NOT EXISTS`; it does not alter an existing table definition to match the new baseline. Compare the existing Neon schema with the repository migrations before applying them to an established production database.

## Current implementation notes

- `app/api/assets`, `inspections`, `monitoring`, `pipeline-inspections`, and `production` contain Neon-backed handlers.
- `app/api/sap` and `app/api/direct-viewer` return deterministic mock data.
- Dashboard values and mock source records are illustrative and must not be interpreted as live Pertamina operational data.
