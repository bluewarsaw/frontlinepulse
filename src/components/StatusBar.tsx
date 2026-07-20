"use client";

import { CATEGORY_META, type IncidentCategory, type StatsEntry } from "@/lib/types";

interface StatusBarProps {
  stats: StatsEntry[];
  gpsDate: string | null;
}

function Trend({ now, prev }: { now: number; prev: number }) {
  if (now > prev) return <span className="text-red-400">▲</span>;
  if (now < prev) return <span className="text-emerald-400">▼</span>;
  return <span className="text-zinc-600">■</span>;
}

export default function StatusBar({ stats, gpsDate }: StatusBarProps) {
  const byCat = new Map(stats.map((s) => [s.category, s]));
  return (
    <header className="pointer-events-auto flex items-center gap-4 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="pulse-dot h-2 w-2 rounded-full bg-lime-400" />
        <h1 className="text-sm font-bold tracking-wide">
          FRONTLINE<span className="text-lime-400">PULSE</span>
        </h1>
      </div>
      <div className="hidden text-[10px] uppercase tracking-widest text-zinc-500 md:block">
        Regionalna mapa anomalii hybrydowych
      </div>

      <div className="ml-auto flex items-center gap-3 overflow-x-auto">
        <span className="hidden shrink-0 text-[9px] uppercase tracking-widest text-zinc-600 lg:block">
          Puls 24h
        </span>
        {(Object.keys(CATEGORY_META) as IncidentCategory[]).map((cat) => {
          const s = byCat.get(cat);
          const meta = CATEGORY_META[cat];
          return (
            <div
              key={cat}
              className="flex shrink-0 items-center gap-1 font-mono text-[11px]"
              title={`${meta.label}: ${s?.last24h ?? 0} w 24h (poprzednie 24h: ${s?.prev24h ?? 0})`}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: meta.color }}
              />
              <span className="text-zinc-200">{s?.last24h ?? 0}</span>
              <Trend now={s?.last24h ?? 0} prev={s?.prev24h ?? 0} />
            </div>
          );
        })}
        {gpsDate && (
          <span
            className="hidden shrink-0 font-mono text-[9px] text-zinc-600 xl:block"
            title="Dane GPS publikowane są raz na dobę (gpsjam.org)"
          >
            GPS: {gpsDate}
          </span>
        )}
      </div>
    </header>
  );
}
