import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "./components/Navbar";
import { RiskRanking } from "./pages/RiskRanking";
import { QuarterlyCalendar } from "./pages/QuarterlyCalendar";
import { Dashboard } from "./pages/Dashboard";
import { FuioInitiative } from "./pages/FuioInitiative";
import { type ScenarioKey } from "./lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "ranking" | "calendar" | "map" | "fuio"
  >("ranking");

  const currentScenario: ScenarioKey = "inverno";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Accessible skip link for keyboard & screen reader navigation (Padrão GOV.BR) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[#1351b4] focus:px-4 focus:py-2 focus:text-white focus:shadow-md"
      >
        Pular para o conteúdo principal
      </a>

      {/* Top Navigation Bar */}
      <Navbar activeTab={activeTab} onChangeTab={(t) => setActiveTab(t)} />

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pb-16 outline-none"
      >
        {activeTab === "ranking" && (
          <RiskRanking
            scenarioKey={currentScenario}
            onNavigateToCalendar={() => setActiveTab("calendar")}
          />
        )}

        {activeTab === "calendar" && (
          <QuarterlyCalendar
            onNavigateToRanking={() => setActiveTab("ranking")}
          />
        )}

        {activeTab === "fuio" && (
          <FuioInitiative
            scenario={currentScenario}
            onNavigateToRanking={() => setActiveTab("ranking")}
          />
        )}

        {activeTab === "map" && (
          <Dashboard
            scenario={currentScenario}
            onNavigateToRanking={() => setActiveTab("ranking")}
          />
        )}
      </main>

      {/* Rodapé do Sistema */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Sentinela das Águas e Vicinais
            </span>
            <span>·</span>
            <span className="text-slate-600">
              Iniciativa FUIO · SEDUC-RO & Censipam
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>SipamHidro · Painel do Fogo</span>
            <span>·</span>
            <span>Monitoramento de Resiliência Escolar em Rondônia</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
