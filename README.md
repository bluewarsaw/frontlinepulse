# Frontline Pulse — Regionalna Mapa Anomalii Hybrydowych

Narzędzie mapujące w czasie (quasi-)rzeczywistym incydenty wojny hybrydowej na
wschodniej flance NATO (Finlandia → Rumunia): zakłócenia GPS, cyberataki,
aktywność dronów, kampanie dezinformacyjne, incydenty graniczne i zagrożenia
infrastruktury krytycznej — wraz z **Korytarzami Zagrożeń**, czyli wizualizacją
kierunku, w którym przemieszcza się fala danego typu zagrożenia.

![stack](https://img.shields.io/badge/stack-Next.js%20%2B%20MapLibre%20%2B%20PostGIS-lime)

## Funkcje MVP

- Pełnoekranowa ciemna mapa (MapLibre GL + basemap CARTO Dark Matter)
- Warstwa heksagonów H3 z zakłóceniami GPS (realne dane z gpsjam.org)
- Punkty incydentów per kategoria (kolor + rozmiar wg wagi 1–4)
- Heatmapa napięcia dezinformacyjnego
- **Korytarze Zagrożeń** — animowane linie kierunkowe łączące centroidy
  klastrów incydentów (PostGIS `ST_ClusterDBSCAN`) w kolejnych oknach 24h
- Suwak czasu (7 dni) + okno 24h/48h/7 dni, filtry kategorii i kraju
- Feed incydentów ze szczegółami i linkami do źródeł
- Pasek "pulsu regionu": liczba incydentów 24h per kategoria + trend

## Źródła danych

| Kategoria | Źródło | Status |
|---|---|---|
| Zakłócenia GPS / EW | [gpsjam.org](https://gpsjam.org) — dzienny dataset H3 (CC-BY, John Wiseman / ADS-B Exchange) | realne dane |
| Cyber (kampanie, malware, phishing) | [CERT Polska](https://cert.pl/rss.xml) — oficjalny RSS (bez CVE flood) | realne dane |
| Dezinformacja | [EUvsDisinfo](https://euvsdisinfo.eu/feed/) — RSS analiz/debunków (filtr flanki NATO) | realne dane |
| Dezinformacja, drony, cyber, granica (doniesienia medialne) | [GDELT 2.0](https://www.gdeltproject.org) — strumień zdarzeń co 15 min, geotagowany | realne dane |
| Cyber, drony, granica, infrastruktura (szczegółowe) | seed oparty na rzeczywistych, publicznie opisywanych wzorcach incydentów 2024–2026 | dane poglądowe |

Uwaga: API GEO 2.0 GDELT (`api.gdeltproject.org/api/v2/geo/geo`) zwraca
obecnie 404, dlatego ingestor korzysta z surowego strumienia zdarzeń
(`data.gdeltproject.org/gdeltv2/`) — również darmowego.

W kolejnych fazach architektura ingestorów (`src/lib/ingest/`) pozwala podpiąć
Wingbits, Shodan, MISP/OpenCTI czy LiveUAMap bez zmian w API i UI.

## Architektura

```
gpsjam.org CSV ─┐
GDELT events  ──┼─> ingestory (tsx) ─> PostgreSQL + PostGIS ─> API routes ─> mapa MapLibre
seed          ──┘                                              (Next.js)      + panel + feed
```

- **Frontend/Backend**: Next.js 16 (App Router, TypeScript), TailwindCSS 4, MapLibre GL JS
- **Baza**: PostgreSQL 17 + PostGIS (operacje przestrzenne, klastrowanie DBSCAN)
- **Ingestory**: skrypty TypeScript (tsx) + endpoint `POST /api/ingest` do crona

## Uruchomienie

### 1. Baza danych (PostGIS)

Wariant A — Docker (jeśli dostępny):

```bash
docker compose up -d
```

Wariant B — [Postgres.app](https://postgresapp.com) (macOS, zawiera PostGIS):

```bash
PGBIN=/Applications/Postgres.app/Contents/Versions/17/bin
"$PGBIN/initdb" -D ./db/pgdata -U frontline --auth=trust -E UTF8
npm run db:start
"$PGBIN/psql" -h localhost -p 5433 -U frontline -d postgres -c "CREATE DATABASE frontline;"
"$PGBIN/psql" -h localhost -p 5433 -U frontline -d frontline -f db/init/001_schema.sql
```

Baza nasłuchuje na porcie **5433** (connection string w `.env.example`).

### 2. Dane

```bash
npm install
npm run ingest            # wszystko: seed + gpsjam (7 dni) + GDELT (24h)
npm run ingest:gpsjam     # tylko heksy/incydenty GPS
npm run ingest:gdelt      # tylko GDELT (opcjonalnie: -- 288 = 3 dni)
npm run ingest:seed       # tylko dane poglądowe
```

### 3. Aplikacja

```bash
npm run dev               # http://localhost:3000
```

Odświeżanie danych w tle: `curl -X POST http://localhost:3000/api/ingest`
(np. z crona co 15 minut).

## API

| Endpoint | Opis |
|---|---|
| `GET /api/incidents?from&to&categories&country` | GeoJSON punktów incydentów |
| `GET /api/gps-hexes?date=YYYY-MM-DD` | GeoJSON heksagonów H3 z zakłóceniami GPS |
| `GET /api/corridors?to&days` | GeoJSON linii korytarzy zagrożeń (DBSCAN + centroidy okien 24h) |
| `GET /api/stats?to` | Puls regionu: liczby 24h vs poprzednie 24h |
| `POST /api/ingest` | Odświeżenie danych (gpsjam + GDELT) |

## Atrybucje

- Dane o zakłóceniach GPS: [gpsjam.org](https://gpsjam.org) — © John Wiseman,
  licencja CC-BY, na podstawie danych ADS-B Exchange
- Monitoring mediów: [GDELT Project](https://www.gdeltproject.org)
- Mapa bazowa: © [CARTO](https://carto.com), © OpenStreetMap contributors

## Wdrożenie na hosting współdzielony seohost.pl (Opcja A)

Hosting seohost + baza **Neon** (PostgreSQL/PostGIS) — bez VPS.

Pełna instrukcja: **[deploy/SEOHOST.md](deploy/SEOHOST.md)**

```bash
# Neon: utwórz projekt, uruchom db/init/001_schema.sql w SQL Editor
DATABASE_URL="postgres://..." npm run ingest
npm run package:seohost
# Wgraj deploy/frontline-seohost.tar.gz → ~/frontline na serwerze
# DirectAdmin → Setup Node.js App → startup file: server.js
```

## Wdrożenie na VPS (np. seohost.pl)

Pliki pomocnicze znajdują się w katalogu `deploy/`.

1. **Serwer (jednorazowo, jako root):** skopiuj i uruchom `deploy/setup-vps.sh`
   — zainstaluje Node.js 22, PostgreSQL + PostGIS, nginx i pm2 oraz utworzy
   bazę `frontline` (skrypt wypisze wygenerowany `DATABASE_URL`).
2. **Kod:** `git clone` (lub `rsync`) do `/var/www/frontline`, następnie:

   ```bash
   cd /var/www/frontline
   npm ci
   psql "postgres://frontline:HASLO@localhost:5432/frontline" -f db/init/001_schema.sql
   DATABASE_URL=postgres://frontline:HASLO@localhost:5432/frontline npm run ingest
   npm run build
   ```

3. **Proces:** wpisz swój `DATABASE_URL` w `deploy/ecosystem.config.js` i:

   ```bash
   pm2 start deploy/ecosystem.config.js
   pm2 startup && pm2 save        # autostart po restarcie serwera
   ```

4. **Domena i SSL:** skopiuj `deploy/nginx.conf.example` do
   `/etc/nginx/sites-available/frontline` (podmień `twojadomena.pl`),
   aktywuj i wystaw certyfikat:

   ```bash
   ln -s /etc/nginx/sites-available/frontline /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d twojadomena.pl
   ```

5. **Automatyczne odświeżanie danych:** `crontab -e` i dodaj:

   ```cron
   */15 * * * * curl -s -X POST http://127.0.0.1:3000/api/ingest > /dev/null
   ```

W panelu seohost ustaw rekord DNS `A` domeny na adres IP VPS-a.

## Poza zakresem MVP

Płatne integracje (Wingbits, Shodan, LiveUAMap), powiadomienia push /
geofencing ("jesteś w promieniu zakłóceń"), konta użytkowników, deploy
produkcyjny.
