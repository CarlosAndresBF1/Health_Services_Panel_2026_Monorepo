#!/bin/sh
set -e

echo "Running database migrations..."
npx typeorm migration:run -d dist/database/data-source.js
echo "Migrations complete."

echo "Running seeders..."
node dist/database/seeders/run-seeders.js
echo "Seeders complete."

echo "Starting API..."
exec node dist/main
