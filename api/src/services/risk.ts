import { and, asc, eq, gte, lte } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import {
  airQualityReadings,
  fireHotspots,
  fuioAgreements,
  hydroReadings,
  hydroStations,
  routeConditions,
  scenarios,
  schools,
  transportRoutes,
  type FireHotspot,
  type FuioAgreement,
  type HydroStation,
  type Scenario,
  type School,
  type TransportRoute,
} from "../db/schema";

/* ------------------------------------------------------------------ */
/* Domain types                                                        */
/* ------------------------------------------------------------------ */

export type RiskLevel = "BAIXO" | "MODERADO" | "ALTO" | "CRITICO";
export type HydroStatus =
  | "ESTIAGEM_SEVERA"
  | "ESTIAGEM"
  | "NORMAL"
  | "ATENCAO"
  | "ALERTA"
  | "INUNDACAO"
  | "INUNDACAO_SEVERA";
export type RouteStatus = "TRAFEGAVEL" | "ATENCAO" | "CRITICA" | "INTRAFEGAVEL";
export type HazardKey = "INUNDACAO" | "FLUVIAL" | "VICINAL" | "FUMACA";
export type RouteCause = "ESTIAGEM" | "CHEIA" | "CHUVA" | null;
export type ActionCategory =
  "PATRIMONIO" | "PEDAGOGICO" | "FUIO" | "SAUDE" | "LOGISTICA";
export type ActionPriority = "IMEDIATA" | "24H" | "72H" | "PREVENTIVA";

export interface SeriesPoint {
  measuredAt: Date;
  value: number;
}

export interface StationSnapshot extends HydroStation {
  latestLevelCm: number | null;
  latestAt: Date | null;
  trendCmPerDay: number;
  status: HydroStatus;
  history: SeriesPoint[];
}

export interface RouteAssessment extends TransportRoute {
  status: RouteStatus;
  cause: RouteCause;
  reason: string;
  rainfall72hMm: number | null;
  rainfallHistory: SeriesPoint[];
}

export interface HazardScore {
  key: HazardKey;
  score: number;
  detail: string;
}

export interface FloodOutlook {
  marginCm: number | null;
  daysToFlood: number | null;
  flooded: boolean;
}

export interface SchoolAssessment {
  school: School;
  station: StationSnapshot | null;
  routes: RouteAssessment[];
  pm25: number | null;
  pm25Indoor: number | null;
  pm25History: SeriesPoint[];
  hotspotsNearby: number;
  nearestHotspotKm: number | null;
  flood: FloodOutlook;
  hazards: HazardScore[];
  score: number;
  level: RiskLevel;
  primaryHazard: HazardKey | null;
  committedIncoming: number;
  committedOutgoing: number;
  idleSeats: number;
}

export interface ScenarioSnapshot {
  scenario: Scenario;
  stations: StationSnapshot[];
  hotspots: FireHotspot[];
  agreements: FuioAgreement[];
  assessments: SchoolAssessment[];
}

export interface HostCandidate {
  schoolId: number;
  name: string;
  network: School["network"];
  municipality: string;
  community: string;
  distanceKm: number;
  idleSeats: number;
  level: RiskLevel;
  score: number;
  climatized: boolean;
  crossNetwork: boolean;
  fitReasons: string[];
}

export interface ActionItem {
  key: string;
  category: ActionCategory;
  priority: ActionPriority;
  hazard: HazardKey | "GERAL";
  title: string;
  description: string;
  responsible: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const HISTORY_WINDOW_DAYS = 14;
const HOTSPOT_WINDOW_HOURS = 72;
export const HOTSPOT_RADIUS_KM = 25;
export const FUIO_MAX_DISTANCE_KM = 80;
/** Fraction of outdoor PM2.5 that reaches a sealed, air-conditioned classroom. */
const CLIMATIZED_INFILTRATION = 0.45;

const LEVEL_ORDER: Record<RiskLevel, number> = {
  BAIXO: 0,
  MODERADO: 1,
  ALTO: 2,
  CRITICO: 3,
};
const PRIORITY_ORDER: Record<ActionPriority, number> = {
  IMEDIATA: 0,
  "24H": 1,
  "72H": 2,
  PREVENTIVA: 3,
};

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "CRITICO";
  if (score >= 50) return "ALTO";
  if (score >= 25) return "MODERADO";
  return "BAIXO";
}

