import { createOpenAI } from "@ai-sdk/openai";
import { getApiKey } from "./config.js";
import type { SupportedProviders } from "./types.js";

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

// Get the AI model for the specified provider and model name.
export function getAIModel(provider: string, modelName?: string) {
  const defaultModel = getDefaultModel(provider);
  const supportedProviders: SupportedProviders = {
    groq: {
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: getApiKey("groq"),
    },
    deepInfra: {
      baseURL: "https://api.deepinfra.com/v1/openai",
      apiKey: getApiKey("deepinfra"),
    },
    local: {
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    },
  };

  if (!supportedProviders[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const { baseURL, apiKey } = supportedProviders[provider];
  return createOpenAI({
    baseURL,
    apiKey,
  })(modelName || defaultModel);
}
