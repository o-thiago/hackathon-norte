/**
 * Seed — Sentinela das Águas e Vicinais
 *
 * Generates two fully self-contained "as-of" scenarios over the same school network:
 *   • inverno — Inverno Amazônico (cheia do Madeira/Mamoré/Candeias, vicinais em atoleiro), 27/03/2026
 *   • verao   — Verão Amazônico (vazante severa, focos de queimada e fumaça PM2.5), 18/09/2026
 *
 * All telemetry is synthetic but calibrated to plausible quotas and coordinates in Rondônia.
 * A deterministic PRNG keeps every run identical.
 */
import { sql } from "drizzle-orm";
import { client, db } from "./index";
import {
  actionChecklist,
  airQualityReadings,
  fireHotspots,
  fuioAgreements,
  hydroReadings,
  hydroStations,
  routeConditions,
  scenarios,
  schools,
  transportRoutes,
  type LatLngTuple,
} from "./schema";

type ScenarioKey = "inverno" | "verao";

const DAY_MS = 86_400_000;
const SERIES_DAYS = 21;

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260327);
const jitter = (amplitude: number) => (rand() * 2 - 1) * amplitude;

function haversineKm(
  [aLat, aLng]: LatLngTuple,
  [bLat, bLng]: LatLngTuple,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pathLengthKm(path: LatLngTuple[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1)
    total += haversineKm(path[i - 1]!, path[i]!);
  return Math.round(total * 10) / 10;
}

/** Daily timestamps (12:00 local, UTC−4) ending on the reference instant. */
function dailyTimestamps(reference: Date): Date[] {
  return Array.from(
    { length: SERIES_DAYS },
    (_, i) => new Date(reference.getTime() - (SERIES_DAYS - 1 - i) * DAY_MS),
  );
}

/**
 * Builds a series that starts near `start`, finishes exactly at `end`,
 * and whose last day-over-day delta equals `finalTrend`.
 */
function shapedSeries(
  start: number,
  end: number,
  finalTrend: number,
  noise: number,
): number[] {
  const penultimate = end - finalTrend;
  const values: number[] = [];
  for (let i = 0; i < SERIES_DAYS - 1; i += 1) {
    const t = i / (SERIES_DAYS - 2);
    const eased = t * t * (3 - 2 * t);
    const base = start + (penultimate - start) * eased;
    values.push(i === SERIES_DAYS - 2 ? penultimate : base + jitter(noise));
  }
  values.push(end);
  return values;
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

const SCENARIOS = [
  {
    key: "inverno",
    label: "Inverno Amazônico · Cheia 2026",
    season: "INVERNO" as const,
    referenceAt: new Date("2026-03-27T16:00:00Z"),
    description:
      "Pico de cheia: Rio Madeira acima da cota de inundação em Porto Velho e no Baixo Madeira, Mamoré em elevação acelerada em Guajará-Mirim e chuvas acumuladas que transformam as linhas vicinais de Cacoal em atoleiros.",
  },
  {
    key: "verao",
    label: "Verão Amazônico · Vazante 2026",
    season: "VERAO" as const,
    referenceAt: new Date("2026-09-18T16:00:00Z"),
    description:
      "Vazante severa: bancos de areia expostos bloqueiam voadeiras no Baixo Madeira, enquanto aglomerados de focos de calor em Cacoal e Candeias do Jamari elevam o PM2.5 a níveis insalubres em salas sem climatização.",
  },
];

/* ------------------------------------------------------------------ */
/* Hydrological stations                                               */
/* ------------------------------------------------------------------ */

interface StationSeed {
  code: string;
  name: string;
  river: string;
  municipality: string;
  lat: number;
  lng: number;
  alertLevelCm: number;
  floodLevelCm: number;
  severeFloodLevelCm: number;
  droughtLevelCm: number;
  severeDroughtLevelCm: number;
  series: Record<ScenarioKey, { start: number; end: number; trend: number }>;
}

const STATIONS: StationSeed[] = [
  {
    code: "15400000",
    name: "Rio Madeira em Porto Velho",
    river: "Rio Madeira",
    municipality: "Porto Velho",
    lat: -8.7486,
    lng: -63.9174,
    alertLevelCm: 1600,
    floodLevelCm: 1700,
    severeFloodLevelCm: 1850,
    droughtLevelCm: 300,
    severeDroughtLevelCm: 150,
    series: {
      inverno: { start: 1560, end: 1748, trend: 9 },
      verao: { start: 330, end: 128, trend: -7 },
    },
  },
  {
    code: "15630000",
    name: "Rio Madeira em Calama",
    river: "Rio Madeira",
    municipality: "Porto Velho (Baixo Madeira)",
    lat: -8.0335,
    lng: -62.8705,
    alertLevelCm: 1450,
    floodLevelCm: 1600,
    severeFloodLevelCm: 1750,
    droughtLevelCm: 250,
    severeDroughtLevelCm: 120,
    series: {
      inverno: { start: 1480, end: 1636, trend: 7 },
      verao: { start: 290, end: 105, trend: -6 },
    },
  },
  {
    code: "15250000",
    name: "Rio Mamoré em Guajará-Mirim",
    river: "Rio Mamoré",
    municipality: "Guajará-Mirim",
    lat: -10.7889,
    lng: -65.346,
    alertLevelCm: 1050,
    floodLevelCm: 1200,
    severeFloodLevelCm: 1450,
    droughtLevelCm: 250,
    severeDroughtLevelCm: 120,
    series: {
      inverno: { start: 1010, end: 1212, trend: 12 },
      verao: { start: 360, end: 230, trend: -5 },
    },
  },
  {
    code: "15560000",
    name: "Rio Machado em Ji-Paraná",
    river: "Rio Machado (Ji-Paraná)",
    municipality: "Ji-Paraná",
    lat: -10.8745,
    lng: -61.938,
    alertLevelCm: 900,
    floodLevelCm: 1050,
    severeFloodLevelCm: 1250,
    droughtLevelCm: 150,
    severeDroughtLevelCm: 80,
    series: {
      inverno: { start: 780, end: 935, trend: 11 },
      verao: { start: 240, end: 160, trend: -3 },
    },
  },
  {
    code: "15430000",
    name: "Rio Candeias em Candeias do Jamari",
    river: "Rio Candeias",
    municipality: "Candeias do Jamari",
    lat: -8.784,
    lng: -63.709,
    alertLevelCm: 820,
    floodLevelCm: 900,
    severeFloodLevelCm: 1000,
    droughtLevelCm: 180,
    severeDroughtLevelCm: 100,
    series: {
      inverno: { start: 760, end: 905, trend: 6 },
      verao: { start: 230, end: 150, trend: -4 },
    },
  },
];

/* ------------------------------------------------------------------ */
/* Schools                                                             */
/* ------------------------------------------------------------------ */

interface SchoolSeed {
  inepCode: string;
  name: string;
  network: "ESTADUAL" | "MUNICIPAL";
  municipality: string;
  community: string;
  lat: number;
  lng: number;
  enrollment: number;
  capacity: number;
  floors: number;
  climatized: boolean;
  transportMode: "URBANO" | "FLUVIAL" | "VICINAL" | "MISTO";
  stationCode: string | null;
  floodThresholdCm: number | null;
  labComputers: number;
  hasServer: boolean;
  archiveBoxes: number;
  groundFloorSubstation: boolean;
  principal: string;
  phone: string;
  /** Latest outdoor PM2.5 (µg/m³) for each scenario. */
  pm25: Record<ScenarioKey, number>;
}

const SCHOOLS: SchoolSeed[] = [
  // 1. Porto Velho — Urbana
  {
    inepCode: "11002484",
    name: "EEEM Major Guapindaia",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community:
      "Bairro São Cristóvão / São João Bosco (Rua Padre Chiquinho, 2375)",
    lat: -8.7495,
    lng: -63.8821,
    enrollment: 1120,
    capacity: 1350,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15400000",
    floodThresholdCm: null,
    labComputers: 30,
    hasServer: true,
    archiveBoxes: 140,
    groundFloorSubstation: false,
    principal: "Profª. Lucinéia Andrade",
    phone: "(69) 3216-4410",
    pm25: { inverno: 9, verao: 95 },
  },
  {
    inepCode: "11003065",
    name: "IEE Carmela Dutra",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community: "Bairro Arigolândia (Av. Farquar, 1913 - Orla do Madeira)",
    lat: -8.7562,
    lng: -63.9055,
    enrollment: 890,
    capacity: 1100,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15400000",
    floodThresholdCm: 1780,
    labComputers: 25,
    hasServer: true,
    archiveBoxes: 110,
    groundFloorSubstation: false,
    principal: "Profª. Maristela Gomes",
    phone: "(69) 3216-3040",
    pm25: { inverno: 10, verao: 95 },
  },
  {
    inepCode: "11002468",
    name: "EEEFM Barão do Solimões",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community: "Bairro Caiari / Centro Histórico (Rua José Bonifácio, 351)",
    lat: -8.7618,
    lng: -63.901,
    enrollment: 980,
    capacity: 1250,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15400000",
    floodThresholdCm: 1820,
    labComputers: 35,
    hasServer: true,
    archiveBoxes: 210,
    groundFloorSubstation: true,
    principal: "Profª. Ana Cláudia Matos",
    phone: "(69) 3216-5080",
    pm25: { inverno: 10, verao: 95 },
  },
  {
    inepCode: "11002883",
    name: "EMEIEF Pingo de Gente",
    network: "MUNICIPAL",
    municipality: "Porto Velho",
    community: "Bairro Ulisses Guimarães (Rua Órion, 102 - Zona Leste)",
    lat: -8.779,
    lng: -63.829,
    enrollment: 470,
    capacity: 620,
    floors: 1,
    climatized: false,
    transportMode: "URBANO",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 12,
    hasServer: false,
    archiveBoxes: 40,
    groundFloorSubstation: false,
    principal: "Profª. Rosângela Pinheiro",
    phone: "(69) 3901-3390",
    pm25: { inverno: 8, verao: 88 },
  },
  {
    inepCode: "11002778",
    name: "EMEIEF Dr. Tancredo de Almeida Neves",
    network: "MUNICIPAL",
    municipality: "Porto Velho",
    community: "Bairro Eletronorte (Rua das Faveiras, 3123 - Zona Sul)",
    lat: -8.795,
    lng: -63.876,
    enrollment: 580,
    capacity: 750,
    floors: 1,
    climatized: true,
    transportMode: "URBANO",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 20,
    hasServer: true,
    archiveBoxes: 65,
    groundFloorSubstation: false,
    principal: "Profª. Miriam Fagundes",
    phone: "(69) 3901-3210",
    pm25: { inverno: 8, verao: 86 },
  },

  // 2. Porto Velho — Baixo Madeira (Ribeirinhas)
  {
    inepCode: "11002204",
    name: "EMEF São Carlos",
    network: "MUNICIPAL",
    municipality: "Porto Velho",
    community: "Distrito de São Carlos (Ramal dos Pioneiros - Baixo Madeira)",
    lat: -8.4672,
    lng: -63.489,
    enrollment: 180,
    capacity: 220,
    floors: 1,
    climatized: false,
    transportMode: "FLUVIAL",
    stationCode: "15400000",
    floodThresholdCm: 1695,
    labComputers: 10,
    hasServer: false,
    archiveBoxes: 38,
    groundFloorSubstation: true,
    principal: "Profª. Raimunda Lopes",
    phone: "(69) 99231-0451",
    pm25: { inverno: 7, verao: 105 },
  },
  {
    inepCode: "11050578",
    name: "EEEM Profª. Juracy Lima Tavares",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community: "Distrito de São Carlos (Margem Direita do Rio Madeira)",
    lat: -8.4685,
    lng: -63.4875,
    enrollment: 240,
    capacity: 350,
    floors: 2,
    climatized: true,
    transportMode: "MISTO",
    stationCode: "15400000",
    floodThresholdCm: 1780,
    labComputers: 20,
    hasServer: true,
    archiveBoxes: 80,
    groundFloorSubstation: false,
    principal: "Prof. Manoel Bezerra",
    phone: "(69) 99210-7733",
    pm25: { inverno: 8, verao: 95 },
  },
  {
    inepCode: "11048670",
    name: "EEEM Profº Francisco Passos Desmorest",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community: "Distrito de Nazaré (Baixo Madeira)",
    lat: -8.217,
    lng: -63.284,
    enrollment: 160,
    capacity: 200,
    floors: 1,
    climatized: false,
    transportMode: "FLUVIAL",
    stationCode: "15630000",
    floodThresholdCm: 1620,
    labComputers: 16,
    hasServer: false,
    archiveBoxes: 70,
    groundFloorSubstation: true,
    principal: "Profª. Francisca Moraes",
    phone: "(69) 99245-1180",
    pm25: { inverno: 6, verao: 80 },
  },
  {
    inepCode: "11003413",
    name: "EEEFM General Osório",
    network: "ESTADUAL",
    municipality: "Porto Velho",
    community: "Distrito de Calama (Foz do Rio Machado)",
    lat: -8.0315,
    lng: -62.872,
    enrollment: 260,
    capacity: 310,
    floors: 1,
    climatized: false,
    transportMode: "FLUVIAL",
    stationCode: "15630000",
    floodThresholdCm: 1610,
    labComputers: 12,
    hasServer: false,
    archiveBoxes: 55,
    groundFloorSubstation: true,
    principal: "Prof. Josué Cavalcante",
    phone: "(69) 99263-4402",
    pm25: { inverno: 6, verao: 75 },
  },

  // 3. Guajará-Mirim — Rio Mamoré / Fronteira
  {
    inepCode: "11006498",
    name: "EMEIEF Professor Salomão Silva",
    network: "MUNICIPAL",
    municipality: "Guajará-Mirim",
    community: "Bairro Liberdade (Av. Dr. Lewerger, 4564 - Orla do Mamoré)",
    lat: -10.781,
    lng: -65.3415,
    enrollment: 340,
    capacity: 390,
    floors: 1,
    climatized: false,
    transportMode: "URBANO",
    stationCode: "15250000",
    floodThresholdCm: 1210,
    labComputers: 15,
    hasServer: false,
    archiveBoxes: 60,
    groundFloorSubstation: true,
    principal: "Profª. Dalva Suárez",
    phone: "(69) 3541-2207",
    pm25: { inverno: 9, verao: 48 },
  },
  {
    inepCode: "11006641",
    name: "EEEMTI Simón Bolívar",
    network: "ESTADUAL",
    municipality: "Guajará-Mirim",
    community: "Centro (Av. 15 de Novembro, 338)",
    lat: -10.785,
    lng: -65.337,
    enrollment: 710,
    capacity: 980,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15250000",
    floodThresholdCm: 1520,
    labComputers: 28,
    hasServer: true,
    archiveBoxes: 160,
    groundFloorSubstation: false,
    principal: "Prof. Hélio Arana",
    phone: "(69) 3541-3315",
    pm25: { inverno: 9, verao: 48 },
  },
  {
    inepCode: "11006633",
    name: "EEEFM Rocha Leal",
    network: "ESTADUAL",
    municipality: "Guajará-Mirim",
    community: "Bairro São José (Av. Dr. Lewerger, 1194)",
    lat: -10.7975,
    lng: -65.3255,
    enrollment: 450,
    capacity: 550,
    floors: 1,
    climatized: false,
    transportMode: "VICINAL",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 10,
    hasServer: false,
    archiveBoxes: 45,
    groundFloorSubstation: false,
    principal: "Profª. Neide Guaporé",
    phone: "(69) 3541-2480",
    pm25: { inverno: 8, verao: 52 },
  },

  // 4. Cacoal — Vicinais e Queimadas
  {
    inepCode: "11026278",
    name: "EEEFM Cora Coralina",
    network: "ESTADUAL",
    municipality: "Cacoal",
    community: "Centro (Rua José do Patrocínio, 2159)",
    lat: -11.438,
    lng: -61.447,
    enrollment: 860,
    capacity: 1150,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 32,
    hasServer: true,
    archiveBoxes: 150,
    groundFloorSubstation: false,
    principal: "Profª. Márcia Schmidt",
    phone: "(69) 3441-2290",
    pm25: { inverno: 7, verao: 70 },
  },
  {
    inepCode: "11027347",
    name: "EEEMTI Clodoaldo Nunes de Almeida",
    network: "ESTADUAL",
    municipality: "Cacoal",
    community:
      "Bairro Jardim Clodoaldo (Rua Presidente Médici, 1930 - Acesso Linha 10)",
    lat: -11.428,
    lng: -61.455,
    enrollment: 380,
    capacity: 450,
    floors: 1,
    climatized: false,
    transportMode: "VICINAL",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 12,
    hasServer: false,
    archiveBoxes: 40,
    groundFloorSubstation: false,
    principal: "Prof. Valdir Kummer",
    phone: "(69) 3441-4015",
    pm25: { inverno: 6, verao: 120 },
  },
  {
    inepCode: "11027312",
    name: "EEEFM Bernardo Guimarães",
    network: "ESTADUAL",
    municipality: "Cacoal",
    community: "Bairro Princesa Isabel (Rua Antônio de Paula Nunes, 737)",
    lat: -11.442,
    lng: -61.439,
    enrollment: 520,
    capacity: 650,
    floors: 1,
    climatized: false,
    transportMode: "VICINAL",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 18,
    hasServer: true,
    archiveBoxes: 60,
    groundFloorSubstation: false,
    principal: "Profª. Ivone Bortolini",
    phone: "(69) 3441-3820",
    pm25: { inverno: 6, verao: 185 },
  },
  {
    inepCode: "11026197",
    name: "EEEFM Carlos Drummond de Andrade",
    network: "ESTADUAL",
    municipality: "Cacoal",
    community: "Bairro Vista Alegre (Rua Basílio da Gama, 1272)",
    lat: -11.425,
    lng: -61.432,
    enrollment: 650,
    capacity: 880,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 22,
    hasServer: true,
    archiveBoxes: 75,
    groundFloorSubstation: false,
    principal: "Prof. Arlindo Krause",
    phone: "(69) 3441-1180",
    pm25: { inverno: 7, verao: 95 },
  },

  // 5. Candeias do Jamari — Rio Candeias / Samuel
  {
    inepCode: "11045043",
    name: "EMEIF Mário Covas",
    network: "MUNICIPAL",
    municipality: "Candeias do Jamari",
    community: "Distrito Nova Samuel / Linha 45 (Área Rural Vicinal)",
    lat: -8.952,
    lng: -63.481,
    enrollment: 280,
    capacity: 320,
    floors: 1,
    climatized: false,
    transportMode: "VICINAL",
    stationCode: null,
    floodThresholdCm: null,
    labComputers: 10,
    hasServer: false,
    archiveBoxes: 35,
    groundFloorSubstation: false,
    principal: "Profª. Elza Tavares",
    phone: "(69) 3230-1144",
    pm25: { inverno: 10, verao: 140 },
  },
  {
    inepCode: "11005041",
    name: "EEEFM Carlos Drummond de Andrade",
    network: "ESTADUAL",
    municipality: "Candeias do Jamari",
    community: "Bairro União (Rua Tancredo Neves, 1487 - Centro Urbano)",
    lat: -8.796,
    lng: -63.692,
    enrollment: 640,
    capacity: 860,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15430000",
    floodThresholdCm: 1040,
    labComputers: 26,
    hasServer: true,
    archiveBoxes: 120,
    groundFloorSubstation: true,
    principal: "Prof. Roberto Sena",
    phone: "(69) 3230-2010",
    pm25: { inverno: 10, verao: 110 },
  },
  {
    inepCode: "11004860",
    name: "EMEF Dom João Batista Costa",
    network: "MUNICIPAL",
    municipality: "Candeias do Jamari",
    community: "Bairro União (Av. Ayrton Senna, 604 - Margem do Rio Candeias)",
    lat: -8.7885,
    lng: -63.7045,
    enrollment: 310,
    capacity: 340,
    floors: 1,
    climatized: false,
    transportMode: "URBANO",
    stationCode: "15430000",
    floodThresholdCm: 890,
    labComputers: 14,
    hasServer: false,
    archiveBoxes: 50,
    groundFloorSubstation: true,
    principal: "Profª. Cleide Rocha",
    phone: "(69) 3230-1550",
    pm25: { inverno: 10, verao: 110 },
  },

  // 6. Ji-Paraná — Rio Machado
  {
    inepCode: "11015608",
    name: "EEEFM Aluizio Ferreira",
    network: "ESTADUAL",
    municipality: "Ji-Paraná",
    community: "Bairro Nova Brasília (Rua São Paulo, 1627)",
    lat: -10.883,
    lng: -61.936,
    enrollment: 480,
    capacity: 600,
    floors: 1,
    climatized: false,
    transportMode: "URBANO",
    stationCode: "15560000",
    floodThresholdCm: 1020,
    labComputers: 16,
    hasServer: false,
    archiveBoxes: 55,
    groundFloorSubstation: true,
    principal: "Prof. Gilmar Fontoura",
    phone: "(69) 3416-4021",
    pm25: { inverno: 8, verao: 75 },
  },
  {
    inepCode: "11016094",
    name: "IEE Marechal Rondon",
    network: "ESTADUAL",
    municipality: "Ji-Paraná",
    community:
      "Bairro Casa Preta (Av. Transcontinental, 710 - Orla do Rio Machado)",
    lat: -10.8715,
    lng: -61.9445,
    enrollment: 820,
    capacity: 1100,
    floors: 2,
    climatized: true,
    transportMode: "URBANO",
    stationCode: "15560000",
    floodThresholdCm: 1300,
    labComputers: 30,
    hasServer: true,
    archiveBoxes: 140,
    groundFloorSubstation: false,
    principal: "Profª. Sandra Weber",
    phone: "(69) 3416-5530",
    pm25: { inverno: 8, verao: 75 },
  },
];

/* ------------------------------------------------------------------ */
/* Transport routes                                                    */
/* ------------------------------------------------------------------ */

interface RouteSeed {
  code: string;
  name: string;
  schoolInep: string;
  mode: "FLUVIAL" | "VICINAL";
  stationCode: string | null;
  vehicle: string;
  studentsServed: number;
  path: LatLngTuple[];
  /** Latest 72h accumulated rainfall (mm) per scenario — vicinal routes only. */
  rainfall: Record<ScenarioKey, number> | null;
}

const ROUTES: RouteSeed[] = [
  {
    code: "RF-SCJ-01",
    name: "Rio Madeira · Comunidades a montante → São Carlos",
    schoolInep: "11002204",
    mode: "FLUVIAL",
    stationCode: "15400000",
    vehicle: "Barco escolar (lancha 40 lugares)",
    studentsServed: 95,
    path: [
      [-8.548, -63.638],
      [-8.515, -63.585],
      [-8.49, -63.535],
      [-8.4672, -63.489],
    ],
    rainfall: null,
  },
  {
    code: "RF-SCJ-02",
    name: "Rio Madeira · Comunidades a jusante → São Carlos",
    schoolInep: "11002204",
    mode: "FLUVIAL",
    stationCode: "15400000",
    vehicle: "Voadeira 15 HP",
    studentsServed: 40,
    path: [
      [-8.41, -63.4],
      [-8.44, -63.445],
      [-8.4672, -63.489],
    ],
    rainfall: null,
  },
  {
    code: "RV-CJG-01",
    name: "Estrada do Cujubim Grande",
    schoolInep: "11050578",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural 4x4",
    studentsServed: 120,
    path: [
      [-8.7, -63.835],
      [-8.68, -63.815],
      [-8.655, -63.795],
      [-8.6355, -63.779],
    ],
    rainfall: { inverno: 28, verao: 0 },
  },
  {
    code: "RF-NAZ-01",
    name: "Rio Madeira · Linha fluvial Nazaré",
    schoolInep: "11048670",
    mode: "FLUVIAL",
    stationCode: "15630000",
    vehicle: "Barco escolar (lancha 40 lugares)",
    studentsServed: 110,
    path: [
      [-8.32, -63.43],
      [-8.28, -63.37],
      [-8.245, -63.32],
      [-8.217, -63.284],
    ],
    rainfall: null,
  },
  {
    code: "RF-CAL-01",
    name: "Rio Madeira · Linha fluvial Calama",
    schoolInep: "11003413",
    mode: "FLUVIAL",
    stationCode: "15630000",
    vehicle: "Voadeira 25 HP",
    studentsServed: 85,
    path: [
      [-8.13, -63.08],
      [-8.095, -63.0],
      [-8.06, -62.93],
      [-8.03, -62.877],
    ],
    rainfall: null,
  },
  {
    code: "RF-CAL-02",
    name: "Rio Machado · Comunidades ribeirinhas → Calama",
    schoolInep: "11003413",
    mode: "FLUVIAL",
    stationCode: "15630000",
    vehicle: "Voadeira 15 HP",
    studentsServed: 60,
    path: [
      [-8.15, -62.77],
      [-8.1, -62.81],
      [-8.06, -62.85],
      [-8.03, -62.877],
    ],
    rainfall: null,
  },
  {
    code: "RV-IAT-32",
    name: "Linha 32 · Iata",
    schoolInep: "11006633",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural",
    studentsServed: 90,
    path: [
      [-10.69, -65.3],
      [-10.66, -65.28],
      [-10.63, -65.26],
      [-10.606, -65.24],
    ],
    rainfall: { inverno: 95, verao: 2 },
  },
  {
    code: "RV-CAC-L10",
    name: "Linha 10 · Cacoal → Pirarara",
    schoolInep: "11027347",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural",
    studentsServed: 110,
    path: [
      [-11.395, -61.415],
      [-11.37, -61.4],
      [-11.35, -61.39],
      [-11.329, -61.379],
    ],
    rainfall: { inverno: 142, verao: 3 },
  },
  {
    code: "RV-CAC-T07",
    name: "Travessão 07 · Pirarara",
    schoolInep: "11027347",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Micro-ônibus rural",
    studentsServed: 55,
    path: [
      [-11.3, -61.33],
      [-11.315, -61.355],
      [-11.329, -61.379],
    ],
    rainfall: { inverno: 128, verao: 1 },
  },
  {
    code: "RV-CAC-RZ",
    name: "Linha 7 · Cacoal → Riozinho",
    schoolInep: "11027312",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural",
    studentsServed: 140,
    path: [
      [-11.5, -61.42],
      [-11.53, -61.39],
      [-11.555, -61.36],
      [-11.579, -61.332],
    ],
    rainfall: { inverno: 82, verao: 0 },
  },
  {
    code: "RV-CAC-L11",
    name: "Linha 11 · Capa Zero",
    schoolInep: "11026197",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural",
    studentsServed: 150,
    path: [
      [-11.42, -61.5],
      [-11.4, -61.52],
      [-11.385, -61.535],
      [-11.372, -61.548],
    ],
    rainfall: { inverno: 40, verao: 2 },
  },
  {
    code: "RV-CDJ-TRI",
    name: "Ramal do Triunfo",
    schoolInep: "11045043",
    mode: "VICINAL",
    stationCode: null,
    vehicle: "Ônibus escolar rural 4x4",
    studentsServed: 100,
    path: [
      [-8.95, -63.6],
      [-8.99, -63.57],
      [-9.02, -63.545],
      [-9.045, -63.526],
    ],
    rainfall: { inverno: 74, verao: 4 },
  },
];

/* ------------------------------------------------------------------ */
/* Wildfire clusters (Painel do Fogo mock)                             */
/* ------------------------------------------------------------------ */

interface HotspotCluster {
  lat: number;
  lng: number;
  count: number;
  spreadDeg: number;
  frpRange: [number, number];
}

const HOTSPOT_CLUSTERS: Record<ScenarioKey, HotspotCluster[]> = {
  inverno: [
    { lat: -11.62, lng: -61.25, count: 1, spreadDeg: 0.05, frpRange: [4, 9] },
    { lat: -9.1, lng: -63.45, count: 2, spreadDeg: 0.05, frpRange: [3, 8] },
  ],
  verao: [
    { lat: -11.6, lng: -61.3, count: 18, spreadDeg: 0.12, frpRange: [15, 140] },
    { lat: -11.3, lng: -61.33, count: 12, spreadDeg: 0.1, frpRange: [12, 95] },
    {
      lat: -9.08,
      lng: -63.48,
      count: 16,
      spreadDeg: 0.12,
      frpRange: [18, 160],
    },
    { lat: -8.84, lng: -63.63, count: 11, spreadDeg: 0.08, frpRange: [10, 80] },
    { lat: -8.58, lng: -63.55, count: 8, spreadDeg: 0.1, frpRange: [8, 60] },
    { lat: -10.68, lng: -65.12, count: 5, spreadDeg: 0.08, frpRange: [6, 40] },
    { lat: -10.95, lng: -61.84, count: 6, spreadDeg: 0.08, frpRange: [8, 55] },
  ],
};

const SATELLITES = [
  "AQUA_M-T",
  "TERRA_M-T",
  "NOAA-20 (VIIRS)",
  "SNPP (VIIRS)",
  "GOES-16",
];

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

async function seed() {
  console.log("🌱 Limpando base…");
  await db.execute(sql`
    truncate table
      action_checklist, fuio_agreements, air_quality_readings, fire_hotspots,
      route_conditions, transport_routes, schools, hydro_readings, hydro_stations, scenarios
    restart identity cascade
  `);

  console.log("🗓️  Cenários…");
  await db.insert(scenarios).values(SCENARIOS);

  console.log("🌊 Estações fluviométricas e leituras…");
  const stationRows = await db
    .insert(hydroStations)
    .values(STATIONS.map(({ series: _series, ...station }) => station))
    .returning({ id: hydroStations.id, code: hydroStations.code });
  const stationIdByCode = new Map(stationRows.map((s) => [s.code, s.id]));

  const readingValues: (typeof hydroReadings.$inferInsert)[] = [];
  for (const scenario of SCENARIOS) {
    const timestamps = dailyTimestamps(scenario.referenceAt);
    for (const station of STATIONS) {
      const cfg = station.series[scenario.key as ScenarioKey];
      const values = shapedSeries(cfg.start, cfg.end, cfg.trend, 4);
      timestamps.forEach((measuredAt, i) => {
        readingValues.push({
          stationId: stationIdByCode.get(station.code)!,
          measuredAt,
          levelCm: Math.round(values[i]!),
        });
      });
    }
  }
  await db.insert(hydroReadings).values(readingValues);

  console.log("🏫 Escolas…");
  const schoolRows = await db
    .insert(schools)
    .values(
      SCHOOLS.map(({ stationCode, pm25: _pm25, ...school }) => ({
        ...school,
        stationId: stationCode
          ? (stationIdByCode.get(stationCode) ?? null)
          : null,
      })),
    )
    .returning({ id: schools.id, inepCode: schools.inepCode });
  const schoolIdByInep = new Map(schoolRows.map((s) => [s.inepCode, s.id]));
  const sid = (inep: string) => {
    const id = schoolIdByInep.get(inep);
    if (id === undefined)
      throw new Error(`Escola INEP ${inep} ausente do seed.`);
    return id;
  };

  console.log("🛶 Rotas de transporte e pluviometria…");
  const routeRows = await db
    .insert(transportRoutes)
    .values(
      ROUTES.map((route) => ({
        code: route.code,
        name: route.name,
        schoolId: sid(route.schoolInep),
        mode: route.mode,
        stationId: route.stationCode
          ? (stationIdByCode.get(route.stationCode) ?? null)
          : null,
        vehicle: route.vehicle,
        studentsServed: route.studentsServed,
        lengthKm: pathLengthKm(route.path),
        path: route.path,
      })),
    )
    .returning({ id: transportRoutes.id, code: transportRoutes.code });
  const routeIdByCode = new Map(routeRows.map((r) => [r.code, r.id]));

  const conditionValues: (typeof routeConditions.$inferInsert)[] = [];
  for (const scenario of SCENARIOS) {
    const timestamps = dailyTimestamps(scenario.referenceAt);
    for (const route of ROUTES) {
      if (!route.rainfall) continue;
      const end = route.rainfall[scenario.key as ScenarioKey];
      const start = scenario.season === "INVERNO" ? end * 0.35 : end + 6;
      const values = shapedSeries(
        start,
        end,
        scenario.season === "INVERNO" ? end * 0.18 : 0,
        end * 0.12 + 1,
      );
      timestamps.forEach((measuredAt, i) => {
        conditionValues.push({
          routeId: routeIdByCode.get(route.code)!,
          measuredAt,
          rainfall72hMm: Math.max(0, Math.round(values[i]! * 10) / 10),
        });
      });
    }
  }
  await db.insert(routeConditions).values(conditionValues);

  console.log("🔥 Qualidade do ar e focos de calor…");
  const airValues: (typeof airQualityReadings.$inferInsert)[] = [];
  for (const scenario of SCENARIOS) {
    const timestamps = dailyTimestamps(scenario.referenceAt);
    for (const school of SCHOOLS) {
      const end = school.pm25[scenario.key as ScenarioKey];
      const start = scenario.season === "VERAO" ? end * 0.4 : end * 1.1;
      const values = shapedSeries(
        start,
        end,
        scenario.season === "VERAO" ? end * 0.06 : 0,
        end * 0.1,
      );
      timestamps.forEach((measuredAt, i) => {
        airValues.push({
          schoolId: sid(school.inepCode),
          measuredAt,
          pm25: Math.max(2, Math.round(values[i]! * 10) / 10),
        });
      });
    }
  }
  await db.insert(airQualityReadings).values(airValues);

  const hotspotValues: (typeof fireHotspots.$inferInsert)[] = [];
  for (const scenario of SCENARIOS) {
    for (const cluster of HOTSPOT_CLUSTERS[scenario.key as ScenarioKey]) {
      for (let i = 0; i < cluster.count; i += 1) {
        const hoursAgo = rand() * 70;
        hotspotValues.push({
          lat:
            Math.round((cluster.lat + jitter(cluster.spreadDeg)) * 10000) /
            10000,
          lng:
            Math.round((cluster.lng + jitter(cluster.spreadDeg)) * 10000) /
            10000,
          detectedAt: new Date(
            scenario.referenceAt.getTime() - hoursAgo * 3_600_000,
          ),
          satellite: SATELLITES[Math.floor(rand() * SATELLITES.length)]!,
          frpMw:
            Math.round(
              (cluster.frpRange[0] +
                rand() * (cluster.frpRange[1] - cluster.frpRange[0])) *
                10,
            ) / 10,
          confidencePct: 60 + Math.floor(rand() * 40),
        });
      }
    }
  }
  await db.insert(fireHotspots).values(hotspotValues);

  console.log("🤝 Termos FUIO…");
  await db.insert(fuioAgreements).values([
    {
      scenarioKey: "inverno",
      sourceSchoolId: sid("11002204"),
      hostSchoolId: sid("11050578"),
      studentsCount: 120,
      shift: "MATUTINO",
      transportPlan:
        "Barco escolar até o porto seguro de São Carlos e transferência direta para a EEEM Juracy Lima Tavares.",
      reason:
        "Térreo da EMEF São Carlos inundado pelo transbordamento do Rio Madeira.",
      status: "ATIVO",
      startDate: "2026-03-16",
      createdAt: new Date("2026-03-13T14:00:00Z"),
    },
    {
      scenarioKey: "inverno",
      sourceSchoolId: sid("11004860"),
      hostSchoolId: sid("11005041"),
      studentsCount: 180,
      shift: "VESPERTINO",
      transportPlan:
        "Deslocamento a pé assistido (1,2 km) por monitores até a EEEFM Carlos Drummond de Andrade.",
      reason:
        "Rio Candeias acima da cota da EMEF Dom João Batista Costa (Beira-Rio alagado).",
      status: "ATIVO",
      startDate: "2026-03-20",
      createdAt: new Date("2026-03-18T15:30:00Z"),
    },
    {
      scenarioKey: "inverno",
      sourceSchoolId: sid("11027347"),
      hostSchoolId: sid("11026197"),
      studentsCount: 60,
      shift: "VESPERTINO",
      transportPlan:
        "Ônibus rural desviando trechos de atoleiro na Linha 10 até o bairro Vista Alegre.",
      reason:
        "Linha 10 e vicinais de Cacoal intrafegáveis após 140 mm de chuva em 72 h.",
      status: "PROPOSTO",
      startDate: "2026-03-30",
      createdAt: new Date("2026-03-26T19:00:00Z"),
    },
    {
      scenarioKey: "verao",
      sourceSchoolId: sid("11027312"),
      hostSchoolId: sid("11026278"),
      studentsCount: 150,
      shift: "VESPERTINO",
      transportPlan:
        "Ônibus rural estendido até o centro de Cacoal com acolhimento em salas climatizadas.",
      reason:
        "PM2.5 acima de 180 µg/m³ no Distrito de Riozinho em salas sem climatização.",
      status: "ATIVO",
      startDate: "2026-09-08",
      createdAt: new Date("2026-09-05T13:00:00Z"),
    },
    {
      scenarioKey: "verao",
      sourceSchoolId: sid("11045043"),
      hostSchoolId: sid("11005041"),
      studentsCount: 110,
      shift: "VESPERTINO",
      transportPlan:
        "Transporte escolar rural da Linha 45 até a sede de Candeias do Jamari.",
      reason:
        "Focos intensos de queimadas e fumaça densa no ramal rural da Nova Samuel.",
      status: "ENCERRADO",
      startDate: "2026-08-24",
      endDate: "2026-09-11",
      createdAt: new Date("2026-08-21T12:00:00Z"),
    },
    {
      scenarioKey: "verao",
      sourceSchoolId: sid("11002204"),
      hostSchoolId: sid("11050578"),
      studentsCount: 90,
      shift: "MATUTINO",
      transportPlan:
        "Voadeiras até o canal navegável e integração com o polo escolar de São Carlos.",
      reason:
        "Vazante severa do Madeira com bancos de areia bloqueando rotas fluviais ordinárias.",
      status: "PROPOSTO",
      startDate: "2026-09-21",
      createdAt: new Date("2026-09-17T18:00:00Z"),
    },
  ]);

  console.log("✅ Checklist inicial…");
  await db.insert(actionChecklist).values([
    {
      scenarioKey: "inverno",
      schoolId: sid("11002204"),
      actionKey: "patrimonio-arquivo",
      completedBy: "Profª. Raimunda Lopes",
      completedAt: new Date("2026-03-14T13:20:00Z"),
    },
    {
      scenarioKey: "inverno",
      schoolId: sid("11002204"),
      actionKey: "patrimonio-laboratorio",
      completedBy: "TI SEMED Porto Velho",
      completedAt: new Date("2026-03-15T17:45:00Z"),
    },
    {
      scenarioKey: "inverno",
      schoolId: sid("11002204"),
      actionKey: "patrimonio-subestacao",
      completedBy: "Equipe de Apoio Elétrico SEMED",
      completedAt: new Date("2026-03-16T12:00:00Z"),
    },
    {
      scenarioKey: "verao",
      schoolId: sid("11027312"),
      actionKey: "saude-atividades-externas",
      completedBy: "Profª. Ivone Bortolini",
      completedAt: new Date("2026-09-04T11:00:00Z"),
    },
  ]);

  console.log(
    `🎉 Seed concluído: ${SCENARIOS.length} cenários, ${STATIONS.length} estações, ${SCHOOLS.length} escolas, ${ROUTES.length} rotas, ${readingValues.length} leituras hidrológicas, ${hotspotValues.length} focos.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error("❌ Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
