import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents?from=ISO&to=ISO&categories=a,b&country=PL&limit=N
 * Zwraca GeoJSON FeatureCollection punktów incydentów.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ?? new Date().toISOString();
  const from =
    sp.get("from") ??
    new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const country = sp.get("country");
  const limit = Math.min(Number(sp.get("limit") ?? 5000), 20000);

  const categories = (sp.get("categories")?.split(",") ?? [...CATEGORIES]).filter(
    (c) => (CATEGORIES as readonly string[]).includes(c)
  );
  if (categories.length === 0) {
    return NextResponse.json({ type: "FeatureCollection", features: [] });
  }

  const params: unknown[] = [from, to, categories];
  let where = `occurred_at >= $1 AND occurred_at <= $2 AND category = ANY($3::incident_category[])`;
  if (country) {
    params.push(country);
    where += ` AND country = $${params.length}`;
  }
  params.push(limit);

  const rows = await query<{ feature: object }>(
    `SELECT jsonb_build_object(
       'type', 'Feature',
       'geometry', ST_AsGeoJSON(geom)::jsonb,
       'properties', jsonb_build_object(
         'id', id, 'category', category, 'severity', severity,
         'title', title, 'description', description,
         'source', source, 'source_url', source_url,
         'country', country, 'occurred_at', occurred_at
       )
     ) AS feature
     FROM incidents
     WHERE ${where}
     ORDER BY occurred_at DESC
     LIMIT $${params.length}`,
    params
  );

  return NextResponse.json({
    type: "FeatureCollection",
    features: rows.map((r) => r.feature),
  });
}
