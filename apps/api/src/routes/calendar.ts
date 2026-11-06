import { Hono } from "hono";
import { z } from "zod";
import { validate } from "../lib/validate";
import { loadSnapshot } from "../services/risk";

export interface MonthDay {
  day: number;
  weekday: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  status: "LETIVO" | "RISCO_CRITICO" | "REPOSICAO" | "RECESSO" | "FINAL_DE_SEMANA";
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
  quarterNumber?: number;
  year: number;
  label: string;
  period: string;
  seasonName: string;
  scenarioKey: string;
  scope: {
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
    mandatoryDaysGoal: number; // 200 days target
  };
  months: QuarterMonth[];
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function getValidWeekdays(year: number, monthIndex: number, desiredDays: number[]): number[] {
  const result: number[] = [];
  const testDate = new Date(year, monthIndex, 1);
  while (testDate.getMonth() === monthIndex) {
    const wd = testDate.getDay();
    if (wd >= 1 && wd <= 5 && desiredDays.includes(testDate.getDate())) {
      result.push(testDate.getDate());
    }
    testDate.setDate(testDate.getDate() + 1);
  }
  if (result.length === 0 && desiredDays.length > 0) {
    const fallbackDate = new Date(year, monthIndex, 1);
    while (fallbackDate.getMonth() === monthIndex) {
      const wd = fallbackDate.getDay();
      if (wd >= 2 && wd <= 4) {
        result.push(fallbackDate.getDate());
        if (result.length >= desiredDays.length) break;
      }
      fallbackDate.setDate(fallbackDate.getDate() + 1);
    }
  }
  return result;
}

function getValidSaturdays(year: number, monthIndex: number, desiredDays: number[]): number[] {
  const result: number[] = [];
  const testDate = new Date(year, monthIndex, 1);
  while (testDate.getMonth() === monthIndex) {
    if (testDate.getDay() === 6 && desiredDays.includes(testDate.getDate())) {
      result.push(testDate.getDate());
    }
    testDate.setDate(testDate.getDate() + 1);
  }
  if (result.length === 0 && desiredDays.length > 0) {
    const fallbackDate = new Date(year, monthIndex, 1);
    while (fallbackDate.getMonth() === monthIndex) {
      if (fallbackDate.getDay() === 6) {
        result.push(fallbackDate.getDate());
        if (result.length >= desiredDays.length) break;
      }
      fallbackDate.setDate(fallbackDate.getDate() + 1);
    }
  }
  return result;
}

function generateQuarterDays(
  year: number,
  monthIndex: number,
  criticalDays: number[],
  remedialDays: number[],
  hazard?: "INUNDACAO" | "VICINAL" | "FUMACA",
): MonthDay[] {
  const date = new Date(year, monthIndex, 1);
  const days: MonthDay[] = [];
  while (date.getMonth() === monthIndex) {
    const day = date.getDate();
    const weekday = date.getDay();

    let status: MonthDay["status"] = "LETIVO";
    let label: string | undefined;
    let haz: MonthDay["hazard"] = undefined;

    if (weekday === 0 || weekday === 6) {
      if (remedialDays.includes(day)) {
        status = "REPOSICAO";
        label = "Sábado Letivo (Reposição de Calendário)";
      } else {
        status = "FINAL_DE_SEMANA";
      }
    } else if (criticalDays.includes(day)) {
      status = "RISCO_CRITICO";
      label =
        hazard === "INUNDACAO"
          ? "Previsão Censipam: Cota de Inundação"
          : hazard === "VICINAL"
          ? "Previsão Censipam: Atoleiros Severos nas Vicinais"
          : "Previsão Censipam: Alerta Hidrometeorológico Crítico";
      haz = hazard;
    }

    days.push({ day, weekday, status, label, hazard: haz });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

async function buildQuarterForecast(schoolId?: number | null): Promise<QuarterForecast> {
  const snapshot = await loadSnapshot("inverno");

  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();

  let schoolName = "Todas as Escolas (Visão Territorial de Rondônia)";
  let isSpecificSchool = false;
  let schoolNote = "Panorama unificado de alertas hidrometeorológicos em todo o estado.";
  let hazard: "INUNDACAO" | "VICINAL" | "FUMACA" | undefined = "INUNDACAO";
  let statusBadgeLabel = "Alerta Hidrológico em Vigência";
  let statusBadgeVariant: "critico" | "alto" | "moderado" | "normal" = "critico";

  // Template pattern per month index (0: current month, 1: +1m, 2: +2m, 3: +3m)
  let rawCriticalConfig: number[][] = [
    [24, 25],
    [10, 11, 17, 18],
    [14, 15, 16, 21, 22],
    [11, 12, 18, 19],
  ];
  let rawRemedialConfig: number[][] = [
    [28],
    [19],
    [24],
    [21],
  ];

  if (schoolId && schoolId > 0) {
    const assessment = snapshot.assessments.find((a) => a.school.id === schoolId);
    if (assessment) {
      isSpecificSchool = true;
      schoolName = `${assessment.school.name} (${assessment.school.municipality})`;

      if (assessment.level === "CRITICO" || assessment.primaryHazard === "INUNDACAO") {
        hazard = "INUNDACAO";
        // River flooding peaks progressively in months 1, 2, 3
        rawCriticalConfig = [
          [],
          [17, 18, 19],
          [14, 15, 16, 21, 22, 23],
          [10, 11, 12, 17, 18],
        ];
        rawRemedialConfig = [
          [],
          [20],
          [17, 24],
          [14, 21],
        ];
        schoolNote = "Risco de elevação de cota fluvial com inundação de acessos e do atracadouro escolar.";
        statusBadgeLabel = "Risco Crítico de Inundação";
        statusBadgeVariant = "critico";
      } else if (assessment.level === "ALTO" || assessment.primaryHazard === "VICINAL") {
        hazard = "VICINAL";
        // Mud & unpaved roads in rainy months
        rawCriticalConfig = [
          [23, 24],
          [10, 11, 17, 18],
          [13, 14, 15, 20, 21],
          [11, 12, 17],
        ];
        rawRemedialConfig = [
          [28],
          [19],
          [17],
          [21],
        ];
        schoolNote = "Risco de atoleiros em linhas vicinais impedindo a circulação regular de ônibus escolares.";
        statusBadgeLabel = "Atoleiros Severos nas Vicinais";
        statusBadgeVariant = "alto";
      } else {
        // Safe schools on paved/urban locations
        hazard = undefined;
        rawCriticalConfig = [[], [], [], []];
        rawRemedialConfig = [[], [], [], []];
        schoolNote = "Unidade em cota segura e via pavimentada. Calendário regular sem interrupções climáticas previstas.";
        statusBadgeLabel = "Operação Regular sem Riscos";
        statusBadgeVariant = "normal";
      }
    }
  }

  // Generate dynamic 4 closest months starting from current month
  const months: QuarterMonth[] = [];
  for (let offset = 0; offset < 4; offset++) {
    const targetDate = new Date(baseYear, baseMonth + offset, 1);
    const mYear = targetDate.getFullYear();
    const mMonthIndex = targetDate.getMonth();
    const mName = MONTH_NAMES[mMonthIndex] ?? "Mês";

    const critical = getValidWeekdays(mYear, mMonthIndex, rawCriticalConfig[offset] ?? []);
    const remedial = getValidSaturdays(mYear, mMonthIndex, rawRemedialConfig[offset] ?? []);

    months.push({
      name: mName,
      year: mYear,
      days: generateQuarterDays(mYear, mMonthIndex, critical, remedial, hazard),
    });
  }

  let instructionalDaysPlanned = 0;
  let riskDaysProjected = 0;
  let remedialSaturdaysPlanned = 0;

  for (const m of months) {
    for (const d of m.days) {
      if (d.status === "LETIVO" || d.status === "RISCO_CRITICO") {
        instructionalDaysPlanned++;
      }
      if (d.status === "RISCO_CRITICO") {
        riskDaysProjected++;
      }
      if (d.status === "REPOSICAO") {
        remedialSaturdaysPlanned++;
      }
    }
  }

  const startMonthName = MONTH_NAMES[baseMonth] ?? "Mês";
  const endMonthDate = new Date(baseYear, baseMonth + 3, 1);
  const endMonthName = MONTH_NAMES[endMonthDate.getMonth()] ?? "Mês";
  const period = `${startMonthName} de ${baseYear} a ${endMonthName} de ${endMonthDate.getFullYear()}`;

  return {
    id: "vigente",
    quarterNumber: 1,
    year: baseYear,
    label: "Trimestre Vigente",
    period,
    seasonName: "Inverno Amazônico · Monitoramento Hidrometeorológico",
    scenarioKey: "inverno",
    scope: {
      schoolId: isSpecificSchool ? schoolId! : null,
      schoolName,
      isSpecificSchool,
      note: schoolNote,
    },
    statusBadge: {
      label: statusBadgeLabel,
      variant: statusBadgeVariant,
    },
    censipamArticulation: {
      hydrologyOutlook:
        "Bacia do Rio Madeira e afluentes com saturação hídrica e monitoramento contínuo das réguas telemétricas.",
      meteorologyOutlook:
        "Precipitação acumulada elevada com instabilidades convectivas típicas do inverno amazônico.",
      fireOutlook: "Focos de calor em patamar residual devido às precipitações regulares.",
      criticalAlertsCount: riskDaysProjected,
      recommendedActions: [
        "Acompanhar telemetria fluviométrica do Censipam diariamente.",
        "Manter plano de transporte assistido para trechos vicinais críticos.",
        "Ativar pacto FUIO preventivamente caso cota atinja nível de atenção.",
      ],
      technicalBulletinCode: "CENSIPAM-BH-RO-VIGENTE",
      lastUpdated: now.toISOString(),
    },
    pedagogicalMetrics: {
      instructionalDaysPlanned,
      riskDaysProjected,
      remedialSaturdaysPlanned,
      mandatoryDaysGoal: 200,
    },
    months,
  };
}

const calendarQuery = z.object({
  schoolId: z.coerce.number().int().optional(),
});

const quarterParam = z.object({ id: z.string().trim().min(1).max(10) });

export const calendarRoutes = new Hono()
  .get("/quarters", validate("query", calendarQuery), async (c) => {
    const { schoolId } = c.req.valid("query");
    const forecast = await buildQuarterForecast(schoolId);
    return c.json({
      quarters: [forecast],
      quarter: forecast,
    });
  })
  .get("/quarters/:id", validate("param", quarterParam), validate("query", calendarQuery), async (c) => {
    const { schoolId } = c.req.valid("query");
    const forecast = await buildQuarterForecast(schoolId);
    return c.json({ quarter: forecast });
  });
