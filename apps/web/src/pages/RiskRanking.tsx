import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Edit,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  api,
  useOverview,
  useQuarters,
  type ScenarioKey,
  type School,
} from "../lib/api";
import {
  HAZARD_CONFIG,
  RISK_LEVEL_CONFIG,
  cn,
  getNetworkBadge,
} from "../lib/utils";
import { SchoolDetailModal } from "../components/SchoolDetailModal";
import { SchoolFormModal } from "../components/SchoolFormModal";

interface RiskRankingProps {
  scenarioKey: ScenarioKey;
  onNavigateToCalendar: () => void;
}

export const RiskRanking: React.FC<RiskRankingProps> = ({
  scenarioKey,
  onNavigateToCalendar,
}) => {
  const { data: overview, isLoading } = useOverview(scenarioKey);
  const { data: quartersData } = useQuarters();

  const currentQuarter = quartersData?.quarter ?? quartersData?.quarters?.[0];

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("TODOS");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("TODAS");
  const [selectedLevel, setSelectedLevel] = useState<string>("TODOS");

  // School modal state
  const [activeModalSchoolId, setActiveModalSchoolId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  const handleOpenEdit = async (schoolId: number) => {
    try {
      const data = await api.school(scenarioKey, schoolId);
      setEditingSchool(data.school);
    } catch (err) {
      console.error("Falha ao carregar dados da escola para edição", err);
    }
  };

  const rawSchools = overview?.schools ?? [];
  const stats = overview?.stats;

  const municipalities = useMemo(() => {
    const list = Array.from(new Set(rawSchools.map((s) => s.municipality))).sort();
    return ["TODOS", ...list];
  }, [rawSchools]);

  // Ranked schools: ordered strictly from highest risk score (#1) down to lowest
  const rankedSchools = useMemo(() => {
    return [...rawSchools]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
      .filter((school) => {
        const matchesSearch =
          searchTerm === "" ||
          school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          school.community.toLowerCase().includes(searchTerm.toLowerCase()) ||
          school.inepCode.includes(searchTerm) ||
          school.municipality.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesMun =
          selectedMunicipality === "TODOS" || school.municipality === selectedMunicipality;

        const matchesNet =
          selectedNetwork === "TODAS" || school.network === selectedNetwork;

        const matchesLevel =
          selectedLevel === "TODOS" || school.level === selectedLevel;

        return matchesSearch && matchesMun && matchesNet && matchesLevel;
      });
  }, [rawSchools, searchTerm, selectedMunicipality, selectedNetwork, selectedLevel]);

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedMunicipality !== "TODOS" ||
    selectedNetwork !== "TODAS" ||
    selectedLevel !== "TODOS";

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMunicipality("TODOS");
    setSelectedNetwork("TODAS");
    setSelectedLevel("TODOS");
  };

  const criticalCount = stats?.byLevel.CRITICO ?? 0;
  const highCount = stats?.byLevel.ALTO ?? 0;
  const priorityCount = criticalCount + highCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4">
      {/* 1. Cabeçalho Minimalista */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Ranking de Risco Escolar
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Classificação de vulnerabilidade climática e logística das escolas de Rondônia (Trimestre Vigente).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingSchool(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1351b4] bg-[#1351b4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c326f] transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Cadastrar Escola no FUIO</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToCalendar}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>Previsão Censipam</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* 2. Resumo em Uma Única Linha */}
      <section
        aria-label="Resumo Geral"
        className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{rawSchools.length} escolas monitoradas</span>
          <span className="text-slate-400">·</span>
          <span className="font-semibold text-red-700">
            {priorityCount} prioritárias ({criticalCount} críticas · {highCount} alto risco)
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-700">
            {stats?.studentsAtRisk.toLocaleString("pt-BR") ?? "—"} estudantes sob risco
          </span>
        </div>

        <span className="text-[11px] text-slate-500">
          Boletim Censipam: {currentQuarter?.censipamArticulation.technicalBulletinCode ?? "CENSIPAM-BH-RO-VIGENTE"}
        </span>
      </section>

      {/* 3. Barra de Busca e Filtros Imediatos (Padrão GOV.BR: Saiba onde procurar) */}
      <section
        aria-labelledby="search-lookup-heading"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="search-lookup-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#1351b4]" aria-hidden="true" />
            <span>Consultar Unidade Escolar</span>
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1351b4] hover:underline"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Caixa de Busca Principal */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <label htmlFor="search-input" className="sr-only">
              Pesquisar escola por nome, comunidade, município ou código INEP
            </label>
            <input
              id="search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome da escola, comunidade ou código INEP..."
              className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-[#1351b4] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
            />
          </div>

          {/* Filtro: Município */}
          <div className="md:col-span-2">
            <label htmlFor="filter-municipality" className="sr-only">
              Filtrar por Município
            </label>
            <select
              id="filter-municipality"
              value={selectedMunicipality}
              onChange={(e) => setSelectedMunicipality(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 px-2.5 text-xs text-slate-800 focus:border-[#1351b4] focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Município: Todos</option>
              {municipalities
                .filter((m) => m !== "TODOS")
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </div>

          {/* Filtro: Rede Escolar */}
          <div className="md:col-span-2">
            <label htmlFor="filter-network" className="sr-only">
              Filtrar por Rede de Ensino
            </label>
            <select
              id="filter-network"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 px-2.5 text-xs text-slate-800 focus:border-[#1351b4] focus:bg-white focus:outline-none"
            >
              <option value="TODAS">Rede: Todas</option>
              <option value="ESTADUAL">Estadual (SEDUC-RO)</option>
              <option value="MUNICIPAL">Municipal (SEMED)</option>
            </select>
          </div>

          {/* Filtro: Grau de Risco */}
          <div className="md:col-span-2">
            <label htmlFor="filter-level" className="sr-only">
              Filtrar por Nível de Risco
            </label>
            <select
              id="filter-level"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 px-2.5 text-xs text-slate-800 focus:border-[#1351b4] focus:bg-white focus:outline-none"
            >
              <option value="TODOS">Risco: Todos</option>
              <option value="CRITICO">Crítico (Score ≥ 75)</option>
              <option value="ALTO">Alto (Score 50–74)</option>
              <option value="MODERADO">Moderado (Score 25–49)</option>
              <option value="BAIXO">Baixo (Score &lt; 25)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Exibindo <strong>{rankedSchools.length}</strong> de <strong>{rawSchools.length}</strong> escolas monitoradas
          </span>
          <span className="text-[11px] text-slate-400">
            Ordenado da maior para a menor prioridade de intervenção
          </span>
        </div>
      </section>

      {/* 4. Tabela de Classificação Padrão DS.GOV.BR */}
      <section
        aria-labelledby="ranking-table-heading"
        className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden"
      >
        <h2 id="ranking-table-heading" className="sr-only">
          Tabela de Classificação de Risco Escolar
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <caption className="sr-only">
              Lista de unidades escolares classificadas pelo índice ponderado de vulnerabilidade sazonal
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-700">
                <th scope="col" className="py-3 px-3 text-center w-12">
                  #
                </th>
                <th scope="col" className="py-3 px-4">
                  Unidade Escolar & Município
                </th>
                <th scope="col" className="py-3 px-3">
                  Rede
                </th>
                <th scope="col" className="py-3 px-4">
                  Grau de Risco
                </th>
                <th scope="col" className="py-3 px-4">
                  Ameaça Principal (Censipam)
                </th>
                <th scope="col" className="py-3 px-3 text-right">
                  Alunos
                </th>
                <th scope="col" className="py-3 pr-4 pl-3 text-center w-40">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 animate-pulse">
                    Carregando matriz de risco das escolas...
                  </td>
                </tr>
              ) : rankedSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Nenhuma escola localizada com os filtros atuais.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tente alterar os termos de busca ou limpar os filtros.
                    </p>
                  </td>
                </tr>
              ) : (
                rankedSchools.map((school, index) => {
                  const rankNumber = index + 1;
                  const riskCfg = RISK_LEVEL_CONFIG[school.level];
                  const net = getNetworkBadge(school.network);
                  const hazard = school.primaryHazard ? HAZARD_CONFIG[school.primaryHazard] : null;

                  return (
                    <tr
                      key={school.id}
                      className={cn(
                        "hover:bg-blue-50/30 transition-colors",
                        school.level === "CRITICO" && "bg-red-50/15",
                        school.level === "ALTO" && "bg-amber-50/15",
                      )}
                    >
                      {/* Posição */}
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {rankNumber}
                      </td>

                      {/* Nome da Escola e Localização */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {school.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 mt-0.5 text-xs">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>
                            {school.municipality} · {school.community}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({school.inepCode})
                          </span>
                        </div>
                      </td>

                      {/* Rede */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={cn("inline-block rounded px-2 py-0.5 text-[11px] font-semibold border", net.badge)}>
                          {school.network === "ESTADUAL" ? "SEDUC-RO" : "SEMED"}
                        </span>
                      </td>

                      {/* Grau de Risco */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                              riskCfg.bg,
                              riskCfg.text,
                              riskCfg.border,
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", riskCfg.dot)} aria-hidden="true" />
                            {riskCfg.label}
                          </span>
                          <span className="font-bold text-slate-700 text-xs">
                            {school.score}/100
                          </span>
                        </div>
                      </td>

                      {/* Ameaça Principal */}
                      <td className="py-3 px-4">
                        {hazard && school.level !== "BAIXO" ? (
                          <div className="space-y-0.5">
                            <span className={cn("inline-block rounded px-2 py-0.5 text-[11px] font-semibold border", hazard.color)}>
                              {hazard.short}
                            </span>
                            <div className="text-[11px] text-slate-600 line-clamp-1">
                              {school.hazards.find((h) => h.key === school.primaryHazard)?.detail ?? hazard.desc}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">
                            Situação regular
                          </span>
                        )}
                      </td>

                      {/* Matrículas */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900">{school.enrollment}</div>
                        <div className="text-[10px] text-slate-500">
                          {school.transportMode.toLowerCase()}
                        </div>
                      </td>

                      {/* Botão de Ação Direta */}
                      <td className="py-3 pr-4 pl-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveModalSchoolId(school.id)}
                            className="rounded-md border border-[#1351b4] bg-[#1351b4] text-white hover:bg-[#0c326f] px-2.5 py-1.5 font-semibold text-xs transition-colors shadow-2xs focus:ring-2 focus:ring-[#1351b4]"
                            title="Ver diagnóstico e plano de ação"
                          >
                            Diagnóstico
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(school.id)}
                            className="rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 p-1.5 text-xs transition-colors shadow-2xs"
                            title="Editar metadados e vagas declaradas"
                            aria-label={`Editar metadados de ${school.name}`}
                          >
                            <Edit className="h-3.5 w-3.5 text-[#1351b4]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Detalhes da Escola */}
      <SchoolDetailModal
        schoolId={activeModalSchoolId}
        scenarioKey={scenarioKey}
        onClose={() => setActiveModalSchoolId(null)}
        onEditSchool={(sch) => {
          setActiveModalSchoolId(null);
          setEditingSchool(sch);
        }}
      />

      {/* Modal de Cadastro / Edição da Escola */}
      <SchoolFormModal
        isOpen={isCreateOpen || editingSchool !== null}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingSchool(null);
        }}
        initialSchool={editingSchool}
        scenarioKey={scenarioKey}
      />
    </div>
  );
};
