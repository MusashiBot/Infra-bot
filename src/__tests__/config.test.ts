import test from "node:test";
import assert from "node:assert/strict";
import { getDbEnv, getEnv } from "../config.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV };
}

test("getEnv works with only LLM env and defaults", () => {
  resetEnv();
  delete process.env.SUPABASE_DB_HOST;
  delete process.env.SUPABASE_DB_NAME;
  delete process.env.SUPABASE_DB_USER;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.DEEPSEEK_API_KEY = "test-key";

  const env = getEnv();
  assert.equal(env.DEEPSEEK_API_KEY, "test-key");
  assert.equal(env.LLM_PROVIDER, "deepseek");
  assert.equal(env.OUTPUT_DIR, "outputs");
});

test("getDbEnv throws when DB env is missing", () => {
  resetEnv();
  delete process.env.SUPABASE_DB_HOST;
  delete process.env.SUPABASE_DB_NAME;
  delete process.env.SUPABASE_DB_USER;
  delete process.env.SUPABASE_DB_PASSWORD;

  assert.throws(() => getDbEnv(), /Missing database environment/);
});

test("getDbEnv returns required DB fields when present", () => {
  resetEnv();
  process.env.SUPABASE_DB_HOST = "host";
  process.env.SUPABASE_DB_NAME = "postgres";
  process.env.SUPABASE_DB_USER = "user";
  process.env.SUPABASE_DB_PASSWORD = "pass";
  process.env.SUPABASE_DB_PORT = "6543";

  const env = getDbEnv();
  assert.equal(env.SUPABASE_DB_HOST, "host");
  assert.equal(env.SUPABASE_DB_NAME, "postgres");
  assert.equal(env.SUPABASE_DB_USER, "user");
  assert.equal(env.SUPABASE_DB_PASSWORD, "pass");
  assert.equal(env.SUPABASE_DB_PORT, 6543);
});
