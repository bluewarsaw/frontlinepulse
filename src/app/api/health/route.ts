import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health — diagnostyka połączenia z bazą (bez wrażliwych danych) */
export async function GET() {
  try {
    const rows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM incidents"
    );
    return NextResponse.json({
      status: "ok",
      db: true,
      driver: process.env.DATABASE_URL?.includes("neon.tech")
        ? "neon-http"
        : "postgres",
      incidents: Number(rows[0]?.n ?? 0),
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      {
        status: "error",
        db: false,
        hint: msg.includes("channel_binding")
          ? "Usuń &channel_binding=require z DATABASE_URL w panelu Node.js"
          : msg.includes("password") || msg.includes("authentication")
            ? "Sprawdź DATABASE_URL (hasło, Reset password w Neon)"
            : msg.includes("does not exist")
              ? "Uruchom db/init/001_schema.sql w Neon SQL Editor"
              : "Sprawdź DATABASE_URL i zrestartuj aplikację",
        error: msg,
      },
      { status: 500 }
    );
  }
}
