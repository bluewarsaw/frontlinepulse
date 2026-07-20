import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { IncidentCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

interface WindowCentroid {
  category: IncidentCategory;
  win: number;
  n: number;
  lng: number;
  lat: number;
}

function haversineKm(a: WindowCentroid, b: WindowCentroid): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(a: WindowCentroid, b: WindowCentroid): number {
  const f1 = (a.lat * Math.PI) / 180;
  const f2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x =
    Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * GET /api/corridors?to=ISO&days=7
 *
 * "Korytarze Zagrożeń": dla każdej kategorii incydenty klastrowane są
 * per okno 24h (PostGIS ST_ClusterDBSCAN), z każdego okna brany jest
 * najliczniejszy klaster, a centroidy kolejnych okien łączone w linię
 * kierunkową — pokazuje, dokąd przemieszcza się fala danego zagrożenia.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ?? new Date().toISOString();
  const days = Math.min(Number(sp.get("days") ?? 7), 30);

  const rows = await query<{
    category: IncidentCategory;
    win: string;
    n: string;
    lng: number;
    lat: number;
  }>(
    `WITH pts AS (
       SELECT category,
              floor(extract(epoch FROM occurred_at) / 86400)::bigint AS win,
              geom
       FROM incidents
       WHERE occurred_at > $1::timestamptz - make_interval(days => $2)
         AND occurred_at <= $1::timestamptz
     ), clustered AS (
       SELECT category, win, geom,
              ST_ClusterDBSCAN(geom, eps := 3.0, minpoints := 1)
                OVER (PARTITION BY category, win) AS cid
       FROM pts
     ), agg AS (
       SELECT category, win, cid,
              count(*) AS n,
              ST_Centroid(ST_Collect(geom)) AS ctr
       FROM clustered
       GROUP BY category, win, cid
     ), best AS (
       SELECT DISTINCT ON (category, win) category, win, n, ctr
       FROM agg
       ORDER BY category, win, n DESC
     )
     SELECT category, win::text, n::text,
            ST_X(ctr) AS lng, ST_Y(ctr) AS lat
     FROM best
     ORDER BY category, win`,
    [to, days]
  );

  const byCategory = new Map<IncidentCategory, WindowCentroid[]>();
  for (const r of rows) {
    const c: WindowCentroid = {
      category: r.category,
      win: Number(r.win),
      n: Number(r.n),
      lng: r.lng,
      lat: r.lat,
    };
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  const features: object[] = [];
  for (const [category, centroids] of byCategory) {
    // łączymy kolejne okna (maks. przerwa 2 dni, maks. skok 900 km)
    let path: WindowCentroid[] = [];
    const flush = () => {
      if (path.length >= 2) {
        const first = path[0];
        const last = path[path.length - 1];
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: path.map((p) => [p.lng, p.lat]),
          },
          properties: {
            category,
            points: path.length,
            incidents: path.reduce((s, p) => s + p.n, 0),
            bearing: Math.round(bearing(first, last)),
            distance_km: Math.round(haversineKm(first, last)),
            from_win: first.win,
            to_win: last.win,
          },
        });
      }
      path = [];
    };
    for (const c of centroids) {
      const prev = path[path.length - 1];
      if (prev && (c.win - prev.win > 2 || haversineKm(prev, c) > 900)) {
        flush();
      }
      path.push(c);
    }
    flush();
  }

  return NextResponse.json({ type: "FeatureCollection", features });
}
