import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/ping — diagnostyka bez bazy (sprawdź najpierw ten endpoint) */
export async function GET() {
  let postgresOk = false;
  let neonOk = false;
  let postgresError = "";
  let neonError = "";

  try {
    await import("postgres");
    postgresOk = true;
  } catch (err) {
    postgresError = (err as Error).message;
  }

  try {
    await import("@neondatabase/serverless");
    neonOk = true;
  } catch (err) {
    neonError = (err as Error).message;
  }

  return NextResponse.json({
    ok: true,
    node: process.version,
    cwd: process.cwd(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    neonHost: process.env.DATABASE_URL?.includes("neon.tech") ?? false,
    modules: {
      postgres: postgresOk ? "ok" : postgresError,
      neon: neonOk ? "ok" : neonError,
    },
  });
}
