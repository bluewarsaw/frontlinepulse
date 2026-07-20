import { withTransaction } from "../db";
import type { IncidentCategory } from "../types";

/**
 * Realistyczne dane seed dla kategorii bez darmowego, programistycznego
 * źródła w MVP (cyber, drony, granica, infrastruktura). Wzorce oparte na
 * rzeczywistych, publicznie opisywanych seriach incydentów z lat 2024-2026
 * (m.in. incydenty dronowe nad lotniskami i portami bałtyckimi, ataki DDoS
 * na instytucje, uszkodzenia kabli podmorskich, prowokacje graniczne).
 *
 * `dayOffset` to liczba dni wstecz od chwili seedu (0-6), a `hour` godzina
 * UTC zdarzenia — dzięki temu suwak czasu (7 dni) ma sensowny rozkład danych,
 * a sekwencje incydentów tworzą czytelne "korytarze zagrożeń" (np. fala
 * dronów przemieszczająca się z północy na południe).
 */
interface SeedIncident {
  key: string;
  category: IncidentCategory;
  severity: number;
  title: string;
  description: string;
  country: string;
  lat: number;
  lng: number;
  dayOffset: number;
  hour: number;
}

const SEEDS: SeedIncident[] = [
  // ── Korytarz dronowy: Finlandia -> Estonia -> Łotwa -> Litwa -> Polska (dni 6->2)
  {
    key: "drone-hel-01",
    category: "drone",
    severity: 3,
    title: "Rój dronów nad lotniskiem Helsinki-Vantaa",
    description:
      "Wstrzymano operacje lotnicze na 2 godziny po zaobserwowaniu kilku bezzałogowców w strefie kontrolowanej lotniska. Policja nie ustaliła operatora.",
    country: "FI",
    lat: 60.3172,
    lng: 24.9633,
    dayOffset: 6,
    hour: 21,
  },
  {
    key: "drone-tal-01",
    category: "drone",
    severity: 3,
    title: "Drony nad portem w Tallinie",
    description:
      "Straż graniczna potwierdziła obecność 3 dronów nad terminalem promowym. Obiekty odleciały w kierunku wschodnim.",
    country: "EE",
    lat: 59.4433,
    lng: 24.7666,
    dayOffset: 5,
    hour: 22,
  },
  {
    key: "drone-rig-01",
    category: "drone",
    severity: 2,
    title: "Bezzałogowiec nad bazą wojskową Adazi",
    description:
      "Żołnierze NATO zaobserwowali drona obserwacyjnego nad poligonem. Obiekt zniknął przed przybyciem systemów antydronowych.",
    country: "LV",
    lat: 57.0994,
    lng: 24.3319,
    dayOffset: 4,
    hour: 23,
  },
  {
    key: "drone-vil-01",
    category: "drone",
    severity: 3,
    title: "Dron przekroczył granicę z Białorusią k. Wilna",
    description:
      "Litewska armia potwierdziła wtargnięcie bezzałogowca typu Gerbera z terytorium Białorusi. Obiekt spadł w rejonie przygranicznym.",
    country: "LT",
    lat: 54.6402,
    lng: 25.6202,
    dayOffset: 3,
    hour: 4,
  },
  {
    key: "drone-waw-01",
    category: "drone",
    severity: 4,
    title: "Nieznane drony nad lotniskiem Chopina w Warszawie",
    description:
      "Wstrzymano starty i lądowania na 90 minut. Wojsko poderwało śmigłowce; trwa ustalanie operatorów. Wzorzec zbieżny z incydentami w Helsinkach i Tallinie z ostatnich dni.",
    country: "PL",
    lat: 52.1657,
    lng: 20.9671,
    dayOffset: 2,
    hour: 20,
  },

  // ── Korytarz cyber: Estonia -> Łotwa -> Polska (dni 4->1)
  {
    key: "cyber-ee-01",
    category: "cyber",
    severity: 3,
    title: "DDoS na estońskie banki i portal e-administracji",
    description:
      "Skoordynowany atak wolumetryczny na X-Road i największe banki. Grupa NoName057(16) przyznała się do ataku w kanale Telegram.",
    country: "EE",
    lat: 59.437,
    lng: 24.7536,
    dayOffset: 4,
    hour: 9,
  },
  {
    key: "cyber-lv-01",
    category: "cyber",
    severity: 3,
    title: "Atak na systemy IT ryskiego operatora energetycznego",
    description:
      "Wykryto próbę instalacji malware w sieci OT operatora dystrybucyjnego. Systemy odcięto prewencyjnie; dostawy energii niezakłócone.",
    country: "LV",
    lat: 56.9496,
    lng: 24.1052,
    dayOffset: 3,
    hour: 11,
  },
  {
    key: "cyber-pl-01",
    category: "cyber",
    severity: 4,
    title: "Kampania phishingowa podszywająca się pod PGE",
    description:
      "CERT Polska ostrzega przed masową kampanią z malware Remcos wymierzoną w klientów operatora energetycznego. Infrastruktura C2 zbieżna z atakami na Łotwie.",
    country: "PL",
    lat: 52.2297,
    lng: 21.0122,
    dayOffset: 1,
    hour: 8,
  },
  {
    key: "cyber-pl-02",
    category: "cyber",
    severity: 3,
    title: "DDoS na systemy samorządowe w Rzeszowie",
    description:
      "Niedostępne strony urzędu miasta i systemy kolejkowe. Rzeszów to kluczowy hub logistyczny pomocy dla Ukrainy.",
    country: "PL",
    lat: 50.0412,
    lng: 21.9991,
    dayOffset: 0,
    hour: 7,
  },
  {
    key: "cyber-fi-01",
    category: "cyber",
    severity: 2,
    title: "Skany portów infrastruktury wodociągowej w Finlandii",
    description:
      "NCSC-FI raportuje falę skanów systemów SCADA operatorów wodociągowych z adresów IP powiązanych z wcześniejszymi kampaniami APT.",
    country: "FI",
    lat: 61.4978,
    lng: 23.761,
    dayOffset: 2,
    hour: 14,
  },
  {
    key: "cyber-ro-01",
    category: "cyber",
    severity: 3,
    title: "Ransomware w rumuńskim szpitalu wojewódzkim",
    description:
      "Zaszyfrowano systemy szpitala w Klużu-Napoce. Wektor: skompromitowane konto dostawcy oprogramowania medycznego.",
    country: "RO",
    lat: 46.7712,
    lng: 23.6236,
    dayOffset: 5,
    hour: 3,
  },

  // ── Infrastruktura krytyczna (Bałtyk + lądowa)
  {
    key: "infra-balt-01",
    category: "infra",
    severity: 4,
    title: "Uszkodzenie kabla telekomunikacyjnego C-Lion1 na Bałtyku",
    description:
      "Operator potwierdził przerwanie łącza Helsinki-Rostock. W rejonie manewrował tankowiec tzw. floty cieni z wyłączonym AIS.",
    country: "FI",
    lat: 59.55,
    lng: 22.4,
    dayOffset: 5,
    hour: 2,
  },
  {
    key: "infra-balt-02",
    category: "infra",
    severity: 3,
    title: "Podejrzane kotwiczenie nad gazociągiem Balticconnector",
    description:
      "Fińska straż przybrzeżna eskortowała statek, który dryfował z opuszczoną kotwicą nad infrastrukturą przesyłową.",
    country: "EE",
    lat: 59.75,
    lng: 25.4,
    dayOffset: 2,
    hour: 16,
  },
  {
    key: "infra-pl-01",
    category: "infra",
    severity: 3,
    title: "Sabotaż na kolejowej linii przesyłowej k. Malborka",
    description:
      "Uszkodzone urządzenia sterowania ruchem kolejowym na trasie wykorzystywanej do transportów wojskowych. ABW zatrzymała dwie osoby.",
    country: "PL",
    lat: 54.0359,
    lng: 19.0266,
    dayOffset: 3,
    hour: 1,
  },
  {
    key: "infra-se-01",
    category: "infra",
    severity: 2,
    title: "Awaria zasilania stacji bazowych na Gotlandii",
    description:
      "Nagła utrata zasilania kilkunastu masztów telekomunikacyjnych. Operator bada, czy doszło do fizycznej ingerencji.",
    country: "SE",
    lat: 57.6348,
    lng: 18.2948,
    dayOffset: 1,
    hour: 5,
  },

  // ── Incydenty graniczne
  {
    key: "border-pl-01",
    category: "border",
    severity: 3,
    title: "Zorganizowany szturm migrantów na granicy k. Białowieży",
    description:
      "Grupa ok. 120 osób forsowała zaporę przy wsparciu służb białoruskich. Użyto lasera do oślepiania patroli SG.",
    country: "PL",
    lat: 52.7,
    lng: 23.85,
    dayOffset: 4,
    hour: 2,
  },
  {
    key: "border-lt-01",
    category: "border",
    severity: 2,
    title: "Balony przemytnicze zakłóciły ruch lotniska w Wilnie",
    description:
      "Kilkanaście balonów meteorologicznych z kontrabandą wleciało z Białorusi; lotnisko wstrzymało operacje na godzinę.",
    country: "LT",
    lat: 54.6341,
    lng: 25.2858,
    dayOffset: 6,
    hour: 22,
  },
  {
    key: "border-ee-01",
    category: "border",
    severity: 3,
    title: "Naruszenie przestrzeni powietrznej nad Zatoką Fińską",
    description:
      "Trzy MiG-31 bez planu lotu i z wyłączonymi transponderami przecięły przestrzeń Estonii na 12 minut. Poderwano myśliwce NATO.",
    country: "EE",
    lat: 59.9,
    lng: 26.5,
    dayOffset: 1,
    hour: 10,
  },
  {
    key: "border-ro-01",
    category: "border",
    severity: 3,
    title: "Szczątki drona Shahed na terytorium Rumunii",
    description:
      "Po nocnym ataku na ukraińskie porty dunajskie fragmenty bezzałogowca spadły k. Plauru. MSZ wezwało ambasadora Rosji.",
    country: "RO",
    lat: 45.3,
    lng: 28.7,
    dayOffset: 2,
    hour: 3,
  },
  {
    key: "border-no-01",
    category: "border",
    severity: 2,
    title: "Zakłócenia łączności przy granicy w Finnmarku",
    description:
      "Norweska straż graniczna raportuje powtarzające się zagłuszanie łączności radiowej patroli w rejonie Kirkenes.",
    country: "NO",
    lat: 69.7271,
    lng: 30.0451,
    dayOffset: 3,
    hour: 13,
  },

  // ── Dezinformacja (uzupełnienie danych GDELT o wyraźne kampanie)
  {
    key: "disinfo-pl-01",
    category: "disinfo",
    severity: 3,
    title: "Fala fake newsów o rzekomej mobilizacji w Polsce",
    description:
      "Skoordynowana kampania (sieć Doppelgänger) rozsiewa spreparowane komunikaty MON o poborze. Wzmocnienie przez sieć botów na platformie X.",
    country: "PL",
    lat: 52.2297,
    lng: 21.0122,
    dayOffset: 2,
    hour: 6,
  },
  {
    key: "disinfo-lt-01",
    category: "disinfo",
    severity: 2,
    title: "Deepfake z udziałem prezydenta Litwy",
    description:
      "W sieci krąży spreparowane nagranie sugerujące wycofanie wsparcia dla Ukrainy. Delfi i NARA potwierdzają manipulację.",
    country: "LT",
    lat: 54.6872,
    lng: 25.2797,
    dayOffset: 5,
    hour: 12,
  },
  {
    key: "disinfo-ro-01",
    category: "disinfo",
    severity: 3,
    title: "Kampania antynatowska przed szczytem w Bukareszcie",
    description:
      "Skok aktywności kont anonimowych promujących narrację o 'okupacji NATO'. Wzorzec zbieżny z kampanią przed wyborami 2024.",
    country: "RO",
    lat: 44.4268,
    lng: 26.1025,
    dayOffset: 0,
    hour: 9,
  },
  {
    key: "disinfo-fi-01",
    category: "disinfo",
    severity: 2,
    title: "Dezinformacja o zamknięciu przejść granicznych",
    description:
      "Rozsiewane w mediach społecznościowych fałszywe komunikaty o otwarciu granicy fińsko-rosyjskiej mają prowokować ruch migracyjny.",
    country: "FI",
    lat: 60.9539,
    lng: 28.35,
    dayOffset: 4,
    hour: 15,
  },
];

export async function seedIncidents(): Promise<{ inserted: number }> {
  const now = new Date();
  let inserted = 0;
  await withTransaction(async (client) => {
    for (const s of SEEDS) {
      const occurred = new Date(now);
      occurred.setUTCDate(occurred.getUTCDate() - s.dayOffset);
      occurred.setUTCHours(s.hour, 0, 0, 0);
      if (occurred > now) occurred.setUTCDate(occurred.getUTCDate() - 1);
      const res = await client.query(
        `INSERT INTO incidents
           (category, severity, title, description, source, source_url,
            country, geom, occurred_at, dedup_key)
         VALUES ($1, $2, $3, $4, 'seed (dane poglądowe)', NULL, $5,
                 ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9)
         ON CONFLICT (dedup_key) DO UPDATE SET occurred_at = EXCLUDED.occurred_at`,
        [
          s.category,
          s.severity,
          s.title,
          s.description,
          s.country,
          s.lng,
          s.lat,
          occurred.toISOString(),
          `seed:${s.key}`,
        ]
      );
      inserted += res.rowCount ?? 0;
    }
  });
  return { inserted };
}
