# Contributing to BanqueJS

Thanks for your interest in improving BanqueJS! This project is local-first
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
docker run -d --name banquejs-db -e POSTGRES_USER=banquejs \
  -e POSTGRES_PASSWORD=banquejs -e POSTGRES_DB=banquejs -p 5432:5432 postgres:16-alpine
export DATABASE_URL=postgres://banquejs:banquejs@localhost:5432/banquejs

npm install
npm run db:migrate   # synchronize schema from entities + seed
npm run dev
```

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
