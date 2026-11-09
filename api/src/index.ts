import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { client, db } from "./db";
import { scenarios } from "./db/schema";
import { calendarRoutes } from "./routes/calendar";
import { fuioRoutes } from "./routes/fuio";
import { schoolsRoutes } from "./routes/schools";

const allowedOrigins = (
  process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono()
  .use("*", logger())
  .use(
    "/api/*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
          return origin;
        if (allowedOrigins.includes(origin)) return origin;
        return allowedOrigins[0] ?? "*";
      },
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  )
  .get("/api/health", async (c) => {
    await client`select 1`;
    return c.json({
      status: "ok",
      service: "sentinela-api",
      time: new Date().toISOString(),
    });
  })
  .get("/api/scenarios", async (c) => {
    const rows = await db
      .select()
      .from(scenarios)
      .orderBy(asc(scenarios.referenceAt));
    return c.json({ scenarios: rows });
  })
  .route("/api/schools", schoolsRoutes)
  .route("/api/fuio", fuioRoutes)
  .route("/api/calendar", calendarRoutes);

app.notFound((c) => c.json({ error: "Rota não encontrada." }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Erro interno do servidor." }, 500);
});

export type AppType = typeof app;

const port = Number(process.env.PORT ?? 3000);
console.log(`🛰️  Sentinela API ouvindo em http://localhost:${port}`);

export default { port, fetch: app.fetch };
