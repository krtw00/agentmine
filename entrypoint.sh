#!/bin/sh
set -e

echo "========================================"
echo "AgentMine Docker Entrypoint"
echo "========================================"

# Install dependencies if node_modules is empty (happens with volume mounts)
if [ ! -d "/app/node_modules/.pnpm" ]; then
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile
  echo "Dependencies installed!"
fi

# Wait for database to be ready
if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database..."

  # Extract host and port from DATABASE_URL
  DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

  if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    for i in $(seq 1 30); do
      if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        echo "Database is ready!"
        break
      fi
      echo "Waiting for database at $DB_HOST:$DB_PORT... ($i/30)"
      sleep 1
    done
  fi
fi

# Run database initialization
echo "Running database initialization..."
set +e
pnpm tsx /app/scripts/db-init.ts
INIT_EXIT_CODE=$?
set -e

if [ $INIT_EXIT_CODE -ne 0 ]; then
  echo "WARNING: Database initialization failed (exit code: $INIT_EXIT_CODE)"
  echo "The application will start, but you may need to initialize the database manually."
else
  echo "Database initialized successfully!"
fi

echo "========================================"
echo "Starting application..."
echo "========================================"

exec "$@"
