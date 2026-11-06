import React, { useState } from "react";
import {
  ChevronRight,
  FileCheck2,
  FilePlus2,
  X,
} from "lucide-react";
import {
  useCreateAgreement,
  useFuioAgreements,
  useFuioAtRisk,
  useFuioCandidates,
  useFuioSummary,
  useUpdateAgreement,
  type AgreementStatus,
  type ScenarioKey,
  type Shift,
} from "../lib/api";
import {
  AGREEMENT_STATUS_CONFIG,
  cn,
  formatDateBr,
  formatKm,
  getNetworkBadge,
} from "../lib/utils";

interface FuioInitiativeProps {
  scenario: ScenarioKey;
  initialSourceSchoolId?: number | null;
  onNavigateToRanking?: () => void;
}

export const FuioInitiative: React.FC<FuioInitiativeProps> = ({
  scenario,
  initialSourceSchoolId,
  onNavigateToRanking,
}) => {
  const { data: summary } = useFuioSummary(scenario);
  const { data: atRiskData } = useFuioAtRisk(scenario);
  const { data: agreementsData, isLoading: agreementsLoading } = useFuioAgreements(scenario);

  const atRiskSchools = atRiskData?.schools ?? [];
  const agreements = agreementsData?.agreements ?? [];

  const [activeSubTab, setActiveSubTab] = useState<"matchmaker" | "agreements">("matchmaker");

  // Selected source school for proposing a transfer
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(
    initialSourceSchoolId ?? (atRiskSchools[0]?.id ?? null),
  );

  const { data: candidatesData, isLoading: candidatesLoading } = useFuioCandidates(
    scenario,
    selectedSourceId,
  );

  // Proposal modal state
  const [targetHostId, setTargetHostId] = useState<number | null>(null);
  const [studentsCount, setStudentsCount] = useState<number>(50);
  const [shift, setShift] = useState<Shift>("VESPERTINO");
  const [transportPlan, setTransportPlan] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreateAgreement(scenario);
  const updateMutation = useUpdateAgreement(scenario);

  const selectedSource = atRiskSchools.find((s) => s.id === selectedSourceId);
  const selectedHost = candidatesData?.candidates.find((c) => c.schoolId === targetHostId);

  const handleOpenProposal = (hostId: number) => {
    const host = candidatesData?.candidates.find((c) => c.schoolId === hostId);
    if (!host || !selectedSource) return;

    setTargetHostId(hostId);
    const suggestedStudents = Math.min(selectedSource.uncoveredStudents || 50, host.idleSeats);
    setStudentsCount(suggestedStudents);

    const defaultTransport =
      selectedSource.transportMode === "FLUVIAL"
        ? `Embarcação escolar (lancha) até margem segura e ônibus rodoviário até a ${host.name}.`
        : `Transporte terrestre em rotas vicinais seguras até a ${host.name}.`;

    setTransportPlan(defaultTransport);
    setReason(
      `Acolhimento emergencial FUIO: estudantes impossibilitados de acesso na sede de origem devido a risco sazonal severo.`,
    );
    setFormError(null);
  };

  const handleCloseProposal = () => {
    setTargetHostId(null);
    setFormError(null);
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceId || !targetHostId) return;

    setFormError(null);
    try {
      await createMutation.mutateAsync({
        scenario,
        sourceSchoolId: selectedSourceId,
        hostSchoolId: targetHostId,
        studentsCount,
        shift,
        transportPlan,
        reason,
      });
      handleCloseProposal();
      setActiveSubTab("agreements");
    } catch (err: any) {
      setFormError(err.message || "Erro ao formalizar termo de intercooperação.");
    }
  };

  const handleUpdateStatus = async (
    id: number,
    newStatus: Exclude<AgreementStatus, "PROPOSTO">,
  ) => {
    try {
      await updateMutation.mutateAsync({ id, status: newStatus });
    } catch (err: any) {
      alert(err.message || "Não foi possível atualizar o termo.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4">
      {/* 1. Cabeçalho Minimalista */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Pacto de Acolhimento Inter-redes (FUIO)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Intercooperação SEDUC-RO e SEMEDs: transferência de turmas isoladas para escolas com vagas ociosas.
          </p>
        </div>

        {onNavigateToRanking && (
          <button
            type="button"
            onClick={onNavigateToRanking}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>Ranking de Escolas</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>
        )}
      </div>

      {/* 2. Resumo de Impacto do Pacto em Linha */}
      <section
        aria-label="Indicadores do Pacto FUIO"
        className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-red-700">
            {summary?.studentsAtRisk.toLocaleString("pt-BR") ?? "—"} alunos sob risco
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-semibold text-emerald-800">
            {summary?.coveragePct ?? 0}% de cobertura ({summary?.studentsSheltered ?? 0} abrigados)
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-700">
            {summary?.idleSeatsNetwork.toLocaleString("pt-BR") ?? "—"} vagas livres na rede parceira
          </span>
        </div>

        <span className="font-semibold text-slate-700 text-[11px]">
          {agreements.length} termo(s) cadastrado(s)
        </span>
      </section>

      {/* 3. Abas de Ação Foco Único (Não sobrecarrega em uma única tela) */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold" aria-label="Seções do Pacto FUIO">
          <button
            type="button"
            onClick={() => setActiveSubTab("matchmaker")}
            className={cn(
              "py-2.5 border-b-2 transition-all flex items-center gap-2",
              activeSubTab === "matchmaker"
                ? "border-[#1351b4] text-[#1351b4]"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            <span>1. Encontrar Escola Acolhedora (Matchmaker)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("agreements")}
            className={cn(
              "py-2.5 border-b-2 transition-all flex items-center gap-2",
              activeSubTab === "agreements"
                ? "border-[#1351b4] text-[#1351b4]"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            <span>2. Termos Formalizados ({agreements.length})</span>
          </button>
        </nav>
      </div>

      {/* 4A. Aba: Encontrar Escola Anfitriã */}
      {activeSubTab === "matchmaker" && (
        <section aria-label="Seleção e Matchmaker de Acolhimento" className="space-y-4">
          {/* Seletor de Escola de Origem */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <label htmlFor="source-school-select" className="block text-xs font-bold text-slate-900 mb-1.5">
              Selecione a Escola de Origem (Ameaçada ou Isolada):
            </label>
            <select
              id="source-school-select"
              value={selectedSourceId ?? ""}
              onChange={(e) => setSelectedSourceId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:bg-white focus:outline-none"
            >
              {atRiskSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.municipality}) — Risco {s.level} ({s.score}/100) · {s.uncoveredStudents} alunos sem vaga segura
                </option>
              ))}
            </select>

            {selectedSource && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="text-slate-600">
                  Comunidade: <strong>{selectedSource.community}</strong> · Rede:{" "}
                  <strong>{selectedSource.network === "ESTADUAL" ? "SEDUC-RO" : "SEMED"}</strong>
                </div>
                <div className="text-red-700 font-semibold">
                  Alunos necessitando de transferência: {selectedSource.uncoveredStudents}
                </div>
              </div>
            )}
          </div>

          {/* Lista de Escolas Anfitriãs Elegíveis */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Escolas Anfitriãs com Capacidade Ociosa em Raio de até 80 km
              </h2>
              <span className="text-xs text-slate-500">
                {candidatesData?.candidates.length ?? 0} candidatas elegíveis
              </span>
            </div>

            {candidatesLoading ? (
              <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                Calculando rotas seguras e vagas ociosas nas proximidades...
              </div>
            ) : !candidatesData?.candidates.length ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Nenhuma escola com vagas ociosas localizada no raio seguro imediato.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">
                      <th scope="col" className="py-2.5 px-3">Escola Anfitriã</th>
                      <th scope="col" className="py-2.5 px-3">Rede</th>
                      <th scope="col" className="py-2.5 px-3">Distância</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Vagas Livres</th>
                      <th scope="col" className="py-2.5 px-3">Critérios de Compatibilidade</th>
                      <th scope="col" className="py-2.5 pr-3 pl-2 text-center w-36">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {candidatesData.candidates.map((cand) => (
                      <tr key={cand.schoolId} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{cand.name}</div>
                          <div className="text-[11px] text-slate-500">{cand.municipality} · {cand.community}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={cn("inline-block rounded px-2 py-0.5 text-[11px] font-semibold border", getNetworkBadge(cand.network).badge)}>
                            {cand.network === "ESTADUAL" ? "SEDUC-RO" : "SEMED"}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-medium text-slate-700">
                          {formatKm(cand.distanceKm)}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-[#1351b4]">
                          {cand.idleSeats} vagas
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-[11px] text-slate-600 line-clamp-1">
                            {cand.fitReasons.join(" · ") || "Ambiente seguro com salas disponíveis"}
                          </div>
                        </td>

                        <td className="py-3 pr-3 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenProposal(cand.schoolId)}
                            className="w-full rounded-md bg-[#1351b4] text-white hover:bg-[#0c326f] px-2.5 py-1.5 font-semibold text-xs transition-colors shadow-2xs"
                          >
                            Propor Termo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4B. Aba: Termos Formalizados */}
      {activeSubTab === "agreements" && (
        <section aria-label="Termos de Acolhimento Formalizados" className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">
              Registro de Termos de Intercooperação Cadastrados
            </h2>
            <span className="text-xs text-slate-500">
              {agreements.length} termo(s) em vigência
            </span>
          </div>

          {agreementsLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
              Carregando termos cadastrados...
            </div>
          ) : agreements.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhum termo formalizado ainda. Use a aba "Encontrar Escola Acolhedora" para registrar um acolhimento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 space-y-3">
              {agreements.map((agreement) => {
                const statusCfg = AGREEMENT_STATUS_CONFIG[agreement.status];

                return (
                  <div key={agreement.id} className="pt-3 first:pt-0 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                            statusCfg.badge,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                          {statusCfg.label}
                        </span>
                        <span className="font-bold text-slate-900">
                          {agreement.studentsCount} estudantes acolhidos
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          ({agreement.shift})
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Início: <strong>{formatDateBr(agreement.startDate)}</strong>
                        {agreement.endDate && (
                          <> · Fim: <strong>{formatDateBr(agreement.endDate)}</strong></>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div>
                        <span className="text-slate-500 block">Origem:</span>
                        <strong className="text-slate-900">{agreement.sourceSchoolName}</strong>
                        <span className="text-slate-500 block">{agreement.sourceMunicipality}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Anfitriã (Abrigo):</span>
                        <strong className="text-[#1351b4]">{agreement.hostSchoolName}</strong>
                        <span className="text-slate-500 block">{agreement.hostMunicipality}</span>
                      </div>
                    </div>

                    <div className="text-slate-600 text-[11px]">
                      <strong>Transporte & Rota:</strong> {agreement.transportPlan}
                    </div>

                    {/* Ações sobre o termo */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {agreement.status === "PROPOSTO" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(agreement.id, "ATIVO")}
                          className="rounded bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 text-xs font-semibold"
                        >
                          Aprovar e Ativar Termo
                        </button>
                      )}
                      {agreement.status === "ATIVO" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(agreement.id, "ENCERRADO")}
                          className="rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1 text-xs font-semibold"
                        >
                          Encerrar Termo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 5. Modal de Formalização de Termo FUIO */}
      {targetHostId && selectedSource && selectedHost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fuio-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 id="fuio-form-title" className="text-base font-bold text-slate-900">
                  Formalizar Termo de Acolhimento Inter-redes
                </h3>
                <p className="text-xs text-slate-500">
                  Instrumento de solidariedade federativa SEDUC-RO ↔ SEMEDs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseProposal}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded bg-red-50 p-3 border border-red-200 text-xs text-red-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitProposal} className="space-y-3 text-xs">
              <div className="rounded bg-slate-50 p-3 border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Escola de Origem:</span>
                  <strong className="text-slate-900">{selectedSource.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Escola Anfitriã:</span>
                  <strong className="text-[#1351b4]">{selectedHost.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Distância / Vagas Livres:</span>
                  <span className="text-slate-800">
                    {formatKm(selectedHost.distanceKm)} · {selectedHost.idleSeats} vagas
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-students-count" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alunos a Transferir:
                  </label>
                  <input
                    id="modal-students-count"
                    type="number"
                    min={1}
                    max={Math.min(selectedSource.uncoveredStudents || 200, selectedHost.idleSeats)}
                    value={studentsCount}
                    onChange={(e) => setStudentsCount(Number(e.target.value))}
                    required
                    className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">
                    Máx: {Math.min(selectedSource.uncoveredStudents || 200, selectedHost.idleSeats)} vagas
                  </span>
                </div>

                <div>
                  <label htmlFor="modal-shift" className="block text-xs font-semibold text-slate-700 mb-1">
                    Turno de Acolhimento:
                  </label>
                  <select
                    id="modal-shift"
                    value={shift}
                    onChange={(e) => setShift(e.target.value as Shift)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                  >
                    <option value="MATUTINO">Matutino</option>
                    <option value="VESPERTINO">Vespertino</option>
                    <option value="INTEGRAL">Integral</option>
                    <option value="NOTURNO">Noturno</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="modal-transport" className="block text-xs font-semibold text-slate-700 mb-1">
                  Plano Logístico de Transporte Assistido:
                </label>
                <textarea
                  id="modal-transport"
                  rows={2}
                  value={transportPlan}
                  onChange={(e) => setTransportPlan(e.target.value)}
                  required
                  placeholder="Descreva a rota segura e o tipo de veículo..."
                  className="w-full rounded border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="modal-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Justificativa Operacional do Termo:
                </label>
                <textarea
                  id="modal-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Justificativa para garantir os 200 dias letivos..."
                  className="w-full rounded border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseProposal}
                  className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-[#1351b4] hover:bg-[#0c326f] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                >
                  {createMutation.isPending ? "Registrando..." : "Registrar Termo FUIO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
