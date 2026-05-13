import { getEnv } from "../config.js";
import type { GenerateJsonArgs, LlmProvider } from "./providers/base.js";
import { DeepSeekProvider } from "./providers/deepseek.js";

function createProvider(): LlmProvider {
  const env = getEnv();
  switch (env.LLM_PROVIDER) {
    case "deepseek":
      return new DeepSeekProvider();
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`);
  }
}

export async function generateStructuredNarrative(
  args: GenerateJsonArgs,
): Promise<string> {
  return createProvider().generateJson(args);
}
