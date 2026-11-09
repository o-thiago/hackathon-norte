import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

/* ------------------------------------------------------------------ */
/* Domain types (mirror api/src/services/risk.ts responses)            */
/* ------------------------------------------------------------------ */

export type ScenarioKey = string;
export type Season = "INVERNO" | "VERAO";
export type RiskLevel = "BAIXO" | "MODERADO" | "ALTO" | "CRITICO";
export type HazardKey = "INUNDACAO" | "FLUVIAL" | "VICINAL" | "FUMACA";
export type HydroStatus =
  | "ESTIAGEM_SEVERA"
  | "ESTIAGEM"
  | "NORMAL"
  | "ATENCAO"
  | "ALERTA"
  | "INUNDACAO"
  | "INUNDACAO_SEVERA";
export type RouteStatus = "TRAFEGAVEL" | "ATENCAO" | "CRITICA" | "INTRAFEGAVEL";
export type RouteCause = "ESTIAGEM" | "CHEIA" | "CHUVA" | null;
export type SchoolNetwork = "ESTADUAL" | "MUNICIPAL";
export type TransportMode = "URBANO" | "FLUVIAL" | "VICINAL" | "MISTO";
export type ActionCategory =
  "PATRIMONIO" | "PEDAGOGICO" | "FUIO" | "SAUDE" | "LOGISTICA";
export type ActionPriority = "IMEDIATA" | "24H" | "72H" | "PREVENTIVA";
export type AgreementStatus = "PROPOSTO" | "ATIVO" | "ENCERRADO" | "CANCELADO";
export type Shift = "MATUTINO" | "VESPERTINO" | "NOTURNO" | "INTEGRAL";
export type LatLng = [number, number];

export interface Scenario {
  key: ScenarioKey;
  label: string;
  season: Season;
  referenceAt: string;
  description: string;
}

export interface SeriesPoint {
  measuredAt: string;
  value: number;
}

export interface HazardScore {
  key: HazardKey;
  score: number;
  detail: string;
}

export interface SchoolSummary {
  id: number;
  inepCode: string;
  name: string;
  network: SchoolNetwork;
  municipality: string;
  community: string;
  lat: number;
  lng: number;
  enrollment: number;
  capacity: number;
  climatized: boolean;
  transportMode: TransportMode;
  level: RiskLevel;
  score: number;
  primaryHazard: HazardKey | null;
  hazards: HazardScore[];
  idleSeats: number;
  committedIncoming: number;
  committedOutgoing: number;
}

export interface School {
  id: number;
  inepCode: string;
  name: string;
  network: SchoolNetwork;
  municipality: string;
  community: string;
  lat: number;
  lng: number;
  enrollment: number;
  capacity: number;
  declaredIdleSeats: number | null;
  floors: number;
  climatized: boolean;
  transportMode: TransportMode;
  stationId: number | null;
  floodThresholdCm: number | null;
  labComputers: number;
  hasServer: boolean;
  archiveBoxes: number;
  groundFloorSubstation: boolean;
  principal: string;
  phone: string;
}

export interface Station {
  id: number;
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
  latestLevelCm: number | null;
  latestAt: string | null;
  trendCmPerDay: number;
  status: HydroStatus;
  history: SeriesPoint[];
}

export interface RouteBase {
  id: number;
  code: string;
  name: string;
  schoolId: number;
  mode: "FLUVIAL" | "VICINAL";
  vehicle: string;
  studentsServed: number;
  lengthKm: number;
  path: LatLng[];
  status: RouteStatus;
  cause: RouteCause;
  reason: string;
  rainfall72hMm: number | null;
}

export interface OverviewRoute extends RouteBase {
  schoolName: string;
}

export interface DetailRoute extends RouteBase {
  stationId: number | null;
  rainfallHistory: SeriesPoint[];
}

export interface Hotspot {
  id: number;
  lat: number;
  lng: number;
  detectedAt: string;
  satellite: string;
  frpMw: number;
  confidencePct: number;
}

export interface OverviewStats {
  byLevel: Record<RiskLevel, number>;
  studentsAtRisk: number;
  totalStudents: number;
  routesBlocked: number;
  routesCritical: number;
  studentsOnBlockedRoutes: number;
  hotspots72h: number;
  stationsInFlood: number;
  stationsInDrought: number;
}

export interface Overview {
  scenario: Scenario;
  stations: Station[];
  hotspots: Hotspot[];
  routes: OverviewRoute[];
  schools: SchoolSummary[];
  stats: OverviewStats;
}

export interface ActionItem {
  key: string;
  category: ActionCategory;
  priority: ActionPriority;
  hazard: HazardKey | "GERAL";
  title: string;
  description: string;
  responsible: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}

