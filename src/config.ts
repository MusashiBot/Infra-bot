import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_DB_HOST: z.string().min(1),
  SUPABASE_DB_PORT: z.coerce.number().int().positive().default(6543),
  SUPABASE_DB_NAME: z.string().min(1),
  SUPABASE_DB_USER: z.string().min(1),
  SUPABASE_DB_PASSWORD: z.string().min(1),
  OUTPUT_DIR: z.string().default("outputs"),
  REPORT_MARKET_LIMIT: z.coerce.number().int().positive().default(25),
  CASE_STUDY_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
});

export type BotEnv = z.infer<typeof EnvSchema>;

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
