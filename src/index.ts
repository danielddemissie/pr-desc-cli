#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { generatePRDescription } from "./pr-generator.js";
import { getGitChanges } from "./git-utils.js";
import { config } from "dotenv";
import { getSupportedModels, SUPPORTED_MODELS } from "./models.js";
import { loadConfig, setApiKey, getApiKey, saveConfig } from "./config.js";
import { readFileSync } from "fs";
import { input, select, password } from "@inquirer/prompts";
import { maskApiKey } from "./utils.js";

config();

const program = new Command();

program
  .name("pr-desc")
  .description("AI-powered PR description generator")
  .version("1.0.0");

program
  .command("generate")
  .alias("gen")
  .description("Generate PR description from git changes")
  .option("-b, --base <branch>", "Base branch to compare against", "main")
  .option(
    "-p, --provider <provider>",
    "AI provider (groq, deepinfra, local)",
    "groq"
  )
  .option("-m, --model <model>", "AI model to use")
  .option(
    "--template <template>",
    "PR template style (standard, detailed, minimal)",
    "standard"
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
  .command("setup")
  .description("Setup API keys for AI providers")
  .action(() => {
    console.log(chalk.yellow("🔧 Setup Instructions:\n"));

    console.log(chalk.bold("Free AI Providers:"));
    console.log("1. Groq (Recommended - Fast & Free):");
    console.log("   - Sign up at: https://console.groq.com");
    console.log("   - Get API key and set: GROQ_API_KEY=your_key\n");

    console.log("2. DeepInfra (Good alternative):");
    console.log("   - Sign up at: https://deepinfra.com");
    console.log("   - Get API key and set: DEEPINFRA_API_KEY=your_key\n");

    console.log("3. Local Models (Ollama):");
    console.log("   - Install Ollama: https://ollama.ai");
    console.log("   - Run: ollama pull llama3.1\n");

    console.log(chalk.bold("Environment Variables:"));
    console.log("Create a .env file or set environment variables:");
    console.log(chalk.green("GROQ_API_KEY=your_groq_key"));
    console.log(chalk.green("DEEPINFRA_API_KEY=your_deepinfra_key"));
  });

program
  .command("init")
  .description("Start an interactive wizard to configure pr-desc")
  .action(async () => {
    console.log(
      chalk.bold.cyan("\n✨ Welcome to the pr-desc setup wizard! ✨\n")
    );
    console.log(
      "Let's configure your preferences for generating PR descriptions.\n"
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

    currentConfig.defaultProvider = defaultProvider;
    currentConfig.defaultTemplate = defaultTemplate;
    currentConfig.defaultBaseBranch = defaultBaseBranch;
    saveConfig(currentConfig);

    // Save API keys if provided
    if (groqApiKey) {
      setApiKey("groq", groqApiKey);
    }
    if (deepinfraApiKey) {
      setApiKey("deepinfra", deepinfraApiKey);
    }

    console.log(chalk.green("\n✅ pr-desc configuration saved successfully!"));
    console.log(
      chalk.gray("You can always review your config with 'pr-desc config show'")
    );
    console.log(
      chalk.gray(
        "And run 'pr-desc generate' to create your first PR description."
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

program.parse();
