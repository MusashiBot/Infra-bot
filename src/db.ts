import postgres from "postgres";
import { getEnv } from "./config.js";

const env = getEnv();

export const sql = postgres({
  host: env.SUPABASE_DB_HOST,
  port: env.SUPABASE_DB_PORT,
  database: env.SUPABASE_DB_NAME,
  username: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  ssl: "require",
  max: 1,
});

export async function closeDb(): Promise<void> {
  await sql.end();
}
