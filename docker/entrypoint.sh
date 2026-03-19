#!/bin/sh
set -eu

mkdir -p /app/db

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:../db/custom.db"
fi

./node_modules/.bin/prisma db push --schema ./prisma/schema.prisma --skip-generate
exec node server.js
