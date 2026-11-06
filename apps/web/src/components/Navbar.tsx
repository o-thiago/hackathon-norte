import React from "react";
import {
  Calendar,
  Handshake,
  Map as MapIcon,
  Search,
  Shield,
} from "lucide-react";
import { useQuarters, type QuarterForecast } from "../lib/api";

interface NavbarProps {
  activeTab: "ranking" | "calendar" | "map" | "fuio";
  onChangeTab: (tab: "ranking" | "calendar" | "map" | "fuio") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const { data: quartersData } = useQuarters();
  const currentQuarter: QuarterForecast | undefined = quartersData?.quarter ?? quartersData?.quarters?.[0];

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-xs">
      {/* 1. Cabeçalho Principal do Sistema */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Marca e Título do Sistema */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1351b4] text-white shadow-xs">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  Sentinela das Águas e Vicinais
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1351b4] border border-blue-200">
                  Rondônia
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Monitoramento Climático e Resiliência Escolar
              </p>
            </div>
          </div>

          {/* Contexto do Trimestre Vigente Censipam */}
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Calendar className="h-4 w-4 text-[#1351b4]" aria-hidden="true" />
            <div>
              <span className="font-bold text-slate-900 block leading-tight">
                Trimestre Vigente
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                Boletim: {currentQuarter?.censipamArticulation.technicalBulletinCode ?? "CENSIPAM-BH-RO-VIGENTE"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Abas de Navegação */}
      <nav id="main-nav" aria-label="Navegação Principal do Sistema" className="border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex space-x-1 sm:space-x-2">
            <button
              type="button"
              onClick={() => onChangeTab("ranking")}
              aria-current={activeTab === "ranking" ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                activeTab === "ranking"
                  ? "border-[#1351b4] text-[#1351b4] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Consultar Escolas (Ranking)</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab("calendar")}
              aria-current={activeTab === "calendar" ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                activeTab === "calendar"
                  ? "border-[#1351b4] text-[#1351b4] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>Trimestre Vigente & Calendário</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab("fuio")}
              aria-current={activeTab === "fuio" ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                activeTab === "fuio"
                  ? "border-[#1351b4] text-[#1351b4] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Handshake className="h-4 w-4" aria-hidden="true" />
              <span>Pacto de Acolhimento (FUIO)</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab("map")}
              aria-current={activeTab === "map" ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                activeTab === "map"
                  ? "border-[#1351b4] text-[#1351b4] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              <span>Mapa Territorial</span>
            </button>
          </div>

          <div className="hidden text-[11px] text-slate-500 xl:block">
            Articulação Interinstitucional: SEDUC-RO · SEMEDs · Censipam
          </div>
        </div>
      </nav>
    </header>
  );
};
