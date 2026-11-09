import React, { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Building, Droplets, Flame, Info, Truck, Waves } from "lucide-react";
import type {
  Hotspot,
  OverviewRoute,
  SchoolSummary,
  Station,
} from "../lib/api";
import {
  HAZARD_CONFIG,
  RISK_LEVEL_CONFIG,
  ROUTE_STATUS_CONFIG,
  cn,
  formatCmMetersOnly,
  formatDateTimeBr,
  formatMm,
} from "../lib/utils";

// Helper component to center and zoom map when a school is selected
const MapController: React.FC<{
  selectedSchool: SchoolSummary | null;
}> = ({ selectedSchool }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after layout settles so tiles never render blank or misaligned
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    if (
      selectedSchool &&
      typeof selectedSchool.lat === "number" &&
      typeof selectedSchool.lng === "number" &&
      !isNaN(selectedSchool.lat) &&
      !isNaN(selectedSchool.lng)
    ) {
      map.flyTo([selectedSchool.lat, selectedSchool.lng], 12, {
        duration: 1.2,
      });
    }
  }, [selectedSchool, map]);

  return null;
};

interface RouteRiskMapProps {
  schools: SchoolSummary[];
  stations: Station[];
  hotspots: Hotspot[];
  routes: OverviewRoute[];
  selectedSchoolId: number | null;
  onSelectSchool: (id: number) => void;
}

