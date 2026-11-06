import { validate } from "../lib/validate";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db } from "../db";
import { fuioAgreements, schools, type FuioAgreement } from "../db/schema";
import { FUIO_MAX_DISTANCE_KM, findHostCandidates, loadSnapshot, type ScenarioSnapshot } from "../services/risk";
import { findAssessment, scenarioQuery, summarizeSchool } from "./schools";

const TIME_ZONE = "America/Porto_Velho";
const COMMITTED_STATUSES = ["ATIVO", "PROPOSTO"] as const;

const schoolIdParam = z.object({ schoolId: z.coerce.number().int().positive() });
const agreementIdParam = z.object({ id: z.coerce.number().int().positive() });

const createAgreementBody = z
  .object({
    scenario: z.string().trim().min(1).max(32),
    sourceSchoolId: z.number().int().positive(),
    hostSchoolId: z.number().int().positive(),
    studentsCount: z.number().int().min(1).max(2000),
    shift: z.enum(["MATUTINO", "VESPERTINO", "NOTURNO", "INTEGRAL"]),
    transportPlan: z.string().trim().min(5).max(500),
    reason: z.string().trim().min(5).max(500),
    startDate: z.iso.date().optional(),
  })
  .refine((body) => body.sourceSchoolId !== body.hostSchoolId, {
    message: "A escola anfitriã deve ser diferente da escola de origem.",
    path: ["hostSchoolId"],
  });

const updateAgreementBody = z.object({
  status: z.enum(["ATIVO", "ENCERRADO", "CANCELADO"]),
});

const ALLOWED_TRANSITIONS: Record<FuioAgreement["status"], FuioAgreement["status"][]> = {
  PROPOSTO: ["ATIVO", "CANCELADO"],
  ATIVO: ["ENCERRADO"],
  ENCERRADO: [],
  CANCELADO: [],
};

function toLocalDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** Weekdays (Mon–Fri) from start (inclusive) to end (inclusive), as a proxy for school days. */
function schoolDaysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  if (end < start) return 0;
  let days = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

function decorateAgreements(snapshot: ScenarioSnapshot) {
  const byId = new Map(snapshot.assessments.map((a) => [a.school.id, a.school]));
  const refDate = toLocalDate(snapshot.scenario.referenceAt);
  return snapshot.agreements.map((agreement) => {
    const source = byId.get(agreement.sourceSchoolId);
    const host = byId.get(agreement.hostSchoolId);
    const preserving = agreement.status === "ATIVO" || agreement.status === "ENCERRADO";
    const days = preserving ? schoolDaysBetween(agreement.startDate, agreement.endDate ?? refDate) : 0;
    return {
      ...agreement,
      sourceSchoolName: source?.name ?? "—",
      sourceNetwork: source?.network ?? null,
      sourceMunicipality: source?.municipality ?? "—",
      hostSchoolName: host?.name ?? "—",
      hostNetwork: host?.network ?? null,
      hostMunicipality: host?.municipality ?? "—",
      crossNetwork: Boolean(source && host && source.network !== host.network),
      schoolDays: days,
      studentDaysPreserved: days * agreement.studentsCount,
    };
  });
}

