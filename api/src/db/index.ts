import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5432/hackathon_db";

export const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

export const client = postgres(databaseUrl, {
  max: 10,
  onnotice: () => undefined,
});

export const db = drizzle({ client, schema });

export type Database = typeof db;
export { schema };