export const RouteRiskMap: React.FC<RouteRiskMapProps> = ({
  schools,
  stations,
  hotspots,
  routes,
  selectedSchoolId,
  onSelectSchool,
}) => {
  // Layer visibility toggles
  const [showSchools, setShowSchools] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showFluvialRoutes, setShowFluvialRoutes] = useState(true);
  const [showVicinalRoutes, setShowVicinalRoutes] = useState(true);

  const selectedSchool = useMemo(
    () => schools.find((s) => s.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId],
  );

  // Center of Rondônia state
  const centerLat = -9.6;
  const centerLng = -63.4;

  // Custom DivIcon generator for Schools in Light Mode
  const getSchoolIcon = (school: SchoolSummary, isSelected: boolean) => {
    const isCritical = school.level === "CRITICO";
    const isHigh = school.level === "ALTO";

    let bgClass = "bg-slate-600 border-white text-white";
    if (school.level === "CRITICO")
      bgClass = "bg-red-600 border-white text-white";
    else if (school.level === "ALTO")
      bgClass = "bg-amber-600 border-white text-white";
    else if (school.level === "MODERADO")
      bgClass = "bg-emerald-600 border-white text-white";
    else if (school.level === "BAIXO")
      bgClass = "bg-cyan-700 border-white text-white";

    const pulseHtml = isCritical
      ? `<div class="marker-pulse-critical"></div>`
      : isHigh
        ? `<div class="marker-pulse-alert"></div>`
        : "";

    const size = isSelected ? 34 : 26;

    const html = `
      <div class="relative flex items-center justify-center w-full h-full">
        ${pulseHtml}
        <div class="relative z-10 flex items-center justify-center rounded-full border-2 ${bgClass} shadow-md transition-transform ${
          isSelected ? "scale-125 ring-4 ring-cyan-600" : "hover:scale-110"
        }" style="width: ${size}px; height: ${size}px;">
          <span style="font-size: ${isSelected ? 13 : 10}px; font-weight: bold;">
            ${school.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: "custom-school-marker",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  // Custom DivIcon for Hydrological Stations in Light Mode
  const getStationIcon = (station: Station) => {
    const isFlood =
      station.status === "INUNDACAO" || station.status === "INUNDACAO_SEVERA";
    const isDrought =
      station.status === "ESTIAGEM" || station.status === "ESTIAGEM_SEVERA";

    const bg = isFlood ? "#b91c1c" : isDrought ? "#c2410c" : "#0284c7";

    const html = `
      <div class="flex items-center justify-center" style="width: 22px; height: 22px; background: ${bg}; border: 2px solid white; border-radius: 4px; transform: rotate(45deg); box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
        <div style="transform: rotate(-45deg); color: white; font-size: 10px; font-weight: bold;">≈</div>
      </div>
    `;

    return L.divIcon({
      className: "custom-station-marker",
      html,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    });
  };

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
      {/* Map Layer Controls Bar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 rounded-lg bg-white/95 p-1.5 border border-slate-200 shadow-md backdrop-blur-xs text-[11px]">
        <span className="px-2 font-bold text-slate-700">Camadas:</span>

        {/* Schools Toggle */}
        <button
          type="button"
          onClick={() => setShowSchools(!showSchools)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
            showSchools
              ? "bg-cyan-700 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Building className="h-3 w-3" />
          <span>Escolas ({schools.length})</span>
        </button>

        {/* Stations Toggle */}
        <button
          type="button"
          onClick={() => setShowStations(!showStations)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
            showStations
              ? "bg-blue-700 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Droplets className="h-3 w-3" />
          <span>SipamHidro ({stations.length})</span>
        </button>

        {/* Hotspots Toggle */}
        <button
          type="button"
          onClick={() => setShowHotspots(!showHotspots)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
            showHotspots
              ? "bg-orange-600 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Flame className="h-3 w-3" />
          <span>Queimadas ({hotspots.length})</span>
        </button>

        {/* Fluvial Routes */}
        <button
          type="button"
          onClick={() => setShowFluvialRoutes(!showFluvialRoutes)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
            showFluvialRoutes
              ? "bg-sky-700 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Waves className="h-3 w-3" />
          <span>Rotas Fluviais</span>
        </button>

        {/* Vicinal Routes */}
        <button
          type="button"
          onClick={() => setShowVicinalRoutes(!showVicinalRoutes)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all",
            showVicinalRoutes
              ? "bg-amber-700 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          <Truck className="h-3 w-3" />
          <span>Vicinais (Linhas)</span>
        </button>
      </div>

      {/* Map Legend in White Mode */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/95 p-3 border border-slate-200 shadow-md backdrop-blur-xs text-[11px] space-y-1.5 hidden sm:block">
        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
          <Info className="h-3.5 w-3.5 text-cyan-700" />
          <span>Legenda do Mapa:</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="h-3 w-3 rounded-full bg-red-600"></span>
          <span>Risco Crítico (Cota de Inundação / Atoleiro Grave)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="h-3 w-3 rounded-full bg-amber-600"></span>
          <span>Risco Alto (Atenção Severa)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="h-3 w-3 rounded-full bg-cyan-700"></span>
          <span>Risco Baixo (Escola Segura / Acolhedora FUIO)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="h-3 w-3 rounded-xs bg-blue-600 transform rotate-45"></span>
          <span>Estação Fluviométrica (SipamHidro)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="h-3 w-3 rounded-full bg-orange-600"></span>
          <span>Foco Ativo de Calor Orbital (NOAA-20/VIIRS)</span>
        </div>
      </div>

      {/* Leaflet Map Container */}
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={7}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <MapController selectedSchool={selectedSchool} />

        {/* Standard OpenStreetMap Natural Light Raster Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Sentinela RO'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* 1. Transport Route Polylines */}
        {routes.map((route) => {
          if (route.mode === "FLUVIAL" && !showFluvialRoutes) return null;
          if (route.mode === "VICINAL" && !showVicinalRoutes) return null;
          if (
            !route.path ||
            !Array.isArray(route.path) ||
            route.path.length < 2
          )
            return null;

          const statusCfg = ROUTE_STATUS_CONFIG[route.status];
          const isSelectedSchoolRoute = selectedSchoolId === route.schoolId;

          return (
            <Polyline
              key={route.id}
              positions={route.path}
              pathOptions={{
                color: statusCfg.stroke,
                weight: isSelectedSchoolRoute ? 5 : 3.5,
                opacity: isSelectedSchoolRoute ? 0.95 : 0.8,
                dashArray:
                  route.status === "INTRAFEGAVEL"
                    ? "6, 8"
                    : route.status === "CRITICA"
                      ? "4, 4"
                      : undefined,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {route.mode === "FLUVIAL" ? (
                      <Waves className="h-3.5 w-3.5 text-cyan-700" />
                    ) : (
                      <Truck className="h-3.5 w-3.5 text-amber-700" />
                    )}
                    <span>
                      {route.code}: {route.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700">
                    Escola atendida: <strong>{route.schoolName}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span>{route.vehicle}</span>
                    <span>·</span>
                    <span>{route.studentsServed} alunos</span>
                    <span>·</span>
                    <span>{route.lengthKm} km</span>
                  </div>
                  {route.rainfall72hMm !== null && (
                    <div className="text-[11px] text-amber-900 font-bold">
                      Chuva acumulada 72h:{" "}
                      <strong>{formatMm(route.rainfall72hMm)}</strong>
                    </div>
                  )}
                  <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-800 border border-slate-200 mt-1">
                    <strong className={statusCfg.color}>
                      [{statusCfg.label}]
                    </strong>{" "}
                    {route.reason}
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* 2. Hydrological Stations (SipamHidro) */}
        {showStations &&
          stations
            .filter(
              (st) =>
                typeof st.lat === "number" &&
                typeof st.lng === "number" &&
                !isNaN(st.lat) &&
                !isNaN(st.lng),
            )
            .map((st) => (
              <Marker
                key={st.id}
                position={[st.lat, st.lng]}
                icon={getStationIcon(st)}
              >
                <Popup>
                  <div className="text-xs space-y-1 min-w-[210px]">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <strong className="text-cyan-900 font-bold text-sm">
                        {st.name}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {st.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Rio: <strong>{st.river}</strong> ({st.municipality})
                    </div>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-xl font-bold text-slate-900">
                        {formatCmMetersOnly(st.latestLevelCm)}
                      </span>
                      <span className="text-[11px] text-slate-700 font-semibold">
                        (
                        {st.trendCmPerDay > 0
                          ? `+${st.trendCmPerDay}`
                          : st.trendCmPerDay}{" "}
                        cm/dia)
                      </span>
                    </div>
                    <div className="rounded bg-slate-50 p-2 text-[11px] space-y-0.5 border border-slate-200 mt-1">
                      <div className="flex justify-between">
                        <span className="text-red-800">Cota Inundação:</span>
                        <strong className="text-red-900">
                          {formatCmMetersOnly(st.floodLevelCm)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-800">Cota Alerta:</span>
                        <strong className="text-amber-900">
                          {formatCmMetersOnly(st.alertLevelCm)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-orange-800">Cota Estiagem:</span>
                        <strong className="text-orange-900">
                          {formatCmMetersOnly(st.droughtLevelCm)}
                        </strong>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 italic pt-0.5">
                      Telemetria oficial SipamHidro · Censipam
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

        {/* 3. Wildfire Hotspots (Painel do Fogo) */}
        {showHotspots &&
          hotspots
            .filter(
              (spot) =>
                typeof spot.lat === "number" &&
                typeof spot.lng === "number" &&
                !isNaN(spot.lat) &&
                !isNaN(spot.lng),
            )
            .map((spot) => (
              <CircleMarker
                key={spot.id}
                center={[spot.lat, spot.lng]}
                radius={spot.frpMw > 50 ? 7 : 5}
                pathOptions={{
                  color: "#c2410c",
                  fillColor: "#ea580c",
                  fillOpacity: 0.8,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1 font-bold text-orange-900">
                      <Flame className="h-3.5 w-3.5 text-orange-600" />
                      <span>Foco de Calor Orbital</span>
                    </div>
                    <div className="text-[11px] text-slate-800">
                      Satélite: <strong>{spot.satellite}</strong>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Potência Radiativa (FRP): <strong>{spot.frpMw} MW</strong>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      Confiabilidade: <strong>{spot.confidencePct}%</strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Detectado em: {formatDateTimeBr(spot.detectedAt)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

        {/* 4. Schools Markers */}
        {showSchools &&
          schools
            .filter(
              (school) =>
                typeof school.lat === "number" &&
                typeof school.lng === "number" &&
                !isNaN(school.lat) &&
                !isNaN(school.lng),
            )
            .map((school) => {
              const isSelected = selectedSchoolId === school.id;
              const riskCfg = RISK_LEVEL_CONFIG[school.level];
              const hazard = school.primaryHazard
                ? HAZARD_CONFIG[school.primaryHazard]
                : null;

              return (
                <Marker
                  key={school.id}
                  position={[school.lat, school.lng]}
                  icon={getSchoolIcon(school, isSelected)}
                  eventHandlers={{
                    click: () => onSelectSchool(school.id),
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1.5 min-w-[220px]">
                      <div className="flex items-start justify-between gap-1 border-b border-slate-200 pb-1">
                        <strong className="text-slate-900 font-bold text-sm leading-snug">
                          {school.name}
                        </strong>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span>{school.municipality}</span>
                        <span>·</span>
                        <span>{school.community}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            riskCfg.bg,
                            riskCfg.text,
                            riskCfg.border,
                          )}
                        >
                          Risco {riskCfg.label} ({school.score}/100)
                        </span>
                        <span className="text-slate-700 font-semibold">
                          {school.enrollment} alunos
                        </span>
                      </div>

                      {hazard && (
                        <div className="text-[11px] text-slate-700 pt-1">
                          Ameaça:{" "}
                          <strong className="text-slate-900">
                            {hazard.label}
                          </strong>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectSchool(school.id)}
                        className="mt-2 w-full rounded-md bg-[#1351b4] hover:bg-[#0c326f] py-1.5 text-center text-xs font-semibold text-white transition-colors shadow-2xs"
                      >
                        Ver Detalhes da Escola
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
      </MapContainer>
    </div>
  );
};
