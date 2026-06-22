# BanqueJS

**Local-first personal finance dashboard for individuals and couples.**
Self-hosted, privacy-respecting, French/EU-first. Your data stays on infrastructure you control.

> ⚠️ **Status: early / pre-1.0.** BanqueJS is the open-source evolution of a private
> finance dashboard. The UI is in **French**; the code is in English. Multi-user,
> optional auth, and assets/net-worth features are on the [roadmap](#roadmap).

Built with **Next.js 15** (App Router), **PostgreSQL** (TypeORM), and Tailwind.
No external services, no telemetry — self-host with Docker Compose (app + Postgres).

---

## Features

- **Dashboard** (Tableau de bord) — monthly income/expense overview and charts.
- **Transactions** — searchable, filterable ledger; manual edits; CSV export.
- **Import** (Importer) — drag-and-drop `.csv` / `.tsv` / `.txt` bank statements,
  parsed in-memory. Duplicate transactions are detected by a content hash, so
  re-importing overlapping files is safe.
- **Auto-categorization** — a transparent, rule-based engine (patterns, priorities,
  amount conditions) with a batteries-included set of French merchant rules.
- **Budgets** — per-category monthly/weekly budgets with progress tracking.
- **Fixed expenses** (Frais fixes) — recurring charges and their schedule.
- **Contributions** (Apports) — track who paid what into shared accounts — designed
  for couples/households splitting expenses.
- **French/EU locale everywhere** — amounts as `1 234,56 €`, dates as `15 mai 2026`.

## Quickstart (Docker Compose)

The published image lives at `ghcr.io/banquejs/banquejs`. `docker-compose.yaml`
brings up the app together with a Postgres database.

```bash
docker compose up -d
docker compose exec app npm run db:migrate   # first run: create schema + seed defaults
# → http://localhost:3000
```

Configuration is via environment variables (see [`.env.example`](./.env.example)):
`DATABASE_URL` (Postgres connection string) and optionally `PATTERN_PACKS`.

## Local development

Requires Node.js 20+ and a reachable PostgreSQL.

```bash
# A throwaway Postgres for development:
docker run -d --name banquejs-db -e POSTGRES_USER=banquejs \
  -e POSTGRES_PASSWORD=banquejs -e POSTGRES_DB=banquejs -p 5432:5432 postgres:16-alpine

export DATABASE_URL=postgres://banquejs:banquejs@localhost:5432/banquejs
npm install
npm run db:migrate   # synchronize schema from entities + seed (idempotent)
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build (does NOT need a database)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest unit tests
```

## How it works

- Amounts are stored as **signed integer cents** (`bigint`) and formatted only at
  the UI edge.
- The schema is defined as **TypeORM entities** (`lib/db/entities.ts`) and applied
  via `synchronize` — there are no migration files to manage.
- Imports are parsed by a small **parser registry** (`lib/ingest/`); adding support
  for a new bank format is a single file — see `CLAUDE.md` → *Adding a new bank parser*.
- Categorization rules live in `lib/categorize/`; default patterns ship as YAML
  **packs** under `lib/categorize/packs/core/` (well-known French chains). Extra
  packs can be loaded at runtime via `PATTERN_PACKS`.
- All `app/api/**/route.ts` handlers run on the Node.js runtime.

## Roadmap

BanqueJS aims to fill a gap among self-hosted finance tools: first-class
**couples/household** support, **optional built-in** auth, and a **French/EU-first**
experience, in one local-first app.

- Multi-user / couples: each person owns accounts/budgets/contributions, each row
  optionally **private** or **shared** (ownership columns already in the schema).
- Optional built-in auth: runs login-free by default; a household can switch on
  per-user passwords to make private data private.
- Assets & liabilities: house/car credit, savings, investments → **net worth**.
- AI-assisted categorization.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Adding
merchant patterns is as easy as editing `lib/categorize/packs/core/fr.yaml`.

## License

BanqueJS is free software, licensed under the **GNU Affero General Public License
v3.0** (AGPLv3) — see [`LICENSE`](./LICENSE).

In short: you may use, study, modify, and redistribute it (including commercially),
but if you run a **modified** version as a network service, the AGPL requires you to
offer that version's complete source code to its users.
