import { defineConfig } from "drizzle-kit";
// Relative, not "@/lib/env": drizzle-kit does not resolve the tsconfig path alias.
import { env } from "./lib/env";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
});
