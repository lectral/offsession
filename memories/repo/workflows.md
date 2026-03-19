## Knoladge Base

- Local dev flow from README: `npm ci`, `export DATABASE_URL="file:./db/offsession.db"`, `npm run db:generate`, `npm run db:push`, `npm run dev`.
- Runtime DB default in containers is `file:../db/custom.db`. `docker/entrypoint.sh` creates `/app/db`, sets the default `DATABASE_URL` when missing, then runs `prisma db push --skip-generate` before starting the standalone server.
- Docker build is multi-stage and explicitly checks the built frontend for leaked Discord webhook URLs with `grep -R "discord\.com/api/webhooks/" .next/static`.
- `src/lib/db.ts` caches a Prisma client on `globalThis` outside production and enables query logging with `log: ['query']`.
- `docker-compose.yaml` mounts `/app/db` to the named volume `offsession-db` and health-checks the app through `GET /api` on localhost.
- Tests use `bun:test` in `src/__tests__/*.test.ts`, even though `package.json` does not define a `test` script.
- Test harness detail: `src/__tests__/api.test.ts` mocks `@/lib/db` at the module boundary and imports route handlers lazily in `beforeAll`, so route tests exercise real handler code with in-memory DB stubs.
- API routes consistently opt out of caching with `dynamic = 'force-dynamic'`, `revalidate = 0`, and `fetchCache = 'force-no-store'`.
