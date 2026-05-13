import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_DB_HOST: z.string().min(1).optional(),
  SUPABASE_DB_PORT: z.coerce.number().int().positive().default(6543),
  SUPABASE_DB_NAME: z.string().min(1).optional(),
  SUPABASE_DB_USER: z.string().min(1).optional(),
  SUPABASE_DB_PASSWORD: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  LLM_PROVIDER: z.enum(["deepseek"]).default("deepseek"),
  OUTPUT_DIR: z.string().default("outputs"),
  REPORT_MARKET_LIMIT: z.coerce.number().int().positive().default(25),
  CASE_STUDY_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
});

export type BotEnv = z.infer<typeof EnvSchema>;
export interface DbEnv {
  SUPABASE_DB_HOST: string;
  SUPABASE_DB_PORT: number;
  SUPABASE_DB_NAME: string;
  SUPABASE_DB_USER: string;
  SUPABASE_DB_PASSWORD: string;
}

export function getEnv(): BotEnv {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
        .join(", ")}`,
    );
  }

  return parsed.data;
}

export function getDbEnv(): DbEnv {
  const env = getEnv();

  if (
    !env.SUPABASE_DB_HOST ||
    !env.SUPABASE_DB_NAME ||
    !env.SUPABASE_DB_USER ||
    !env.SUPABASE_DB_PASSWORD
  ) {
    throw new Error(
      "Missing database environment. Required: SUPABASE_DB_HOST, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD",
    );
  }

  return {
    SUPABASE_DB_HOST: env.SUPABASE_DB_HOST,
    SUPABASE_DB_PORT: env.SUPABASE_DB_PORT,
    SUPABASE_DB_NAME: env.SUPABASE_DB_NAME,
    SUPABASE_DB_USER: env.SUPABASE_DB_USER,
    SUPABASE_DB_PASSWORD: env.SUPABASE_DB_PASSWORD,
  };
}
