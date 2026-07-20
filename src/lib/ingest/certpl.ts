import { withTransaction } from "../db";
import { fetchRss, jitterFromKey, parsePubDate } from "./rss";

const FEED = "https://cert.pl/rss.xml";
const WARSAW: [number, number] = [52.2297, 21.0122];

/** Tylko komunikaty o zagrożeniach / kampaniach — pomijamy flood CVE i soft news. */
const THREAT_CATEGORY =
  /zagroż|atak|phishing|malware|ransomware|kampania|dfir/i;
const THREAT_TEXT =
  /kampania|phishing|ransomware|malware|\batak\b|ddos|botnet|ghostwriter|unc\d+|fake.?captcha|sektora? energ|farmy wiatrowe|elektrociepł|dywersj|raport z (analizy )?incydent/i;
const SOFT_NEWS =
  /poradnik|rekomendacje|fuzzing|raport roczny|moje\.cert\.pl|cyber resilience act|\bcra\b|urodzin|świętuje|zaufanie liczone|obowiązki dla producent/i;

function isThreatItem(
  categories: string[],
  title: string,
  description: string
): boolean {
  const blob = `${title} ${description}`;
  if (SOFT_NEWS.test(blob) && !THREAT_TEXT.test(blob)) return false;
  if (categories.some((c) => THREAT_CATEGORY.test(c))) return true;
  return THREAT_TEXT.test(blob);
}

function severityFor(title: string, description: string): number {
  const t = `${title} ${description}`.toLowerCase();
  if (/ransomware|destrukcyj|sektora? energ|farmy wiatrowe|elektrociepł/.test(t))
    return 4;
  if (/kampania|phishing|malware|ddos|ghostwriter|unc/.test(t)) return 3;
  return 2;
}

/**
 * CERT Polska RSS — oficjalne komunikaty o zagrożeniach cyber (PL).
 * Publiczny feed, bez API key.
 */
export async function ingestCertPl(): Promise<{ scanned: number; inserted: number }> {
  const items = await fetchRss(FEED);
  const cutoff = Date.now() - 120 * 24 * 3600 * 1000;
  const threats = items.filter((it) => {
    if (!isThreatItem(it.categories, it.title, it.description)) return false;
    const d = parsePubDate(it.pubDate);
    if (d && d.getTime() < cutoff) return false;
    return true;
  });

  let inserted = 0;
  await withTransaction(async (client) => {
    for (const it of threats) {
      const occurred = parsePubDate(it.pubDate) ?? new Date();
      const [dLat, dLng] = jitterFromKey(it.guid);
      const lat = WARSAW[0] + dLat;
      const lng = WARSAW[1] + dLng;
      const res = await client.query(
        `INSERT INTO incidents
           (category, severity, title, description, source, source_url,
            country, geom, occurred_at, dedup_key)
         VALUES ('cyber', $1, $2, $3, 'CERT Polska', $4, 'PL',
                 ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8)
         ON CONFLICT (dedup_key) DO UPDATE
           SET occurred_at = EXCLUDED.occurred_at,
               title = EXCLUDED.title,
               description = EXCLUDED.description`,
        [
          severityFor(it.title, it.description),
          it.title,
          it.description.slice(0, 600) || null,
          it.link,
          lng,
          lat,
          occurred.toISOString(),
          `certpl:${it.guid}`,
        ]
      );
      inserted += res.rowCount ?? 0;
    }
  });

  return { scanned: items.length, inserted };
}
