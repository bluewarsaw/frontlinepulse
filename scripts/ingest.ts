import { ingestGpsjam } from "../src/lib/ingest/gpsjam";
import { ingestGdelt } from "../src/lib/ingest/gdelt";
import { ingestCertPl } from "../src/lib/ingest/certpl";
import { ingestEuvsDisinfo } from "../src/lib/ingest/euvsdisinfo";
import { seedIncidents } from "../src/lib/ingest/seed";
import { closeDb } from "../src/lib/db";

const only = process.argv[2]; // gpsjam | gdelt | seed | certpl | euvsdisinfo | (brak = wszystko)

async function main() {
  if (!only || only === "seed") {
    const r = await seedIncidents();
    console.log(`[seed]   incydenty: ${r.inserted}`);
  }

  if (!only || only === "gpsjam") {
    for (let i = 1; i <= 7; i++) {
      const day = new Date(Date.now() - (i + 0.5) * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      try {
        const r = await ingestGpsjam(day);
        console.log(
          `[gpsjam] ${r.date}: heksy=${r.hexes}, nowe incydenty=${r.incidents}`
        );
      } catch (err) {
        console.warn(`[gpsjam] ${day}: pominięto (${(err as Error).message})`);
      }
    }
  }

  if (!only || only === "gdelt") {
    const files = Number(process.argv[3] ?? 96);
    const r = await ingestGdelt(files);
    console.log(`[gdelt]  przeskanowane zdarzenia: ${r.scanned}, nowe: ${r.inserted}`);
  }

  if (!only || only === "certpl") {
    const r = await ingestCertPl();
    console.log(`[certpl] przeskanowane: ${r.scanned}, zapisane: ${r.inserted}`);
  }

  if (!only || only === "euvsdisinfo") {
    const r = await ingestEuvsDisinfo();
    console.log(
      `[euvsdisinfo] przeskanowane: ${r.scanned}, zapisane: ${r.inserted}`
    );
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
