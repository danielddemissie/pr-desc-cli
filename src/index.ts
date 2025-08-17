#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { input, select, password, confirm } from "@inquirer/prompts";
import { join, dirname } from "path";

import { generatePRDescription } from "./pr-generator.js";
import { generatePRReview } from "./pr-reviewer.js";
import { getGitChanges } from "./git-utils.js";
import { getSupportedModels, SUPPORTED_MODELS } from "./models.js";
import {
  loadConfig,
  setApiKey,
  getApiKey,
  saveConfig,
  addReviewProfile,
  removeReviewProfile,
  getReviewProfile,
  listReviewProfiles,
} from "./config.js";
import { maskApiKey } from "./utils.js";
import type { PackageJson, ReviewProfile } from "./types.js";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");

let packageJson: PackageJson;
try {
  packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  ) as PackageJson;
} catch (error) {
  packageJson = {
    name: "pr-desc-cli",
    version: "1.0.0",
    description: "AI-powered PR description generator",
  };
}
const program = new Command();

// Get program metadata from package.json
program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command("generate")
  .alias("gen")
  .description("Generate PR description from git changes")
  .option("-b, --base <branch>", "Base branch to compare against")
  .option("-p, --provider <provider>", "AI provider (groq, deepinfra, local)")
  .option("-m, --model <model>", "AI model to use")
  .option(
    "--template <template>",
    "PR template style (standard, detailed, minimal)"
  )
  .option("--template-file <path>", "Path to a custom Markdown template file") // user-custom template
  .option("--max-files <number>", "Maximum number of files to analyze", "20")
  .option(
    "--dry-run",
    "Display decorative output for interactive review (dry run)",
    false
  )
  .action(async (options) => {
    const spinner = ora("Analyzing git changes...").start();

    try {
      // load default config
      const config = loadConfig();
      if (!config.defaultProvider) config.defaultProvider = "groq";
      if (!config.defaultTemplate) config.defaultTemplate = "standard";
      if (!config.defaultBaseBranch) config.defaultBaseBranch = "main";

      // set options
      options.provider = options.provider || config.defaultProvider;
      options.template = options.template || config.defaultTemplate;
      options.base = options.base || config.defaultBaseBranch;
      options.model =
        options.model ||
        SUPPORTED_MODELS[options.provider as keyof typeof SUPPORTED_MODELS]
          .default;

      const changes = await getGitChanges(
        options.base,
        Number.parseInt(options.maxFiles)
      );

      if (!changes.files.length) {
        spinner.fail("No changes found");
        return;
      }

      let customTemplateContent: string | undefined;
      if (options.templateFile) {
        try {
          customTemplateContent = readFileSync(options.templateFile, "utf-8");
          spinner.text =
            "Generating PR description with AI using custom template...";
        } catch (fileError) {
          spinner.fail(
            `Error reading custom template file: ${
              fileError instanceof Error ? fileError.message : "Unknown error"
            }`
          );
          process.exit(1);
        }
      } else {
        spinner.text = "Generating PR description with AI...";
      }

      // Generate PR description
      const description = await generatePRDescription(changes, {
        provider: options.provider,
        model: options.model,
        template: options.template,
        customTemplateContent: customTemplateContent,
      });

      spinner.succeed("PR description generated!");

      if (options.dryRun) {
        console.log("\n" + chalk.blue("═".repeat(60)));
        console.log(chalk.bold.cyan("🚀 Generated PR Description (Dry Run)"));
        console.log(chalk.blue("═".repeat(60)));
        console.log("\n" + description + "\n");
        console.log(chalk.blue("═".repeat(60)));
      } else {
        // Pure output for piping to gh
        console.log(description);
      }
    } catch (error) {
      spinner.fail(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Start an interactive wizard to configure pr-desc")
  .action(async () => {
    console.log(
      chalk.bold.cyan("\n✨ Welcome to the pr-desc setup wizard! ✨\n")
    );
    console.log(
      "Let's configure your preferences for generating PR descriptions and reviews.\n"
    );

    const currentConfig = loadConfig();

    const defaultProvider = await select({
      message: "Which AI provider would you like to use by default?",
      choices: Object.keys(SUPPORTED_MODELS).map((key) => ({
        value: key,
        name: key,
      })),
      default: currentConfig.defaultProvider || "groq",
    });

    let groqApiKey: string | undefined;
    if (defaultProvider === "groq") {
      // If we already have a key, set default
      if (getApiKey("groq")) {
        groqApiKey = await input({
          message: "Enter your Groq API Key (leave blank to skip):",
          default: maskApiKey(getApiKey("groq") as string),
        });
      } else {
        groqApiKey = await password({
          message: "Enter your Groq API Key (leave blank to skip):",
        });
      }
    }

    let deepinfraApiKey: string | undefined;
    if (defaultProvider === "deepinfra") {
      if (getApiKey("deepinfra")) {
        deepinfraApiKey = await input({
          message: "Enter your DeepInfra API Key (leave blank to skip):",
          default: maskApiKey(getApiKey("deepinfra") as string),
        });
      } else {
        deepinfraApiKey = await password({
          message: "Enter your DeepInfra API Key (leave blank to skip):",
        });
      }
    }

    const defaultTemplate = await select({
      message: "Which PR description template style do you prefer by default?",
      choices: ["standard", "detailed", "minimal"].map((t) => ({
        value: t,
        name: t,
      })),
      default: currentConfig.defaultTemplate || "standard",
    });

    const defaultBaseBranch = await input({
      message: "What is your default base branch (e.g., main, develop)?",
      default: currentConfig.defaultBaseBranch || "main",
    });

    console.log(chalk.bold.cyan("\n🔍 Review Configuration\n"));

    const setupReview = await confirm({
      message: "Would you like to configure code review settings?",
      default: true,
    });

    let reviewConfig = currentConfig.reviewConfig;

    if (setupReview) {
      const defaultReviewType = await select({
        message: "What type of code review do you prefer by default?",
        choices: [
          {
            value: "comprehensive",
            name: "Comprehensive - All aspects (security, performance, bugs, style)",
          },
          {
            value: "security",
            name: "Security - Focus on vulnerabilities and security issues",
          },
          {
            value: "performance",
            name: "Performance - Focus on optimization opportunities",
          },
          {
            value: "bugs",
            name: "Bug Detection - Focus on potential bugs and logic errors",
          },
          {
            value: "style",
            name: "Style - Focus on code style and maintainability",
          },
        ],
        default:
          currentConfig.reviewConfig?.defaultReviewType || "comprehensive",
      });

      const defaultSeverity = await select({
        message: "What minimum severity level should be reported?",
        choices: [
          {
            value: "all",
            name: "All - Report all issues regardless of severity",
          },
          {
            value: "high",
            name: "High & Critical - Only report significant issues",
          },
          {
            value: "critical",
            name: "Critical Only - Only report critical security/stability issues",
          },
        ],
        default: currentConfig.reviewConfig?.defaultSeverity || "all",
      });

      const enablePreAnalysis = await confirm({
        message: "Enable pre-analysis pattern detection for faster reviews?",
        default: currentConfig.reviewConfig?.enablePreAnalysis ?? true,
      });

      const scoreThresholdSetup = await confirm({
        message:
          "Would you like to customize score thresholds for pass/warn/fail?",
        default: false,
      });

      let scoreThreshold = currentConfig.reviewConfig?.scoreThreshold;
      if (scoreThresholdSetup) {
        const passThreshold = await input({
          message: "Pass threshold (score above this is considered good):",
          default: String(
            currentConfig.reviewConfig?.scoreThreshold?.pass || 8
          ),
          validate: (value) => {
            const num = Number.parseInt(value);
            return (
              (num >= 1 && num <= 10) ||
              "Please enter a number between 1 and 10"
            );
          },
        });

        const warnThreshold = await input({
          message: "Warning threshold (score above this shows warnings):",
          default: String(
            currentConfig.reviewConfig?.scoreThreshold?.warn || 6
          ),
          validate: (value) => {
            const num = Number.parseInt(value);
            return (
              (num >= 1 && num <= 10) ||
              "Please enter a number between 1 and 10"
            );
          },
        });

        scoreThreshold = {
          pass: Number.parseInt(passThreshold),
          warn: Number.parseInt(warnThreshold),
          fail: Math.min(Number.parseInt(warnThreshold) - 1, 4),
        };
      }

      reviewConfig = {
        ...currentConfig.reviewConfig,
        defaultReviewType: defaultReviewType as any,
        defaultSeverity: defaultSeverity as any,
        enablePreAnalysis,
        scoreThreshold,
      };
    }

    // Save configuration
    const newConfig = {
      defaultProvider,
      defaultTemplate,
      defaultBaseBranch,
      reviewConfig,
    };

    saveConfig(newConfig);

    // Save API keys if provided
    if (groqApiKey && groqApiKey !== maskApiKey(getApiKey("groq") || "")) {
      setApiKey("groq", groqApiKey);
    }
    if (
      deepinfraApiKey &&
      deepinfraApiKey !== maskApiKey(getApiKey("deepinfra") || "")
    ) {
      setApiKey("deepinfra", deepinfraApiKey);
    }

    console.log(chalk.green("\n✅ pr-desc configuration saved successfully!"));
    console.log(
      chalk.gray("You can always review your config with 'pr-desc config show'")
    );
    console.log(
      chalk.gray(
        "Run 'pr-desc generate' to create PR descriptions or 'pr-desc review' for code reviews."
      )
    );
  });

program
  .command("models")
  .description("List available models for each provider")
  .option("-p, --provider <provider>", "Show models for specific provider")
  .action((options) => {
    if (options.provider) {
      try {
        const models = getSupportedModels(options.provider);
        console.log(
          chalk.bold.cyan(`Available models for ${options.provider}:`)
        );
        models.forEach((model) => {
          const isDefault =
            model ===
            SUPPORTED_MODELS[options.provider as keyof typeof SUPPORTED_MODELS]
              .default;
          console.log(
            `  ${isDefault ? "✓" : " "} ${model}${
              isDefault ? " (default)" : ""
            }`
          );
        });
      } catch (error) {
        console.error(
          chalk.red(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        );
      }
    } else {
      console.log(
        chalk.bold.cyan("Available providers and their default models:\n")
      );
      Object.entries(SUPPORTED_MODELS).forEach(([provider, config]) => {
        console.log(chalk.bold(`${provider}:`));
        console.log(`  Default: ${config.default}`);
        console.log(`  Options: ${config.options.length} models available`);
        console.log();
      });
      console.log(
        chalk.yellow(
          "Use 'pr-desc models -p <provider>' to see all models for a provider"
        )
      );
    }
  });

program
  .command("config")
  .description("Manage configuration and API keys")
  .argument("<action>", "Action to perform (set, get, show)")
  .argument("[provider]", "Provider name (groq, deepinfra)")
  .argument("[value]", "API key value (for set action)")
  .action((action, provider, value) => {
    switch (action) {
      case "set":
        if (!provider || !value) {
          console.error(
            chalk.red("Usage: pr-desc config set <provider> <api-key>")
          );
          process.exit(1);
        }
        setApiKey(provider, value);
        break;

      case "get":
        if (!provider) {
          console.error(chalk.red("Usage: pr-desc config get <provider>"));
          process.exit(1);
        }
        const apiKey = getApiKey(provider);
        if (apiKey) {
          console.log(
            `${provider}: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
          );
        } else {
          console.log(`${provider}: Not set`);
        }
        break;

      case "show":
        const config = loadConfig();
        console.log(chalk.bold.cyan("Current Configuration:"));
        console.log(JSON.stringify(config, null, 2));
        break;

      default:
        console.error(chalk.red("Unknown action. Use: set, get, or show"));
        process.exit(1);
    }
  });

program
  .command("review")
  .alias("pr-review")
  .description("AI-powered code review of your changes before creating PR")
  .option("-b, --base <branch>", "Base branch to compare against")
  .option("-p, --provider <provider>", "AI provider (groq, deepinfra, local)")
  .option("-m, --model <model>", "AI model to use")
  .option(
    "-t, --type <type>",
    "Review type (comprehensive, security, performance, style, bugs)"
  )
  .option(
    "-s, --severity <level>",
    "Minimum severity to report (all, high, critical)"
  )
  .option("--max-files <number>", "Maximum number of files to analyze")
  .option("--json", "Output results in JSON format", false)
  .option("--profile <name>", "Use a predefined review profile")
  .action(async (options) => {
    const spinner = ora("Analyzing git changes for review...").start();

    try {
      // Load default config
      const config = loadConfig();
      const reviewConfig = config.reviewConfig;

      // Handle profile-based configuration
      let profileConfig: Partial<ReviewProfile> = {};
      if (options.profile) {
        const profile = getReviewProfile(options.profile);
        if (!profile) {
          spinner.fail(`Review profile '${options.profile}' not found`);
          console.log(chalk.yellow("Available profiles:"));
          listReviewProfiles().forEach((p) => {
            console.log(`  - ${p.name}: ${p.description}`);
          });
          process.exit(1);
        }
        profileConfig = {
          reviewType: profile.reviewType,
          severity: profile.severity,
        };
        spinner.text = `Using profile '${profile.name}' - ${profile.description}`;
      }

      // Set options with precedence: CLI args > profile > config > defaults
      const finalOptions = {
        provider: options.provider || config.defaultProvider || "groq",
        base: options.base || config.defaultBaseBranch || "main",
        model:
          options.model ||
          SUPPORTED_MODELS[
            (options.provider ||
              config.defaultProvider ||
              "groq") as keyof typeof SUPPORTED_MODELS
          ].default,
        type:
          options.type ||
          profileConfig.reviewType ||
          reviewConfig?.defaultReviewType ||
          "comprehensive",
        severity:
          options.severity ||
          profileConfig.severity ||
          reviewConfig?.defaultSeverity ||
          "all",
        maxFiles: options.maxFiles
          ? Number.parseInt(options.maxFiles)
          : reviewConfig?.maxFiles || 20,
      };

      const changes = await getGitChanges(
        finalOptions.base,
        finalOptions.maxFiles
      );

      if (!changes.files.length) {
        spinner.fail("No changes found to review");
        return;
      }

      spinner.text = `Performing ${finalOptions.type} code review with AI...`;

      // Generate code review
      const review = await generatePRReview(changes, {
        provider: finalOptions.provider,
        model: finalOptions.model,
        reviewType: finalOptions.type as any,
        severity: finalOptions.severity as any,
        maxFiles: finalOptions.maxFiles,
      });

      spinner.succeed("Code review completed!");

      if (options.json) {
        console.log(JSON.stringify(review, null, 2));
      } else {
        displayReviewResults(review, reviewConfig?.scoreThreshold);
      }
    } catch (error) {
      spinner.fail(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program
  .command("profiles")
  .description("Manage review profiles")
  .argument("[action]", "Action to perform (list, add, remove, show)")
  .argument("[name]", "Profile name")
  .action(async (action, name) => {
    switch (action) {
      case "list":
      case undefined:
        const profiles = listReviewProfiles();
        if (profiles.length === 0) {
          console.log(chalk.yellow("No review profiles configured"));
          return;
        }

        console.log(chalk.bold.cyan("Available Review Profiles:\n"));
        profiles.forEach((profile) => {
          console.log(`${chalk.bold(profile.name)}`);
          console.log(`  Description: ${profile.description}`);
          console.log(
            `  Type: ${profile.reviewType}, Severity: ${profile.severity}`
          );
          if (profile.filePatterns?.length) {
            console.log(`  File patterns: ${profile.filePatterns.join(", ")}`);
          }
          console.log();
        });
        break;

      case "show":
        if (!name) {
          console.error(chalk.red("Profile name required for show action"));
          process.exit(1);
        }

        const profile = getReviewProfile(name);
        if (!profile) {
          console.error(chalk.red(`Profile '${name}' not found`));
          process.exit(1);
        }

        console.log(chalk.bold.cyan(`Profile: ${profile.name}\n`));
        console.log(JSON.stringify(profile, null, 2));
        break;

      case "add":
        console.log(chalk.bold.cyan("Create New Review Profile\n"));

        const profileName = await input({
          message: "Profile name:",
          validate: (value) =>
            value.trim().length > 0 || "Profile name is required",
        });

        const description = await input({
          message: "Profile description:",
          validate: (value) =>
            value.trim().length > 0 || "Description is required",
        });

        const reviewType = await select({
          message: "Review type:",
          choices: [
            { value: "comprehensive", name: "Comprehensive" },
            { value: "security", name: "Security" },
            { value: "performance", name: "Performance" },
            { value: "bugs", name: "Bug Detection" },
            { value: "style", name: "Style" },
          ],
        });

        const severity = await select({
          message: "Severity level:",
          choices: [
            { value: "all", name: "All" },
            { value: "high", name: "High & Critical" },
            { value: "critical", name: "Critical Only" },
          ],
        });

        const newProfile: ReviewProfile = {
          name: profileName,
          description,
          reviewType: reviewType as any,
          severity: severity as any,
        };

        addReviewProfile(newProfile);
        console.log(
          chalk.green(`✅ Profile '${profileName}' created successfully!`)
        );
        break;

      case "remove":
        if (!name) {
          console.error(chalk.red("Profile name required for remove action"));
          process.exit(1);
        }

        const confirmRemove = await confirm({
          message: `Are you sure you want to remove profile '${name}'?`,
          default: false,
        });

        if (confirmRemove) {
          removeReviewProfile(name);
          console.log(
            chalk.green(`✅ Profile '${name}' removed successfully!`)
          );
        }
        break;

      default:
        console.error(
          chalk.red("Unknown action. Use: list, add, remove, or show")
        );
        process.exit(1);
    }
  });

/**
 * Display code review results in a formatted way
 */
function displayReviewResults(
  review: any,
  scoreThreshold?: { pass: number; warn: number; fail: number }
) {
  console.log("\n" + chalk.blue("═".repeat(60)));
  console.log(chalk.bold.cyan("🔍 AI Code Review Results"));
  console.log(chalk.blue("═".repeat(60)));

  // Overall score with custom thresholds
  const thresholds = scoreThreshold || { pass: 8, warn: 6, fail: 4 };
  const scoreColor =
    review.score >= thresholds.pass
      ? chalk.green
      : review.score >= thresholds.warn
      ? chalk.yellow
      : chalk.red;

  console.log(
    `\n${chalk.bold("Overall Score:")} ${scoreColor(review.score + "/10")}`
  );

  // Summary
  console.log(`\n${chalk.bold("Summary:")}`);
  console.log(chalk.gray(review.summary));

  // Issues
  if (review.issues.length > 0) {
    console.log(
      `\n${chalk.bold("Issues Found:")} ${chalk.red(review.issues.length)}`
    );

    review.issues.forEach((issue: any, index: number) => {
      const severityColor =
        {
          critical: chalk.red.bold,
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.gray,
        }[issue.severity as "critical" | "high" | "medium" | "low"] ||
        chalk.gray;

      const typeIcon =
        (
          {
            security: "🔒",
            performance: "⚡",
            bug: "🐛",
            style: "🎨",
            maintainability: "🔧",
          } as Record<string, string>
        )[issue.type] || "⚠️";

      console.log(
        `\n${index + 1}. ${typeIcon} ${severityColor(
          issue.severity.toUpperCase()
        )} - ${issue.type}`
      );
      console.log(
        `   ${chalk.bold("File:")} ${issue.file}${
          issue.line ? `:${issue.line}` : ""
        }`
      );
      console.log(`   ${chalk.bold("Issue:")} ${issue.message}`);
      if (issue.suggestion) {
        console.log(
          `   ${chalk.bold("Fix:")} ${chalk.green(issue.suggestion)}`
        );
      }
    });
  } else {
    console.log(`\n${chalk.green("✅ No issues found!")}`);
  }

  // Suggestions
  if (review.suggestions.length > 0) {
    console.log(`\n${chalk.bold("General Suggestions:")}`);
    review.suggestions.forEach((suggestion: string, index: number) => {
      console.log(`${index + 1}. ${chalk.cyan(suggestion)}`);
    });
  }

  console.log("\n" + chalk.blue("═".repeat(60)));

  // Action recommendations with custom thresholds
  if (review.score >= thresholds.pass) {
    console.log(chalk.green("🚀 Code looks great! Ready to create PR."));
  } else if (review.score >= thresholds.warn) {
    console.log(
      chalk.yellow("⚠️  Consider addressing issues before creating PR.")
    );
  } else {
    console.log(chalk.red("🛑 Please fix critical issues before proceeding."));
  }

  console.log(
    chalk.gray(
      "\nRun 'pr-desc generate' when ready to create your PR description."
    )
  );
  console.log(
    chalk.gray("Use 'pr-desc profiles list' to see available review profiles.")
  );
}

program.parse();
