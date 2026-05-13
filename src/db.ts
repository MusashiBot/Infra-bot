import postgres, { type Sql } from "postgres";
import { getDbEnv } from "./config.js";

let sqlInstance: Sql | null = null;

export function getSql(): Sql {
  if (sqlInstance) {
    return sqlInstance;
  }

  const env = getDbEnv();
  sqlInstance = postgres({
    host: env.SUPABASE_DB_HOST,
    port: env.SUPABASE_DB_PORT,
    database: env.SUPABASE_DB_NAME,
    username: env.SUPABASE_DB_USER,
    password: env.SUPABASE_DB_PASSWORD,
    ssl: "require",
    max: 1,
  });

  return sqlInstance;
}

export async function closeDb(): Promise<void> {
  if (!sqlInstance) {
    return;
  }

  await sqlInstance.end();
  sqlInstance = null;
}
