# PHM Intelligence — Asset Integrity Workspace

A Next.js workspace for asset registration, inspection records, corrosion monitoring, and production data. The repository currently combines Neon-backed API routes with mock SAP / Direct Viewer endpoints and prototype UI areas; not every screen is connected to persisted data yet.

## Repository audit

- **Language:** TypeScript (with TSX for the Next.js UI).
- **Framework:** Next.js App Router; lockfile resolves Next.js 15.5.29, React 19.3.1, and TypeScript 5.9.3.
- **Database client:** `@neondatabase/serverless` 1.2.1 using tagged-template SQL; there is no ORM.
- **Database:** Neon PostgreSQL; API routes read `DATABASE_URL`.
- **Authentication:** none is implemented in the current repository.
- **UI:** React, custom CSS, and Lucide React icons; no component-library dependency.
- **Deployment:** the repository is configured as a Vercel-hosted Next.js project (the repository homepage points to the Vercel deployment); there is no committed `vercel.json`.
- **Package manager:** npm, with the committed `package-lock.json`.

## Setup from scratch

### Requirements

- Node.js **22.16.x** (see `.nvmrc` and `package.json`).
- npm 10.x.
- A Neon PostgreSQL database for routes that query persisted data.

### Install and configure

```bash
nvm install
nvm use
npm ci
```

Copy the environment template to a local-only file and put your **pooled Neon connection string** in `DATABASE_URL`. The hostname should contain `-pooler` and the URL must include `?sslmode=require`.

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

The server validates `DATABASE_URL` at startup and displays a clear error if it is missing.

### Verify and run

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run start
```

For development, use `npm run dev` instead of `npm run start`.

## Environment variables

| Variable | Purpose | Where to set it |
| --- | --- | --- |
| `DATABASE_URL` | Required pooled Neon PostgreSQL URL for runtime API requests; include `sslmode=require`. | `.env.local`; Vercel Project Settings → Environment Variables for **Production** and **Preview**. Use a separate Neon branch URL for Preview where available. |

Do not commit `.env`, `.env.local`, or any real connection string. The CI workflow uses a placeholder URL and does not connect to Neon.

## Deployment (Vercel)

Vercel should detect the existing Next.js app automatically. Keep the standard Next.js settings:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave the Next.js default (`.next`)
- Runtime: Node.js 22.16.x
- Environment: set `DATABASE_URL` for Production and Preview

No custom Vercel configuration file is currently present in the repository.

## Database bootstrap status — action required before a clean Neon database can be initialized

The repository currently has two SQL files under `database/migrations`, but it does **not** yet have a migration runner or a seed script.

There is also a dependency gap in the existing migrations: `001_unified_asset_register.sql` creates `assets` and then adds foreign keys to `production_readings`, `inspection_records`, and `pipeline_inspections`, but this repository does not contain migrations that create those three prerequisite tables. `002_corrosion_monitoring.sql` depends on `assets`. Therefore the committed migrations cannot currently initialize an empty database from scratch.

The repository also has no users table or authentication implementation. An admin seed cannot safely be written until the user/authentication schema and password-hashing approach are agreed in Phase 1. Do not treat the existing migration files as a complete fresh-database bootstrap, and do not run them against production as a substitute for a reviewed baseline migration.

**Needed to finish database bootstrap:** obtain the canonical schema (or a schema-only export) from the current Neon database for the three source tables, confirm whether existing data must be preserved, and then add a baseline migration plus an ordered migration runner and a seed command in the appropriate phase.

## Current implementation notes

- `app/api/assets`, `inspections`, `monitoring`, `pipeline-inspections`, and `production` contain Neon-backed handlers.
- `app/api/sap` and `app/api/direct-viewer` return deterministic mock data.
- Authentication and role-based authorization are not yet implemented; these are Phase 1 work.
- `database/migrations` contains incremental SQL only; see the bootstrap limitation above.
- Dashboard values and mock source records are illustrative and must not be interpreted as live Pertamina operational data.
