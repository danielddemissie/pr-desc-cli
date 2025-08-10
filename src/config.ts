import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config } from "dotenv";

const CONFIG_DIR = join(homedir(), ".pr-desc");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const ENV_FILE = join(CONFIG_DIR, ".env");

export interface Config {
  defaultProvider?: string;
  defaultTemplate?: string;
  defaultBaseBranch?: string;
  apiKeys?: {
    groq?: string;
    deepinfra?: string;
  };
}

export function loadConfig(): Config {
  // global config
  if (existsSync(ENV_FILE)) {
    config({ path: ENV_FILE });
  }

  config();

  let userConfig: Config = {};

  if (existsSync(CONFIG_FILE)) {
    try {
      const configContent = readFileSync(CONFIG_FILE, "utf-8");
      userConfig = JSON.parse(configContent);
    } catch (error) {
      console.warn("Warning: Could not parse config file");
    }
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
  const config = loadConfig();

  switch (provider) {
    case "groq":
      return process.env.GROQ_API_KEY || config.apiKeys?.groq;
    case "deepinfra":
      return process.env.DEEPINFRA_API_KEY || config.apiKeys?.deepinfra;
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
