#!/bin/bash
set -e

# Port binding for Cloud Run ($PORT default is 8080)
PORT="${PORT:-8080}"
sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/:80/:${PORT}/g" /etc/apache2/sites-available/000-default.conf

echo "==> Configuring Trax LRS on Cloud Run (Port: ${PORT}) <=="

# Ensure application key exists
if [ -z "$APP_KEY" ]; then
    echo "Notice: APP_KEY not provided. Generating new key..."
    php artisan key:generate --force || true
fi

# Run database migrations if DB_HOST or DB_SOCKET is provided
if [ -n "$DB_HOST" ] || [ -n "$DB_SOCKET" ]; then
    echo "==> Verifying Database Connection and Running Migrations <=="
    php artisan migrate --force --no-interaction || echo "Warning: Database migration deferred or already complete."
fi

# Execute CMD (apache2-foreground)
exec "$@"
