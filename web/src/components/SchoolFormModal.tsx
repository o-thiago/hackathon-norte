import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  HelpCircle,
  Save,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import {
  useCreateSchool,
  useUpdateSchool,
  type CreateSchoolInput,
  type ScenarioKey,
  type School,
  type SchoolNetwork,
  type TransportMode,
  type UpdateSchoolInput,
} from "../lib/api";

interface SchoolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSchool?: School | null;
  scenarioKey: ScenarioKey;
}

const RONDONIA_MUNICIPALITIES = [
  "Porto Velho",
  "Cacoal",
  "Guajará-Mirim",
  "Candeias do Jamari",
  "Ji-Paraná",
  "Ariquemes",
  "Vilhena",
  "Jaru",
  "Rolim de Moura",
  "Pimenta Bueno",
];

export const SchoolFormModal: React.FC<SchoolFormModalProps> = ({
  isOpen,
  onClose,
  initialSchool,
  scenarioKey,
}) => {
  const isEdit = Boolean(initialSchool);

  // Form State
  const [inepCode, setInepCode] = useState("");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<SchoolNetwork>("ESTADUAL");
  const [municipality, setMunicipality] = useState("Porto Velho");
  const [community, setCommunity] = useState("");
  const [lat, setLat] = useState<string>("-8.7619");
  const [lng, setLng] = useState<string>("-63.9039");
  const [enrollment, setEnrollment] = useState<string>("350");
  const [capacity, setCapacity] = useState<string>("450");
  const [declaredIdleSeats, setDeclaredIdleSeats] = useState<string>("");
  const [floors, setFloors] = useState<string>("1");
  const [climatized, setClimatized] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>("URBANO");
  const [principal, setPrincipal] = useState("");
  const [phone, setPhone] = useState("");

  // Asset protection state
  const [labComputers, setLabComputers] = useState<string>("20");
  const [hasServer, setHasServer] = useState(true);
  const [archiveBoxes, setArchiveBoxes] = useState<string>("40");
  const [groundFloorSubstation, setGroundFloorSubstation] = useState(false);
  const [floodThresholdCm, setFloodThresholdCm] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useCreateSchool(scenarioKey);
  const updateMutation = useUpdateSchool(initialSchool?.id, scenarioKey);

  // Populate form when initialSchool changes
  useEffect(() => {
    if (initialSchool) {
      setInepCode(initialSchool.inepCode);
      setName(initialSchool.name);
      setNetwork(initialSchool.network);
      setMunicipality(initialSchool.municipality);
      setCommunity(initialSchool.community);
      setLat(String(initialSchool.lat));
      setLng(String(initialSchool.lng));
      setEnrollment(String(initialSchool.enrollment));
      setCapacity(String(initialSchool.capacity));
      setDeclaredIdleSeats(
        initialSchool.declaredIdleSeats !== null &&
          initialSchool.declaredIdleSeats !== undefined
          ? String(initialSchool.declaredIdleSeats)
          : "",
      );
      setFloors(String(initialSchool.floors));
      setClimatized(initialSchool.climatized);
      setTransportMode(initialSchool.transportMode);
      setPrincipal(initialSchool.principal);
      setPhone(initialSchool.phone);
      setLabComputers(String(initialSchool.labComputers));
      setHasServer(initialSchool.hasServer);
      setArchiveBoxes(String(initialSchool.archiveBoxes));
      setGroundFloorSubstation(initialSchool.groundFloorSubstation);
      setFloodThresholdCm(
        initialSchool.floodThresholdCm !== null &&
          initialSchool.floodThresholdCm !== undefined
          ? String(initialSchool.floodThresholdCm)
          : "",
      );
    } else {
      // Defaults for new school
      setInepCode("");
      setName("");
      setNetwork("ESTADUAL");
      setMunicipality("Porto Velho");
      setCommunity("");
      setLat("-8.7619");
      setLng("-63.9039");
      setEnrollment("350");
      setCapacity("450");
      setDeclaredIdleSeats("");
      setFloors("1");
      setClimatized(false);
      setTransportMode("URBANO");
      setPrincipal("Direção Escolar");
      setPhone("(69) 3216-0000");
      setLabComputers("20");
      setHasServer(true);
      setArchiveBoxes("30");
      setGroundFloorSubstation(false);
      setFloodThresholdCm("");
    }
    setErrorMessage(null);
  }, [initialSchool, isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validation
    const cleanInep = inepCode.trim();
    if (!/^\d{8}$/.test(cleanInep)) {
      setErrorMessage(
        "O código INEP deve possuir exatamente 8 dígitos numéricos (Censo Escolar).",
      );
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Por favor, preencha o nome da unidade escolar.");
      return;
    }

    if (!community.trim()) {
      setErrorMessage(
        "Por favor, informe a comunidade, bairro ou linha vicinal de localização.",
      );
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setErrorMessage("Coordenadas geográficas inválidas.");
      return;
    }

    const parsedEnrollment = parseInt(enrollment, 10);
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedEnrollment) || parsedEnrollment <= 0) {
      setErrorMessage("A matrícula escolar deve ser um número maior que zero.");
      return;
    }
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      setErrorMessage("A capacidade física deve ser um número maior que zero.");
      return;
    }

    const parsedDeclaredIdle =
      declaredIdleSeats.trim() !== "" ? parseInt(declaredIdleSeats, 10) : null;
    if (
      parsedDeclaredIdle !== null &&
      (isNaN(parsedDeclaredIdle) || parsedDeclaredIdle < 0)
    ) {
      setErrorMessage("Vagas ociosas declaradas não podem ser negativas.");
      return;
    }

    const parsedFloors = parseInt(floors, 10) || 1;
    const parsedLabComputers = parseInt(labComputers, 10) || 0;
    const parsedArchiveBoxes = parseInt(archiveBoxes, 10) || 0;
    const parsedThreshold =
      floodThresholdCm.trim() !== "" ? parseInt(floodThresholdCm, 10) : null;

    try {
      if (isEdit && initialSchool) {
        const updatePayload: UpdateSchoolInput = {
          inepCode: cleanInep,
          name: name.trim(),
          network,
          municipality: municipality.trim(),
          community: community.trim(),
          lat: parsedLat,
          lng: parsedLng,
          enrollment: parsedEnrollment,
          capacity: parsedCapacity,
          declaredIdleSeats: parsedDeclaredIdle,
          floors: parsedFloors,
          climatized,
          transportMode,
          principal: principal.trim() || "Direção Escolar",
          phone: phone.trim() || "(69) 3216-0000",
          labComputers: parsedLabComputers,
          hasServer,
          archiveBoxes: parsedArchiveBoxes,
          groundFloorSubstation,
          floodThresholdCm: parsedThreshold,
        };
        await updateMutation.mutateAsync({
          id: initialSchool.id,
          data: updatePayload,
        });
      } else {
        const createPayload: CreateSchoolInput = {
          inepCode: cleanInep,
          name: name.trim(),
          network,
          municipality: municipality.trim(),
          community: community.trim(),
          lat: parsedLat,
          lng: parsedLng,
          enrollment: parsedEnrollment,
          capacity: parsedCapacity,
          declaredIdleSeats: parsedDeclaredIdle,
          floors: parsedFloors,
          climatized,
          transportMode,
          principal: principal.trim() || "Direção Escolar",
          phone: phone.trim() || "(69) 3216-0000",
          labComputers: parsedLabComputers,
          hasServer,
          archiveBoxes: parsedArchiveBoxes,
          groundFloorSubstation,
          floodThresholdCm: parsedThreshold,
        };
        await createMutation.mutateAsync(createPayload);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro ao salvar dados da escola.");
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-form-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div>
            <h2
              id="school-form-modal-title"
              className="text-base font-bold text-slate-900 sm:text-lg flex items-center gap-2"
            >
              <Building2
                className="h-5 w-5 text-[#1351b4]"
                aria-hidden="true"
              />
              <span>
                {isEdit
                  ? "Editar Metadados e Vagas da Escola"
                  : "Cadastrar Nova Escola no Pacto FUIO"}
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {isEdit
                ? "Atualize a capacidade ociosa declarada pela direção e as características de infraestrutura da unidade."
                : "Registro de unidade escolar da rede SEDUC-RO ou SEMED no sistema integrado de resiliência e acolhimento."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção ao preenchimento:</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Seção 1: Identificação Institucional */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[#1351b4]" />
              Identificação Geral & Localização
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Código INEP */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-inep"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Código INEP (8 dígitos){" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="school-inep"
                  type="text"
                  maxLength={8}
                  value={inepCode}
                  onChange={(e) =>
                    setInepCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Ex: 11002484"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                  required
                />
              </div>

              {/* Rede de Ensino */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-network"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rede de Ensino <span className="text-red-600">*</span>
                </label>
                <select
                  id="school-network"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as SchoolNetwork)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                >
                  <option value="ESTADUAL">Estadual (SEDUC-RO)</option>
                  <option value="MUNICIPAL">Municipal (SEMED)</option>
                </select>
              </div>

              {/* Município */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-municipality"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Município <span className="text-red-600">*</span>
                </label>
                <select
                  id="school-municipality"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                >
                  {RONDONIA_MUNICIPALITIES.map((mun) => (
                    <option key={mun} value={mun}>
                      {mun}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nome da Escola */}
              <div className="md:col-span-7">
                <label
                  htmlFor="school-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome da Escola <span className="text-red-600">*</span>
                </label>
                <input
                  id="school-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: EEEFM Aluízio Ferreira"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                  required
                />
              </div>

              {/* Comunidade / Bairro / Linha */}
              <div className="md:col-span-5">
                <label
                  htmlFor="school-community"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Comunidade / Bairro / Linha{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="school-community"
                  type="text"
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  placeholder="Ex: Distrito de São Carlos ou Bairro Liberdade"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                  required
                />
              </div>

              {/* Coordenadas */}
              <div className="md:col-span-6">
                <label
                  htmlFor="school-lat"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Latitude (ex: -8.7619)
                </label>
                <input
                  id="school-lat"
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                />
              </div>

              <div className="md:col-span-6">
                <label
                  htmlFor="school-lng"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Longitude (ex: -63.9039)
                </label>
                <input
                  id="school-lng"
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Capacidade & Gestão das Vagas Declaradas (Pacto FUIO) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#1351b4]" />
              Capacidade Escolar & Vagas Declaradas para o Pacto FUIO
            </h3>

            {/* Caixa Informativa sobre Autodeclaração */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950 flex items-start gap-2.5">
              <HelpCircle className="h-4 w-4 text-[#1351b4] shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">
                  Declaração de Capacidade Ociosa pela Gestão Escolar:
                </strong>
                <p className="text-[11px] text-blue-900/90 mt-0.5 leading-relaxed">
                  Para evitar estimativas artificiais, a própria direção escolar
                  autodeclara a quantidade de vagas disponíveis em suas salas
                  para abrigar temporariamente turmas de escolas atingidas por
                  cheias ou fumaça.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Matrícula */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-enrollment"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Total de Estudantes Matriculados{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="school-enrollment"
                  type="number"
                  min={1}
                  value={enrollment}
                  onChange={(e) => setEnrollment(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                  required
                />
              </div>

              {/* Capacidade Física */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-capacity"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Capacidade Física Total do Prédio{" "}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="school-capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                  required
                />
              </div>

              {/* Vagas Ociosas Declaradas (FUIO) */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-declared-idle"
                  className="block text-xs font-bold text-[#1351b4] mb-1"
                >
                  Vagas Ociosas Declaradas (FUIO)
                </label>
                <input
                  id="school-declared-idle"
                  type="number"
                  min={0}
                  value={declaredIdleSeats}
                  onChange={(e) => setDeclaredIdleSeats(e.target.value)}
                  placeholder="Ex: 80 (vazio = automático)"
                  className="w-full rounded-md border-2 border-blue-400 bg-blue-50/30 py-2 px-3 text-xs font-semibold text-slate-900 focus:border-[#1351b4] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1351b4]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Deixe vazio para o cálculo (Capacidade - Matrícula)
                </span>
              </div>

              {/* Pavimentos */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-floors"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Número de Pavimentos / Andares
                </label>
                <select
                  id="school-floors"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                >
                  <option value="1">
                    1 (Térrea - Alerta Máximo para Inundações)
                  </option>
                  <option value="2">2 (Sobrado / Térreo + 1º Pavimento)</option>
                  <option value="3">3 (3 Pavimentos)</option>
                </select>
              </div>

              {/* Modal de Transporte */}
              <div className="md:col-span-4">
                <label
                  htmlFor="school-transport"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Modal de Transporte Predominante
                </label>
                <select
                  id="school-transport"
                  value={transportMode}
                  onChange={(e) =>
                    setTransportMode(e.target.value as TransportMode)
                  }
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                >
                  <option value="URBANO">
                    Urbano (Ônibus e Acesso Pavimentado)
                  </option>
                  <option value="FLUVIAL">
                    Fluvial (Barcos, Voadeiras e Linhas Fluviais)
                  </option>
                  <option value="VICINAL">
                    Vicinal (Estradas Rurais de Terra / Linhas)
                  </option>
                  <option value="MISTO">
                    Misto (Fluvial e Vicinal Integrados)
                  </option>
                </select>
              </div>

              {/* Ar-condicionado / Climatizada */}
              <div className="md:col-span-4 flex items-center pt-5">
                <label className="relative flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={climatized}
                    onChange={(e) => setClimatized(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1351b4] focus:ring-[#1351b4]"
                  />
                  <span>Salas 100% Climatizadas</span>
                </label>
              </div>
            </div>
          </div>

          {/* Seção 3: Gestão & Contato */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#1351b4]" />
              Contato da Direção Escolar
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <label
                  htmlFor="school-principal"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do(a) Diretor(a) / Gestor(a)
                </label>
                <input
                  id="school-principal"
                  type="text"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="Ex: Prof. Carlos Eduardo Souza"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div className="md:col-span-6">
                <label
                  htmlFor="school-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Telefone Institucional / WhatsApp de Emergência
                </label>
                <input
                  id="school-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (69) 99201-1122"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Proteção Patrimonial & Riscos Críticos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[#1351b4]" />
              Proteção Patrimonial e Vulnerabilidade Estrutural
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label
                  htmlFor="school-computers"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Qtd. Computadores (Lab TI)
                </label>
                <input
                  id="school-computers"
                  type="number"
                  min={0}
                  value={labComputers}
                  onChange={(e) => setLabComputers(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="school-archive"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Caixas de Arquivo Escolar
                </label>
                <input
                  id="school-archive"
                  type="number"
                  min={0}
                  value={archiveBoxes}
                  onChange={(e) => setArchiveBoxes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="school-threshold"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Cota Soleira Inundação (cm)
                </label>
                <input
                  id="school-threshold"
                  type="number"
                  value={floodThresholdCm}
                  onChange={(e) => setFloodThresholdCm(e.target.value)}
                  placeholder="Ex: 1720"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-[#1351b4] focus:outline-none"
                />
              </div>

              <div className="md:col-span-3 space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={hasServer}
                    onChange={(e) => setHasServer(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1351b4] focus:ring-[#1351b4]"
                  />
                  <span>Possui Servidor Local</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-red-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={groundFloorSubstation}
                    onChange={(e) => setGroundFloorSubstation(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                  />
                  <span>Subestação Elétrica Térrea</span>
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#1351b4] bg-[#1351b4] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0c326f] shadow-xs transition-colors focus:ring-2 focus:ring-[#1351b4] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando dados...</span>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isEdit ? "Salvar Alterações" : "Cadastrar Escola no FUIO"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