export const fuioRoutes = new Hono()
  /** Headline indicators of the inter-school cooperation pact. */
  .get("/summary", validate("query", scenarioQuery), async (c) => {
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const agreements = decorateAgreements(snapshot);
    const atRisk = snapshot.assessments.filter((a) => a.level === "ALTO" || a.level === "CRITICO");
    const safe = snapshot.assessments.filter((a) => a.level === "BAIXO" || a.level === "MODERADO");
    const active = agreements.filter((a) => a.status === "ATIVO");
    const proposed = agreements.filter((a) => a.status === "PROPOSTO");

    const studentsAtRisk = atRisk.reduce((sum, a) => sum + a.school.enrollment, 0);
    const studentsCovered = atRisk.reduce((sum, a) => sum + Math.min(a.school.enrollment, a.committedOutgoing), 0);

    return c.json({
      scenario: snapshot.scenario,
      schoolsAtRisk: atRisk.length,
      studentsAtRisk,
      studentsCovered,
      coveragePct: studentsAtRisk ? Math.round((studentsCovered / studentsAtRisk) * 100) : 100,
      studentsSheltered: active.reduce((sum, a) => sum + a.studentsCount, 0),
      studentsProposed: proposed.reduce((sum, a) => sum + a.studentsCount, 0),
      hostSchoolsAvailable: safe.filter((a) => a.idleSeats > 0).length,
      idleSeatsNetwork: safe.reduce((sum, a) => sum + a.idleSeats, 0),
      agreementsByStatus: {
        PROPOSTO: proposed.length,
        ATIVO: active.length,
        ENCERRADO: agreements.filter((a) => a.status === "ENCERRADO").length,
        CANCELADO: agreements.filter((a) => a.status === "CANCELADO").length,
      },
      crossNetworkAgreements: agreements.filter((a) => a.crossNetwork && a.status !== "CANCELADO").length,
      studentDaysPreserved: agreements.reduce((sum, a) => sum + a.studentDaysPreserved, 0),
      maxDistanceKm: FUIO_MAX_DISTANCE_KM,
    });
  })

  /** Schools at ALTO/CRITICO risk and how many of their students still lack a host seat. */
  .get("/at-risk", validate("query", scenarioQuery), async (c) => {
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const items = snapshot.assessments
      .filter((a) => a.level === "ALTO" || a.level === "CRITICO")
      .sort((a, b) => b.score - a.score)
      .map((a) => ({
        ...summarizeSchool(a),
        uncoveredStudents: Math.max(0, a.school.enrollment - a.committedOutgoing),
        hostOptions: findHostCandidates(snapshot, a.school.id).length,
      }));
    return c.json({ scenario: snapshot.scenario, schools: items });
  })

  /** Ranked host schools for a given source school. */
  .get("/candidates/:schoolId", validate("param", schoolIdParam), validate("query", scenarioQuery), async (c) => {
    const { schoolId } = c.req.valid("param");
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const source = findAssessment(snapshot, schoolId);
    return c.json({
      scenario: snapshot.scenario,
      source: {
        ...summarizeSchool(source),
        uncoveredStudents: Math.max(0, source.school.enrollment - source.committedOutgoing),
      },
      candidates: findHostCandidates(snapshot, schoolId),
    });
  })

  .get("/agreements", validate("query", scenarioQuery), async (c) => {
    const { scenario } = c.req.valid("query");
    const snapshot = await loadSnapshot(scenario);
    const items = decorateAgreements(snapshot).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return c.json({ scenario: snapshot.scenario, agreements: items });
  })

  /** Propose a temporary transfer. Seats are reserved immediately (PROPOSTO counts against capacity). */
  .post("/agreements", validate("json", createAgreementBody), async (c) => {
    const body = c.req.valid("json");
    const snapshot = await loadSnapshot(body.scenario);
    const source = findAssessment(snapshot, body.sourceSchoolId);
    if (source.level !== "ALTO" && source.level !== "CRITICO") {
      throw new HTTPException(422, { message: "Somente escolas em risco ALTO ou CRÍTICO podem acionar a FUIO." });
    }
    const candidate = findHostCandidates(snapshot, body.sourceSchoolId).find((h) => h.schoolId === body.hostSchoolId);
    if (!candidate) {
      throw new HTTPException(422, {
        message: `Escola anfitriã inelegível: precisa estar em risco baixo/moderado, ter vagas e distar até ${FUIO_MAX_DISTANCE_KM} km.`,
      });
    }

    const startDate = body.startDate ?? toLocalDate(snapshot.scenario.referenceAt);

    const created = await db.transaction(async (tx) => {
      // Serialize concurrent proposals touching the same schools (ascending order avoids deadlocks).
      for (const lockId of [body.sourceSchoolId, body.hostSchoolId].sort((a, b) => a - b)) {
        await tx.execute(sql`select pg_advisory_xact_lock(7101, ${lockId})`);
      }

      const [host] = await tx
        .select({ capacity: schools.capacity, enrollment: schools.enrollment })
        .from(schools)
        .where(eq(schools.id, body.hostSchoolId));
      const [sourceRow] = await tx
        .select({ enrollment: schools.enrollment })
        .from(schools)
        .where(eq(schools.id, body.sourceSchoolId));
      if (!host || !sourceRow) throw new HTTPException(404, { message: "Escola não encontrada." });

      const [incoming] = await tx
        .select({ total: sql<number>`coalesce(sum(${fuioAgreements.studentsCount}), 0)::int` })
        .from(fuioAgreements)
        .where(
          and(
            eq(fuioAgreements.scenarioKey, body.scenario),
            eq(fuioAgreements.hostSchoolId, body.hostSchoolId),
            inArray(fuioAgreements.status, [...COMMITTED_STATUSES]),
          ),
        );
      const [outgoing] = await tx
        .select({ total: sql<number>`coalesce(sum(${fuioAgreements.studentsCount}), 0)::int` })
        .from(fuioAgreements)
        .where(
          and(
            eq(fuioAgreements.scenarioKey, body.scenario),
            eq(fuioAgreements.sourceSchoolId, body.sourceSchoolId),
            inArray(fuioAgreements.status, [...COMMITTED_STATUSES]),
          ),
        );

      const idleSeats = host.capacity - host.enrollment - (incoming?.total ?? 0);
      const uncovered = sourceRow.enrollment - (outgoing?.total ?? 0);
      if (body.studentsCount > idleSeats) {
        throw new HTTPException(409, { message: `A anfitriã dispõe de apenas ${Math.max(0, idleSeats)} vagas.` });
      }
      if (body.studentsCount > uncovered) {
        throw new HTTPException(409, { message: `Restam apenas ${Math.max(0, uncovered)} alunos sem vaga na escola de origem.` });
      }

      const [row] = await tx
        .insert(fuioAgreements)
        .values({
          scenarioKey: body.scenario,
          sourceSchoolId: body.sourceSchoolId,
          hostSchoolId: body.hostSchoolId,
          studentsCount: body.studentsCount,
          shift: body.shift,
          transportPlan: body.transportPlan,
          reason: body.reason,
          status: "PROPOSTO",
          startDate,
        })
        .returning();
      return row;
    });

    return c.json({ agreement: created }, 201);
  })

  /** Advance the agreement lifecycle: PROPOSTO → ATIVO/CANCELADO, ATIVO → ENCERRADO. */
  .patch("/agreements/:id", validate("param", agreementIdParam), validate("json", updateAgreementBody), async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const [current] = await db.select().from(fuioAgreements).where(eq(fuioAgreements.id, id));
    if (!current) throw new HTTPException(404, { message: "Termo de intercooperação não encontrado." });
    if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
      throw new HTTPException(409, { message: `Transição ${current.status} → ${status} não permitida.` });
    }

    const snapshot = await loadSnapshot(current.scenarioKey);
    const refDate = toLocalDate(snapshot.scenario.referenceAt);
    const [updated] = await db
      .update(fuioAgreements)
      .set({
        status,
        endDate: status === "ENCERRADO" || status === "CANCELADO" ? refDate : current.endDate,
      })
      .where(and(eq(fuioAgreements.id, id), eq(fuioAgreements.status, current.status)))
      .returning();
    if (!updated) throw new HTTPException(409, { message: "O termo foi alterado por outro usuário. Recarregue." });
    return c.json({ agreement: updated });
  });
