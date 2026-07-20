"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { CATEGORY_META, type IncidentCategory } from "@/lib/types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

const categoryColorMatch: unknown[] = [
  "match",
  ["get", "category"],
  ...Object.entries(CATEGORY_META).flatMap(([cat, meta]) => [cat, meta.color]),
  "#ffffff",
];

export interface LayerVisibility {
  hexes: boolean;
  incidents: boolean;
  heat: boolean;
  corridors: boolean;
}

interface MapViewProps {
  incidents: FeatureCollection;
  hexes: FeatureCollection;
  corridors: FeatureCollection;
  layers: LayerVisibility;
  selectedId: number | null;
  flyTo: { lng: number; lat: number } | null;
  onSelect: (id: number | null) => void;
}

export default function MapView({
  incidents,
  hexes,
  corridors,
  layers,
  selectedId,
  flyTo,
  onSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [23.5, 56.0],
      zoom: 4.2,
      minZoom: 3,
      maxZoom: 11,
      attributionControl: {
        compact: true,
        customAttribution:
          'Dane GPS: <a href="https://gpsjam.org" target="_blank">gpsjam.org</a> (CC-BY, John Wiseman / ADS-B Exchange) | Monitoring mediów: <a href="https://www.gdeltproject.org" target="_blank">GDELT</a>',
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("gps-hexes", { type: "geojson", data: EMPTY_FC });
      map.addSource("incidents", { type: "geojson", data: EMPTY_FC });
      map.addSource("corridors", { type: "geojson", data: EMPTY_FC });

      map.addLayer({
        id: "gps-hexes-fill",
        type: "fill",
        source: "gps-hexes",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "bad_ratio"],
            0.0, "rgba(74, 222, 128, 0.0)",
            0.02, "rgba(250, 204, 21, 0.25)",
            0.1, "rgba(249, 115, 22, 0.35)",
            0.3, "rgba(239, 68, 68, 0.45)",
            0.7, "rgba(220, 38, 38, 0.6)",
          ],
          "fill-outline-color": "rgba(255,255,255,0.06)",
        },
      });

      map.addLayer({
        id: "disinfo-heat",
        type: "heatmap",
        source: "incidents",
        filter: ["==", ["get", "category"], "disinfo"],
        paint: {
          "heatmap-weight": ["*", ["get", "severity"], 0.3],
          "heatmap-radius": 60,
          "heatmap-intensity": 1.2,
          "heatmap-opacity": 0.55,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(56,189,248,0)",
            0.3, "rgba(56,189,248,0.4)",
            0.6, "rgba(59,130,246,0.6)",
            1, "rgba(147,197,253,0.9)",
          ],
        },
      });

      map.addLayer({
        id: "corridor-lines",
        type: "line",
        source: "corridors",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": categoryColorMatch as never,
          "line-width": ["min", ["+", 1.5, ["*", 0.4, ["get", "incidents"]]], 6],
          "line-opacity": 0.85,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "corridor-arrows",
        type: "symbol",
        source: "corridors",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 90,
          "text-field": "▶",
          "text-size": 12,
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": categoryColorMatch as never,
          "text-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "incident-points",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-color": categoryColorMatch as never,
          "circle-radius": ["+", 2, ["*", 1.6, ["get", "severity"]]],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(0,0,0,0.6)",
        },
      });
      map.addLayer({
        id: "incident-selected",
        type: "circle",
        source: "incidents",
        filter: ["==", ["get", "id"], -1],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["+", 7, ["*", 1.6, ["get", "severity"]]],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "incident-points", (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, {
          layers: ["incident-points"],
        })[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        onSelectRef.current(Number(p.id));
        const meta = CATEGORY_META[p.category as IncidentCategory];
        const when = new Date(p.occurred_at).toLocaleString("pl-PL", {
          dateStyle: "short",
          timeStyle: "short",
        });
        new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="border-left:3px solid ${meta.color}; padding-left:8px">
               <div style="color:${meta.color}; font-size:10px; text-transform:uppercase; letter-spacing:0.08em">${meta.label} · ${p.country} · ${when}</div>
               <div style="font-weight:600; margin:4px 0">${p.title}</div>
               <div style="color:#a1a1aa">${p.description ?? ""}</div>
               <div style="margin-top:6px; color:#71717a">Źródło: ${p.source}${
                 p.source_url && p.source_url !== "null"
                   ? ` · <a href="${p.source_url}" target="_blank" style="color:#a3e635">link</a>`
                   : ""
               }</div>
             </div>`
          )
          .addTo(map);
      });
      map.on("mouseenter", "incident-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "incident-points", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", (e: MapMouseEvent) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ["incident-points"],
        });
        if (hits.length === 0) onSelectRef.current(null);
      });

      // animacja przesuwu kresek na korytarzach (kierunek ruchu zagrożenia)
      const dashSeq: [number, number, number][] = [
        [0, 2, 2],
        [0.5, 2, 2],
        [1, 2, 2],
        [1.5, 2, 2],
      ];
      let step = 0;
      let last = 0;
      const animate = (t: number) => {
        if (t - last > 180) {
          last = t;
          step = (step + 1) % dashSeq.length;
          const [off, a, b] = dashSeq[step];
          if (map.getLayer("corridor-lines")) {
            map.setPaintProperty("corridor-lines", "line-dasharray", [off, a, b, 0]);
          }
        }
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      readyRef.current = true;
      syncData();
      syncVisibility();
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const dataRef = useRef({ incidents, hexes, corridors });
  dataRef.current = { incidents, hexes, corridors };
  const layersRef = useRef(layers);
  layersRef.current = layers;

  function syncData() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("incidents") as maplibregl.GeoJSONSource)?.setData(
      dataRef.current.incidents
    );
    (map.getSource("gps-hexes") as maplibregl.GeoJSONSource)?.setData(
      dataRef.current.hexes
    );
    (map.getSource("corridors") as maplibregl.GeoJSONSource)?.setData(
      dataRef.current.corridors
    );
  }

  function syncVisibility() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const l = layersRef.current;
    const vis = (on: boolean) => (on ? "visible" : "none");
    map.setLayoutProperty("gps-hexes-fill", "visibility", vis(l.hexes));
    map.setLayoutProperty("disinfo-heat", "visibility", vis(l.heat));
    map.setLayoutProperty("corridor-lines", "visibility", vis(l.corridors));
    map.setLayoutProperty("corridor-arrows", "visibility", vis(l.corridors));
    map.setLayoutProperty("incident-points", "visibility", vis(l.incidents));
    map.setLayoutProperty("incident-selected", "visibility", vis(l.incidents));
  }

  useEffect(syncData, [incidents, hexes, corridors]);
  useEffect(syncVisibility, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setFilter("incident-selected", ["==", ["get", "id"], selectedId ?? -1]);
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: Math.max(map.getZoom(), 6), duration: 1200 });
  }, [flyTo]);

  // wrapper trzyma pozycjonowanie — MapLibre nadpisuje position na kontenerze mapy
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
