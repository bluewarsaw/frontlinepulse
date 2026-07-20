import { inflateRawSync } from "node:zlib";
import { withTransaction } from "../db";
import type { IncidentCategory } from "../types";

// GDELT 2.0 Events — kody krajów FIPS 10-4 dla wschodniej flanki
const FIPS_TO_ISO: Record<string, string> = {
  PL: "PL",
  FI: "FI",
  EN: "EE",
  LG: "LV",
  LH: "LT",
  RO: "RO",
  HU: "HU",
  LO: "SK",
  NO: "NO",
  SW: "SE",
};

// Klasyfikacja incydentu po słowach kluczowych w URL artykułu źródłowego
const URL_CATEGORY_RULES: Array<{ re: RegExp; category: IncidentCategory }> = [
  { re: /gps|gnss|jamm|spoof/i, category: "gps_jamming" },
  { re: /drone|uav|dron[-_y]|bezzalogow/i, category: "drone" },
  {
    re: /cyber|hack|ransomware|ddos|malware|phishing/i,
    category: "cyber",
  },
  {
    re: /disinform|dezinform|propaganda|fake[-_]?news|deepfake|influence[-_]op/i,
    category: "disinfo",
  },
  {
    re: /sabotage|sabota|pipeline|undersea|subsea|power[-_]?grid|cable|infrastructure/i,
    category: "infra",
  },
  {
    re: /border|airspace|incursion|violat|provocation|granic|przestrzen/i,
    category: "border",
  },
];

interface GdeltEvent {
  eventId: string;
  category: IncidentCategory;
  country: string;
  locationName: string;
  lat: number;
  lng: number;
  numArticles: number;
  occurredAt: string;
  sourceUrl: string;
}

function categorize(url: string): IncidentCategory | null {
  for (const rule of URL_CATEGORY_RULES) {
    if (rule.re.test(url)) return rule.category;
  }
  return null;
}

function severityFor(numArticles: number): number {
  if (numArticles >= 20) return 4;
  if (numArticles >= 8) return 3;
  if (numArticles >= 3) return 2;
  return 1;
}

function parseDateAdded(s: string): string {
  // YYYYMMDDHHMMSS -> ISO
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

async function fetchEventFile(url: string): Promise<GdeltEvent[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const buf = Buffer.from(await res.arrayBuffer());
  const csv = unzipSingle(buf);
  if (!csv) return [];

  const events: GdeltEvent[] = [];
  for (const line of csv.split("\n")) {
    const cols = line.split("\t");
    if (cols.length < 61) continue;
    // ActionGeo: 52 Type, 53 Fullname, 54 CountryCode(FIPS), 57 Lat, 58 Long
    const fips = cols[53];
    const iso = FIPS_TO_ISO[fips];
    if (!iso) continue;
    const lat = Number(cols[56]);
    const lng = Number(cols[57]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))
      continue;
    const sourceUrl = cols[60]?.trim();
    if (!sourceUrl) continue;
    const category = categorize(sourceUrl);
    if (!category) continue;
    events.push({
      eventId: cols[0],
      category,
      country: iso,
      locationName: cols[52] || iso,
      lat,
      lng,
      numArticles: Number(cols[33]) || 1,
      occurredAt: parseDateAdded(cols[59]),
      sourceUrl,
    });
  }
  return events;
}

/** Minimalny odczyt pierwszego pliku z archiwum ZIP (GDELT pakuje 1 CSV per zip). */
function unzipSingle(buf: Buffer): string | null {
  if (buf.readUInt32LE(0) !== 0x04034b50) return null;
  const method = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return data.toString("utf8");
  if (method === 8) return inflateRawSync(data).toString("utf8");
  return null;
}

const CATEGORY_TITLES: Record<IncidentCategory, string> = {
  gps_jamming: "Doniesienia o zakłóceniach GPS",
  cyber: "Doniesienia o cyberataku",
  drone: "Doniesienia o aktywności dronów",
  disinfo: "Kampania dezinformacyjna / napięcie informacyjne",
  border: "Incydent graniczny / naruszenie przestrzeni",
  infra: "Zagrożenie infrastruktury krytycznej",
};

/**
 * Pobiera strumień zdarzeń GDELT 2.0 (pliki eksportu co 15 minut,
 * http://data.gdeltproject.org/gdeltv2/), filtruje po krajach wschodniej
 * flanki i klasyfikuje incydenty hybrydowe po słowach kluczowych URL.
 *
 * Uwaga: API GEO 2.0 (api.gdeltproject.org/api/v2/geo/geo) zwraca obecnie 404,
 * dlatego korzystamy z surowego strumienia zdarzeń — również darmowego.
 *
 * @param files liczba 15-minutowych plików wstecz (96 = 24h)
 */
export async function ingestGdelt(
  files = 96
): Promise<{ scanned: number; inserted: number }> {
  // Pliki publikowane co 15 min z ~kilkuminutowym opóźnieniem; cofamy się 30 min
  const now = Date.now() - 30 * 60 * 1000;
  const urls: string[] = [];
  for (let i = 0; i < files; i++) {
    const t = new Date(now - i * 15 * 60 * 1000);
    const stamp = t
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 12);
    // zaokrąglenie do pełnych 15 minut
    const min = Math.floor(Number(stamp.slice(10, 12)) / 15) * 15;
    const rounded = stamp.slice(0, 10) + String(min).padStart(2, "0") + "00";
    urls.push(`http://data.gdeltproject.org/gdeltv2/${rounded}.export.CSV.zip`);
  }

  const events: GdeltEvent[] = [];
  const BATCH = 8;
  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(fetchEventFile));
    for (const r of results) {
      if (r.status === "fulfilled") events.push(...r.value);
    }
  }

  let inserted = 0;
  await withTransaction(async (client) => {
    for (const ev of events) {
      let host = "media";
      try {
        host = new URL(ev.sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        // zostaw domyślne
      }
      const res = await client.query(
        `INSERT INTO incidents
           (category, severity, title, description, source, source_url,
            country, geom, occurred_at, dedup_key)
         VALUES ($1, $2, $3, $4, 'GDELT', $5, $6,
                 ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10)
         ON CONFLICT (dedup_key) DO NOTHING`,
        [
          ev.category,
          severityFor(ev.numArticles),
          `${CATEGORY_TITLES[ev.category]} — ${ev.locationName}`,
          `Wykryte przez monitoring mediów GDELT (${ev.numArticles} artykułów). Źródło: ${host}.`,
          ev.sourceUrl,
          ev.country,
          ev.lng,
          ev.lat,
          ev.occurredAt,
          `gdelt:${ev.category}:${ev.sourceUrl}`,
        ]
      );
      inserted += res.rowCount ?? 0;
    }
  });

  return { scanned: events.length, inserted };
}
