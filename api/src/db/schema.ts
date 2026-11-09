import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const seasonEnum = pgEnum("season", ["INVERNO", "VERAO"]);
export const schoolNetworkEnum = pgEnum("school_network", [
  "ESTADUAL",
  "MUNICIPAL",
]);
export const transportModeEnum = pgEnum("transport_mode", [
  "URBANO",
  "FLUVIAL",
  "VICINAL",
  "MISTO",
]);
export const routeModeEnum = pgEnum("route_mode", ["FLUVIAL", "VICINAL"]);
export const agreementStatusEnum = pgEnum("agreement_status", [
  "PROPOSTO",
  "ATIVO",
  "ENCERRADO",
  "CANCELADO",
]);
export const shiftEnum = pgEnum("school_shift", [
  "MATUTINO",
  "VESPERTINO",
  "NOTURNO",
  "INTEGRAL",
]);
export const diagnosisStatusEnum = pgEnum("diagnosis_status", [
  "PENDENTE",
  "EM_ANALISE",
  "VISTORIADO",
  "INTERDITADO",
]);

/* ------------------------------------------------------------------ */
/* Scenarios — "as-of" replay snapshots of the seeded telemetry        */
/* ------------------------------------------------------------------ */

export const scenarios = pgTable("scenarios", {
  key: varchar("key", { length: 32 }).primaryKey(),
  label: text("label").notNull(),
  season: seasonEnum("season").notNull(),
  referenceAt: timestamp("reference_at", { withTimezone: true }).notNull(),
  description: text("description").notNull(),
});

/* ------------------------------------------------------------------ */
/* Hydrological telemetry (SipamHidro mock)                            */
/* ------------------------------------------------------------------ */

export const hydroStations = pgTable("hydro_stations", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  river: text("river").notNull(),
  municipality: text("municipality").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  /** All quotas in centimetres relative to the gauge zero. */
  alertLevelCm: integer("alert_level_cm").notNull(),
  floodLevelCm: integer("flood_level_cm").notNull(),
  severeFloodLevelCm: integer("severe_flood_level_cm").notNull(),
  droughtLevelCm: integer("drought_level_cm").notNull(),
  severeDroughtLevelCm: integer("severe_drought_level_cm").notNull(),
});

