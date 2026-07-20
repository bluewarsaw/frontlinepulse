import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/gps-hexes?date=YYYY-MM-DD
 * GeoJSON heksagonów H3 z odsetkiem samolotów raportujących niską
 * dokładność nawigacji. Bez parametru zwraca najnowszy dostępny dzień.
 */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("date");

  let date = requested;
  if (!date) {
    const latest = await query<{ date: string }>(
      `SELECT max(date)::text AS date FROM gps_hexes`
    );
    date = latest[0]?.date ?? null;
  } else {
    // najbliższy dostępny dzień <= żądanego (dataset publikowany z opóźnieniem)
    const nearest = await query<{ date: string }>(
      `SELECT max(date)::text AS date FROM gps_hexes WHERE date <= $1::date`,
      [date]
    );
    date = nearest[0]?.date ?? null;
  }

  if (!date) {
    return NextResponse.json({
      type: "FeatureCollection",
      features: [],
      date: null,
    });
  }

  const rows = await query<{ feature: object }>(
    `SELECT jsonb_build_object(
       'type', 'Feature',
       'geometry', ST_AsGeoJSON(geom)::jsonb,
       'properties', jsonb_build_object(
         'h3_id', h3_id, 'bad_ratio', bad_ratio,
         'aircraft_count', aircraft_count, 'date', date
       )
     ) AS feature
     FROM gps_hexes
     WHERE date = $1::date AND aircraft_count >= 3`,
    [date]
  );

  return NextResponse.json({
    type: "FeatureCollection",
    features: rows.map((r) => r.feature),
    date,
  });
}
