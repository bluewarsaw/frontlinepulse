import { withTransaction } from "../db";
import { FLANK_COUNTRIES } from "../types";
import { COUNTRY_NAME_TO_ISO } from "./region";
import { fetchRss, jitterFromKey, parsePubDate } from "./rss";

const FEED = "https://euvsdisinfo.eu/feed/";

// Centroidy stolic / punktów reprezentatywnych (lat, lng)
const COORDS: Record<string, [number, number]> = {
  FI: [60.17, 24.94],
  EE: [59.44, 24.75],
  LV: [56.95, 24.11],
  LT: [54.69, 25.28],
  PL: [52.23, 21.01],
  SK: [48.15, 17.11],
  HU: [47.5, 19.04],
  RO: [44.43, 26.1],
  NO: [59.91, 10.75],
  SE: [59.33, 18.07],
};

const COUNTRY_PATTERNS: Array<{ re: RegExp; iso: string }> = [
  { re: /\bpoland\b|\bpolish\b|\bpolsk/i, iso: "PL" },
  { re: /\bfinland\b|\bfinnish\b|\bsuomi/i, iso: "FI" },
  { re: /\bestonia\b|\bestonian\b/i, iso: "EE" },
  { re: /\blatvia\b|\blatvian\b/i, iso: "LV" },
  { re: /\blithuania\b|\blithuanian\b/i, iso: "LT" },
  { re: /\bslovakia\b|\bslovak\b/i, iso: "SK" },
  { re: /\bhungary\b|\bhungarian\b/i, iso: "HU" },
  { re: /\bromania\b|\bromanian\b/i, iso: "RO" },
  { re: /\bnorway\b|\bnorwegian\b/i, iso: "NO" },
  { re: /\bsweden\b|\bswedish\b/i, iso: "SE" },
  { re: /\bkaliningrad\b/i, iso: "PL" },
  { re: /\bbaltic states\b|\bbaltics\b|\beastern flank\b/i, iso: "LT" },
];

function detectCountries(text: string, categories: string[]): string[] {
  const hay = `${text} ${categories.join(" ")}`;
  const found = new Set<string>();
  for (const { re, iso } of COUNTRY_PATTERNS) {
    if (re.test(hay) && iso in FLANK_COUNTRIES) found.add(iso);
  }
  // kategorie WordPress czasem mają nazwę kraju
  for (const c of categories) {
    const iso = COUNTRY_NAME_TO_ISO[c.toLowerCase()];
    if (iso) found.add(iso);
  }
  return [...found];
}

/**
 * EUvsDisinfo RSS — debunki / analizy dezinformacji pro-Kreml.
 * Publiczny feed WordPress, bez API key. Filtrujemy do flanki NATO.
 */
export async function ingestEuvsDisinfo(): Promise<{
  scanned: number;
  inserted: number;
}> {
  const items = await fetchRss(FEED);
  const cutoff = Date.now() - 45 * 24 * 3600 * 1000;

  type Row = {
    title: string;
    link: string;
    description: string;
    guid: string;
    country: string;
    occurred: Date;
  };
  const rows: Row[] = [];

  for (const it of items) {
    const occurred = parsePubDate(it.pubDate) ?? new Date();
    if (occurred.getTime() < cutoff) continue;
    const countries = detectCountries(
      `${it.title} ${it.description}`,
      it.categories
    );
    // jeśli brak kraju flanki — pomijamy (artykuły globalne bez geolokalizacji)
    if (countries.length === 0) continue;
    for (const country of countries) {
      rows.push({
        title: it.title,
        link: it.link,
        description: it.description.slice(0, 600),
        guid: it.guid,
        country,
        occurred,
      });
    }
  }

  let inserted = 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      const [lat0, lng0] = COORDS[r.country] ?? COORDS.PL;
      const [dLat, dLng] = jitterFromKey(`${r.guid}:${r.country}`, 0.4);
      const res = await client.query(
        `INSERT INTO incidents
           (category, severity, title, description, source, source_url,
            country, geom, occurred_at, dedup_key)
         VALUES ('disinfo', 3, $1, $2, 'EUvsDisinfo', $3, $4,
                 ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8)
         ON CONFLICT (dedup_key) DO UPDATE
           SET occurred_at = EXCLUDED.occurred_at,
               title = EXCLUDED.title,
               description = EXCLUDED.description`,
        [
          r.title.slice(0, 200),
          r.description || null,
          r.link,
          r.country,
          lng0 + dLng,
          lat0 + dLat,
          r.occurred.toISOString(),
          `euvsdisinfo:${r.guid}:${r.country}`,
        ]
      );
      inserted += res.rowCount ?? 0;
    }
  });

  return { scanned: items.length, inserted };
}
