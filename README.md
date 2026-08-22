# NextBudget

**Local-first personal finance dashboard for individuals and couples.**
Self-hosted, privacy-respecting, French/EU-first. Your data stays on infrastructure you control.

---

## Features

- **Dashboard** (Tableau de bord) — monthly income/expense overview and charts.
- **Transactions** — searchable, filterable ledger; manual edits; CSV export.
- **Import** (Importer) — drag-and-drop `.csv` / `.tsv` / `.txt` bank statements,
  parsed in-memory. Duplicate transactions are detected by a content hash, so
  re-importing overlapping files is safe.
- **Auto-categorization** — a transparent, rule-based engine (patterns, priorities,
  amount conditions) over a catalogue of ~390 French and European merchants that
  ships with the app. Your own rules always win, and any shipped merchant can be
  moved to another category or switched off without editing it.
- **Budgets** — per-category monthly/weekly budgets with progress tracking.
- **Fixed expenses** (Frais fixes) — recurring charges and their schedule.
- **Contributions** (Apports) — track who paid what into shared accounts — designed
  for couples/households splitting expenses.
- **Patrimoine / net worth** — track assets & liabilities (savings, real estate,
  vehicles, loans/mortgages with computed amortization) and your net worth over time.
- **Property estimation** — give a house or flat its address, surface and kind, and
  it can be valued from **DVF**, the public register of recorded French sale prices:
  the median €/m² of comparable sales nearby, with the range it sits in. Runs only
  when you ask for it — nothing leaves the machine on a page load.
- **Couples & privacy** — runs **login-free by default**; a household can enable
  per-user passwords, and mark any account / expense / contribution / asset as
  **shared or private**. Private rows stay hidden from other members.
- **French/EU locale everywhere** — amounts as `1 234,56 €`, dates as `15 mai 2026`.

## Quickstart (Docker Compose)

The published image lives at `ghcr.io/fallais/nextbudget`. `docker-compose.yaml`
brings up the app together with a Postgres database.

```bash
docker compose up -d
docker compose exec app npm run db:migrate   # first run: create schema + seed defaults
# → http://localhost:3000
```

Configuration is via environment variables (see [`.env.example`](./.env.example)):
`DATABASE_URL` (Postgres connection string) and optionally `TZ`. Everything else
— household, privacy, accounts, categories — is configured in the app itself.

By default there is **no login**: the app runs in open mode and resolves every
request to a single owner. That suits a laptop; for a machine on the network,
give the owner credentials before the first `db:migrate` and it comes up with
auth already enforced:

```yaml
environment:
  NEXTBUDGET_OWNER_NAME: Propriétaire         # a login identifier
  NEXTBUDGET_OWNER_EMAIL: vous@example.com    # the other one (optional)
  NEXTBUDGET_OWNER_PASSWORD: au-moins-8-caracteres
```

They are read only while the owner has no password — a value left in the file
cannot revert a password changed since. To change it afterwards:
`docker compose exec app npm run auth:reset -- <nouveau mot de passe>`, or
`npm run auth:reset` with no argument to drop back to open mode.

## Local development

Requires Node.js 20+ and a reachable PostgreSQL.

```bash
# A throwaway Postgres for development:
docker run -d --name nextbudget-db -e POSTGRES_USER=nextbudget \
  -e POSTGRES_PASSWORD=nextbudget -e POSTGRES_DB=nextbudget -p 5432:5432 postgres:16-alpine

export DATABASE_URL=postgres://nextbudget:nextbudget@localhost:5432/nextbudget
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

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Adding
merchant patterns is as easy as adding a line to
[`lib/categorize/categories.yaml`](./lib/categorize/categories.yaml).

## License

NextBudget is free software, licensed under the **GNU Affero General Public License
v3.0** (AGPLv3) — see [`LICENSE`](./LICENSE).

In short: you may use, study, modify, and redistribute it (including commercially),
but if you run a **modified** version as a network service, the AGPL requires you to
offer that version's complete source code to its users.
