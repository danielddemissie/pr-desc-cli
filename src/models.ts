import { createOpenAI } from "@ai-sdk/openai";
import { getApiKey } from "./config.js";
import type { SupportedProviders } from "./types.js";

export const SUPPORTED_MODELS = {
  groq: {
    default: "claude-3.5-sonnet",
    options: [
      "claude-3.5-sonnet",
      "llama-3.1-70b-versatile",
      "llama-3.3-70b-versatile",
      "mixtral-8x22b-instruct",
      "gemma2-27b-it",
      "deepseek-v3",
    ],
  },
  deepinfra: {
    default: "anthropic/claude-3-5-sonnet",
    options: [
      "anthropic/claude-3-5-sonnet",
      "openai/gpt-4o",
      "anthropic/claude-3-opus",
      "meta-llama/Llama-3.3-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "mistralai/Mixtral-8x22B-Instruct-v0.1",
      "deepseek-ai/DeepSeek-V3",
      "openai/gpt-4-turbo",
    ],
  },
  local: {
    default: "llama3.1:70b",
    options: [
      "llama3.1:70b",
      "codegemma:2b", // An excellent, lightweight option for fast PR descriptions
      "phi3:3.8b-mini-4k-instruct",
      "qwen2-coder:32b",
      "mixtral:8x22b",
      "gemma2:27b",
      "deepseek-coder:33b",
      "llama3.3:70b",
      "codellama:70b",
    ],
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
