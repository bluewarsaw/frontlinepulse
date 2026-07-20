#!/usr/bin/env bash
# Jednorazowa konfiguracja VPS (Ubuntu 22.04/24.04, użytkownik root).
# Instaluje: Node.js 22 LTS, PostgreSQL + PostGIS, nginx, pm2.
# Użycie: bash setup-vps.sh
set -euo pipefail

echo "== Pakiety systemowe =="
apt-get update
apt-get install -y curl git nginx postgresql postgresql-contrib postgis \
  postgresql-16-postgis-3 2>/dev/null ||
  apt-get install -y curl git nginx postgresql postgresql-contrib postgis

echo "== Node.js 22 LTS =="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "== Baza danych =="
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
sudo -u postgres psql <<SQL
CREATE USER frontline WITH PASSWORD '${DB_PASS}';
CREATE DATABASE frontline OWNER frontline;
SQL
sudo -u postgres psql -d frontline -c "CREATE EXTENSION IF NOT EXISTS postgis;"

echo "== Katalog aplikacji =="
mkdir -p /var/www/frontline

echo
echo "Gotowe. Zapisz connection string (użyj go w deploy/ecosystem.config.js):"
echo "  DATABASE_URL=postgres://frontline:${DB_PASS}@localhost:5432/frontline"
