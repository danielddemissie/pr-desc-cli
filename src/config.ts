import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { Config, ReviewConfig, ReviewProfile } from "./types.js";

const CONFIG_DIR = join(homedir(), ".pr-desc");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const API_KEYS_FILE = join(CONFIG_DIR, "api-keys.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return getDefaultConfig();
  }

  try {
    const configData = readFileSync(CONFIG_FILE, "utf8");
    const config = JSON.parse(configData) as Config;

    // Merge with defaults to ensure all properties exist
    return {
      ...getDefaultConfig(),
      ...config,
      reviewConfig: {
        ...getDefaultReviewConfig(),
        ...config.reviewConfig,
      },
    };
  } catch (error) {
    console.warn("Failed to load config, using defaults:", error);
    return getDefaultConfig();
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to save config: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function getDefaultConfig(): Config {
  return {
    defaultProvider: "groq",
    defaultTemplate: "standard",
    defaultBaseBranch: "main",
    reviewConfig: getDefaultReviewConfig(),
  };
}

function getDefaultReviewConfig(): ReviewConfig {
  return {
    defaultReviewType: "comprehensive",
    defaultSeverity: "all",
    maxFiles: 20,
    maxDiffLines: 500,
    enablePreAnalysis: true,
    reviewProfiles: getDefaultReviewProfiles(),
    autoFix: false,
    outputFormat: "formatted",
    scoreThreshold: {
      pass: 8,
      warn: 6,
      fail: 4,
    },
  };
}

function getDefaultReviewProfiles(): ReviewProfile[] {
  return [
    {
      name: "security-focused",
      description: "Comprehensive security review with critical issues only",
      reviewType: "security",
      severity: "critical",
      filePatterns: ["*.ts", "*.js", "*.tsx", "*.jsx", "*.py", "*.java"],
    },
    {
      name: "performance-check",
      description: "Performance optimization review",
      reviewType: "performance",
      severity: "high",
      filePatterns: ["*.ts", "*.js", "*.tsx", "*.jsx", "*.sql"],
    },
    {
      name: "code-quality",
      description: "General code quality and maintainability review",
      reviewType: "comprehensive",
      severity: "all",
      filePatterns: [
        "*.ts",
        "*.js",
        "*.tsx",
        "*.jsx",
        "*.py",
        "*.java",
        "*.go",
        "*.rs",
      ],
    },
    {
      name: "style-guide",
      description: "Code style and formatting consistency check",
      reviewType: "style",
      severity: "all",
      filePatterns: ["*.ts", "*.js", "*.tsx", "*.jsx", "*.css", "*.scss"],
    },
    {
      name: "bug-hunter",
      description: "Focus on potential bugs and logic errors",
      reviewType: "bugs",
      severity: "high",
      filePatterns: ["*.ts", "*.js", "*.tsx", "*.jsx", "*.py", "*.java"],
    },
  ];
}

function loadApiKeys(): Record<string, string> {
  ensureConfigDir();

  if (!existsSync(API_KEYS_FILE)) {
    return {};
  }

  try {
    const keysData = readFileSync(API_KEYS_FILE, "utf8");
    return JSON.parse(keysData);
  } catch (error) {
    console.warn("Failed to load API keys:", error);
    return {};
  }
}

function saveApiKeys(keys: Record<string, string>): void {
  ensureConfigDir();

  try {
    writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to save API keys: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function setApiKey(provider: string, apiKey: string): void {
  const keys = loadApiKeys();
  keys[provider] = apiKey;
  saveApiKeys(keys);
}

export function getApiKey(provider: string): string | undefined {
  const keys = loadApiKeys();
  return keys[provider];
}

export function updateReviewConfig(updates: Partial<ReviewConfig>): void {
  const config = loadConfig();
  config.reviewConfig = {
    ...config.reviewConfig,
    ...updates,
  };
  saveConfig(config);
}

export function addReviewProfile(profile: ReviewProfile): void {
  const config = loadConfig();
  if (!config.reviewConfig) {
    config.reviewConfig = getDefaultReviewConfig();
  }

  if (!config.reviewConfig.reviewProfiles) {
    config.reviewConfig.reviewProfiles = [];
  }

  // Remove existing profile with same name
  config.reviewConfig.reviewProfiles =
    config.reviewConfig.reviewProfiles.filter((p) => p.name !== profile.name);

  config.reviewConfig.reviewProfiles.push(profile);
  saveConfig(config);
}

export function removeReviewProfile(profileName: string): void {
  const config = loadConfig();
  if (!config.reviewConfig?.reviewProfiles) return;

  config.reviewConfig.reviewProfiles =
    config.reviewConfig.reviewProfiles.filter((p) => p.name !== profileName);
  saveConfig(config);
}

export function getReviewProfile(
  profileName: string
): ReviewProfile | undefined {
  const config = loadConfig();
  return config.reviewConfig?.reviewProfiles?.find(
    (p) => p.name === profileName
  );
}

export function listReviewProfiles(): ReviewProfile[] {
  const config = loadConfig();
  return config.reviewConfig?.reviewProfiles || [];
}
