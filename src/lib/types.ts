export const CATEGORIES = [
  "gps_jamming",
  "cyber",
  "drone",
  "disinfo",
  "border",
  "infra",
] as const;

export type IncidentCategory = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; color: string }
> = {
  gps_jamming: { label: "Zakłócenia GPS", color: "#f59e0b" },
  cyber: { label: "Cyberatak", color: "#ef4444" },
  drone: { label: "Aktywność dronów", color: "#a855f7" },
  disinfo: { label: "Dezinformacja", color: "#38bdf8" },
  border: { label: "Incydent graniczny", color: "#f97316" },
  infra: { label: "Infrastruktura", color: "#facc15" },
};

// Kraje wschodniej flanki objęte monitoringiem
export const FLANK_COUNTRIES: Record<string, string> = {
  FI: "Finlandia",
  EE: "Estonia",
  LV: "Łotwa",
  LT: "Litwa",
  PL: "Polska",
  SK: "Słowacja",
  HU: "Węgry",
  RO: "Rumunia",
  NO: "Norwegia",
  SE: "Szwecja",
};

export interface IncidentProperties {
  id: number;
  category: IncidentCategory;
  severity: number;
  title: string;
  description: string | null;
  source: string;
  source_url: string | null;
  country: string;
  occurred_at: string;
}

export interface StatsEntry {
  category: IncidentCategory;
  last24h: number;
  prev24h: number;
}
