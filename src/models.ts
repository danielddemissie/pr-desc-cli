export const SUPPORTED_MODELS = {
  groq: {
    default: "llama-3.1-8b-instant",
    options: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
  },
  deepinfra: {
    default: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    options: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1-Turbo",
    ],
  },
  local: {
    default: "llama3.1",
    options: ["llama3.3", "llama3.1", "codellama", "deepseek-r1"],
  },
} as const;

export function getDefaultModel(provider: string): string {
  const providerModels =
    SUPPORTED_MODELS[provider as keyof typeof SUPPORTED_MODELS];
  if (!providerModels) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return providerModels.default;
}

export function getSupportedModels(provider: string): string[] {
  const providerModels =
    SUPPORTED_MODELS[provider as keyof typeof SUPPORTED_MODELS];
  if (!providerModels) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return providerModels.options.slice();
}
