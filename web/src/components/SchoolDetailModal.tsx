import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Cpu,
  Droplets,
  Edit,
  FileCheck,
  FilePlus,
  FileText,
  Flame,
  MapPin,
  Phone,
  PlusCircle,
  Save,
  Server,
  ShieldAlert,
  Truck,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  useCreateDiagnosis,
  useSchoolDetail,
  useToggleAction,
  type CreateDiagnosisInput,
  type DiagnosisStatus,
  type HostCandidate,
  type RiskLevel,
  type ScenarioKey,
  type School,
} from "../lib/api";
import {
  ACTION_CATEGORY_CONFIG,
  ACTION_PRIORITY_CONFIG,
  HAZARD_CONFIG,
  HYDRO_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  ROUTE_STATUS_CONFIG,
  cn,
  formatCmMetersOnly,
  formatDateTimeBr,
  formatKm,
  formatMm,
  formatPm25,
  getNetworkBadge,
} from "../lib/utils";

interface SchoolDetailModalProps {
  schoolId: number | null;
  scenarioKey: ScenarioKey;
  onClose: () => void;
  onEditSchool?: (school: School) => void;
}

export const SchoolDetailModal: React.FC<SchoolDetailModalProps> = ({
  schoolId,
  scenarioKey,
  onClose,
  onEditSchool,
}) => {
  const { data: detail, isLoading } = useSchoolDetail(scenarioKey, schoolId);
  const [activeTab, setActiveTab] = useState<"DIRETRIZES" | "DIAGNOSTICOS">(
    "DIRETRIZES",
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [responsibleName, setResponsibleName] = useState("Equipe Gestora");

  // State for new diagnosis form
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [diagTitle, setDiagTitle] = useState("");
  const [diagEvaluator, setDiagEvaluator] = useState("");
  const [diagRole, setDiagRole] = useState("Defesa Civil Municipal");
  const [diagStatus, setDiagStatus] = useState<DiagnosisStatus>("VISTORIADO");
  const [diagSeverity, setDiagSeverity] = useState<RiskLevel>("MODERADO");
  const [diagAssessment, setDiagAssessment] = useState("");
  const [diagRecommendation, setDiagRecommendation] = useState("");
  const [diagFormError, setDiagFormError] = useState<string | null>(null);
  const [diagSuccessMessage, setDiagSuccessMessage] = useState<string | null>(
    null,
  );

  const toggleMutation = useToggleAction(scenarioKey, schoolId ?? 0);
  const createDiagnosisMutation = useCreateDiagnosis(
    schoolId ?? 0,
    scenarioKey,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!schoolId) return null;

  const handleToggle = (actionKey: string, currentCompleted: boolean) => {
    toggleMutation.mutate({
      actionKey,
      completed: !currentCompleted,
      completedBy: responsibleName || "Direção Escolar",
    });
  };

  const handleCreateDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiagFormError(null);
    setDiagSuccessMessage(null);

    if (!diagTitle.trim()) {
      setDiagFormError("Informe o título do laudo ou parecer técnico.");
      return;
    }
    if (!diagEvaluator.trim()) {
      setDiagFormError("Informe o nome do técnico responsável pela vistoria.");
      return;
    }
    if (!diagAssessment.trim() || diagAssessment.trim().length < 10) {
      setDiagFormError(
        "O parecer técnico deve conter pelo menos 10 caracteres descritivos.",
      );
      return;
    }
    if (!diagRecommendation.trim()) {
      setDiagFormError(
        "Informe as recomendações operacionais e diretrizes de salvaguarda.",
      );
      return;
    }

    try {
      const payload: CreateDiagnosisInput = {
        scenario: scenarioKey,
        title: diagTitle.trim(),
        evaluatorName: diagEvaluator.trim(),
        evaluatorRole: diagRole.trim() || "Técnico Avaliador",
        status: diagStatus,
        severityLevel: diagSeverity,
        assessmentText: diagAssessment.trim(),
        operationalRecommendation: diagRecommendation.trim(),
      };

      await createDiagnosisMutation.mutateAsync(payload);
      setDiagSuccessMessage(
        "Laudo técnico registrado com sucesso no prontuário da escola!",
      );
      setShowDiagnosisForm(false);
      // Reset form
      setDiagTitle("");
      setDiagAssessment("");
      setDiagRecommendation("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDiagFormError(err.message);
      } else {
        setDiagFormError("Falha ao registrar laudo técnico.");
      }
    }
  };

  const school = detail?.school;
  const summary = detail?.summary;
  const station = detail?.station;
  const routes = detail?.routes ?? [];
  const flood = detail?.flood;
  const air = detail?.air;
  const actions = detail?.actions ?? [];
  const candidates = detail?.candidates ?? [];
  const diagnoses = detail?.diagnoses ?? [];
  const topHost: HostCandidate | undefined = candidates[0];

  const riskCfg = summary ? RISK_LEVEL_CONFIG[summary.level] : null;
  const netBadge = school ? getNetworkBadge(school.network) : null;
  const primaryHazard = summary?.primaryHazard
    ? HAZARD_CONFIG[summary.primaryHazard]
    : null;

  const filteredActions = actions.filter((action) => {
    if (selectedCategory === "TODAS") return true;
    return action.category === selectedCategory;
  });

  const totalActions = actions.length;
  const completedActions = actions.filter((a) => a.completed).length;
  const progressPct =
    totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  const getStatusBadge = (status: DiagnosisStatus) => {
    switch (status) {
      case "VISTORIADO":
        return "border-emerald-300 bg-emerald-50 text-emerald-800";
      case "EM_ANALISE":
        return "border-amber-300 bg-amber-50 text-amber-800";
      case "INTERDITADO":
        return "border-red-300 bg-red-100 text-red-900";
      case "PENDENTE":
      default:
        return "border-slate-300 bg-slate-100 text-slate-800";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {riskCfg && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                    riskCfg.bg,
                    riskCfg.text,
                    riskCfg.border,
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", riskCfg.dot)} />
                  Risco {riskCfg.label} ({summary?.score}/100)
                </span>
              )}

              {netBadge && (
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold border",
                    netBadge.badge,
                  )}
                >
                  {netBadge.label}
                </span>
              )}

              {primaryHazard && (
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold border",
                    primaryHazard.color,
                  )}
                >
                  {primaryHazard.short}
                </span>
              )}

              {school && (
                <span className="text-xs text-slate-500 font-mono">
                  INEP: {school.inepCode}
                </span>
              )}

              {school?.declaredIdleSeats !== null &&
                school?.declaredIdleSeats !== undefined && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-[#1351b4] border border-blue-200">
                    {school.declaredIdleSeats} vagas declaradas
                  </span>
                )}
            </div>

            <h2
              id="school-modal-title"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              {school?.name ?? "Carregando detalhes da escola..."}
            </h2>

            {school && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {school.municipality} · {school.community}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  Gestor: {school.principal}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  {school.phone}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {school && onEditSchool && (
              <button
                type="button"
                onClick={() => onEditSchool(school)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                title="Editar dados e vagas da escola"
              >
                <Edit className="h-3.5 w-3.5 text-[#1351b4]" />
                <span className="hidden sm:inline">Editar Dados</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab("DIRETRIZES")}
            className={cn(
              "flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-colors",
              activeTab === "DIRETRIZES"
                ? "border-[#1351b4] text-[#1351b4]"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Telemetria & Diretrizes de Mitigação</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("DIAGNOSTICOS")}
            className={cn(
              "flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-colors",
              activeTab === "DIAGNOSTICOS"
                ? "border-[#1351b4] text-[#1351b4]"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <FileCheck className="h-4 w-4" />
            <span>Laudos & Vistorias Técnicas</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {diagnoses.length}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500 animate-pulse">
              Carregando dados da unidade escolar...
            </div>
          ) : school && summary ? (
            activeTab === "DIRETRIZES" ? (
              <>
                {/* Telemetry Summary Cards: 3 Columns */}
                <section aria-labelledby="telemetry-section-heading">
                  <h3
                    id="telemetry-section-heading"
                    className="text-xs font-bold text-slate-700 mb-3"
                  >
                    Diagnóstico de Telemetria Ambiental (Censipam)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Card 1: Hidrologia */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                            <Droplets className="h-4 w-4 text-sky-600" />
                            SipamHidro · Rio
                          </span>
                          {station && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold border",
                                HYDRO_STATUS_CONFIG[station.status].badge,
                              )}
                            >
                              {HYDRO_STATUS_CONFIG[station.status].label}
                            </span>
                          )}
                        </div>

                        {station ? (
                          <>
                            <div className="text-xs text-slate-600 mb-1">
                              Estação: <strong>{station.name}</strong>
                            </div>
                            <div className="text-xl font-bold text-slate-900">
                              {formatCmMetersOnly(station.latestLevelCm)}
                              <span className="text-xs font-semibold text-slate-600 ml-1.5">
                                (
                                {station.trendCmPerDay > 0
                                  ? `+${station.trendCmPerDay}`
                                  : station.trendCmPerDay}{" "}
                                cm/dia)
                              </span>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-700 space-y-0.5 border-t border-slate-200 pt-1.5">
                              <div>
                                Cota Inundação:{" "}
                                <strong>
                                  {formatCmMetersOnly(station.floodLevelCm)}
                                </strong>
                              </div>
                              {school.floodThresholdCm && (
                                <div>
                                  Soleira da Escola:{" "}
                                  <strong>
                                    {formatCmMetersOnly(
                                      school.floodThresholdCm,
                                    )}
                                  </strong>
                                </div>
                              )}
                              {flood?.flooded ? (
                                <div className="font-bold text-red-700">
                                  Térreo Inundado
                                </div>
                              ) : flood?.daysToFlood !== null &&
                                flood?.daysToFlood! <= 5 ? (
                                <div className="font-bold text-amber-700">
                                  Inundação em {flood?.daysToFlood} dias
                                </div>
                              ) : (
                                <div className="text-emerald-700 font-medium">
                                  Margem segura: {flood?.marginCm} cm
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-500 py-3 italic">
                            Sem estação fluviométrica na cota de influência
                            direta.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 2: Rotas e Vicinais */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Truck className="h-4 w-4 text-amber-600" />
                            Vicinais & Fluvial
                          </span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800">
                            {routes.length} rota(s)
                          </span>
                        </div>

                        {routes.length > 0 ? (
                          <div className="space-y-2 mt-1">
                            {routes.slice(0, 2).map((r) => {
                              const statusCfg = ROUTE_STATUS_CONFIG[r.status];
                              return (
                                <div
                                  key={r.id}
                                  className="rounded border border-slate-200 bg-white p-2 text-xs"
                                >
                                  <div className="flex items-center justify-between mb-0.5">
                                    <strong className="text-slate-800">
                                      {r.code}
                                    </strong>
                                    <span
                                      className={cn(
                                        "rounded px-1.5 py-0.2 text-[9px] font-bold border",
                                        statusCfg.bg,
                                        statusCfg.color,
                                        statusCfg.border,
                                      )}
                                    >
                                      {statusCfg.label}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 truncate">
                                    {r.name}
                                  </div>
                                  {r.rainfall72hMm !== null && (
                                    <div className="text-[10px] text-amber-900 font-semibold mt-0.5">
                                      Chuva 72h: {formatMm(r.rainfall72hMm)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 py-3 italic">
                            Atendimento escolar urbano (sem rotas rurais
                            mapeadas).
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 3: Ar & Fumaça */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-orange-600" />
                            Fumaça & Ar (PM2.5)
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold border",
                              (air?.pm25 ?? 0) > 55
                                ? "bg-red-50 text-red-900 border-red-200"
                                : (air?.pm25 ?? 0) > 25
                                  ? "bg-amber-50 text-amber-900 border-amber-200"
                                  : "bg-emerald-50 text-emerald-900 border-emerald-200",
                            )}
                          >
                            {(air?.pm25 ?? 0) > 55 ? "Insalubre" : "Aceitável"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded bg-white p-2 border border-slate-200 text-center">
                            <div className="text-[10px] text-slate-500">
                              Externo
                            </div>
                            <div className="text-base font-bold text-slate-900">
                              {formatPm25(air?.pm25)}
                            </div>
                          </div>
                          <div className="rounded bg-white p-2 border border-slate-200 text-center">
                            <div className="text-[10px] text-slate-500">
                              Em Sala
                            </div>
                            <div className="text-base font-bold text-slate-900">
                              {formatPm25(air?.pm25Indoor)}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 mt-2">
                          Focos em 25 km:{" "}
                          <strong>{air?.hotspotsNearby ?? 0} focos</strong>{" "}
                          (NOAA-20/VIIRS)
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Critical Assets Protection Strip */}
                <section
                  aria-labelledby="assets-heading"
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                >
                  <h3
                    id="assets-heading"
                    className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"
                  >
                    <ShieldAlert className="h-4 w-4 text-[#1351b4]" />
                    Inventário de Ativos Físicos e Tecnológicos
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2 rounded bg-white p-2 border border-slate-200">
                      <Cpu className="h-4 w-4 text-purple-600" />
                      <div>
                        <div className="text-[10px] text-slate-500">
                          Laboratório
                        </div>
                        <strong className="text-slate-900">
                          {school.labComputers} PCs
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded bg-white p-2 border border-slate-200">
                      <Server className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-[10px] text-slate-500">
                          Servidor
                        </div>
                        <strong className="text-slate-900">
                          {school.hasServer ? "Instalado" : "Nenhum"}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded bg-white p-2 border border-slate-200">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <div>
                        <div className="text-[10px] text-slate-500">
                          Arquivo Físico
                        </div>
                        <strong className="text-slate-900">
                          {school.archiveBoxes} caixas
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded bg-white p-2 border border-slate-200">
                      <Zap className="h-4 w-4 text-red-600" />
                      <div>
                        <div className="text-[10px] text-slate-500">
                          Subestação Elétrica
                        </div>
                        <strong
                          className={
                            school.groundFloorSubstation
                              ? "text-red-700 font-bold"
                              : "text-emerald-700 font-medium"
                          }
                        >
                          {school.groundFloorSubstation
                            ? "Térreo (Alerta)"
                            : "Elevada"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>

                {/* FUIO Automatic Mutual-Aid Pairing */}
                {topHost &&
                  (summary.level === "ALTO" || summary.level === "CRITICO") && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1351b4] text-white shadow-2xs">
                        <Users className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-xs font-bold text-blue-950">
                            Acolhimento Automático Integrado (Pacto FUIO)
                          </h4>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-[#1351b4] border border-blue-200">
                            Unidade Integrante do Pacto
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Escola acolhedora parceira:{" "}
                          <strong>{topHost.name}</strong> (
                          {formatKm(topHost.distanceKm)} de distância ·{" "}
                          <strong>{topHost.idleSeats} vagas disponíveis</strong>{" "}
                          {topHost.climatized
                            ? "em salas climatizadas"
                            : "em ambiente ventilado"}
                          ). Acolhimento mútuo entre redes (SEDUC ↔ SEMED) já
                          assegurado formalmente pelo Pacto FUIO.
                        </p>
                      </div>
                    </div>
                  )}

                {/* Action Directives Checklist */}
                <section
                  aria-labelledby="actions-section-heading"
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <h3
                        id="actions-section-heading"
                        className="text-sm font-bold text-slate-900"
                      >
                        Plano de Diretrizes e Mitigações Automatizadas
                      </h3>
                      <p className="text-xs text-slate-500">
                        Checklist operacional auditável em conformidade com o
                        protocolo Censipam/SEDUC-RO.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-slate-600">
                        Concluídas:{" "}
                        <strong>
                          {completedActions}/{totalActions}
                        </strong>{" "}
                        ({progressPct}%)
                      </div>
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1351b4] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category filter buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {[
                      "TODAS",
                      "PATRIMONIO",
                      "PEDAGOGICO",
                      "FUIO",
                      "SAUDE",
                      "LOGISTICA",
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "rounded px-2.5 py-1 text-[11px] font-semibold border transition-all",
                          selectedCategory === cat
                            ? "bg-[#1351b4] text-white border-[#1351b4] shadow-2xs"
                            : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200",
                        )}
                      >
                        {cat === "TODAS"
                          ? "Todas as Ações"
                          : (ACTION_CATEGORY_CONFIG[
                              cat as keyof typeof ACTION_CATEGORY_CONFIG
                            ]?.label ?? cat)}
                      </button>
                    ))}
                  </div>

                  {/* Responsible Input */}
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <label htmlFor="auditor-name" className="font-medium">
                      Responsável pelo Registro:
                    </label>
                    <input
                      id="auditor-name"
                      type="text"
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#1351b4] focus:outline-none"
                      placeholder="Nome do gestor ou técnico..."
                    />
                  </div>

                  {/* Checklist items list */}
                  <div className="space-y-2">
                    {filteredActions.map((action) => {
                      const prioCfg = ACTION_PRIORITY_CONFIG[action.priority];
                      const catCfg = ACTION_CATEGORY_CONFIG[action.category];

                      return (
                        <div
                          key={action.key}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            action.completed
                              ? "border-emerald-200 bg-emerald-50/40"
                              : "border-slate-200 bg-white hover:border-slate-300",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggle(action.key, action.completed)
                              }
                              disabled={toggleMutation.isPending}
                              aria-label={
                                action.completed
                                  ? `Marcar "${action.title}" como pendente`
                                  : `Marcar "${action.title}" como concluída`
                              }
                              className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-600"
                            >
                              {action.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-400 hover:text-cyan-700" />
                              )}
                            </button>

                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <h4
                                  className={cn(
                                    "text-xs font-bold",
                                    action.completed
                                      ? "line-through text-slate-500"
                                      : "text-slate-900",
                                  )}
                                >
                                  {action.title}
                                </h4>

                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5 font-bold border",
                                      prioCfg.badge,
                                    )}
                                  >
                                    {prioCfg.label}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5 font-semibold border",
                                      catCfg.badge,
                                    )}
                                  >
                                    {catCfg.label}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 leading-relaxed">
                                {action.description}
                              </p>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                                <span>
                                  Responsável:{" "}
                                  <strong>{action.responsible}</strong>
                                </span>
                                {action.completed && action.completedAt && (
                                  <span className="text-emerald-700 font-medium">
                                    ✓ Registrado em{" "}
                                    {formatDateTimeBr(action.completedAt)}
                                    {action.completedBy &&
                                      ` por ${action.completedBy}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              /* TAB 2: LAUDOS & VISTORIAS TÉCNICAS (DIAGNÓSTICOS) */
              <div className="space-y-6">
                {/* Header da Aba com Botão de Registro */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Laudos de Vistoria e Diagnósticos Técnicos da Escola
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pareceres situacionais registrados pela Defesa Civil,
                      Corpo de Bombeiros e Engenharia SEDUC/SEMED.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDiagnosisForm((prev) => !prev);
                      setDiagFormError(null);
                      setDiagSuccessMessage(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#1351b4] bg-[#1351b4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c326f] transition-colors shadow-2xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>
                      {showDiagnosisForm
                        ? "Fechar Formulário"
                        : "Registrar Novo Laudo Técnico"}
                    </span>
                  </button>
                </div>

                {/* Mensagens de Sucesso / Feedback */}
                {diagSuccessMessage && (
                  <div
                    role="status"
                    className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{diagSuccessMessage}</span>
                  </div>
                )}

                {/* Formulário de Novo Diagnóstico */}
                {showDiagnosisForm && (
                  <form
                    onSubmit={handleCreateDiagnosis}
                    className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-4"
                  >
                    <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-200 pb-2">
                      <FilePlus className="h-4 w-4 text-[#1351b4]" />
                      Novo Laudo / Parecer Técnico
                    </h4>

                    {diagFormError && (
                      <div
                        role="alert"
                        className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 flex items-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span>{diagFormError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Título do laudo */}
                      <div className="md:col-span-8">
                        <label
                          htmlFor="diag-title"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Título do Laudo / Objeto da Vistoria{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="diag-title"
                          type="text"
                          value={diagTitle}
                          onChange={(e) => setDiagTitle(e.target.value)}
                          placeholder="Ex: Vistoria Fluvial da Defesa Civil - Cota Soleira Atingida"
                          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                          required
                        />
                      </div>

                      {/* Situação / Status */}
                      <div className="md:col-span-4">
                        <label
                          htmlFor="diag-status"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Status da Vistoria
                        </label>
                        <select
                          id="diag-status"
                          value={diagStatus}
                          onChange={(e) =>
                            setDiagStatus(e.target.value as DiagnosisStatus)
                          }
                          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                        >
                          <option value="VISTORIADO">
                            Vistoriado (Concluído)
                          </option>
                          <option value="EM_ANALISE">Em Análise Técnica</option>
                          <option value="INTERDITADO">
                            Interditado (Risco Iminente)
                          </option>
                          <option value="PENDENTE">Pendente de Vistoria</option>
                        </select>
                      </div>

                      {/* Nome do Técnico */}
                      <div className="md:col-span-4">
                        <label
                          htmlFor="diag-evaluator"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Nome do Avaliador / Técnico{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="diag-evaluator"
                          type="text"
                          value={diagEvaluator}
                          onChange={(e) => setDiagEvaluator(e.target.value)}
                          placeholder="Ex: Eng. Roberto Silva"
                          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                          required
                        />
                      </div>

                      {/* Cargo / Órgão */}
                      <div className="md:col-span-4">
                        <label
                          htmlFor="diag-role"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Órgão / Cargo Técnico{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="diag-role"
                          type="text"
                          value={diagRole}
                          onChange={(e) => setDiagRole(e.target.value)}
                          placeholder="Ex: Defesa Civil Municipal / CREA-RO"
                          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                          required
                        />
                      </div>

                      {/* Gravidade */}
                      <div className="md:col-span-4">
                        <label
                          htmlFor="diag-severity"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Nível de Gravidade Avaliado
                        </label>
                        <select
                          id="diag-severity"
                          value={diagSeverity}
                          onChange={(e) =>
                            setDiagSeverity(e.target.value as RiskLevel)
                          }
                          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                        >
                          <option value="CRITICO">
                            Crítico (Emergência Imediata)
                          </option>
                          <option value="ALTO">Alto Risco</option>
                          <option value="MODERADO">Moderado / Alerta</option>
                          <option value="BAIXO">
                            Baixo / Monitoramento de Rotina
                          </option>
                        </select>
                      </div>

                      {/* Parecer Técnico */}
                      <div className="md:col-span-12">
                        <label
                          htmlFor="diag-assessment"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Parecer Técnico & Diagnóstico Estrutural{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          id="diag-assessment"
                          rows={3}
                          value={diagAssessment}
                          onChange={(e) => setDiagAssessment(e.target.value)}
                          placeholder="Descreva a vistoria técnica: avanço das águas sobre ancoradouro, fissuras, condições do transformador térreo, acessibilidade das linhas vicinais ou nível de particulados no ar..."
                          className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                          required
                        />
                      </div>

                      {/* Recomendações Operacionais */}
                      <div className="md:col-span-12">
                        <label
                          htmlFor="diag-recommendation"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Recomendações Operacionais & Salvaguarda{" "}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          id="diag-recommendation"
                          rows={2}
                          value={diagRecommendation}
                          onChange={(e) =>
                            setDiagRecommendation(e.target.value)
                          }
                          placeholder="Indique as providências emergenciais: suspensão imediata de atracação, desligamento de energia, transporte de prontuários em bombonas vedadas ou acionamento de aulas na escola acolhedora parceira..."
                          className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200">
                      <button
                        type="button"
                        onClick={() => setShowDiagnosisForm(false)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={createDiagnosisMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded border border-[#1351b4] bg-[#1351b4] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0c326f] shadow-2xs transition-colors disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>
                          {createDiagnosisMutation.isPending
                            ? "Gravando laudo..."
                            : "Gravar Laudo Técnico"}
                        </span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Lista de Diagnósticos Registrados */}
                <div className="space-y-3">
                  {diagnoses.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      <FileCheck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">
                        Nenhum laudo técnico registrado para este cenário.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Utilize o botão acima para registrar vistorias da Defesa
                        Civil, laudos periciais ou avaliações da engenharia
                        educacional.
                      </p>
                    </div>
                  ) : (
                    diagnoses.map((diag) => {
                      const sevCfg = RISK_LEVEL_CONFIG[diag.severityLevel];
                      return (
                        <div
                          key={diag.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-[10px] font-bold border",
                                    getStatusBadge(diag.status),
                                  )}
                                >
                                  {diag.status}
                                </span>
                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-[10px] font-bold border",
                                    sevCfg.bg,
                                    sevCfg.text,
                                    sevCfg.border,
                                  )}
                                >
                                  Gravidade {sevCfg.label}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">
                                {diag.title}
                              </h4>
                            </div>

                            <div className="text-right text-[11px] text-slate-500">
                              <div className="font-semibold text-slate-700">
                                {diag.evaluatorName}
                              </div>
                              <div>{diag.evaluatorRole}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatDateTimeBr(diag.evaluatedAt)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <strong className="text-slate-800 block mb-0.5 font-semibold">
                                Parecer Técnico:
                              </strong>
                              <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                                {diag.assessmentText}
                              </p>
                            </div>

                            <div>
                              <strong className="text-blue-900 block mb-0.5 font-semibold">
                                Recomendações Operacionais:
                              </strong>
                              <p className="text-blue-950 leading-relaxed bg-blue-50/60 p-2.5 rounded border border-blue-200">
                                {diag.operationalRecommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <div className="text-xs text-slate-500">
            {school && <span>Pacto FUIO · Rondônia</span>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
