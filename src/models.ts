import { createOpenAI } from "@ai-sdk/openai";
import { getApiKey } from "./config.js";
import type { SupportedProviders } from "./types.js";

export const SUPPORTED_MODELS = {
  groq: {
    default: "llama-3.3-70b-versatile",
    options: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "qwen/qwen3-32b",
      "gemma2-9b-it",
      "deepseek-r1-distill-llama-70b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "compound-beta-mini",
      "compound-beta",
    ],
  },
  local: {
    default: "llama3.1:8b",
    options: [
      "llama3.1:8b",
      "llama3.1:70b",
      "codegemma:2b",
      "phi3:3.8b-mini-4k-instruct",
      "qwen2-coder:32b",
      "mixtral:8x22b",
      "gemma2:27b",
      "deepseek-coder:33b",
      "deepseek-r1:8b",
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

async function getModelsListByProviders(
  url: string,
  headers: Headers
): Promise<string[]> {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data.map((model: { id: string }) => model.id);
  } catch (error) {
    console.error("Error fetching models:", error);
    return []; // fallback on failure
  }
}

async function checkAndFilterModels(
  provider: string,
  options: string[]
): Promise<string[]> {
  const providersConfig: SupportedProviders = {
    groq: {
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: getApiKey("groq"),
    },
    local: {
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    },
  };

  const providerConfig =
    providersConfig[provider as keyof typeof providersConfig];

  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (provider === "local") {
    return options;
  }

  const { baseURL, apiKey } = providerConfig;
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  });

  const availableModels = await getModelsListByProviders(
    `${baseURL}/models`,
    headers
  );

  return options.filter((model) => availableModels.includes(model));
}

// Get the AI model for the specified provider and model name.
export async function getAIModel(provider: string, modelName?: string) {
  const supportedProviders: SupportedProviders = {
    groq: {
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: getApiKey("groq"),
    },
    local: {
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    },
  };

  if (!supportedProviders[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // Dynamically check and filter the supported models list
  const availableOptions = await checkAndFilterModels(
    provider,
    getSupportedModels(provider)
  );

  const defaultModel = getDefaultModel(provider);
  const finalModel =
    modelName && availableOptions.includes(modelName)
      ? modelName
      : defaultModel;

  // Final check to ensure the chosen model is available
  if (!availableOptions.includes(finalModel)) {
    throw new Error(
      `Selected model "${finalModel}" is not available for provider "${provider}". Please choose from: ${availableOptions.join(
        ", "
      )}`
    );
  }

  const { baseURL, apiKey } = supportedProviders[provider];
  return createOpenAI({
    baseURL,
    apiKey,
  })(finalModel);
}
