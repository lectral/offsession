# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
ARG NEXT_BUILD_ID=dev
ENV NEXT_BUILD_ID=$NEXT_BUILD_ID
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate
COPY . .
RUN npm run build
RUN if grep -R -n "discord\.com/api/webhooks/" .next/static; then \
            echo "Discord webhook leaked into frontend bundle" >&2; \
            exit 1; \
        fi

FROM base AS prisma-deps
WORKDIR /prisma-runtime
COPY package-lock.json ./package-lock.json
RUN node -e "const fs = require('node:fs'); const lock = require('./package-lock.json'); const prismaVersion = lock.packages['node_modules/prisma'].version; const clientVersion = lock.packages['node_modules/@prisma/client'].version; fs.writeFileSync('package.json', JSON.stringify({ name: 'prisma-runtime', private: true, dependencies: { prisma: prismaVersion, '@prisma/client': clientVersion } }, null, 2));"
COPY prisma ./prisma
RUN npm install --omit=dev --ignore-scripts \
    && ./node_modules/.bin/prisma generate \
    && npm cache clean --force

FROM base AS runner
WORKDIR /app
ARG NEXT_BUILD_ID=dev
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_BUILD_ID=$NEXT_BUILD_ID

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 nextjs \
    && install -d -o nextjs -g nodejs /app/db

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=prisma-deps --chown=nextjs:nodejs /prisma-runtime/node_modules ./node_modules
COPY --from=prisma-deps --chown=nextjs:nodejs /prisma-runtime/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs --chmod=755 /app/docker/entrypoint.sh ./docker/entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["./docker/entrypoint.sh"]
