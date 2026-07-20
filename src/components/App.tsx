"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  CATEGORIES,
  type IncidentCategory,
  type IncidentProperties,
  type StatsEntry,
} from "@/lib/types";
import type { LayerVisibility } from "./MapView";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";
import Timeline from "./Timeline";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

export default function App() {
  // punkt odniesienia "teraz" ustalany raz na montaż (czysty render)
  const [nowMs] = useState(() => Math.floor(Date.now() / 300000) * 300000);
  const [hoursBack, setHoursBack] = useState(0);
  // Domyślnie 7 dni — seed/GPS często nie mieszczą się w 48h od ostatniego ingestu
  const [windowHours, setWindowHours] = useState(168);
  const [activeCategories, setActiveCategories] = useState<Set<IncidentCategory>>(
    new Set(CATEGORIES)
  );
  const [country, setCountry] = useState("");
  const [layers, setLayers] = useState<LayerVisibility>({
    hexes: true,
    incidents: true,
    heat: true,
    corridors: true,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number } | null>(null);

  const [incidents, setIncidents] = useState<FeatureCollection>(EMPTY_FC);
  const [hexes, setHexes] = useState<FeatureCollection>(EMPTY_FC);
  const [corridors, setCorridors] = useState<FeatureCollection>(EMPTY_FC);
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [gpsDate, setGpsDate] = useState<string | null>(null);

  const toIso = useMemo(
    () => new Date(nowMs - hoursBack * 3600 * 1000).toISOString(),
    [nowMs, hoursBack]
  );
  const fromIso = useMemo(
    () =>
      new Date(new Date(toIso).getTime() - windowHours * 3600 * 1000).toISOString(),
    [toIso, windowHours]
  );

  useEffect(() => {
    const controller = new AbortController();
    const cats = [...activeCategories].join(",");
    const params = new URLSearchParams({ from: fromIso, to: toIso, categories: cats });
    if (country) params.set("country", country);

    fetch(`/api/incidents?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setIncidents)
      .catch(() => {});

    fetch(`/api/gps-hexes?date=${toIso.slice(0, 10)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setHexes(d);
        setGpsDate(d.date ?? null);
      })
      .catch(() => {});

    fetch(`/api/corridors?to=${encodeURIComponent(toIso)}&days=7`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(setCorridors)
      .catch(() => {});

    fetch(`/api/stats?to=${encodeURIComponent(toIso)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

    return () => controller.abort();
  }, [fromIso, toIso, activeCategories, country]);

  const toggleCategory = useCallback((c: IncidentCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const toggleLayer = useCallback((k: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const selectFromFeed = useCallback((f: Feature<Point, IncidentProperties>) => {
    setSelectedId(f.properties.id);
    const [lng, lat] = f.geometry.coordinates;
    setFlyTo({ lng, lat });
  }, []);

  const feedFeatures = useMemo(
    () => incidents.features as Feature<Point, IncidentProperties>[],
    [incidents]
  );

  // korytarze filtrowane po aktywnych kategoriach
  const visibleCorridors = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: corridors.features.filter((f) =>
        activeCategories.has(
          (f.properties as { category: IncidentCategory }).category
        )
      ),
    }),
    [corridors, activeCategories]
  );

  return (
    <div className="relative flex h-screen flex-col">
      <StatusBar stats={stats} gpsDate={gpsDate} />
      <div className="relative flex-1">
        <MapView
          incidents={incidents}
          hexes={hexes}
          corridors={visibleCorridors}
          layers={layers}
          selectedId={selectedId}
          flyTo={flyTo}
          onSelect={setSelectedId}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden md:block">
          <Sidebar
            features={feedFeatures}
            activeCategories={activeCategories}
            country={country}
            layers={layers}
            selectedId={selectedId}
            onToggleCategory={toggleCategory}
            onCountryChange={setCountry}
            onToggleLayer={toggleLayer}
            onSelect={selectFromFeed}
          />
        </div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 md:left-[calc(50%-11rem)]">
          <Timeline
            nowMs={nowMs}
            hoursBack={hoursBack}
            windowHours={windowHours}
            onHoursBackChange={setHoursBack}
            onWindowChange={setWindowHours}
          />
        </div>
      </div>
    </div>
  );
}
