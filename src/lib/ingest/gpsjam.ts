import { gunzipSync } from "node:zlib";
import { cellToBoundary, cellToLatLng } from "h3-js";
import { withTransaction } from "../db";
import { inFlankBbox, guessCountry } from "./region";

interface HexRow {
  h3: string;
  lat: number;
  lng: number;
  good: number;
  bad: number;
  ratio: number;
  wkt: string;
}

function hexToWkt(h3: string): string {
  // cellToBoundary z formatAsGeoJson=true zwraca zamknięty pierścień [lng, lat]
  const ring = cellToBoundary(h3, true);
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `POLYGON((${coords}))`;
}

function severityForRatio(ratio: number): number {
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.45) return 3;
  return 2;
}

/**
 * Pobiera dzienny dataset gpsjam.org (CC-BY, John Wiseman / ADS-B Exchange):
 * https://gpsjam.org/data/YYYY-MM-DD-h3_4.csv (gzip, kolumny: hex,good,bad).
 * Zapisuje heksy z obszaru flanki oraz tworzy incydenty gps_jamming
 * dla heksów z >=10% samolotów raportujących niską dokładność nawigacji.
 */
export async function ingestGpsjam(
  date?: string
): Promise<{ date: string; hexes: number; incidents: number }> {
  // Dataset za dzień D publikowany jest ~04:00 UTC dnia D+1, więc bezpiecznie
  // sięgamy po "przedwczoraj/wczoraj" (36h wstecz).
  const day =
    date ?? new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 10);
  const url = `https://gpsjam.org/data/${day}-h3_4.csv`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`gpsjam.org zwrócił ${res.status} dla ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text =
    buf[0] === 0x1f && buf[1] === 0x8b
      ? gunzipSync(buf).toString("utf8")
      : buf.toString("utf8");

  const rows: HexRow[] = [];
  for (const line of text.split("\n").slice(1)) {
    const [h3, goodStr, badStr] = line.trim().split(",");
    if (!h3 || goodStr === undefined || badStr === undefined) continue;
    const [lat, lng] = cellToLatLng(h3);
    if (!inFlankBbox(lat, lng)) continue;
    const good = Number(goodStr);
    const bad = Number(badStr);
    const total = good + bad;
    if (total === 0) continue;
    rows.push({
      h3,
      lat,
      lng,
      good,
      bad,
      ratio: bad / total,
      wkt: hexToWkt(h3),
    });
  }

  let incidentCount = 0;
  await withTransaction(async (client) => {
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const values: unknown[] = [];
      const tuples = batch.map((r, j) => {
        values.push(r.h3, day, r.ratio, r.good + r.bad, r.wkt);
        const o = j * 5;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, ST_GeomFromText($${o + 5}, 4326))`;
      });
      await client.query(
        `INSERT INTO gps_hexes (h3_id, date, bad_ratio, aircraft_count, geom)
         VALUES ${tuples.join(", ")}
         ON CONFLICT (h3_id, date) DO UPDATE
           SET bad_ratio = EXCLUDED.bad_ratio,
               aircraft_count = EXCLUDED.aircraft_count`,
        values
      );
    }

    // Incydenty tylko dla wyraźnie "czerwonych" heksów (mapa i tak pokazuje
    // wszystkie zakłócenia warstwą heksagonów; incydent = zdarzenie znaczące)
    const badHexes = rows.filter((r) => r.ratio >= 0.3 && r.good + r.bad >= 10);
    for (const r of badHexes) {
      const pct = Math.round(r.ratio * 100);
      const result = await client.query(
        `INSERT INTO incidents
           (category, severity, title, description, source, source_url,
            country, geom, occurred_at, dedup_key)
         VALUES ('gps_jamming', $1, $2, $3, 'gpsjam.org', $4, $5,
                 ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9)
         ON CONFLICT (dedup_key) DO NOTHING`,
        [
          severityForRatio(r.ratio),
          `Zakłócenia GPS — ${pct}% samolotów z utratą dokładności`,
          `W strefie heksagonu ${r.h3} ${r.bad} z ${r.good + r.bad} samolotów raportowało niską dokładność nawigacji (NIC) w ciągu doby ${day}. Dane: ADS-B via gpsjam.org (CC-BY).`,
          `https://gpsjam.org/?lat=${r.lat.toFixed(3)}&lon=${r.lng.toFixed(3)}&z=6&date=${day}`,
          guessCountry(r.lat, r.lng),
          r.lng,
          r.lat,
          `${day}T12:00:00Z`,
          `gpsjam:${r.h3}:${day}`,
        ]
      );
      incidentCount += result.rowCount ?? 0;
    }
  });

  return { date: day, hexes: rows.length, incidents: incidentCount };
}