export function isSafeHostLevel(level: RiskLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER.MODERADO;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function classifyStation(
  station: HydroStation,
  levelCm: number | null,
): HydroStatus {
  if (levelCm === null) return "NORMAL";
  if (levelCm >= station.severeFloodLevelCm) return "INUNDACAO_SEVERA";
  if (levelCm >= station.floodLevelCm) return "INUNDACAO";
  if (levelCm >= station.alertLevelCm) return "ALERTA";
  if (levelCm >= station.alertLevelCm - 50) return "ATENCAO";
  if (levelCm <= station.severeDroughtLevelCm) return "ESTIAGEM_SEVERA";
  if (levelCm <= station.droughtLevelCm) return "ESTIAGEM";
  return "NORMAL";
}

interface RouteVerdict {
  status: RouteStatus;
  cause: RouteCause;
  reason: string;
}

function assessFluvialRoute(station: StationSnapshot | null): RouteVerdict {
  if (!station || station.latestLevelCm === null) {
    return {
      status: "TRAFEGAVEL",
      cause: null,
      reason: "Sem telemetria fluviométrica vinculada.",
    };
  }
  const level = `${(station.latestLevelCm / 100).toFixed(2)} m`;
  switch (station.status) {
    case "ESTIAGEM_SEVERA":
      return {
        status: "INTRAFEGAVEL",
        cause: "ESTIAGEM",
        reason: `Vazante severa (${level}): bancos de areia expostos, voadeiras e barcos escolares sem calado.`,
      };
    case "ESTIAGEM":
      return {
        status: "CRITICA",
        cause: "ESTIAGEM",
        reason: `Estiagem (${level}): canal estreito, embarque deslocado e viagens com carga reduzida.`,
      };
    case "INUNDACAO_SEVERA":
      return {
        status: "INTRAFEGAVEL",
        cause: "CHEIA",
        reason: `Cheia severa (${level}): portos e rampas flutuantes submersos, correnteza e balseiros.`,
      };
    case "INUNDACAO":
      return {
        status: "CRITICA",
        cause: "CHEIA",
        reason: `Cota de inundação (${level}): rampas deslocadas e troncos à deriva no canal.`,
      };
    case "ALERTA":
      return {
        status: "ATENCAO",
        cause: "CHEIA",
        reason: `Cota de alerta (${level}): navegação com restrição noturna.`,
      };
    default:
      return {
        status: "TRAFEGAVEL",
        cause: null,
        reason: `Nível navegável (${level}).`,
      };
  }
}

function assessVicinalRoute(rainfall72hMm: number | null): RouteVerdict {
  if (rainfall72hMm === null)
    return {
      status: "TRAFEGAVEL",
      cause: null,
      reason: "Sem pluviômetro vinculado.",
    };
  const mm = `${Math.round(rainfall72hMm)} mm/72h`;
  if (rainfall72hMm >= 120) {
    return {
      status: "INTRAFEGAVEL",
      cause: "CHUVA",
      reason: `${mm}: atoleiros e pontes de madeira comprometidas; ônibus retidos.`,
    };
  }
  if (rainfall72hMm >= 70) {
    return {
      status: "CRITICA",
      cause: "CHUVA",
      reason: `${mm}: trechos de barro liso e erosão em aterros de bueiros.`,
    };
  }
  if (rainfall72hMm >= 35) {
    return {
      status: "ATENCAO",
      cause: "CHUVA",
      reason: `${mm}: solo saturado, tráfego lento em rampas.`,
    };
  }
  return { status: "TRAFEGAVEL", cause: null, reason: `${mm}: leito firme.` };
}

const ROUTE_STATUS_SCORE: Record<RouteStatus, number> = {
  TRAFEGAVEL: 5,
  ATENCAO: 35,
  CRITICA: 65,
  INTRAFEGAVEL: 90,
};

function scoreFlood(
  school: School,
  station: StationSnapshot | null,
): { score: number; outlook: FloodOutlook; detail: string } {
  const empty: FloodOutlook = {
    marginCm: null,
    daysToFlood: null,
    flooded: false,
  };
  if (
    !station ||
    station.latestLevelCm === null ||
    school.floodThresholdCm === null
  ) {
    return {
      score: 0,
      outlook: empty,
      detail: "Edificação fora da planície de inundação mapeada.",
    };
  }
  const marginCm = school.floodThresholdCm - station.latestLevelCm;
  const trend = station.trendCmPerDay;
  const daysToFlood =
    marginCm > 0 && trend > 0 ? round1(marginCm / trend) : null;
  const outlook: FloodOutlook = {
    marginCm,
    daysToFlood,
    flooded: marginCm <= 0,
  };

  if (marginCm <= 0) {
    return {
      score: 100,
      outlook,
      detail: `Térreo inundado: rio ${Math.abs(marginCm)} cm acima da cota da escola.`,
    };
  }
  if (daysToFlood !== null && daysToFlood <= 3) {
    return {
      score: 85,
      outlook,
      detail: `Inundação projetada em ${daysToFlood} dia(s) (+${trend} cm/dia).`,
    };
  }
  if (daysToFlood !== null && daysToFlood <= 7) {
    return {
      score: 60,
      outlook,
      detail: `Inundação projetada em ${daysToFlood} dias (+${trend} cm/dia).`,
    };
  }
  if (marginCm <= 100) {
    return {
      score: 35,
      outlook,
      detail: `Margem de ${marginCm} cm até a cota da escola.`,
    };
  }
  return { score: 5, outlook, detail: `Margem confortável de ${marginCm} cm.` };
}

function scoreSmoke(
  pm25Indoor: number | null,
  hotspotsNearby: number,
): { score: number; detail: string } {
  if (pm25Indoor === null)
    return { score: 0, detail: "Sem leitura de material particulado." };
  let score: number;
  if (pm25Indoor >= 150) score = 90;
  else if (pm25Indoor >= 55) score = 65;
  else if (pm25Indoor >= 35) score = 40;
  else if (pm25Indoor >= 15) score = 15;
  else score = 0;
  if (hotspotsNearby >= 10) score = Math.min(100, score + 10);
  return {
    score,
    detail: `PM2.5 em sala ≈ ${Math.round(pm25Indoor)} µg/m³ (OMS 24h: 15) · ${hotspotsNearby} focos em ${HOTSPOT_RADIUS_KM} km.`,
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot loader                                                     */
/* ------------------------------------------------------------------ */

function groupSeries<T extends { measuredAt: Date }>(
  rows: T[],
  keyOf: (row: T) => number,
  valueOf: (row: T) => number,
): Map<number, SeriesPoint[]> {
  const grouped = new Map<number, SeriesPoint[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = grouped.get(key) ?? [];
    list.push({ measuredAt: row.measuredAt, value: valueOf(row) });
    grouped.set(key, list);
  }
  return grouped;
}

export async function getScenario(key: string): Promise<Scenario> {
  const [scenario] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.key, key))
    .limit(1);
  if (!scenario)
    throw new HTTPException(404, {
      message: `Cenário '${key}' não encontrado.`,
    });
  return scenario;
}

export async function loadSnapshot(
  scenarioKey: string,
): Promise<ScenarioSnapshot> {
  const scenario = await getScenario(scenarioKey);
  const ref = scenario.referenceAt;
  const windowStart = new Date(ref.getTime() - HISTORY_WINDOW_DAYS * DAY_MS);
  const hotspotStart = new Date(
    ref.getTime() - HOTSPOT_WINDOW_HOURS * 3_600_000,
  );

  const [
    stationRows,
    readingRows,
    schoolRows,
    routeRows,
    conditionRows,
    airRows,
    hotspotRows,
    agreementRows,
  ] = await Promise.all([
    db.select().from(hydroStations).orderBy(asc(hydroStations.id)),
    db
      .select()
      .from(hydroReadings)
      .where(
        and(
          gte(hydroReadings.measuredAt, windowStart),
          lte(hydroReadings.measuredAt, ref),
        ),
      )
      .orderBy(asc(hydroReadings.measuredAt)),
    db.select().from(schools).orderBy(asc(schools.name)),
    db.select().from(transportRoutes).orderBy(asc(transportRoutes.code)),
    db
      .select()
      .from(routeConditions)
      .where(
        and(
          gte(routeConditions.measuredAt, windowStart),
          lte(routeConditions.measuredAt, ref),
        ),
      )
      .orderBy(asc(routeConditions.measuredAt)),
    db
      .select()
      .from(airQualityReadings)
      .where(
        and(
          gte(airQualityReadings.measuredAt, windowStart),
          lte(airQualityReadings.measuredAt, ref),
        ),
      )
      .orderBy(asc(airQualityReadings.measuredAt)),
    db
      .select()
      .from(fireHotspots)
      .where(
        and(
          gte(fireHotspots.detectedAt, hotspotStart),
          lte(fireHotspots.detectedAt, ref),
        ),
      )
      .orderBy(asc(fireHotspots.detectedAt)),
    db
      .select()
      .from(fuioAgreements)
      .where(eq(fuioAgreements.scenarioKey, scenarioKey))
      .orderBy(asc(fuioAgreements.id)),
  ]);

  const levelSeries = groupSeries(
    readingRows,
    (r) => r.stationId,
    (r) => r.levelCm,
  );
  const rainSeries = groupSeries(
    conditionRows,
    (r) => r.routeId,
    (r) => r.rainfall72hMm,
  );
  const airSeries = groupSeries(
    airRows,
    (r) => r.schoolId,
    (r) => r.pm25,
  );

  const stations: StationSnapshot[] = stationRows.map((station) => {
    const history = levelSeries.get(station.id) ?? [];
    const latest = history.at(-1) ?? null;
    const previous = history.at(-2) ?? null;
    let trendCmPerDay = 0;
    if (latest && previous) {
      const days =
        (latest.measuredAt.getTime() - previous.measuredAt.getTime()) / DAY_MS;
      trendCmPerDay =
        days > 0 ? Math.round((latest.value - previous.value) / days) : 0;
    }
    const latestLevelCm = latest ? latest.value : null;
    return {
      ...station,
      latestLevelCm,
      latestAt: latest ? latest.measuredAt : null,
      trendCmPerDay,
      status: classifyStation(station, latestLevelCm),
      history,
    };
  });
  const stationById = new Map(stations.map((s) => [s.id, s]));

  const committed = agreementRows.filter(
    (a) => a.status === "ATIVO" || a.status === "PROPOSTO",
  );

  const assessments: SchoolAssessment[] = schoolRows.map((school) => {
    const station =
      school.stationId !== null
        ? (stationById.get(school.stationId) ?? null)
        : null;

    const routes: RouteAssessment[] = routeRows
      .filter((route) => route.schoolId === school.id)
      .map((route) => {
        const rainfallHistory = rainSeries.get(route.id) ?? [];
        const rainfall72hMm =
          route.mode === "VICINAL"
            ? (rainfallHistory.at(-1)?.value ?? null)
            : null;
        const routeStation =
          route.stationId !== null
            ? (stationById.get(route.stationId) ?? null)
            : null;
        const verdict =
          route.mode === "FLUVIAL"
            ? assessFluvialRoute(routeStation)
            : assessVicinalRoute(rainfall72hMm);
        return { ...route, ...verdict, rainfall72hMm, rainfallHistory };
      });

    const pm25History = airSeries.get(school.id) ?? [];
    const pm25 = pm25History.at(-1)?.value ?? null;
    const pm25Indoor =
      pm25 === null
        ? null
        : round1(school.climatized ? pm25 * CLIMATIZED_INFILTRATION : pm25);

    let hotspotsNearby = 0;
    let nearestHotspotKm: number | null = null;
    for (const spot of hotspotRows) {
      const distance = haversineKm(school.lat, school.lng, spot.lat, spot.lng);
      if (distance <= HOTSPOT_RADIUS_KM) hotspotsNearby += 1;
      if (nearestHotspotKm === null || distance < nearestHotspotKm)
        nearestHotspotKm = distance;
    }
    nearestHotspotKm =
      nearestHotspotKm === null ? null : round1(nearestHotspotKm);

    const flood = scoreFlood(school, station);
    const fluvialRoutes = routes.filter((r) => r.mode === "FLUVIAL");
    const vicinalRoutes = routes.filter((r) => r.mode === "VICINAL");

    const worstFluvial = fluvialRoutes.reduce<RouteAssessment | null>(
      (worst, r) =>
        !worst ||
        ROUTE_STATUS_SCORE[r.status] > ROUTE_STATUS_SCORE[worst.status]
          ? r
          : worst,
      null,
    );
    const worstVicinal = vicinalRoutes.reduce<RouteAssessment | null>(
      (worst, r) =>
        !worst ||
        ROUTE_STATUS_SCORE[r.status] > ROUTE_STATUS_SCORE[worst.status]
          ? r
          : worst,
      null,
    );

    /* Fluvial access: drought blocks boats; floods displace docks (lower weight than drought). */
    let droughtScore = 0;
    let droughtDetail = "Sem rota fluvial dependente.";
    if (worstFluvial) {
      const isDrought = worstFluvial.cause === "ESTIAGEM";
      const raw = ROUTE_STATUS_SCORE[worstFluvial.status];
      droughtScore = isDrought
        ? raw
        : worstFluvial.status === "TRAFEGAVEL"
          ? 0
          : Math.round(raw * 0.7);
      droughtDetail = `${worstFluvial.code}: ${worstFluvial.reason}`;
    }

    const vicinalScore = worstVicinal
      ? ROUTE_STATUS_SCORE[worstVicinal.status]
      : 0;
    const vicinalDetail = worstVicinal
      ? `${worstVicinal.code}: ${worstVicinal.reason}`
      : "Sem rota vicinal dependente.";

    const smoke = scoreSmoke(pm25Indoor, hotspotsNearby);

    const hazards: HazardScore[] = [
      { key: "INUNDACAO", score: flood.score, detail: flood.detail },
      { key: "FLUVIAL", score: droughtScore, detail: droughtDetail },
      {
        key: "VICINAL",
        score: vicinalRoutes.length ? vicinalScore : 0,
        detail: vicinalDetail,
      },
      { key: "FUMACA", score: smoke.score, detail: smoke.detail },
    ];
    const top = hazards.reduce((a, b) => (b.score > a.score ? b : a));
    const score = top.score;

    const committedIncoming = committed
      .filter((a) => a.hostSchoolId === school.id)
      .reduce((sum, a) => sum + a.studentsCount, 0);
    const committedOutgoing = committed
      .filter((a) => a.sourceSchoolId === school.id)
      .reduce((sum, a) => sum + a.studentsCount, 0);

    return {
      school,
      station,
      routes,
      pm25,
      pm25Indoor,
      pm25History,
      hotspotsNearby,
      nearestHotspotKm,
      flood: flood.outlook,
      hazards,
      score,
      level: levelFromScore(score),
      primaryHazard: score >= 25 ? top.key : null,
      committedIncoming,
      committedOutgoing,
      idleSeats: Math.max(
        0,
        (school.declaredIdleSeats !== null &&
        school.declaredIdleSeats !== undefined
          ? school.declaredIdleSeats
          : Math.max(0, school.capacity - school.enrollment)) -
          committedIncoming,
      ),
    };
  });

  return {
    scenario,
    stations,
    hotspots: hotspotRows,
    agreements: agreementRows,
    assessments,
  };
}

/* ------------------------------------------------------------------ */
/* FUIO host matching                                                  */
/* ------------------------------------------------------------------ */

export function findHostCandidates(
  snapshot: ScenarioSnapshot,
  sourceSchoolId: number,
): HostCandidate[] {
  const source = snapshot.assessments.find(
    (a) => a.school.id === sourceSchoolId,
  );
  if (!source)
    throw new HTTPException(404, {
      message: "Escola de origem não encontrada.",
    });
  const needsCleanAir = source.primaryHazard === "FUMACA";

  return snapshot.assessments
    .filter(
      (a) =>
        a.school.id !== sourceSchoolId &&
        isSafeHostLevel(a.level) &&
        a.idleSeats > 0,
    )
    .map<HostCandidate>((host) => {
      const distanceKm = round1(
        haversineKm(
          source.school.lat,
          source.school.lng,
          host.school.lat,
          host.school.lng,
        ),
      );
      const crossNetwork = host.school.network !== source.school.network;
      const fitReasons: string[] = [];
      if (crossNetwork) fitReasons.push("Intercooperação SEDUC ↔ SEMED");
      if (host.school.climatized) fitReasons.push("Salas climatizadas");
      if (host.level === "BAIXO") fitReasons.push("Risco baixo no cenário");
      if (host.school.floors > 1)
        fitReasons.push("Edificação com pavimento superior");
      if (host.idleSeats >= source.school.enrollment)
        fitReasons.push("Comporta a escola inteira");
      return {
        schoolId: host.school.id,
        name: host.school.name,
        network: host.school.network,
        municipality: host.school.municipality,
        community: host.school.community,
        distanceKm,
        idleSeats: host.idleSeats,
        level: host.level,
        score: host.score,
        climatized: host.school.climatized,
        crossNetwork,
        fitReasons,
      };
    })
    .filter((c) => c.distanceKm <= FUIO_MAX_DISTANCE_KM)
    .filter((c) => !needsCleanAir || c.climatized)
    .sort((a, b) => {
      const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      if (levelDiff !== 0) return levelDiff;
      return a.distanceKm - b.distanceKm;
    });
}

/* ------------------------------------------------------------------ */
/* Automated action engine                                             */
/* ------------------------------------------------------------------ */

export function buildActionPlan(
  a: SchoolAssessment,
  topHost: HostCandidate | null,
): ActionItem[] {
  const { school } = a;
  const actions = new Map<string, ActionItem>();
  const add = (item: ActionItem) => {
    const existing = actions.get(item.key);
    if (
      !existing ||
      PRIORITY_ORDER[item.priority] < PRIORITY_ORDER[existing.priority]
    )
      actions.set(item.key, item);
  };
  const hazard = (key: HazardKey) =>
    a.hazards.find((h) => h.key === key)?.score ?? 0;
  const studentsToShelter = Math.max(
    0,
    school.enrollment - a.committedOutgoing,
  );

  const addFuio = (hz: HazardKey, priority: ActionPriority, motive: string) => {
    if (studentsToShelter === 0) {
      add({
        key: "fuio-acompanhar",
        category: "FUIO",
        priority: "72H",
        hazard: hz,
        title: "Acompanhar alunos já abrigados pela FUIO",
        description: `Todos os ${school.enrollment} alunos possuem vaga comprometida em escola anfitriã. Validar frequência diária e transporte.`,
        responsible: "Comissão FUIO (SEDUC/SEMED)",
      });
      return;
    }
    if (topHost) {
      const seats = Math.min(studentsToShelter, topHost.idleSeats);
      add({
        key: "fuio-transferencia",
        category: "FUIO",
        priority,
        hazard: hz,
        title: `Acionar FUIO: abrigar ${seats} alunos na ${topHost.name}`,
        description: `${motive} Anfitriã a ${topHost.distanceKm} km (rede ${topHost.network.toLowerCase()}, ${topHost.idleSeats} vagas ociosas). Formalizar termo de intercooperação, lista nominal e transporte.`,
        responsible: "Comissão FUIO (SEDUC/SEMED)",
      });
    } else {
      add({
        key: "fuio-sem-anfitria",
        category: "FUIO",
        priority,
        hazard: hz,
        title: "Solicitar vagas emergenciais à comissão FUIO",
        description: `${motive} Nenhuma escola segura com vagas em até ${FUIO_MAX_DISTANCE_KM} km: avaliar espaço comunitário em terra firme com professores itinerantes.`,
        responsible: "Comissão FUIO (SEDUC/SEMED)",
      });
    }
  };

  const addModules = (
    priority: ActionPriority,
    hz: HazardKey,
    delivery: string,
  ) =>
    add({
      key: "pedagogico-modulos",
      category: "PEDAGOGICO",
      priority,
      hazard: hz,
      title: `Distribuir kits modulares híbridos para ${studentsToShelter || school.enrollment} alunos`,
      description: `Cadernos de atividades para 15 dias letivos por componente curricular, com roteiro de estudo e devolutiva. Entrega: ${delivery}`,
      responsible: "Coordenação pedagógica",
    });

  /* ---------- Inundação ---------- */
  const floodScore = hazard("INUNDACAO");
  if (floodScore >= 50) {
    const pri: ActionPriority =
      a.flood.flooded || (a.flood.daysToFlood ?? 99) <= 3 ? "IMEDIATA" : "24H";
    const upper = school.floors > 1;
    if (school.labComputers > 0) {
      add({
        key: "patrimonio-laboratorio",
        category: "PATRIMONIO",
        priority: pri,
        hazard: "INUNDACAO",
        title: upper
          ? `Elevar os ${school.labComputers} computadores do laboratório ao ${school.floors}º pavimento`
          : `Remover os ${school.labComputers} computadores do laboratório para terra firme`,
        description: upper
          ? "Desconectar, embalar em sacos plásticos e acondicionar acima da cota prevista; registrar patrimônio em planilha."
          : `Edificação térrea: embalar e transportar para ${topHost ? topHost.name : "depósito em terra firme indicado pela secretaria"}, com termo de guarda.`,
        responsible: "Direção escolar + TI da secretaria",
      });
    }
    if (school.hasServer) {
      add({
        key: "patrimonio-servidor",
        category: "PATRIMONIO",
        priority: pri,
        hazard: "INUNDACAO",
        title: "Backup e desligamento do servidor da secretaria escolar",
        description:
          "Exportar diários, matrículas e históricos para a nuvem institucional; desligar e elevar o rack e o nobreak.",
        responsible: "Secretaria escolar",
      });
    }
    if (school.archiveBoxes > 0) {
      add({
        key: "patrimonio-arquivo",
        category: "PATRIMONIO",
        priority: pri,
        hazard: "INUNDACAO",
        title: `Lacrar ${school.archiveBoxes} caixas do arquivo passivo em tambores herméticos`,
        description:
          "Históricos, atas de resultados finais e diários de classe em tambores plásticos com tampa de rosca, elevados a ≥ 1,5 m do piso.",
        responsible: "Secretaria escolar",
      });
    }
    if (school.groundFloorSubstation) {
      add({
        key: "patrimonio-subestacao",
        category: "PATRIMONIO",
        priority: pri,
        hazard: "INUNDACAO",
        title: "Desligar subestação e quadro geral do térreo",
        description:
          "Solicitar à distribuidora o seccionamento preventivo e sinalizar o quadro com bloqueio (LOTO) até a vistoria pós-cheia.",
        responsible: "Direção escolar + distribuidora de energia",
      });
    }
    add({
      key: "patrimonio-merenda",
      category: "PATRIMONIO",
      priority: pri === "IMEDIATA" ? "24H" : "72H",
      hazard: "INUNDACAO",
      title: "Retirar estoque de merenda e botijões de gás",
      description:
        "Transferir gêneros alimentícios e GLP para local elevado e ventilado; descartar itens com contato com água da cheia.",
      responsible: "Nutrição escolar",
    });
    add({
      key: "pedagogico-calendario",
      category: "PEDAGOGICO",
      priority: "72H",
      hazard: "INUNDACAO",
      title: "Replanejar o calendário letivo da cheia",
      description:
        "Registrar dias de suspensão e aprovar plano de reposição (sábados letivos e contraturno) após a vazante, garantindo os 200 dias letivos.",
      responsible: school.network === "ESTADUAL" ? "SEDUC-RO / CRE" : "SEMED",
    });
    addModules(
      "24H",
      "INUNDACAO",
      "barco de apoio da Defesa Civil e pontos comunitários em terra firme.",
    );
    addFuio(
      "INUNDACAO",
      pri,
      a.flood.flooded
        ? "Escola com térreo inundado."
        : `Inundação projetada em ${a.flood.daysToFlood} dia(s).`,
    );
  } else if (floodScore >= 25) {
    add({
      key: "patrimonio-preposicionar",
      category: "PATRIMONIO",
      priority: "PREVENTIVA",
      hazard: "INUNDACAO",
      title: "Pré-posicionar tambores, lonas e paletes",
      description: `Margem de ${a.flood.marginCm ?? 0} cm até a cota da escola: deixar material de elevação e lacre pronto e revisar o inventário fotográfico.`,
      responsible: "Direção escolar",
    });
  }

  /* ---------- Estiagem / acesso fluvial ---------- */
  const droughtScore = hazard("FLUVIAL");
  const fluvial = a.routes.filter(
    (r) => r.mode === "FLUVIAL" && r.status !== "TRAFEGAVEL",
  );
  const stationDrought = fluvial.some((r) => r.cause === "ESTIAGEM");
  if (droughtScore >= 50 && stationDrought) {
    const blocked = fluvial.filter((r) => r.status === "INTRAFEGAVEL");
    add({
      key: "logistica-fluvial",
      category: "LOGISTICA",
      priority: blocked.length ? "IMEDIATA" : "24H",
      hazard: "FLUVIAL",
      title: blocked.length
        ? `Suspender rota(s) fluvial(is) ${blocked.map((r) => r.code).join(", ")}`
        : "Relocar pontos de embarque para o canal navegável",
      description: blocked.length
        ? "Notificar famílias pela rádio comunitária; mapear ramais terrestres alternativos e contratar transporte por trecho."
        : "Reduzir lotação por voadeira, exigir coletes e deslocar o embarque para trechos com calado mínimo de 0,8 m.",
      responsible: "Gestão de transporte escolar",
    });
    add({
      key: "pedagogico-calendario-vazante",
      category: "PEDAGOGICO",
      priority: "72H",
      hazard: "FLUVIAL",
      title: "Antecipar recesso para o pico da vazante",
      description:
        "Deslocar recesso para setembro–outubro e repor dias na enchente moderada (dez–jan), quando a navegação é segura.",
      responsible: school.network === "ESTADUAL" ? "SEDUC-RO / CRE" : "SEMED",
    });
    addModules(
      blocked.length ? "IMEDIATA" : "24H",
      "FLUVIAL",
      "lancha de apoio até a margem navegável e agentes comunitários.",
    );
    add({
      key: "saude-agua-potavel",
      category: "SAUDE",
      priority: "24H",
      hazard: "FLUVIAL",
      title: "Garantir água potável na escola",
      description:
        "Vazante compromete captação e poços rasos: solicitar caminhão-pipa/filtros e testar turbidez antes do preparo da merenda.",
      responsible: "Direção escolar + Vigilância em Saúde",
    });
    if (droughtScore >= 75)
      addFuio(
        "FLUVIAL",
        "24H",
        "Rotas fluviais bloqueadas pela vazante severa.",
      );
  } else if (droughtScore >= 25 && fluvial.length) {
    add({
      key: "logistica-fluvial-cheia",
      category: "LOGISTICA",
      priority: droughtScore >= 50 ? "24H" : "72H",
      hazard: "FLUVIAL",
      title: "Reforçar segurança das rotas fluviais na cheia",
      description: `Rotas ${fluvial.map((r) => r.code).join(", ")}: realocar rampas flutuantes, proibir viagens noturnas e checar coletes salva-vidas.`,
      responsible: "Gestão de transporte escolar",
    });
  }

  /* ---------- Vicinais ---------- */
  const vicinalScore = hazard("VICINAL");
  const badVicinal = a.routes.filter(
    (r) =>
      r.mode === "VICINAL" &&
      (r.status === "CRITICA" || r.status === "INTRAFEGAVEL"),
  );
  if (vicinalScore >= 50 && badVicinal.length) {
    const blocked = badVicinal.filter((r) => r.status === "INTRAFEGAVEL");
    const studentsAffected = badVicinal.reduce(
      (sum, r) => sum + r.studentsServed,
      0,
    );
    add({
      key: "logistica-suspender-vicinal",
      category: "LOGISTICA",
      priority: blocked.length ? "IMEDIATA" : "24H",
      hazard: "VICINAL",
      title: `${blocked.length ? "Suspender" : "Restringir"} rota(s) ${badVicinal.map((r) => r.code).join(", ")} (${studentsAffected} alunos)`,
      description:
        "Avisar motoristas e famílias via rádio comunitária e grupos de mensagens; proibir travessia de pontes de madeira submersas.",
      responsible: "Gestão de transporte escolar",
    });
    add({
      key: "logistica-patrulha-mecanizada",
      category: "LOGISTICA",
      priority: "24H",
      hazard: "VICINAL",
      title: "Solicitar patrulha mecanizada para os trechos críticos",
      description:
        "Ofício à secretaria municipal de obras / DER-RO para cascalhamento, limpeza de bueiros e recomposição de aterros.",
      responsible:
        school.network === "ESTADUAL"
          ? "SEDUC-RO + DER-RO"
          : "SEMED + Secretaria de Obras",
    });
    addModules(
      "24H",
      "VICINAL",
      "pontos de apoio nas linhas (igrejas, associações de produtores) com retirada semanal.",
    );
    if (vicinalScore >= 90)
      addFuio(
        "VICINAL",
        "24H",
        "Linhas vicinais intrafegáveis por tempo indeterminado.",
      );
  } else if (vicinalScore >= 25) {
    add({
      key: "logistica-monitorar-vicinal",
      category: "LOGISTICA",
      priority: "PREVENTIVA",
      hazard: "VICINAL",
      title: "Monitorar trechos vicinais e pré-posicionar patrolas",
      description:
        "Solo saturado: motoristas devem reportar atoleiros pelo canal da secretaria antes de cada viagem.",
      responsible: "Gestão de transporte escolar",
    });
  }

  /* ---------- Fumaça ---------- */
  const smokeScore = hazard("FUMACA");
  if (smokeScore >= 40) {
    add({
      key: "saude-atividades-externas",
      category: "SAUDE",
      priority: "IMEDIATA",
      hazard: "FUMACA",
      title: "Suspender educação física e recreio ao ar livre",
      description: `PM2.5 externo ≈ ${Math.round(a.pm25 ?? 0)} µg/m³. Substituir por atividades em ambiente fechado.`,
      responsible: "Direção escolar",
    });
    add({
      key: "saude-ambiente-interno",
      category: "SAUDE",
      priority: "IMEDIATA",
      hazard: "FUMACA",
      title: school.climatized
        ? "Vedar salas e operar climatização com filtros limpos"
        : "Montar purificadores caseiros (Corsi-Rosenthal) nas salas",
      description: school.climatized
        ? "Manter portas e janelas fechadas, trocar/limpar filtros e evitar renovação de ar externo nos horários de pico."
        : "Ventiladores com filtros MERV-13; concentrar turmas nas salas mais vedadas e fechar janelas voltadas para os focos.",
      responsible: "Direção escolar",
    });
    add({
      key: "saude-triagem",
      category: "SAUDE",
      priority: "24H",
      hazard: "FUMACA",
      title: "Triagem de alunos com asma e doenças respiratórias",
      description:
        "Comunicar a Vigilância em Saúde e a UBS de referência; liberar alunos sintomáticos com atividades domiciliares.",
      responsible: "Direção escolar + UBS",
    });
    if (!school.climatized && smokeScore >= 65) {
      addFuio("FUMACA", "24H", "Salas sem climatização com ar insalubre.");
      addModules(
        "24H",
        "FUMACA",
        "retirada pelos responsáveis na escola e envio digital quando houver conectividade.",
      );
    }
  }

  if (actions.size === 0) {
    add({
      key: "geral-monitoramento",
      category: "LOGISTICA",
      priority: "PREVENTIVA",
      hazard: "GERAL",
      title: "Manter monitoramento e oferecer vagas à rede FUIO",
      description: `Condições operacionais normais. ${a.idleSeats} vagas ociosas disponíveis para acolhimento intercooperativo.`,
      responsible: "Direção escolar",
    });
  }

  return [...actions.values()].sort(
    (x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority],
  );
}