export interface HostCandidate {
  schoolId: number;
  name: string;
  network: SchoolNetwork;
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

export interface Agreement {
  id: number;
  scenarioKey: string;
  sourceSchoolId: number;
  hostSchoolId: number;
  studentsCount: number;
  shift: Shift;
  transportPlan: string;
  reason: string;
  status: AgreementStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  sourceSchoolName: string;
  hostSchoolName: string;
}

export interface DecoratedAgreement extends Agreement {
  sourceNetwork: SchoolNetwork | null;
  sourceMunicipality: string;
  hostNetwork: SchoolNetwork | null;
  hostMunicipality: string;
  crossNetwork: boolean;
  schoolDays: number;
  studentDaysPreserved: number;
}

export type DiagnosisStatus =
  "PENDENTE" | "EM_ANALISE" | "VISTORIADO" | "INTERDITADO";

export interface SchoolDiagnosis {
  id: number;
  schoolId: number;
  scenarioKey: string;
  title: string;
  assessmentText: string;
  evaluatorName: string;
  evaluatorRole: string;
  status: DiagnosisStatus;
  severityLevel: RiskLevel;
  operationalRecommendation: string;
  evaluatedAt: string;
}

export interface CreateSchoolInput {
  inepCode: string;
  name: string;
  network: SchoolNetwork;
  municipality: string;
  community: string;
  lat: number;
  lng: number;
  enrollment: number;
  capacity: number;
  declaredIdleSeats?: number | null;
  floors?: number;
  climatized?: boolean;
  transportMode?: TransportMode;
  stationId?: number | null;
  floodThresholdCm?: number | null;
  labComputers?: number;
  hasServer?: boolean;
  archiveBoxes?: number;
  groundFloorSubstation?: boolean;
  principal?: string;
  phone?: string;
}

export interface UpdateSchoolInput extends Partial<CreateSchoolInput> {}

export interface CreateDiagnosisInput {
  scenario: string;
  title: string;
  assessmentText: string;
  evaluatorName: string;
  evaluatorRole: string;
  status?: DiagnosisStatus;
  severityLevel?: RiskLevel;
  operationalRecommendation: string;
}

export interface SchoolDetail {
  scenario: Scenario;
  school: School;
  summary: SchoolSummary;
  station: Station | null;
  routes: DetailRoute[];
  flood: {
    marginCm: number | null;
    daysToFlood: number | null;
    flooded: boolean;
  };
  air: {
    pm25: number | null;
    pm25Indoor: number | null;
    history: SeriesPoint[];
    hotspotsNearby: number;
    nearestHotspotKm: number | null;
  };
  actions: ActionItem[];
  diagnoses?: SchoolDiagnosis[];
  candidates: HostCandidate[];
  agreements: Agreement[];
}

export interface FuioSummary {
  scenario: Scenario;
  schoolsAtRisk: number;
  studentsAtRisk: number;
  studentsCovered: number;
  coveragePct: number;
  studentsSheltered: number;
  studentsProposed: number;
  hostSchoolsAvailable: number;
  idleSeatsNetwork: number;
  agreementsByStatus: Record<AgreementStatus, number>;
  crossNetworkAgreements: number;
  studentDaysPreserved: number;
  maxDistanceKm: number;
}

export interface AtRiskSchool extends SchoolSummary {
  uncoveredStudents: number;
  hostOptions: number;
}

export interface CandidatesResponse {
  scenario: Scenario;
  source: SchoolSummary & { uncoveredStudents: number };
  candidates: HostCandidate[];
}

export interface CreateAgreementInput {
  scenario: ScenarioKey;
  sourceSchoolId: number;
  hostSchoolId: number;
  studentsCount: number;
  shift: Shift;
  transportPlan: string;
  reason: string;
}

export interface MonthDay {
  day: number;
  weekday: number;
  status:
    "LETIVO" | "RISCO_CRITICO" | "REPOSICAO" | "RECESSO" | "FINAL_DE_SEMANA";
  label?: string;
  hazard?: "INUNDACAO" | "VICINAL" | "FUMACA";
}

export interface QuarterMonth {
  name: string;
  year: number;
  days: MonthDay[];
}

export interface QuarterForecast {
  id: string;
  quarterNumber: 1 | 2 | 3 | 4;
  year: number;
  label: string;
  period: string;
  seasonName: string;
  scenarioKey: string;
  scope?: {
    schoolId: number | null;
    schoolName: string;
    isSpecificSchool: boolean;
    note: string;
  };
  statusBadge: {
    label: string;
    variant: "critico" | "alto" | "moderado" | "normal";
  };
  censipamArticulation: {
    hydrologyOutlook: string;
    meteorologyOutlook: string;
    fireOutlook: string;
    criticalAlertsCount: number;
    recommendedActions: string[];
    technicalBulletinCode: string;
    lastUpdated: string;
  };
  pedagogicalMetrics: {
    instructionalDaysPlanned: number;
    riskDaysProjected: number;
    remedialSaturdaysPlanned: number;
    mandatoryDaysGoal: number;
  };
  months: QuarterMonth[];
}

/* ------------------------------------------------------------------ */
/* HTTP client                                                         */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_URL ?? "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "Não foi possível contatar a API do Sentinela. Verifique se o servidor está em execução.",
      0,
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Falha na requisição (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

const qs = (scenario: ScenarioKey) =>
  `scenario=${encodeURIComponent(scenario)}`;

export const api = {
  scenarios: () => request<{ scenarios: Scenario[] }>("/api/scenarios"),
  overview: (scenario: ScenarioKey) =>
    request<Overview>(`/api/schools/overview?${qs(scenario)}`),
  school: (scenario: ScenarioKey, id: number) =>
    request<SchoolDetail>(`/api/schools/${id}?${qs(scenario)}`),
  toggleAction: (
    id: number,
    body: {
      scenario: ScenarioKey;
      actionKey: string;
      completed: boolean;
      completedBy: string;
    },
  ) =>
    request<{ ok: true }>(`/api/schools/${id}/checklist`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  fuioSummary: (scenario: ScenarioKey) =>
    request<FuioSummary>(`/api/fuio/summary?${qs(scenario)}`),
  fuioAtRisk: (scenario: ScenarioKey) =>
    request<{ scenario: Scenario; schools: AtRiskSchool[] }>(
      `/api/fuio/at-risk?${qs(scenario)}`,
    ),
  fuioCandidates: (scenario: ScenarioKey, schoolId: number) =>
    request<CandidatesResponse>(
      `/api/fuio/candidates/${schoolId}?${qs(scenario)}`,
    ),
  fuioAgreements: (scenario: ScenarioKey) =>
    request<{ scenario: Scenario; agreements: DecoratedAgreement[] }>(
      `/api/fuio/agreements?${qs(scenario)}`,
    ),
  createAgreement: (body: CreateAgreementInput) =>
    request<{ agreement: Agreement }>("/api/fuio/agreements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAgreement: (id: number, status: Exclude<AgreementStatus, "PROPOSTO">) =>
    request<{ agreement: Agreement }>(`/api/fuio/agreements/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  quarters: (schoolId?: number | null) =>
    request<{ quarters: QuarterForecast[]; quarter: QuarterForecast }>(
      `/api/calendar/quarters${schoolId ? `?schoolId=${schoolId}` : ""}`,
    ),
  quarter: (id: string, schoolId?: number | null) =>
    request<{ quarter: QuarterForecast }>(
      `/api/calendar/quarters/${id}${schoolId ? `?schoolId=${schoolId}` : ""}`,
    ),
  createSchool: (body: CreateSchoolInput) =>
    request<{ ok: true; school: School }>("/api/schools", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSchool: (id: number, body: UpdateSchoolInput) =>
    request<{ ok: true; school: School }>(`/api/schools/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  schoolDiagnoses: (id: number, scenario: ScenarioKey) =>
    request<{ diagnoses: SchoolDiagnosis[] }>(
      `/api/schools/${id}/diagnoses?scenario=${encodeURIComponent(scenario)}`,
    ),
  createDiagnosis: (schoolId: number, body: CreateDiagnosisInput) =>
    request<{ ok: true; diagnosis: SchoolDiagnosis }>(
      `/api/schools/${schoolId}/diagnoses`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
};

/* ------------------------------------------------------------------ */
/* Query keys & hooks                                                  */
/* ------------------------------------------------------------------ */

export const queryKeys = {
  scenarios: ["scenarios"] as const,
  quarters: (schoolId?: number | null) =>
    ["quarters", schoolId ?? "all"] as const,
  quarter: (id: string, schoolId?: number | null) =>
    ["quarter", id, schoolId ?? "all"] as const,
  overview: (scenario: ScenarioKey) => ["overview", scenario] as const,
  school: (scenario: ScenarioKey, id: number) =>
    ["school", scenario, id] as const,
  fuio: (scenario: ScenarioKey) => ["fuio", scenario] as const,
  fuioSummary: (scenario: ScenarioKey) =>
    ["fuio", scenario, "summary"] as const,
  fuioAtRisk: (scenario: ScenarioKey) => ["fuio", scenario, "at-risk"] as const,
  fuioCandidates: (scenario: ScenarioKey, id: number) =>
    ["fuio", scenario, "candidates", id] as const,
  fuioAgreements: (scenario: ScenarioKey) =>
    ["fuio", scenario, "agreements"] as const,
};

export function useScenarios() {
  return useQuery({
    queryKey: queryKeys.scenarios,
    queryFn: api.scenarios,
    staleTime: Infinity,
  });
}

export function useQuarters(schoolId?: number | null) {
  return useQuery({
    queryKey: queryKeys.quarters(schoolId),
    queryFn: () => api.quarters(schoolId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useQuarter(id: string, schoolId?: number | null) {
  return useQuery({
    queryKey: queryKeys.quarter(id, schoolId),
    queryFn: () => api.quarter(id, schoolId),
    enabled: !!id,
  });
}

export function useOverview(scenario: ScenarioKey) {
  return useQuery({
    queryKey: queryKeys.overview(scenario),
    queryFn: () => api.overview(scenario),
    placeholderData: keepPreviousData,
  });
}

export function useSchoolDetail(scenario: ScenarioKey, id: number | null) {
  return useQuery({
    queryKey: queryKeys.school(scenario, id ?? 0),
    queryFn: () => api.school(scenario, id ?? 0),
    enabled: id !== null,
  });
}

export function useToggleAction(scenario: ScenarioKey, schoolId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.school(scenario, schoolId);
  return useMutation({
    mutationFn: (vars: {
      actionKey: string;
      completed: boolean;
      completedBy: string;
    }) => api.toggleAction(schoolId, { scenario, ...vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SchoolDetail>(key);
      if (previous) {
        queryClient.setQueryData<SchoolDetail>(key, {
          ...previous,
          actions: previous.actions.map((a) =>
            a.key === vars.actionKey
              ? {
                  ...a,
                  completed: vars.completed,
                  completedBy: vars.completed ? vars.completedBy : null,
                  completedAt: vars.completed ? new Date().toISOString() : null,
                }
              : a,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useFuioSummary(scenario: ScenarioKey) {
  return useQuery({
    queryKey: queryKeys.fuioSummary(scenario),
    queryFn: () => api.fuioSummary(scenario),
  });
}

export function useFuioAtRisk(scenario: ScenarioKey) {
  return useQuery({
    queryKey: queryKeys.fuioAtRisk(scenario),
    queryFn: () => api.fuioAtRisk(scenario),
  });
}

export function useFuioCandidates(
  scenario: ScenarioKey,
  schoolId: number | null,
) {
  return useQuery({
    queryKey: queryKeys.fuioCandidates(scenario, schoolId ?? 0),
    queryFn: () => api.fuioCandidates(scenario, schoolId ?? 0),
    enabled: schoolId !== null,
  });
}

export function useFuioAgreements(scenario: ScenarioKey) {
  return useQuery({
    queryKey: queryKeys.fuioAgreements(scenario),
    queryFn: () => api.fuioAgreements(scenario),
  });
}

/** Any FUIO change shifts seats, coverage and school-level plans, so refresh all of it. */
function useInvalidateScenario(scenario: ScenarioKey) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.fuio(scenario) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.overview(scenario) }),
      queryClient.invalidateQueries({ queryKey: ["school", scenario] }),
    ]);
}

export function useCreateAgreement(scenario: ScenarioKey) {
  const invalidate = useInvalidateScenario(scenario);
  return useMutation({
    mutationFn: api.createAgreement,
    onSuccess: invalidate,
  });
}

export function useUpdateAgreement(scenario: ScenarioKey) {
  const invalidate = useInvalidateScenario(scenario);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      status: Exclude<AgreementStatus, "PROPOSTO">;
    }) => api.updateAgreement(vars.id, vars.status),
    onSuccess: invalidate,
  });
}

export function useCreateSchool(scenario?: ScenarioKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createSchool,
    onSuccess: () => {
      if (scenario) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.overview(scenario),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.fuio(scenario) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["overview"] });
        queryClient.invalidateQueries({ queryKey: ["fuio"] });
      }
    },
  });
}

export function useUpdateSchool(schoolId?: number, scenario?: ScenarioKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: UpdateSchoolInput }) =>
      api.updateSchool(vars.id, vars.data),
    onSuccess: (_data, vars) => {
      const targetId = vars.id ?? schoolId;
      if (scenario && targetId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.school(scenario, targetId),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["fuio"] });
      queryClient.invalidateQueries({ queryKey: ["school"] });
    },
  });
}

export function useCreateDiagnosis(schoolId: number, scenario: ScenarioKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDiagnosisInput) =>
      api.createDiagnosis(schoolId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.school(scenario, schoolId),
      });
    },
  });
}
