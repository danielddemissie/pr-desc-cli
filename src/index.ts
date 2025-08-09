#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { generatePRDescription } from "./pr-generator.js";
import { getGitChanges } from "./git-utils.js";
import { config } from "dotenv";
import { getSupportedModels, SUPPORTED_MODELS } from "./models.js";

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
  .option("--max-files <number>", "Maximum number of files to analyze", "20")
  .action(async (options) => {
    const spinner = ora("Analyzing git changes...").start();

    try {
      // Get git changes
      const changes = await getGitChanges(
        options.base,
        Number.parseInt(options.maxFiles)
      );

      if (!changes.files.length) {
        spinner.fail("No changes found");
        return;
      }

      spinner.text = "Generating PR description with AI...";

      // Generate PR description
      const description = await generatePRDescription(changes, {
        provider: options.provider,
        model: options.model,
        template: options.template,
      });

      spinner.succeed("PR description generated!");

      console.log("\n" + chalk.blue("═".repeat(60)));
      console.log(chalk.bold.cyan("🚀 Generated PR Description"));
      console.log(chalk.blue("═".repeat(60)));
      console.log("\n" + description + "\n");
      console.log(chalk.blue("═".repeat(60)));
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

program.parse();
