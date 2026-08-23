<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-dark.svg">
  <img src="public/logo.svg" alt="NextBudget" width="330">
</picture>

**Local-first personal finance dashboard for individuals and couples.**
Self-hosted, privacy-respecting, French/EU-first. Your data stays on infrastructure you control.

[![CI](https://github.com/fallais/nextbudget/actions/workflows/ci.yml/badge.svg)](https://github.com/fallais/nextbudget/actions/workflows/ci.yml)
[![docker](https://github.com/fallais/nextbudget/actions/workflows/docker.yml/badge.svg)](https://github.com/fallais/nextbudget/actions/workflows/docker.yml)
[![CodeQL](https://github.com/fallais/nextbudget/actions/workflows/codeql.yml/badge.svg)](https://github.com/fallais/nextbudget/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/fallais/nextbudget/branch/main/graph/badge.svg)](https://codecov.io/gh/fallais/nextbudget)

[![License: AGPL v3](https://img.shields.io/badge/licence-AGPL--3.0-1D6EF2.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-0E2348?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-0E2348?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![ghcr.io](https://img.shields.io/badge/ghcr.io-nextbudget-0E2348?logo=docker&logoColor=white)](https://github.com/fallais/nextbudget/pkgs/container/nextbudget)

</div>

![NextBudget's dashboard: reste à vivre, spending by category, balance over time, this month's budgets and fixed expenses.](docs/img/dashboard.png)

<div align="center"><sub>The interface is French throughout. Every figure above is invented.</sub></div>

## Features

- **Dashboard** (Tableau de bord): monthly income/expense overview and charts.
- **Transactions**: searchable, filterable ledger, manual edits, CSV export.
- **Import** (Importer): drag-and-drop `.csv` / `.tsv` / `.txt` bank statements,
  parsed in-memory. Duplicate transactions are detected by a content hash, so
  re-importing overlapping files is safe.
- **Auto-categorization**: a transparent, rule-based engine (patterns, priorities,
  amount conditions) over a catalogue of ~390 French and European merchants that
  ships with the app. Your own rules always win, and any shipped merchant can be
  moved to another category or switched off without editing it.
- **Internal transfers** (Virements): moving money to your own savings account
  is not spending. Both legs are recognised automatically on import and left
  out of income, expenses and budgets, while staying on the statement and in
  the balance.
- **Budgets**: per-category monthly/weekly budgets with progress tracking.
- **Fixed expenses** (Frais fixes): recurring charges and their schedule.
- **Contributions** (Apports): track who paid what into shared accounts, for
  couples and households splitting expenses.
- **Patrimoine / net worth**: track assets & liabilities (savings, real estate,
  vehicles, loans/mortgages with computed amortization) and your net worth over time.
- **Property estimation**: give a house or flat its address, surface and kind, and
  it can be valued from **DVF**, the public register of recorded French sale prices:
  the median €/m² of comparable sales nearby, with the range it sits in. Runs only
  when you ask for it, and nothing leaves the machine on a page load.
- **Couples & privacy**: runs **login-free by default**. A household can enable
  per-user passwords, and mark any account / expense / contribution / asset as
  **shared or private**. Private rows stay hidden from other members.
- **French/EU locale everywhere**: amounts as `1 234,56 €`, dates as `15 mai 2026`.

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
(household, privacy, accounts, categories) is configured in the app itself.

By default there is **no login**: the app runs in open mode and resolves every
request to a single owner. That suits a laptop; for a machine on the network,
give the owner credentials before the first `db:migrate` and it comes up with
auth already enforced:

```yaml
environment:
  NEXTBUDGET_OWNER_NAME: Propriétaire         # a login identifier
  NEXTBUDGET_OWNER_EMAIL: vous@example.com    # the other one (optional)
  NEXTBUDGET_OWNER_PASSWORD: <votre-mot-de-passe>
```

They are read only while the owner has no password, so a value left in the file
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

Contributions are welcome: see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Adding
merchant patterns is as easy as adding a line to
[`lib/categorize/categories.yaml`](./lib/categorize/categories.yaml).

## License

NextBudget is free software, licensed under the **GNU Affero General Public License
v3.0** (AGPLv3). See [`LICENSE`](./LICENSE).

In short: you may use, study, modify, and redistribute it (including commercially),
but if you run a **modified** version as a network service, the AGPL requires you to
offer that version's complete source code to its users.
