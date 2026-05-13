import { getEnv } from "./config.js";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface DeepSeekChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function generateStructuredNarrative(args: {
  system: string;
  user: string;
}): Promise<string> {
  const env = getEnv();
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.user },
  ];

  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      temperature: 0.2,
      max_tokens: 1800,
      messages,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek request failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as DeepSeekChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned no content");
  }

  return content;
}
