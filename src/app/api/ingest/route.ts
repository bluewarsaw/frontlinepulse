import { NextRequest, NextResponse } from "next/server";
import { ingestGpsjam } from "@/lib/ingest/gpsjam";
import { ingestGdelt } from "@/lib/ingest/gdelt";
import { ingestCertPl } from "@/lib/ingest/certpl";
import { ingestEuvsDisinfo } from "@/lib/ingest/euvsdisinfo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ingest — odświeżenie danych (cron).
 * Jeśli ustawiono CRON_SECRET, wymagany nagłówek:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, unknown> = {};
  try {
    results.gpsjam = await ingestGpsjam();
  } catch (err) {
    results.gpsjam = { error: (err as Error).message };
  }
  try {
    results.gdelt = await ingestGdelt(8);
  } catch (err) {
    results.gdelt = { error: (err as Error).message };
  }
  try {
    results.certpl = await ingestCertPl();
  } catch (err) {
    results.certpl = { error: (err as Error).message };
  }
  try {
    results.euvsdisinfo = await ingestEuvsDisinfo();
  } catch (err) {
    results.euvsdisinfo = { error: (err as Error).message };
  }
  return NextResponse.json(results);
}
