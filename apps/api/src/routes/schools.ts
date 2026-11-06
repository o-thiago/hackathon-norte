import { validate } from "../lib/validate";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db } from "../db";
import { actionChecklist, schoolDiagnoses, schools } from "../db/schema";
import {
  buildActionPlan,
  findHostCandidates,
  loadSnapshot,
  type RiskLevel,
  type SchoolAssessment,
  type ScenarioSnapshot,
} from "../services/risk";

export const scenarioQuery = z.object({
  scenario: z.string().trim().min(1).max(32).default("inverno"),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const checklistBody = z.object({
  scenario: z.string().trim().min(1).max(32),
  actionKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Chave de ação inválida."),
  completed: z.boolean(),
  completedBy: z.string().trim().min(2).max(120).default("Direção escolar"),
});

export const createSchoolBody = z.object({
  inepCode: z.string().trim().regex(/^\d{8}$/, "Código INEP deve conter exatamente 8 dígitos numéricos."),
  name: z.string().trim().min(3).max(180),
  network: z.enum(["ESTADUAL", "MUNICIPAL"]),
  municipality: z.string().trim().min(2).max(120),
  community: z.string().trim().min(2).max(180),
  lat: z.number().min(-15).max(-7),
  lng: z.number().min(-68).max(-59),
  enrollment: z.number().int().min(1).max(5000),
  capacity: z.number().int().min(1).max(5000),
  declaredIdleSeats: z.number().int().min(0).max(5000).nullable().optional(),
  floors: z.number().int().min(1).max(10).default(1),
  climatized: z.boolean().default(false),
  transportMode: z.enum(["URBANO", "FLUVIAL", "VICINAL", "MISTO"]).default("URBANO"),
  stationId: z.number().int().positive().nullable().optional(),
  floodThresholdCm: z.number().int().positive().nullable().optional(),
  labComputers: z.number().int().min(0).default(0),
  hasServer: z.boolean().default(false),
  archiveBoxes: z.number().int().min(0).default(0),
  groundFloorSubstation: z.boolean().default(false),
  principal: z.string().trim().min(2).max(120).default("Direção Escolar"),
  phone: z.string().trim().min(8).max(20).default("(69) 3216-0000"),
});

export const updateSchoolBody = createSchoolBody.partial();

export const createDiagnosisBody = z.object({
  scenario: z.string().trim().min(1).max(32).default("inverno"),
  title: z.string().trim().min(3).max(200),
  assessmentText: z.string().trim().min(5),
  evaluatorName: z.string().trim().min(2).max(120),
  evaluatorRole: z.string().trim().min(2).max(120),
  status: z.enum(["PENDENTE", "EM_ANALISE", "VISTORIADO", "INTERDITADO"]).default("VISTORIADO"),
  severityLevel: z.enum(["CRITICO", "ALTO", "MODERADO", "BAIXO"]).default("MODERADO"),
  operationalRecommendation: z.string().trim().min(3),
});

export function summarizeSchool(a: SchoolAssessment) {
  const { school } = a;
  return {
    id: school.id,
    inepCode: school.inepCode,
    name: school.name,
    network: school.network,
    municipality: school.municipality,
    community: school.community,
    lat: school.lat,
    lng: school.lng,
    enrollment: school.enrollment,
    capacity: school.capacity,
    declaredIdleSeats: school.declaredIdleSeats,
    climatized: school.climatized,
    transportMode: school.transportMode,
    level: a.level,
    score: a.score,
    primaryHazard: a.primaryHazard,
    hazards: a.hazards,
    idleSeats: a.idleSeats,
    committedIncoming: a.committedIncoming,
    committedOutgoing: a.committedOutgoing,
  };
}

export function findAssessment(snapshot: ScenarioSnapshot, schoolId: number): SchoolAssessment {
  const assessment = snapshot.assessments.find((a) => a.school.id === schoolId);
  if (!assessment) throw new HTTPException(404, { message: `Escola ${schoolId} não encontrada.` });
  return assessment;
}

/** Single source of truth for a school's plan so GET and checklist validation agree. */
export function planFor(snapshot: ScenarioSnapshot, schoolId: number) {
  const assessment = findAssessment(snapshot, schoolId);
  const atRisk = assessment.level === "ALTO" || assessment.level === "CRITICO";
  const candidates = atRisk ? findHostCandidates(snapshot, schoolId) : [];
  return { assessment, candidates, plan: buildActionPlan(assessment, candidates[0] ?? null) };
}

export const schoolsRoutes = new Hono()
  /** All schools with their consolidated risk for the scenario. */
  .get("/", validate("query", scenarioQuery), async (c) => {
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const order: Record<RiskLevel, number> = { CRITICO: 0, ALTO: 1, MODERADO: 2, BAIXO: 3 };
    const items = snapshot.assessments
      .map(summarizeSchool)
      .sort((a, b) => order[a.level] - order[b.level] || b.score - a.score || a.name.localeCompare(b.name, "pt-BR"));
    return c.json({ scenario: snapshot.scenario, schools: items });
  })

  /** Map layers: stations, hotspots, routes and schools, plus headline stats. */
  .get("/overview", validate("query", scenarioQuery), async (c) => {
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);

    const routes = snapshot.assessments.flatMap((a) =>
      a.routes.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        schoolId: r.schoolId,
        schoolName: a.school.name,
        mode: r.mode,
        vehicle: r.vehicle,
        studentsServed: r.studentsServed,
        lengthKm: r.lengthKm,
        path: r.path,
        status: r.status,
        cause: r.cause,
        reason: r.reason,
        rainfall72hMm: r.rainfall72hMm,
      })),
    );

    const byLevel: Record<RiskLevel, number> = { BAIXO: 0, MODERADO: 0, ALTO: 0, CRITICO: 0 };
    let studentsAtRisk = 0;
    for (const a of snapshot.assessments) {
      byLevel[a.level] += 1;
      if (a.level === "ALTO" || a.level === "CRITICO") studentsAtRisk += a.school.enrollment;
    }

    return c.json({
      scenario: snapshot.scenario,
      stations: snapshot.stations.map(({ history, ...station }) => ({
        ...station,
        history: history.slice(-7),
      })),
      hotspots: snapshot.hotspots,
      routes,
      schools: snapshot.assessments.map(summarizeSchool),
      stats: {
        byLevel,
        studentsAtRisk,
        totalStudents: snapshot.assessments.reduce((sum, a) => sum + a.school.enrollment, 0),
        routesBlocked: routes.filter((r) => r.status === "INTRAFEGAVEL").length,
        routesCritical: routes.filter((r) => r.status === "CRITICA").length,
        studentsOnBlockedRoutes: routes
          .filter((r) => r.status === "INTRAFEGAVEL" || r.status === "CRITICA")
          .reduce((sum, r) => sum + r.studentsServed, 0),
        hotspots72h: snapshot.hotspots.length,
        stationsInFlood: snapshot.stations.filter((s) => s.status === "INUNDACAO" || s.status === "INUNDACAO_SEVERA").length,
        stationsInDrought: snapshot.stations.filter((s) => s.status === "ESTIAGEM" || s.status === "ESTIAGEM_SEVERA").length,
      },
    });
  })

  /** Full school dossier: telemetry, route verdicts, action plan with completion and FUIO hosts. */
  .get("/:id", validate("param", idParam), validate("query", scenarioQuery), async (c) => {
    const { id } = c.req.valid("param");
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const { assessment, candidates, plan } = planFor(snapshot, id);

    const completions = await db
      .select()
      .from(actionChecklist)
      .where(and(eq(actionChecklist.scenarioKey, scenario), eq(actionChecklist.schoolId, id)));
    const completionByKey = new Map(completions.map((entry) => [entry.actionKey, entry]));

    const actions = plan.map((action) => {
      const done = completionByKey.get(action.key);
      return {
        ...action,
        completed: Boolean(done),
        completedAt: done?.completedAt ?? null,
        completedBy: done?.completedBy ?? null,
      };
    });

    const outgoing = snapshot.agreements.filter((a) => a.sourceSchoolId === id || a.hostSchoolId === id);
    const nameById = new Map(snapshot.assessments.map((a) => [a.school.id, a.school.name]));

    const diagnoses = await db
      .select()
      .from(schoolDiagnoses)
      .where(and(eq(schoolDiagnoses.schoolId, id), eq(schoolDiagnoses.scenarioKey, scenario)))
      .orderBy(desc(schoolDiagnoses.evaluatedAt));

    return c.json({
      scenario: snapshot.scenario,
      school: assessment.school,
      summary: summarizeSchool(assessment),
      station: assessment.station,
      routes: assessment.routes,
      flood: assessment.flood,
      air: {
        pm25: assessment.pm25,
        pm25Indoor: assessment.pm25Indoor,
        history: assessment.pm25History,
        hotspotsNearby: assessment.hotspotsNearby,
        nearestHotspotKm: assessment.nearestHotspotKm,
      },
      actions,
      diagnoses,
      candidates: candidates.slice(0, 5),
      agreements: outgoing.map((a) => ({
        ...a,
        sourceSchoolName: nameById.get(a.sourceSchoolId) ?? "—",
        hostSchoolName: nameById.get(a.hostSchoolId) ?? "—",
      })),
    });
  })

  /** Register a new school in the FUIO pact. */
  .post("/", validate("json", createSchoolBody), async (c) => {
    const body = c.req.valid("json");
    const [existing] = await db
      .select({ id: schools.id })
      .from(schools)
      .where(eq(schools.inepCode, body.inepCode))
      .limit(1);
    if (existing) {
      throw new HTTPException(409, {
        message: `Já existe uma escola cadastrada com o código INEP ${body.inepCode}.`,
      });
    }

    const [created] = await db
      .insert(schools)
      .values({
        inepCode: body.inepCode,
        name: body.name,
        network: body.network,
        municipality: body.municipality,
        community: body.community,
        lat: body.lat,
        lng: body.lng,
        enrollment: body.enrollment,
        capacity: body.capacity,
        declaredIdleSeats: body.declaredIdleSeats ?? null,
        floors: body.floors,
        climatized: body.climatized,
        transportMode: body.transportMode,
        stationId: body.stationId ?? null,
        floodThresholdCm: body.floodThresholdCm ?? null,
        labComputers: body.labComputers,
        hasServer: body.hasServer,
        archiveBoxes: body.archiveBoxes,
        groundFloorSubstation: body.groundFloorSubstation,
        principal: body.principal,
        phone: body.phone,
      })
      .returning();

    return c.json({ ok: true, school: created }, 201);
  })

  /** Update an existing school's metadata and self-declared capacity. */
  .patch("/:id", validate("param", idParam), validate("json", updateSchoolBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const [existing] = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    if (!existing) {
      throw new HTTPException(404, { message: `Escola ${id} não encontrada.` });
    }

    if (body.inepCode && body.inepCode !== existing.inepCode) {
      const [conflict] = await db
        .select({ id: schools.id })
        .from(schools)
        .where(eq(schools.inepCode, body.inepCode))
        .limit(1);
      if (conflict) {
        throw new HTTPException(409, { message: `Código INEP ${body.inepCode} já está em uso.` });
      }
    }

    const [updated] = await db
      .update(schools)
      .set({
        ...body,
      })
      .where(eq(schools.id, id))
      .returning();

    return c.json({ ok: true, school: updated });
  })

  /** List situational diagnoses for a school. */
  .get("/:id/diagnoses", validate("param", idParam), validate("query", scenarioQuery), async (c) => {
    const { id } = c.req.valid("param");
    const { scenario } = c.req.valid("query");

    const rows = await db
      .select()
      .from(schoolDiagnoses)
      .where(and(eq(schoolDiagnoses.schoolId, id), eq(schoolDiagnoses.scenarioKey, scenario)))
      .orderBy(desc(schoolDiagnoses.evaluatedAt));

    return c.json({ diagnoses: rows });
  })

  /** Register a new situational diagnosis for a school. */
  .post("/:id/diagnoses", validate("param", idParam), validate("json", createDiagnosisBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const [school] = await db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(eq(schools.id, id))
      .limit(1);
    if (!school) {
      throw new HTTPException(404, { message: `Escola ${id} não encontrada.` });
    }

    const [diagnosis] = await db
      .insert(schoolDiagnoses)
      .values({
        schoolId: id,
        scenarioKey: body.scenario,
        title: body.title,
        assessmentText: body.assessmentText,
        evaluatorName: body.evaluatorName,
        evaluatorRole: body.evaluatorRole,
        status: body.status,
        severityLevel: body.severityLevel,
        operationalRecommendation: body.operationalRecommendation,
      })
      .returning();

    return c.json({ ok: true, diagnosis }, 201);
  })

  /** Toggle an action-plan item as done / pending. */
  .post("/:id/checklist", validate("param", idParam), validate("json", checklistBody), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const snapshot = await loadSnapshot(body.scenario);
    const validKeys = new Set(planFor(snapshot, id).plan.map((a) => a.key));
    if (!validKeys.has(body.actionKey)) {
      throw new HTTPException(422, { message: "Ação não pertence ao plano vigente desta escola." });
    }

    if (body.completed) {
      const [entry] = await db
        .insert(actionChecklist)
        .values({
          scenarioKey: body.scenario,
          schoolId: id,
          actionKey: body.actionKey,
          completedBy: body.completedBy,
        })
        .onConflictDoUpdate({
          target: [actionChecklist.scenarioKey, actionChecklist.schoolId, actionChecklist.actionKey],
          set: { completedBy: body.completedBy, completedAt: new Date() },
        })
        .returning();
      return c.json({ ok: true, entry });
    }

    await db
      .delete(actionChecklist)
      .where(
        and(
          eq(actionChecklist.scenarioKey, body.scenario),
          eq(actionChecklist.schoolId, id),
          eq(actionChecklist.actionKey, body.actionKey),
        ),
      );
    return c.json({ ok: true, entry: null });
  });
