import React, { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { useOverview, useSchoolDetail, type ScenarioKey } from "../lib/api";
import { RouteRiskMap } from "../components/RouteRiskMap";
import { SchoolDetailModal } from "../components/SchoolDetailModal";
import { HAZARD_CONFIG, RISK_LEVEL_CONFIG, cn } from "../lib/utils";

interface DashboardProps {
  scenario: ScenarioKey;
  onNavigateToRanking: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  scenario,
  onNavigateToRanking,
}) => {
  const { data: overview, isLoading } = useOverview(scenario);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [activeModalSchoolId, setActiveModalSchoolId] = useState<number | null>(
    null,
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-slate-500 animate-pulse">
        Carregando camadas cartográficas, estações fluviométricas e malha
        viária...
      </div>
    );
  }

  const schools = overview?.schools ?? [];
  const activeSchoolId =
    selectedSchoolId ??
    schools.find((s) => s.level === "CRITICO")?.id ??
    schools[0]?.id ??
    null;

  const { data: schoolDetail } = useSchoolDetail(scenario, activeSchoolId);
  const focusedSchool = schoolDetail?.school;
  const focusedSummary = schoolDetail?.summary;
  const focusedRiskCfg = focusedSummary
    ? RISK_LEVEL_CONFIG[focusedSummary.level]
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* 1. Cabeçalho Minimalista */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Mapa Territorial e Malha Logística
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Georreferenciamento de escolas, estações fluviométricas SipamHidro e
            rotas fluviais/vicinais.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToRanking}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <span>Ranking de Escolas</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </div>

      {/* 2. Grade: Mapa + Painel da Escola Focada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Mapa Geoespacial (8 colunas) */}
        <div className="lg:col-span-8 h-[600px] rounded-lg overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
          <RouteRiskMap
            schools={schools}
            stations={overview?.stations ?? []}
            hotspots={overview?.hotspots ?? []}
            routes={overview?.routes ?? []}
            selectedSchoolId={activeSchoolId}
            onSelectSchool={(id) => setSelectedSchoolId(id)}
          />
        </div>

        {/* Detalhes da Escola Selecionada (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700">
                Escola Selecionada no Mapa
              </span>
              {focusedRiskCfg && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold border",
                    focusedRiskCfg.bg,
                    focusedRiskCfg.text,
                    focusedRiskCfg.border,
                  )}
                >
                  Risco {focusedRiskCfg.label}
                </span>
              )}
            </div>

            {focusedSchool && focusedSummary ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {focusedSchool.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-slate-600 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {focusedSchool.municipality} · {focusedSchool.community}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div className="rounded bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      Matrículas
                    </span>
                    <strong className="text-slate-900 text-sm">
                      {focusedSchool.enrollment} alunos
                    </strong>
                  </div>
                  <div className="rounded bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      Rede de Ensino
                    </span>
                    <strong className="text-slate-900 text-sm">
                      {focusedSchool.network === "ESTADUAL"
                        ? "SEDUC-RO"
                        : "SEMED"}
                    </strong>
                  </div>
                </div>

                <div className="rounded bg-slate-50 p-3 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Diagnóstico de Ameaça:
                  </span>
                  <div className="text-xs font-semibold text-slate-900">
                    {focusedSummary.primaryHazard
                      ? HAZARD_CONFIG[focusedSummary.primaryHazard].label
                      : "Situação Regular"}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {focusedSummary.hazards.find(
                      (h) => h.key === focusedSummary.primaryHazard,
                    )?.detail ?? "Sem anomalias severas no momento."}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveModalSchoolId(focusedSchool.id)}
                    className="w-full rounded-md bg-[#1351b4] hover:bg-[#0c326f] py-2 text-center font-semibold text-white shadow-xs transition-colors"
                  >
                    Ver Diagnóstico Completo & Ações
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Clique em um marcador de escola no mapa para visualizar os
                indicadores e rotas.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes da Escola */}
      <SchoolDetailModal
        schoolId={activeModalSchoolId}
        scenarioKey={scenario}
        onClose={() => setActiveModalSchoolId(null)}
      />
    </div>
  );
};
