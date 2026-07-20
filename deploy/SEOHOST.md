# Frontline Pulse — wdrożenie na hosting współdzielony seohost.pl (Opcja A)
#
# Architektura:
#   seohost.pl (DirectAdmin, Node.js)  →  aplikacja Next.js
#   Neon.tech (darmowa baza)           →  PostgreSQL + PostGIS
#   Twój Mac / PC                      →  build + pierwszy ingest danych

## Wymagania

- Konto hostingowe seohost.pl z **dostępem SSH** i **Setup Node.js App** w DirectAdmin
- Domena wskazująca na hosting (rekord A lub nameservery seohost)
- Darmowe konto na [neon.tech](https://neon.tech) (baza PostgreSQL z PostGIS)
- Node.js 20+ lokalnie (do buildu i ingestu)

---

## Krok 1 — Baza danych Neon (PostGIS)

1. Załóż projekt na [console.neon.tech](https://console.neon.tech)
2. Skopiuj **connection string** (PostgreSQL) — wygląda tak:
   ```
   postgres://user:haslo@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
3. W **SQL Editor** uruchom schemat aplikacji — wklej całą zawartość pliku
   `db/init/001_schema.sql` z tego repozytorium.
4. Potwierdź, że PostGIS działa:
   ```sql
   SELECT PostGIS_Version();
   ```

Zapisz connection string — to Twój `DATABASE_URL`.

---

## Krok 2 — Pierwsze dane (na Macu, przed wgraniem)

W katalogu projektu:

```bash
cd /Users/sebastianczarnecki/Desktop/frontline
npm ci

# Załaduj dane do Neon (może potrwać kilka minut)
DATABASE_URL="postgres://..." npm run ingest

# Sprawdź, czy są incydenty
DATABASE_URL="postgres://..." npx tsx -e "
import { pool } from './src/lib/db.ts';
const r = await pool.query('SELECT category, count(*) FROM incidents GROUP BY 1');
console.log(r.rows);
await pool.end();
"
```

---

## Krok 3 — Zbuduj paczkę do wgrania

```bash
npm run package:seohost
```

Powstanie katalog `deploy/dist-seohost/` oraz archiwum `deploy/frontline-seohost.tar.gz` (~80 MB).

Paczka **nie zawiera** `node_modules` — CloudLinux instaluje je przez **Run NPM Install**.
Paczka **nie używa** standalone z Maca — na serwerze startuje zwykły Next.js (`server.js` ładuje `.env`).

---

## Krok 4 — Wgranie plików na seohost

**Ważne:** katalog aplikacji to np. `domains/frontlinepulse.eu/frontline/` (obok `public_html`, nie w środku).

### Czyste wdrożenie (jeśli coś nie działa — zrób tak)

1. W menedżerze plików wejdź do `frontline/`
2. **Usuń wszystko** oprócz pliku `.env` (zostaw sam `.env` z `DATABASE_URL`)
3. Wgraj `frontline-seohost.tar.gz` i rozpakuj **do tego katalogu**
4. Po rozpakowaniu muszą być: `server.js`, `package.json`, `.next/`, `public/`
5. **Nie** powinno być folderu `node_modules` (usuń jeśli jest)

### Przez SSH (zalecane)

```bash
# Zamień USER i HOST na dane z panelu seohost
scp deploy/frontline-seohost.tar.gz USER@HOST:~/

ssh USER@HOST
mkdir -p ~/frontline
tar -xzf ~/frontline-seohost.tar.gz -C ~/frontline
rm ~/frontline-seohost.tar.gz
```

### Przez menedżer plików DirectAdmin

1. Utwórz katalog `frontline` **obok** `public_html` (nie wewnątrz!)
2. Wgraj i rozpakuj `frontline-seohost.tar.gz` do tego katalogu
3. Po rozpakowaniu w `~/frontline` muszą leżeć m.in.: `server.js`, `package.json`, `.next/`, `public/`

---

## Krok 5 — Setup Node.js App w DirectAdmin

1. Zaloguj się do **DirectAdmin**
2. **Dodatkowe funkcje** → **Setup Node.js App**
3. **Create Application** i uzupełnij:

| Pole | Wartość |
|------|---------|
| Node.js version | **20.x** lub **22.x** (najnowsza dostępna) |
| Application mode | **Production** |
| Application root | `/home/TWOJ_USER/frontline` |
| Application URL | Twoja domena (np. `twojadomena.pl`) |
| Application startup file | `server.js` |

4. W sekcji **Environment variables** dodaj:

```
NODE_ENV=production
DATABASE_URL=postgres://...@ep-....neon.tech/neondb?sslmode=require
CRON_SECRET=wygeneruj-losowy-ciag-min-32-znakow
```

Losowy `CRON_SECRET` (na Macu):
```bash
openssl rand -hex 24
```

5. Kliknij **Create**.

6. **CloudLinux — ważne:** w menedżerze plików **usuń folder `node_modules`**
   z katalogu `frontline/` (jeśli istnieje). CloudLinux tworzy własny symlink
   przez **Run NPM Install** — gotowy folder `node_modules` z paczki blokuje instalację.

7. Utwórz plik **`frontline/.env`** (patrz `deploy/env.seohost.example`):
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://...@ep-....neon.tech/neondb?sslmode=require
   CRON_SECRET=...
   ```

8. Kliknij **Run NPM Install**, potem **Restart** / **Start App**.

9. Otwórz `https://twojadomena.pl/api/ping` — powinien być JSON (bez bazy). Jeśli tu jest błąd → Run NPM Install nie zadziałał.
10. Otwórz `https://twojadomena.pl/api/health` — powinno być `{"status":"ok","driver":"neon-http",...}`.
11. Otwórz `https://twojadomena.pl/api/stats` — JSON z kategoriami.

Jeśli `/api/stats` zwraca JSON z polem `error` i `hint` — przeczytaj komunikat (brak `.env`, brak modułów npm, błąd Neon).

---

## Krok 6 — Cron (automatyczne odświeżanie danych)

DirectAdmin → **Cron Jobs** → dodaj:

```cron
*/15 * * * * curl -s -X POST -H "Authorization: Bearer TWOJ_CRON_SECRET" https://twojadomena.pl/api/ingest > /dev/null 2>&1
```

Podmień `TWOJ_CRON_SECRET` na wartość z kroku 5.

---

## Krok 7 — Aktualizacja aplikacji (po zmianach w kodzie)

Zawsze na Macu:

```bash
npm run package:seohost
```

Wgraj archiwum na serwer i **nadpisz** pliki w `frontline/` (zostaw `.env`).

Potem w DirectAdmin → Setup Node.js App:
1. **Run NPM Install** (jeśli zmienił się `package.json`)
2. **Restart**

Dane w Neon zostają — nie musisz ponownie robić `ingest`, chyba że chcesz odświeżyć historyczne dane.

---

## Rozwiązywanie problemów

### Biała strona / 502
- DirectAdmin → Setup Node.js App → sprawdź logi aplikacji
- Upewnij się, że `Application root` wskazuje katalog z `server.js`
- Sprawdź, czy `DATABASE_URL` jest ustawiony w zmiennych środowiskowych panelu

### Błąd połączenia z bazą
- Connection string musi zawierać `?sslmode=require`
- W Neon: Project Settings → sprawdź, czy baza nie jest wstrzymana (free tier usypia po nieaktywności — pierwsze zapytanie może trwać 1–2 s)

### Błąd CloudLinux: „application should not contain folder node_modules”

Usuń folder **`node_modules`** z katalogu aplikacji w menedżerze plików,
potem kliknij **Run NPM Install** i **Restart**. Paczka `frontline-seohost.tar.gz`
nie zawiera już `node_modules` — instalacja odbywa się na serwerze.

### Mapa bez eventów / Internal Server Error na /api/*
- **Najpierw** sprawdź `/api/ping` — jeśli 500, problem to brak `node_modules` (Run NPM Install)
- **Stara paczka** — `/api/ping` zwraca 404? Wgraj najnowszą paczkę
- Plik musi nazywać się **`.env`** w katalogu `frontline/`
- Aplikacja używa **Neon HTTP** (nie wymaga portu 5432) — `DATABASE_URL` musi wskazywać na `*.neon.tech`
- Uruchom **Run NPM Install** — instaluje `postgres` i `@neondatabase/serverless`
- Sprawdź w Neon SQL Editor: `SELECT count(*) FROM incidents;`

### Build na serwerze się wywala
- **Nie buduj na serwerze** — zawsze `npm run package:seohost` lokalnie i wgrywaj gotową paczkę

### Brakuje Setup Node.js App w panelu
- Napisz do supportu seohost z prośbą o włączenie Node.js na koncie
- Alternatywa: najtańszy VPS u seohost (~100 zł/mies.) — instrukcja w `deploy/setup-vps.sh`

---

## Podsumowanie kosztów

| Element | Koszt |
|---------|-------|
| Hosting współdzielony seohost | od ~37 zł/rok (masz już) |
| Baza Neon (free tier) | 0 zł |
| Domena | wg Twojego planu |
| **Razem za aplikację** | **0 zł dodatkowo** (oprócz hostingu, który już masz) |
