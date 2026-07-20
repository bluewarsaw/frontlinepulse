#!/usr/bin/env bash
# Paczka pod CloudLinux / DirectAdmin (seohost.pl).
# BEZ node_modules — instalacja przez "Run NPM Install" w panelu.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/dist-seohost"
ARCHIVE="$ROOT/deploy/frontline-seohost.tar.gz"

cd "$ROOT"

echo "== npm ci + build (CloudLinux) =="
npm ci
npm run build

echo "== pakowanie =="
rm -rf "$OUT"
mkdir -p "$OUT"

cp -R .next "$OUT/.next"
cp -R public "$OUT/public"
cp package.json package-lock.json "$OUT/"
cp deploy/server-cloudlinux.js "$OUT/server.js"
cp deploy/env-for-seohost.env "$OUT/.env.example"

# CloudLinux wymaga braku node_modules w katalogu app
rm -rf "$OUT/node_modules"

tar -czf "$ARCHIVE" -C "$OUT" .
SIZE=$(du -sh "$OUT" | cut -f1)

echo
echo "Gotowe ($SIZE)."
echo "  Archiwum: deploy/frontline-seohost.tar.gz"
echo "  Przykładowy .env: deploy/env-for-seohost.env  → wgraj jako frontline/.env"
echo
echo "Na serwerze:"
echo "  1. Usuń WSZYSTKO w ~/domains/frontlinepulse.eu/frontline/ (zostaw tylko .env)"
echo "  2. Rozpakuj archiwum do frontline/"
echo "  3. Upewnij się że jest plik .env (nie .env.example!)"
echo "  4. Run NPM Install → Restart"
