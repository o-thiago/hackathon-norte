import React, { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useOverview, useQuarters, type MonthDay } from "../lib/api";
import { cn } from "../lib/utils";

interface QuarterlyCalendarProps {
  onNavigateToRanking: () => void;
}

export const QuarterlyCalendar: React.FC<QuarterlyCalendarProps> = ({
  onNavigateToRanking,
}) => {
  // Selected school for school-specific risk calendar (null = territorial overview)
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);

  const { data: quartersData, isLoading } = useQuarters(selectedSchoolId);
  const { data: overview } = useOverview("inverno");

  const schools = overview?.schools ?? [];
  const activeQuarter = quartersData?.quarter ?? quartersData?.quarters?.[0];

  const [selectedDay, setSelectedDay] = useState<{
    monthName: string;
    day: MonthDay;
  } | null>(null);

  if (isLoading || !activeQuarter) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-xs text-slate-500 animate-pulse">
        Carregando previsão do Censipam e grade do calendário...
      </div>
    );
  }

  const { censipamArticulation, pedagogicalMetrics, months, scope } =
    activeQuarter;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-5">
      {/* 1. Cabeçalho Minimalista e Direto */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Previsão do Trimestre Vigente & Calendário
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Previsão hidrometeorológica vigente (4 meses mais próximos) e dias
            de risco letivo para a escola selecionada.
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

      {/* 2. Seletor de Escola (Geral ou Específica) + Boletim Censipam */}
      <section
        aria-label="Seletor de Escola e Boletim"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Dropdown de Escola */}
          <div className="md:col-span-8">
            <label
              htmlFor="school-calendar-select"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              Escola de Referência para Análise de Risco:
            </label>
            <div className="relative">
              <select
                id="school-calendar-select"
                value={selectedSchoolId ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedSchoolId(val === 0 ? null : val);
                  setSelectedDay(null);
                }}
                className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 px-3 text-xs font-medium text-slate-900 focus:border-[#1351b4] focus:bg-white focus:outline-none"
              >
                <option value={0}>
                  Visão Territorial Geral (Todas as 40 escolas de Rondônia)
                </option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.municipality}) — Risco {s.level} (
                    {s.primaryHazard ? s.primaryHazard : "Segura"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tag do Boletim Censipam (Previsão única do trimestre) */}
          <div className="md:col-span-4 rounded-md bg-slate-50 p-2.5 border border-slate-200 text-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              Boletim Trimestral Censipam
            </span>
            <div className="font-bold text-[#1351b4]">
              {censipamArticulation.technicalBulletinCode}
            </div>
            <div className="text-[11px] text-slate-600">
              Vigência: {activeQuarter.period}
            </div>
          </div>
        </div>

        {/* Diagnóstico em 1 linha */}
        <div className="text-xs text-slate-700 bg-blue-50/50 rounded p-2.5 border border-blue-100 flex items-center justify-between flex-wrap gap-2">
          <span>
            <strong>Diagnóstico:</strong>{" "}
            {scope?.note ?? censipamArticulation.hydrologyOutlook}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#1351b4] border border-blue-200">
            {activeQuarter.statusBadge.label}
          </span>
        </div>
      </section>

      {/* 3. Métricas Pedagógicas Essenciais (Minimal Viable Metrics) */}
      <section
        aria-label="Indicadores do Calendário"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs"
      >
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-slate-500 text-[11px] block">
            Dias Letivos Previstos
          </span>
          <strong className="text-base text-slate-900">
            {pedagogicalMetrics.instructionalDaysPlanned} dias
          </strong>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-slate-500 text-[11px] block">
            {scope?.isSpecificSchool
              ? "Dias de Risco na Escola"
              : "Dias com Risco no Estado"}
          </span>
          <strong
            className={cn(
              "text-base",
              pedagogicalMetrics.riskDaysProjected > 0
                ? "text-red-700"
                : "text-emerald-700",
            )}
          >
            {pedagogicalMetrics.riskDaysProjected} dias
          </strong>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-slate-500 text-[11px] block">
            Sábados de Reposição
          </span>
          <strong className="text-base text-emerald-800">
            {pedagogicalMetrics.remedialSaturdaysPlanned} sábados
          </strong>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-slate-500 text-[11px] block">
            Meta Anual Obrigatória
          </span>
          <strong className="text-base text-[#1351b4]">
            {pedagogicalMetrics.mandatoryDaysGoal} dias (LDB)
          </strong>
        </div>
      </section>

      {/* 4. Grade Mensal dos 4 Meses Mais Próximos */}
      <section aria-label="Grade do Calendário" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span className="font-bold text-slate-900">
            Calendário do Trimestre Vigente ({scope?.schoolName})
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-white border border-slate-300" />
              <span>Aula</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-red-800">
              <span className="h-2.5 w-2.5 rounded-xs bg-red-100 border border-red-300" />
              <span>Risco de Paralisação</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-100 border border-emerald-300" />
              <span>Reposição</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {months.map((month) => (
            <div
              key={month.name}
              className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs"
            >
              <div className="text-xs font-bold text-slate-900 mb-2.5 text-center border-b border-slate-100 pb-1.5">
                {month.name} {month.year}
              </div>

              {/* D S T Q Q S S */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                <span>D</span>
                <span>S</span>
                <span>T</span>
                <span>Q</span>
                <span>Q</span>
                <span>S</span>
                <span>S</span>
              </div>

              {/* Dias */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: month.days[0]?.weekday ?? 0 }).map(
                  (_, i) => (
                    <div key={`empty-${i}`} className="h-7" />
                  ),
                )}

                {month.days.map((d) => {
                  const isCritical = d.status === "RISCO_CRITICO";
                  const isRemedial = d.status === "REPOSICAO";
                  const isSchoolDay =
                    d.status === "LETIVO" || isCritical || isRemedial;
                  const isSelected =
                    selectedDay?.monthName === month.name &&
                    selectedDay?.day.day === d.day;

                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() =>
                        setSelectedDay({
                          monthName: month.name,
                          day: d,
                        })
                      }
                      className={cn(
                        "h-7 rounded flex items-center justify-center text-xs font-medium transition-all relative border",
                        isSelected
                          ? "ring-2 ring-[#1351b4] font-bold z-10"
                          : "hover:border-slate-400",
                        isCritical
                          ? "bg-red-50 text-red-900 border-red-300 font-bold"
                          : isRemedial
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold"
                            : isSchoolDay
                              ? "bg-white text-slate-800 border-slate-200"
                              : "bg-slate-50 text-slate-400 border-transparent",
                      )}
                    >
                      <span>{d.day}</span>
                      {isCritical && (
                        <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Inspeção do Dia Selecionado */}
        {selectedDay && (
          <div className="rounded-md border border-slate-300 bg-slate-50 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 mr-2">
                {selectedDay.day.day} de {selectedDay.monthName}:
              </span>
              <span className="text-slate-700">
                {selectedDay.day.label ||
                  (selectedDay.day.status === "LETIVO"
                    ? "Dia letivo regular sem alertas hidrometeorológicos severos previstos."
                    : "Dia não letivo.")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
