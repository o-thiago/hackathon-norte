import type {
  ActionCategory,
  ActionPriority,
  AgreementStatus,
  HazardKey,
  HydroStatus,
  RiskLevel,
  RouteCause,
  RouteStatus,
  SchoolNetwork,
} from "./api";

export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function formatCm(cm: number | null | undefined): string {
  if (cm === null || cm === undefined) return "—";
  const meters = (cm / 100).toFixed(2);
  return `${meters} m (${cm} cm)`;
}

export function formatCmMetersOnly(cm: number | null | undefined): string {
  if (cm === null || cm === undefined) return "—";
  return `${(cm / 100).toFixed(2)} m`;
}

export function formatMm(mm: number | null | undefined): string {
  if (mm === null || mm === undefined) return "—";
  return `${Math.round(mm)} mm`;
}

export function formatPm25(pm: number | null | undefined): string {
  if (pm === null || pm === undefined) return "—";
  return `${Math.round(pm)} µg/m³`;
}

export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—";
  return `${km.toFixed(1)} km`;
}

export function formatDateBr(
  isoOrDate: string | Date | null | undefined,
): string {
  if (!isoOrDate) return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Porto_Velho",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeBr(
  isoOrDate: string | Date | null | undefined,
): string {
  if (!isoOrDate) return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Porto_Velho",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface RiskBadgeStyle {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, RiskBadgeStyle> = {
  CRITICO: {
    label: "Crítico",
    bg: "bg-red-50",
    text: "text-red-900",
    border: "border-red-300",
    dot: "bg-red-600",
  },
  ALTO: {
    label: "Alto",
    bg: "bg-amber-50",
    text: "text-amber-950",
    border: "border-amber-300",
    dot: "bg-amber-600",
  },
  MODERADO: {
    label: "Moderado",
    bg: "bg-blue-50",
    text: "text-blue-900",
    border: "border-blue-200",
    dot: "bg-blue-600",
  },
  BAIXO: {
    label: "Baixo",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-emerald-200",
    dot: "bg-emerald-600",
  },
};

export const HAZARD_CONFIG: Record<
  HazardKey,
  { label: string; short: string; color: string; desc: string }
> = {
  INUNDACAO: {
    label: "Inundação Fluvial",
    short: "Cheia Fluvial",
    color: "text-sky-900 bg-sky-50 border-sky-300",
    desc: "Cotas fluviométricas acima da soleira da edificação escolar",
  },
  FLUVIAL: {
    label: "Navegação Fluvial",
    short: "Vazante / Voadeiras",
    color: "text-cyan-900 bg-cyan-50 border-cyan-300",
    desc: "Bancos de areia expostos na estiagem ou balseiros e troncos na cheia",
  },
  VICINAL: {
    label: "Estrada Vicinal",
    short: "Atoleiro Vicinal",
    color: "text-amber-900 bg-amber-50 border-amber-300",
    desc: "Atoleiros e pontilhões de madeira submersos retendo ônibus escolares",
  },
  FUMACA: {
    label: "Fumaça & Queimadas",
    short: "Fumaça PM2.5",
    color: "text-orange-900 bg-orange-50 border-orange-300",
    desc: "Material particulado fino em concentração insalubre nas salas",
  },
};

export const HYDRO_STATUS_CONFIG: Record<
  HydroStatus,
  { label: string; color: string; badge: string }
