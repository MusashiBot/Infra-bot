export interface GenerateJsonArgs {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmProvider {
  generateJson(args: GenerateJsonArgs): Promise<string>;
}
