# Frontline Pulse — wdrożenie na Vercel (zalecane)

Hosting współdzielony seohost (CloudLinux + Node.js Selector) nie radzi sobie
stabilnie z Next.js 16 + zewnętrzną bazą. **Vercel** jest darmowy i zbudowany
pod Next.js — to najszybsza droga do działającej aplikacji.

Baza zostaje na **Neon** (już masz).

---

## Krok 1 — Konto Vercel (2 min)

1. Wejdź na [vercel.com](https://vercel.com) i zaloguj się (GitHub / Google).
2. Nic więcej nie klikaj — wrócimy do panelu po pushu kodu.

---

## Krok 2 — Wypchnij kod na GitHub (5 min)

Jeśli jeszcze nie masz repo:

```bash
cd ~/Desktop/frontline
git init   # jeśli nie było
git add -A
git commit -m "Frontline Pulse ready for Vercel"
# utwórz repo na github.com, potem:
git remote add origin https://github.com/TWOJ_USER/frontline.git
git push -u origin main
```

**Nie commituj** plików z hasłami: `.env`, `deploy/env-for-seohost.env`.

---

## Krok 3 — Import w Vercel

1. Vercel → **Add New…** → **Project**
2. Importuj repozytorium `frontline`
3. Framework Preset: **Next.js** (wykryje samo)
4. **Environment Variables** — dodaj:

| Name | Value |
|------|-------|
| `DATABASE_URL` | connection string z Neon (`?sslmode=require`, **bez** `channel_binding`) |
| `CRON_SECRET` | losowy ciąg (np. `openssl rand -hex 24`) |
| `NODE_ENV` | `production` |

5. Kliknij **Deploy**

Po ~1–2 min dostaniesz URL typu `https://frontline-xxx.vercel.app`.

Sprawdź:
- `https://….vercel.app/api/ping` → JSON `ok: true`
- `https://….vercel.app/api/health` → `status: ok`, liczba incydentów
- `https://….vercel.app/` → mapa z punktami

---

## Krok 4 — Domena frontlinepulse.eu

1. Vercel → projekt → **Settings** → **Domains** → dodaj `frontlinepulse.eu` (+ `www` jeśli chcesz)
2. Vercel pokaże rekord DNS (zwykle **A** lub **CNAME**)
3. W panelu domeny / seohost ustaw DNS zgodnie z instrukcją Vercel
4. Odłącz **Setup Node.js App** na seohost (żeby nie kolidował) albo zostaw domenę tylko przez DNS u rejestratora

Po propagacji DNS (kilka minut–kilka godzin) `https://frontlinepulse.eu` będzie serwowane z Vercel.

---

## Cron (opcjonalnie)

Vercel → projekt → **Settings** → **Cron Jobs** albo plik `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

W `src/app/api/ingest/route.ts` upewnij się, że cron sprawdza `Authorization: Bearer CRON_SECRET`
(albo dodaj to przy pierwszym odświeżeniu).

---

## Dlaczego nie seohost?

| Problem na seohost | Na Vercel |
|--------------------|-----------|
| CloudLinux wymaga własnego `node_modules` (symlink) | automatyczna instalacja |
| Env z panelu często nie dochodzi do procesu | env w UI działa |
| Paczka standalone z Maca psuje ścieżki | build na Linuxie w CI |
| Port 5432 / `pg` blokowany | Neon HTTP driver przez HTTPS |
| Stara paczka zostaje mimo „wgrania” | każdy deploy = czysta wersja |
