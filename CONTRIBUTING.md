# Contributing to NextBudget

Thanks for your interest in improving NextBudget! This project is local-first
personal finance software — small, focused, and privacy-respecting.

## Ground rules

- **Code/identifiers in English, UI text in French.** Keep this split consistent.
- **Never commit personal or financial data.** No real bank statements, no `.db`
  files, no SQL dumps. `data/*` is gitignored — keep it that way. Use neutral,
  obviously-fake examples in placeholders and tests (e.g. `DURAND`, `JEAN`).
- By contributing, you agree your contributions are licensed under the project's
  **AGPLv3** license (see [`LICENSE`](./LICENSE)).

## Getting started

Requires Node.js 20+ and a reachable PostgreSQL.

```bash
# Throwaway dev Postgres:
docker run -d --name nextbudget-db -e POSTGRES_USER=nextbudget \
  -e POSTGRES_PASSWORD=nextbudget -e POSTGRES_DB=nextbudget -p 5432:5432 postgres:16-alpine
export DATABASE_URL=postgres://nextbudget:nextbudget@localhost:5432/nextbudget

npm install
npm run db:migrate   # synchronize schema from entities + seed
npm run dev
```

## Adding categories and merchant patterns

The easiest and most useful contribution. Everything lives in one file,
[`lib/categorize/categories.yaml`](./lib/categorize/categories.yaml) — no build
step, no registration, no plugin format. Most additions are one line:

```yaml
  - name: Alimentation
    patterns:
      - CARREFOUR
      - MONOPRIX      # ← your addition
```

Use the long form only when a plain "contains" match is not enough:

```yaml
      - pattern: VINCI
        matchType: starts_with     # contains (default) | equals | starts_with | regex
        amountCondition: positive  # any (default) | positive | negative
        priority: 90               # lower wins; default 100
```

What we take:

- **Yes** — chains people across a country or region would recognise
  (supermarkets, fuel, telecoms, streaming, insurers, utilities).
- **No** — your local baker, your landlord's name, your employer. Add those to
  your own install from the Rules page; they would only create false matches for
  everyone else.
- Patterns are matched case-insensitively against the *normalised* description,
  so write them upper-case and without accents.
- Keep patterns **specific enough not to collide**: `BP ` (with the space) rather
  than `BP`. Prefer the shortest string that is still unambiguous.

Patterns are seeded into the database at `npm run db:migrate` and are keyed on
the pattern text, so an existing install picks up new ones on its next migrate
without losing local edits. `npm test` checks the file parses and has no
duplicates.

## Before opening a pull request

```bash
npm run lint && npm run typecheck && npm test && npm run build   # all must pass
```

- Keep amounts as signed integer **cents**; format only at the UI edge (`lib/format.ts`).
- The schema is defined as TypeORM entities (`lib/db/entities.ts`) and applied via
  `synchronize` — there are no migration files to commit.
- All `app/api/**/route.ts` must `export const runtime = 'nodejs'` (TypeORM/pg).
- Match the French locale conventions for dates/currency (`1 234,56 €`, `15 mai 2026`).

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes and how to add a new bank parser.

## Reporting bugs / requesting features

Open an issue using the provided templates. For bugs, include steps to reproduce
and your environment (Docker vs local, Node version). **Do not paste real
transaction data** — redact or use synthetic examples.

## Security

Please do not open public issues for security-sensitive reports. Instead, contact
the maintainers privately (see the repository's security policy / contact).
