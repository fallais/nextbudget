# Domain enums

Closed sets of values the domain speaks in: visibilities, match types, account
kinds, asset types.

They are `as const` arrays with the union derived from them, **not** TypeScript
`enum`s. The values *are* the strings stored in Postgres and sent over HTTP, so
a union is exactly the right type — `row.visibility` needs no conversion at any
boundary. A string `enum` is nominally typed, so `"shared"` would not be
assignable to `Visibility.Shared`, forcing a mapping in every Zod schema, YAML
default, test and JSON payload; `enum` also emits runtime code, which sits badly
with `isolatedModules`.

Deriving the type from the array keeps one source of truth: the same
declaration gives the runtime list (for Zod schemas, `<Select>` options and
seeding) and the compile-time union.

```ts
export const VISIBILITIES = ["private", "shared"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
```