> = {
  INUNDACAO_SEVERA: {
    label: "Inundação Severa",
    color: "text-red-700",
    badge: "bg-red-100 border-red-300 text-red-900",
  },
  INUNDACAO: {
    label: "Cota de Inundação",
    color: "text-red-700",
    badge: "bg-red-50 border-red-200 text-red-800",
  },
  ALERTA: {
    label: "Cota de Alerta",
    color: "text-amber-700",
    badge: "bg-amber-50 border-amber-200 text-amber-900",
  },
  ATENCAO: {
    label: "Atenção",
    color: "text-amber-700",
    badge: "bg-amber-50 border-amber-200 text-amber-800",
  },
  NORMAL: {
    label: "Nível Normal",
    color: "text-emerald-700",
    badge: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  ESTIAGEM: {
    label: "Cota de Estiagem",
    color: "text-orange-700",
    badge: "bg-orange-50 border-orange-200 text-orange-900",
  },
  ESTIAGEM_SEVERA: {
    label: "Vazante Extrema",
    color: "text-red-700",
    badge: "bg-red-100 border-red-300 text-red-900",
  },
};

export const ROUTE_STATUS_CONFIG: Record<
  RouteStatus,
  { label: string; color: string; border: string; bg: string; stroke: string }
> = {
  TRAFEGAVEL: {
    label: "Trafegável",
    color: "text-emerald-900",
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    stroke: "#059669",
  },
  ATENCAO: {
    label: "Atenção",
    color: "text-amber-900",
    border: "border-amber-300",
    bg: "bg-amber-50",
    stroke: "#d97706",
  },
  CRITICA: {
    label: "Crítica",
    color: "text-orange-900",
    border: "border-orange-300",
    bg: "bg-orange-50",
    stroke: "#ea580c",
  },
  INTRAFEGAVEL: {
    label: "Intrafegável",
    color: "text-red-900",
    border: "border-red-300",
    bg: "bg-red-50",
    stroke: "#dc2626",
  },
};

export const ACTION_CATEGORY_CONFIG: Record<
  ActionCategory,
  { label: string; badge: string }
> = {
  PATRIMONIO: {
    label: "Proteção Patrimonial",
    badge: "bg-purple-50 text-purple-900 border-purple-200",
  },
  PEDAGOGICO: {
    label: "Ação Pedagógica",
    badge: "bg-indigo-50 text-indigo-900 border-indigo-200",
  },
  FUIO: {
    label: "Iniciativa FUIO",
    badge: "bg-cyan-50 text-cyan-900 border-cyan-300 font-semibold",
  },
  SAUDE: {
    label: "Saúde & Ar",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
  },
  LOGISTICA: {
    label: "Logística & Transporte",
    badge: "bg-blue-50 text-blue-900 border-blue-200",
  },
};

export const ACTION_PRIORITY_CONFIG: Record<
  ActionPriority,
  { label: string; badge: string }
> = {
  IMEDIATA: {
    label: "Imediata (Urgente)",
    badge: "bg-red-100 text-red-900 border-red-300",
  },
  "24H": {
    label: "Em 24h",
    badge: "bg-orange-100 text-orange-900 border-orange-300",
  },
  "72H": {
    label: "Em 72h",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
  },
  PREVENTIVA: {
    label: "Preventiva",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export const AGREEMENT_STATUS_CONFIG: Record<
  AgreementStatus,
  { label: string; badge: string; dot: string }
> = {
  PROPOSTO: {
    label: "Em Tramitação",
    badge: "bg-amber-50 text-amber-900 border-amber-300",
    dot: "bg-amber-500",
  },
  ATIVO: {
    label: "Pacto Vigente",
    badge: "bg-emerald-50 text-emerald-900 border-emerald-300",
    dot: "bg-emerald-600",
  },
  ENCERRADO: {
    label: "Encerrado",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
  },
  CANCELADO: {
    label: "Cancelado",
    badge: "bg-red-50 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
};

export function getNetworkBadge(network: SchoolNetwork): {
  label: string;
  badge: string;
} {
  if (network === "ESTADUAL") {
    return {
      label: "SEDUC-RO (Estadual)",
      badge: "bg-blue-50 text-blue-900 border-blue-200",
    };
  }
  return {
    label: "SEMED (Municipal)",
    badge: "bg-teal-50 text-teal-900 border-teal-200",
  };
}

export function routeCauseLabel(cause: RouteCause): string | null {
  if (cause === "CHEIA") return "Cheia fluvial (Madeira/Mamoré)";
  if (cause === "ESTIAGEM") return "Vazante extrema / Bancos de areia";
  if (cause === "CHUVA") return "Saturação hídrica / Pluviometria 72h";
  return null;
}
