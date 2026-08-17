# Couple support — implementation plan

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress

## Settled decisions

1. **Person = domain, User = auth.** Ownership shares hang off `persons`, so they
   work in solo/open mode with nobody logging in. `persons.user_id` links to a
   login when there is one.
2. **Config lives in the DB `settings` table, edited from the UI.** Env stays for
   infra only (`DATABASE_URL`, `TZ`, `PATTERN_PACKS`); break-glass gets npm scripts.
3. **Privacy ⇒ auth.** One switch, not two — visibility separation without login
   is theatre (`lib/auth/index.ts:42`).
4. **Three orthogonal axes, never merged:** ownership share (how much is yours) ·
   visibility (whether it's visible to the other) · payment share (who funds it).

## The core problem

`visibility` is a boolean, and it works fine for *flows* that belong wholly to one
person (budgets, contributions). Patrimoine is a *stock* that can be co-owned in a
proportion, and a boolean cannot tell 50/50 from 60/40.

This is already a latent bug: `getNetWorth()` sums `a.valueCents` whole for every
visible asset (`lib/db/assets.ts:41-46`). Two users in enforced mode with a shared
house → both see the full value, same house counted twice. Phase C fixes it.

## Dependency order

```
0 ──▶ A ──┬──▶ B ──┬──▶ D ──▶ E
          └──▶ C ──┘
```

`0` working tree · `A` persons↔users · `B` comptes · `C` quotes-parts ·
`D` réglages · `E` vues couple

**C only depends on A.** B and C are independent of each other.

---

## Phase 0 — Land the working tree

- [x] Verify the seven modified files typecheck, test and lint clean
- [x] Fix a pre-existing `npm run typecheck` failure (see below)
- [x] Commit them

**Pre-existing typecheck breakage, fixed here.** `npm run typecheck` was already
red before any of this work: in vitest 4.1.9 the `vitest/config` subpath's types
entry (`node_modules/vitest/config.d.ts`) re-exports from `"vitest/config"`, which
resolves straight back to itself, so `defineConfig` is never exported. Renamed to
`vitest.config.mts` (the tsconfig `include` already listed `**/*.mts`) and replaced
`defineConfig` with a plain object checked via `satisfies { test: TestUserConfig }`
from `vitest/node`, which has no cycle. Typecheck has to be a trustworthy gate for
every phase below, so this had to go first.

Six files add `items={{...}}` to Base UI `<Select>` roots so the trigger renders
the French label instead of the raw value. `components/assets/asset-form.tsx`
(+135/−32) adds per-nature type lists, `changeKind()` resnapping invalid types,
and the "also record the mortgage" checkbox.

Do this first: Phase C rewrites `asset-form.tsx` substantially. That mortgage
checkbox is the natural place for Phase C's `linked_asset_id`.

---

## Phase A — Persons ↔ users

**Goal:** a household member can map to a login. Today `persons.user_id` is
declared and then only ever *nulled* (`app/api/users/[id]/route.ts:88`) — never
set, never read.

**Schema:** none. The column exists (`lib/db/entities.ts:304`).

- [x] `lib/validation.ts:32` — `personInputSchema` accepts `userId: number | null`
- [x] `app/api/persons/route.ts`, `[id]/route.ts` — accept and persist the link,
      409 when a login is already claimed by another person (one login ⇒ at most
      one member, enforced in app code since there are no DB constraints)
- [x] `lib/db/household.ts` *(new)* — `listMembers()`, `getPersonForUser()`,
      `isUserLinkTaken()`
- [x] `lib/db/seed.ts:82` — in `backfillOwnership`, ensure a `Person` exists for
      the owner user; adopts a pre-existing unlinked person rather than
      duplicating them
- [x] `components/persons/person-form.tsx` — optional "compte utilisateur" select,
      rendered only when the install has more than one login

**Note:** `npm run db:migrate` does not read `.env.local` — that file is loaded by
Next, not by the standalone `tsx` script. Run it as
`DATABASE_URL=postgres://banquejs:banquejs@localhost:5432/banquejs npm run db:migrate`.

The seed step matters: without it a solo user has zero person rows until they
visit `/apports`, and Phase C's share picker would have nobody to assign to.

---

## Phase B — Accounts CRUD + per-account import

**Goal:** actually be able to have three accounts. Today
`getOrCreateDefaultAccount()` takes `find({ take: 1 })` — the first account,
whatever it is — or creates "Compte courant" (`lib/ingest/index.ts:44-51`), and
`/api/accounts` is GET-only. Every import lands in the same account.

**Schema:** `accounts.kind` text default `'personal'` — `personal` | `joint`.

Why an explicit column rather than deriving from `visibility`: joint-ness is a
fact about the *bank account*, and Phase E needs it to scope contribution
matching. Today a salary landing in a personal account can match a contribution
pattern, because matching runs over every transaction in scope
(`lib/db/contributions.ts:72-78`).

- [x] `lib/db/entities.ts:236` — `AccountEntity` + `kind`
- [x] `lib/validation.ts` — `accountInputSchema`
- [x] `app/api/accounts/route.ts` — add `POST`
- [x] `app/api/accounts/[id]/route.ts` *(new)* — `PATCH` / `DELETE`
- [x] `lib/ingest/index.ts:44-51,182` — accept an `accountId`; default lookup
      becomes fallback only
- [x] `app/api/ingest/route.ts` — read `accountId` from the multipart form
- [x] `components/import/import-button.tsx` — account selector, defaulting to the
      common account rather than whichever sorts first alphabetically
- [x] `app/(dashboard)/comptes/page.tsx` + `components/accounts/` *(new)*
- [x] `components/layout/sidebar.tsx` — nav entry
- [x] `lib/db/seed.ts` — backfill existing account → `kind='personal'`
- [x] **dedup scope fix — see below**

### Dedup was global; per-account import made that a bug

Not foreseen when this plan was written. `transactions.hash` is
`sha256(date|amountCents|normalizedDescription)` and carried a **globally**
unique index. Verified against the running app: importing the same statement
into a second account reported `rowsNew: 0, rowsDuplicate: 3` and inserted
nothing.

Two ways that bites once a household has more than one account:

1. Both partners pay 12,99 € to the same merchant on the same day — whoever is
   imported second silently loses the line.
2. A statement imported into the wrong account cannot be re-imported into the
   right one.

Fixed by scoping uniqueness rather than changing the hash: dropped
`unique: true` from the column and added a composite
`transactions_account_hash_uniq (account_id, hash)`. The hash stays a pure
content fingerprint, and **no rehashing or data migration is needed** — existing
rows keep their hashes and stay unique within their account. `CLAUDE.md` updated
to match, since it documented the old behaviour.

**Risk:** no DB-level FKs, so `DELETE` on an account with transactions would
orphan them silently. Block deletion when `count(transactions) > 0` and say so in
the error, consistent with the category/person DELETE routes.

**Free win:** the transactions account filter already exists, gated behind
`accounts.length > 1` (`components/transactions/filters.tsx:249`) — it appears on
its own.

---

## Phase C — Ownership shares for patrimoine

**Goal:** one apartment owned 100% by one person, one house owned 60/40, correct
net worth per person and for the household.

**Schema:**

```
asset_owners (id, asset_id, person_id, share_bps)
  unique (asset_id, person_id) · index (asset_id)

assets.linked_asset_id  int null   -- pairs a liability with the asset it finances
```

Basis points to match the existing `interest_rate_bps` convention. A join table
rather than `owner_id + share_bps` on `assets`: a percentage column forces you to
duplicate the asset row to express 60/40, which duplicates its valuations and its
mortgage link too.

**Invariants** (app-level, matching the no-FK-constraints convention):

- Shares for an asset sum to `10000`. Reject writes that don't.
- **An asset with no `asset_owners` rows reads as 100% to `assets.owner_id`.**
  Keeps every existing row correct without a data migration, and keeps solo mode
  working untouched.

- [x] `lib/db/entities.ts:383,449` — `AssetOwnerEntity`, `assets.linked_asset_id`,
      add to `ALL_ENTITIES`
- [x] `lib/shares.ts` *(new)* — pure share maths, DB-free so it is unit-testable
- [x] `lib/db/assets.ts` — `getNetWorthByPerson()`, `listAssetOwners()`,
      `effectiveOwners()` (the legacy fallback), `replaceAssetOwners()`
- [x] `lib/validation.ts` — `assetInputSchema` gains
      `owners: [{personId, shareBps}]` and `linkedAssetId`
- [x] `app/api/assets/route.ts`, `[id]/route.ts` — write owner rows
      transactionally with the asset; DELETE cascades ownership rows and clears
      inbound `linked_asset_id`
- [x] `components/assets/asset-form.tsx` — share picker, three presets:
      **Commun, à parts égales** · **À moi** · **Personnalisé…**; the mortgage
      checkbox links the loan to the property and copies its shares
- [x] `components/assets/assets-pane.tsx` — show the share on each row
- [x] `app/(dashboard)/patrimoine/page.tsx` — per-person cards alongside the
      household total
- [x] tests — sum-to-10000, rounding, even splits, formatting (18 assertions)

Verified against the running app with a house at 50/50 and a 310 000 € mortgage
at 50/50: household net −40 000 €, each person −20 000 €, summing back to the
household total instead of double-counting. With a personal flat and a legacy
asset added: household 145 000 € = Camille 160 000 € + Propriétaire −15 000 €,
the legacy asset (no ownership rows) correctly falling back to its `owner_id`.

### `.partial()` was silently resetting fields on every PATCH

Found by this phase, but pre-existing and **not** limited to assets. Zod 4 keeps
`.default()` on a key made optional by `.partial()`, so a PATCH body that omits
a field still parses to that field's default — and the route writes it. Sending
`{ owners: [...] }` to `/api/assets/1` reset the house's type to "other" and its
value to 0 (observed, then repaired).

All seven `*InputSchema.partial()` call sites were affected: assets, accounts,
persons, categories, rules, contributions, fixed expenses. Any partial PATCH
would quietly reset `tolerancePct`, `isActive`, `currency`, `visibility`, `kind`
and friends. The UI never tripped it because every form posts a complete body.

Fixed with `patchSchema()` in `lib/validation.ts`, which unwraps `ZodDefault`
before making keys optional, applied at all seven sites, with regression tests
in `lib/validation.test.ts`.

**Accepted limitation:** shares are not versioned. Buying out a partner mid-loan
would retroactively rewrite history, since `asset_valuations` is already a time
series. Rare enough to defer — the join table is what lets `from_date` be added
later without a rewrite.

**Deliberately separate:** ownership share ≠ payment share. A house owned 50/50
can be funded 70/30 through the joint account; that second fact already lives in
`contributions` + `fixed_expenses`. Show both, do not reconcile them.

---

## Phase D — Settings page, wizard, break-glass

**Goal:** make the above configurable by the non-technical half of the couple.
There is no settings page today (`/settings` 404s); the sidebar auth prompt is the
only config surface.

- [x] `app/(dashboard)/parametres/page.tsx` *(new)* — **Foyer** (members),
      **Confidentialité** (single privacy switch, reusing
      `components/auth/enable-auth-dialog.tsx`), **Comptes** shortcut
- [x] `lib/db/settings.ts` + `app/api/settings/route.ts` *(new)* —
      `settings.household` → `solo` | `couple`, written like `authMode`
      (`settings.key` is the PK, `save` upserts). PATCH is owner-only.
- [x] `components/settings/household-wizard.tsx` — one pass over the setup:
      name the second person, create the common account, switch to couple mode
- [x] `components/layout/sidebar.tsx` — nav entry
- [x] `scripts/auth-reset.ts` + `npm run auth:reset` — reset the owner password /
      drop back to `open`. Enforcing auth and forgetting the password was an
      unrecoverable lockout. A legitimate ops tool, not a throwaway script.

The privacy control is deliberately presented as one choice with honest labels
("Tout partagé (sans connexion)" vs "Chacun son espace (connexion requise)")
rather than as two independent toggles, since visibility without a login is
meaningless — `getCurrentUser()` just returns the owner in open mode.

---

## Phase E — Couple views

- [ ] **Apports** — scope contribution matching to `kind='joint'` transactions
      (depends on B); removes the false-positive class above
- [ ] **Dashboard** — household by default, per-person toggle in couple mode
- [ ] **Patrimoine** — per-person net worth from Phase C

**Out of scope for v1:** who-owes-whom settlement, and splitting a single
transaction across two people. Both real, both big, neither needed to answer
"what's mine, what's ours".

---

## Cross-cutting

**No migrations.** `synchronize: true` derives the schema from entities. New
nullable columns, new columns with defaults, and new tables are all safe. Run
`npm run db:migrate` after B and after C.

**Every phase must be a no-op for a solo user.** `getScope()` returns
`{scoped: false}` in open mode and all the scope helpers no-op
(`lib/db/scope.ts:15-19`), so the couple work rides the same path rather than
forking it. Verify after each phase that a single-account, single-person setup
renders identically.

**Tests** (`npm run test`, vitest, no DB): the share math is the part worth
covering. Amortization logic is untouched.
