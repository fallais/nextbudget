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

# Everything Next needs at runtime + tsx + lib (for `npm run db:migrate`,
# which also reads the core pattern packs under lib/categorize/packs/).
COPY --from=builder --chown=app:app /app/.next             ./.next
COPY --from=builder --chown=app:app /app/public            ./public
COPY --from=builder --chown=app:app /app/node_modules      ./node_modules
COPY --from=builder --chown=app:app /app/package.json      ./package.json
COPY --from=builder --chown=app:app /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=app:app /app/next.config.ts    ./next.config.ts
COPY --from=builder --chown=app:app /app/lib               ./lib

USER app
EXPOSE 3000

# Data lives in Postgres (DATABASE_URL). `npm start` is `next start`.
CMD ["npm", "start"]
