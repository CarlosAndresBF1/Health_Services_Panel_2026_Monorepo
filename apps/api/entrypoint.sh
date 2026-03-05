#!/bin/sh
set -e

echo "Running database migrations..."
npx typeorm migration:run -d dist/database/data-source.js
echo "Migrations complete."

echo "Starting API..."
exec node dist/main
