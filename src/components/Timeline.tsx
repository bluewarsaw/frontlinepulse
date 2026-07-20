"use client";

export const RANGE_HOURS = 168; // 7 dni

interface TimelineProps {
  nowMs: number;
  hoursBack: number; // 0 = teraz
  windowHours: number;
  onHoursBackChange: (h: number) => void;
  onWindowChange: (h: number) => void;
}

const WINDOWS = [
  { hours: 24, label: "24h" },
  { hours: 48, label: "48h" },
  { hours: 168, label: "7 dni" },
];

export default function Timeline({
  nowMs,
  hoursBack,
  windowHours,
  onHoursBackChange,
  onWindowChange,
}: TimelineProps) {
  const to = new Date(nowMs - hoursBack * 3600 * 1000);
  const label =
    hoursBack === 0
      ? "TERAZ"
      : to.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
      <div className="flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.hours}
            onClick={() => onWindowChange(w.hours)}
            className={`rounded px-2 py-0.5 font-mono text-[10px] transition ${
              windowHours === w.hours
                ? "bg-lime-400 text-zinc-950"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            title={`Pokaż incydenty z okna ${w.label} przed wybranym momentem`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <span className="font-mono text-[10px] text-zinc-600">-7 dni</span>
      <input
        type="range"
        className="timeline w-56 md:w-80"
        min={0}
        max={RANGE_HOURS}
        step={1}
        // suwak rośnie w prawo ku "teraz"
        value={RANGE_HOURS - hoursBack}
        onChange={(e) => onHoursBackChange(RANGE_HOURS - Number(e.target.value))}
      />
      <span
        className={`w-28 font-mono text-[11px] ${
          hoursBack === 0 ? "text-lime-400" : "text-zinc-300"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
