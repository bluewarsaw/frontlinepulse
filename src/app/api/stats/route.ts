import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats?to=ISO
 * Puls regionu: liczba incydentów per kategoria w ostatnich 24h
 * vs poprzednich 24h (trend).
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") ?? new Date().toISOString();

  try {
    const rows = await query<{
      category: string;
      last24h: string;
      prev24h: string;
    }>(
      `SELECT category,
              count(*) FILTER (
                WHERE occurred_at > $1::timestamptz - interval '24 hours'
              )::text AS "last24h",
              count(*) FILTER (
                WHERE occurred_at <= $1::timestamptz - interval '24 hours'
                  AND occurred_at > $1::timestamptz - interval '48 hours'
              )::text AS "prev24h"
       FROM incidents
       WHERE occurred_at > $1::timestamptz - interval '48 hours'
         AND occurred_at <= $1::timestamptz
       GROUP BY category`,
      [to]
    );

    return NextResponse.json(
      rows.map((r) => ({
        category: r.category,
        last24h: Number(r.last24h),
        prev24h: Number(r.prev24h),
      }))
    );
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      {
        error: msg,
        hint: !process.env.DATABASE_URL
          ? "Brak DATABASE_URL — dodaj plik .env w katalogu frontline/"
          : msg.includes("Cannot find module 'pg'")
            ? "Uruchom Run NPM Install w panelu Node.js"
            : "Sprawdź DATABASE_URL i połączenie z Neon",
      },
      { status: 500 }
    );
  }
}
