// Obszar zainteresowania: wschodnia flanka NATO (Finlandia -> Rumunia)
export const FLANK_BBOX = {
  minLat: 44,
  maxLat: 72,
  minLng: 8,
  maxLng: 42,
};

export function inFlankBbox(lat: number, lng: number): boolean {
  return (
    lat >= FLANK_BBOX.minLat &&
    lat <= FLANK_BBOX.maxLat &&
    lng >= FLANK_BBOX.minLng &&
    lng <= FLANK_BBOX.maxLng
  );
}

// Przybliżone centroidy krajów flanki — do przypisywania kraju punktom
// (np. heksom GPS nad Bałtykiem przypisujemy najbliższy kraj)
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  FI: [64.5, 26.0],
  EE: [58.7, 25.5],
  LV: [56.9, 24.9],
  LT: [55.2, 23.9],
  PL: [52.1, 19.4],
  SK: [48.7, 19.7],
  HU: [47.2, 19.4],
  RO: [45.9, 25.0],
  NO: [64.0, 12.0],
  SE: [62.0, 15.0],
};

export function guessCountry(lat: number, lng: number): string {
  let best = "PL";
  let bestDist = Infinity;
  for (const [code, [clat, clng]] of Object.entries(COUNTRY_CENTROIDS)) {
    const d = (lat - clat) ** 2 + ((lng - clng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = code;
    }
  }
  return best;
}

// Mapowanie angielskich nazw krajów (z GDELT) na kody ISO
export const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  finland: "FI",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  poland: "PL",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  norway: "NO",
  sweden: "SE",
};
