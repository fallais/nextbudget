# syntax=docker/dockerfile:1.7

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# pg and typeorm are pure-JS — no native toolchain needed.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r app && useradd -r -g app -d /app app

# Everything Next needs at runtime, plus what the `tsx` scripts need:
#   npm run db:migrate  → libs/ (incl. categorize/categories.yaml) + tsconfig.json
#   npm run auth:reset  → scripts/
# tsconfig.json is not optional: the scripts import through the `@domain/*`,
# `@application/*`, `@infrastructure/*` and `@shared/*` aliases, and tsx resolves
# those from tsconfig `paths`.
COPY --from=builder --chown=app:app /app/.next             ./.next
COPY --from=builder --chown=app:app /app/public            ./public
COPY --from=builder --chown=app:app /app/node_modules      ./node_modules
COPY --from=builder --chown=app:app /app/package.json      ./package.json
COPY --from=builder --chown=app:app /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=app:app /app/next.config.ts    ./next.config.ts
COPY --from=builder --chown=app:app /app/tsconfig.json     ./tsconfig.json
COPY --from=builder --chown=app:app /app/libs              ./libs
COPY --from=builder --chown=app:app /app/scripts           ./scripts

USER app
EXPOSE 3000

# Data lives in Postgres (DATABASE_URL). `npm start` is `next start`.
CMD ["npm", "start"]
