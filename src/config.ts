import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { maskApiKey } from "./utils.js";

const CONFIG_DIR = join(homedir(), ".pr-desc");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Config {
  defaultProvider?: string;
  defaultTemplate?: string;
  defaultBaseBranch?: string;
  apiKeys?: {
    groq?: string;
  };
}

export function loadConfig(unmask?: boolean): Config {
  let userConfig: Config = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const configContent = readFileSync(CONFIG_FILE, "utf-8");
      userConfig = JSON.parse(configContent);
    } catch (error) {
      console.warn("Warning: Could not parse config file");
    }
  }

  if (userConfig.apiKeys && !unmask) {
    userConfig.apiKeys = Object.fromEntries(
      Object.entries(userConfig.apiKeys).map(([key, value]) => [
        key,
        maskApiKey(value),
      ])
    );
  }
  return userConfig;
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiKey(provider: string): string | undefined {
  const config = loadConfig(true);

  switch (provider) {
    case "groq":
      return config.apiKeys?.groq;
    default:
      return undefined;
  }
}

export function setApiKey(provider: string, apiKey: string): void {
  const config = loadConfig();

  if (!config.apiKeys) {
    config.apiKeys = {};
  }

  config.apiKeys[provider as keyof typeof config.apiKeys] = apiKey;
  saveConfig(config);

  console.log(`✅ API key for ${provider} saved to global config`);
}