export const hydroReadings = pgTable(
  "hydro_readings",
  {
    id: serial("id").primaryKey(),
    stationId: integer("station_id")
      .notNull()
      .references(() => hydroStations.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    levelCm: integer("level_cm").notNull(),
  },
  (t) => [
    uniqueIndex("hydro_readings_station_time_idx").on(
      t.stationId,
      t.measuredAt,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Schools                                                             */
/* ------------------------------------------------------------------ */

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  inepCode: varchar("inep_code", { length: 8 }).notNull().unique(),
  name: text("name").notNull(),
  network: schoolNetworkEnum("network").notNull(),
  municipality: text("municipality").notNull(),
  community: text("community").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  enrollment: integer("enrollment").notNull(),
  capacity: integer("capacity").notNull(),
  declaredIdleSeats: integer("declared_idle_seats"),
  floors: integer("floors").notNull(),
  climatized: boolean("climatized").notNull(),
  transportMode: transportModeEnum("transport_mode").notNull(),
  stationId: integer("station_id").references(() => hydroStations.id, {
    onDelete: "set null",
  }),
  /** Gauge level (cm) at the reference station at which the school ground floor floods. */
  floodThresholdCm: integer("flood_threshold_cm"),
  labComputers: integer("lab_computers").notNull(),
  hasServer: boolean("has_server").notNull(),
  archiveBoxes: integer("archive_boxes").notNull(),
  groundFloorSubstation: boolean("ground_floor_substation").notNull(),
  principal: text("principal").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Transport routes (fluvial and vicinal)                              */
/* ------------------------------------------------------------------ */

export type LatLngTuple = [number, number];

export const transportRoutes = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  name: text("name").notNull(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  mode: routeModeEnum("mode").notNull(),
  stationId: integer("station_id").references(() => hydroStations.id, {
    onDelete: "set null",
  }),
  vehicle: text("vehicle").notNull(),
  studentsServed: integer("students_served").notNull(),
  lengthKm: doublePrecision("length_km").notNull(),
  path: jsonb("path").$type<LatLngTuple[]>().notNull(),
});

/** Rain gauge accumulation along vicinal routes. */
export const routeConditions = pgTable(
  "route_conditions",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => transportRoutes.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    rainfall72hMm: doublePrecision("rainfall_72h_mm").notNull(),
  },
  (t) => [
    uniqueIndex("route_conditions_route_time_idx").on(t.routeId, t.measuredAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Wildfire & air quality (Painel do Fogo mock)                        */
/* ------------------------------------------------------------------ */

export const fireHotspots = pgTable(
  "fire_hotspots",
  {
    id: serial("id").primaryKey(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    satellite: text("satellite").notNull(),
    frpMw: doublePrecision("frp_mw").notNull(),
    confidencePct: integer("confidence_pct").notNull(),
  },
  (t) => [index("fire_hotspots_detected_idx").on(t.detectedAt)],
);

export const airQualityReadings = pgTable(
  "air_quality_readings",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    pm25: doublePrecision("pm25").notNull(),
  },
  (t) => [
    uniqueIndex("air_quality_school_time_idx").on(t.schoolId, t.measuredAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Iniciativa FUIO                                                     */
/* ------------------------------------------------------------------ */

export const fuioAgreements = pgTable(
  "fuio_agreements",
  {
    id: serial("id").primaryKey(),
    scenarioKey: varchar("scenario_key", { length: 32 })
      .notNull()
      .references(() => scenarios.key, { onDelete: "cascade" }),
    sourceSchoolId: integer("source_school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    hostSchoolId: integer("host_school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentsCount: integer("students_count").notNull(),
    shift: shiftEnum("shift").notNull(),
    transportPlan: text("transport_plan").notNull(),
    reason: text("reason").notNull(),
    status: agreementStatusEnum("status").notNull().default("PROPOSTO"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("fuio_agreements_scenario_idx").on(t.scenarioKey)],
);

/** Completion log for the automated action plan, per school and scenario. */
export const actionChecklist = pgTable(
  "action_checklist",
  {
    id: serial("id").primaryKey(),
    scenarioKey: varchar("scenario_key", { length: 32 })
      .notNull()
      .references(() => scenarios.key, { onDelete: "cascade" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    actionKey: varchar("action_key", { length: 64 }).notNull(),
    completedBy: text("completed_by").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("action_checklist_unique_idx").on(
      t.scenarioKey,
      t.schoolId,
      t.actionKey,
    ),
  ],
);

/** Registered situational & technical diagnoses for schools. */
export const schoolDiagnoses = pgTable(
  "school_diagnoses",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    scenarioKey: varchar("scenario_key", { length: 32 })
      .notNull()
      .references(() => scenarios.key, { onDelete: "cascade" }),
    title: text("title").notNull(),
    assessmentText: text("assessment_text").notNull(),
    evaluatorName: text("evaluator_name").notNull(),
    evaluatorRole: text("evaluator_role").notNull(),
    status: diagnosisStatusEnum("status").notNull().default("VISTORIADO"),
    severityLevel: text("severity_level").notNull(),
    operationalRecommendation: text("operational_recommendation").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("school_diagnoses_school_scenario_idx").on(t.schoolId, t.scenarioKey),
  ],
);

export type Scenario = typeof scenarios.$inferSelect;
export type HydroStation = typeof hydroStations.$inferSelect;
export type HydroReading = typeof hydroReadings.$inferSelect;
export type School = typeof schools.$inferSelect;
export type TransportRoute = typeof transportRoutes.$inferSelect;
export type RouteCondition = typeof routeConditions.$inferSelect;
export type FireHotspot = typeof fireHotspots.$inferSelect;
export type AirQualityReading = typeof airQualityReadings.$inferSelect;
export type FuioAgreement = typeof fuioAgreements.$inferSelect;
export type ActionChecklistEntry = typeof actionChecklist.$inferSelect;
export type SchoolDiagnosis = typeof schoolDiagnoses.$inferSelect;
