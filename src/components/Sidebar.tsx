"use client";

import { useEffect, useRef } from "react";
import type { Feature, Point } from "geojson";
import {
  CATEGORIES,
  CATEGORY_META,
  FLANK_COUNTRIES,
  type IncidentCategory,
  type IncidentProperties,
} from "@/lib/types";
import type { LayerVisibility } from "./MapView";

interface SidebarProps {
  features: Feature<Point, IncidentProperties>[];
  activeCategories: Set<IncidentCategory>;
  country: string;
  layers: LayerVisibility;
  selectedId: number | null;
  onToggleCategory: (c: IncidentCategory) => void;
  onCountryChange: (c: string) => void;
  onToggleLayer: (k: keyof LayerVisibility) => void;
  onSelect: (f: Feature<Point, IncidentProperties>) => void;
}

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  hexes: "Heksy GPS",
  incidents: "Incydenty",
  heat: "Heatmapa dezinfo",
  corridors: "Korytarze zagrożeń",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))} min temu`;
  if (h < 48) return `${h} godz. temu`;
  return `${Math.floor(h / 24)} dni temu`;
}

export default function Sidebar({
  features,
  activeCategories,
  country,
  layers,
  selectedId,
  onToggleCategory,
  onCountryChange,
  onToggleLayer,
  onSelect,
}: SidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <aside className="pointer-events-auto flex h-full w-[22rem] flex-col border-l border-zinc-800 bg-zinc-950/90 backdrop-blur">
      {/* Filtry kategorii */}
      <div className="border-b border-zinc-800 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Kategorie
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-transparent text-zinc-950"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
                style={active ? { backgroundColor: meta.color } : undefined}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Kraj
          </label>
          <select
            value={country}
            onChange={(e) => onCountryChange(e.target.value)}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
          >
            <option value="">Cała flanka</option>
            {Object.entries(FLANK_COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(LAYER_LABELS) as (keyof LayerVisibility)[]).map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400"
            >
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={() => onToggleLayer(k)}
                className="h-3 w-3 accent-lime-400"
              />
              {LAYER_LABELS[k]}
            </label>
          ))}
        </div>
      </div>

      {/* Feed incydentów */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Feed incydentów
        </span>
        <span className="font-mono text-[10px] text-zinc-600">
          {features.length}
        </span>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-2">
        {features.length === 0 && (
          <div className="p-4 text-center text-xs text-zinc-600">
            Brak incydentów w wybranym oknie czasowym.
          </div>
        )}
        {features.map((f) => {
          const p = f.properties;
          const meta = CATEGORY_META[p.category];
          const isSelected = p.id === selectedId;
          return (
            <button
              key={p.id}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelect(f)}
              className={`mb-1 block w-full rounded border-l-2 px-2.5 py-2 text-left transition ${
                isSelected
                  ? "bg-zinc-800"
                  : "bg-zinc-900/60 hover:bg-zinc-900"
              }`}
              style={{ borderLeftColor: meta.color }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-zinc-500">
                  {p.country} · {timeAgo(p.occurred_at)}
                </span>
              </div>
              <div className="mt-0.5 text-xs leading-snug text-zinc-200">
                {p.title}
              </div>
              {isSelected && (
                <div className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                  {p.description}
                  <div className="mt-1 text-zinc-500">
                    Źródło: {p.source}
                    {p.source_url && (
                      <>
                        {" · "}
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-lime-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          link
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
