import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// ponytail: max 1 per serverless instance; Neon pooled endpoint does the real pooling
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: process.env.VERCEL ? 1 : 10,
});

export const db = drizzle(pool, { schema });
