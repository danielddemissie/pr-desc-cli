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
import { generateConventionalCommitMessage } from "./commit-generator.js";
import {
  getGitChanges,
  createPR,
  getPRForCurrentBranch,
  isGhCliInstalled,
  updatePR,
  pushCurrentBranch,
  runGitCommand,
} from "./git-utils.js";
import { getSupportedModels, SUPPORTED_MODELS } from "./models.js";
import { loadConfig, setApiKey, getApiKey, saveConfig } from "./config.js";
import { maskApiKey } from "./utils.js";
import { PackageJson } from "./types.js";
import { GhNeedsPushError } from "./types.js";

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
  .option("-p, --provider <provider>", "AI provider (groq, local)")
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
  .option(
    "--gh-pr",
    "Create or update a PR on GitHub with the generated description using the GitHub CLI",
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

      let description = await generatePRDescription(changes, {
        provider: options.provider,
        model: options.model,
        template: options.template,
        customTemplateContent: customTemplateContent,
      });

      spinner.succeed("PR description generated!");

      if (options.ghPr) {
        if (!(await isGhCliInstalled())) {
          spinner.fail(
            "GitHub CLI ('gh') is not installed. Please install it to create PRs."
          );
          return;
        }

        let proceed = false;
        let regenerate = true;

        while (regenerate) {
          console.log("\n" + chalk.blue("═".repeat(60)));
          console.log(chalk.bold.cyan("🚀 Generated PR Description Preview"));
          console.log(chalk.blue("═".repeat(60)));
          console.log("\n" + description + "\n");
          console.log(chalk.blue("═".repeat(60)));

          proceed = await confirm({
            message: "Continue with this PR description?",
            default: true,
          });

          if (proceed) {
            regenerate = false;
          } else {
            const action = await select({
              message: "What would you like to do?",
              choices: [
                { name: "Regenerate", value: "regenerate" },
                { name: "Cancel", value: "cancel" },
              ],
            });

            if (action === "regenerate") {
              spinner.start("Re-generating PR description...");
              description = await generatePRDescription(changes, {
                provider: options.provider,
                model: options.model,
                template: options.template,
                customTemplateContent: customTemplateContent,
              });
              spinner.succeed("PR description re-generated!");
            } else {
              spinner.info("PR creation cancelled.");
              return;
            }
          }
        }

        if (proceed) {
          try {
            spinner.start("Checking for uncommitted changes...");
            const gitStatus = await runGitCommand(["status", "--porcelain"]);
            if (gitStatus.trim().length > 0) {
              spinner.warn(`Unstaged changes found:\n${gitStatus}.\n`);

              const action = await select({
                message: `What would you like to do?`,
                choices: [
                  { name: "Commit changes", value: "commit" },
                  { name: "Stash changes and continue", value: "stash" },
                  { name: "Cancel PR creation", value: "cancel" },
                ],
              });

              switch (action) {
                case "commit":
                  // Ask if user wants AI generated conventional commit
                  const commitMode = await select({
                    message: "Commit message mode:",
                    choices: [
                      { name: "Manual input", value: "manual" },
                      { name: "AI (Conventional Commit)", value: "ai" },
                    ],
                    default: "manual",
                  });

                  let commitMessage: string;
                  if (commitMode === "ai") {
                    try {
                      spinner.start(
                        "Generating conventional commit message with AI..."
                      );
                      // Reuse existing changes (they reflect unstaged diff). We need staged content, so add first.
                      await runGitCommand(["add", "."]);
                      // Get fresh changes context after staging
                      const stagedChanges = await getGitChanges(
                        options.base,
                        Number.parseInt(options.maxFiles)
                      );
                      commitMessage = await generateConventionalCommitMessage(
                        stagedChanges,
                        {
                          provider: options.provider,
                          model: options.model,
                        }
                      );
                      spinner.succeed("AI commit message generated.");
                      const accept = await confirm({
                        message: `Use generated commit message: \n${commitMessage}\n?`,
                        default: true,
                      });
                      if (!accept) {
                        commitMessage = await input({
                          message: "Enter a commit message:",
                          default: commitMessage,
                        });
                      }
                    } catch (aiErr) {
                      spinner.warn(
                        `AI commit generation failed: ${
                          aiErr instanceof Error ? aiErr.message : aiErr
                        }. Falling back to manual input.`
                      );
                      commitMessage = await input({
                        message: "Enter a commit message:",
                        default: "chore: prepare for PR",
                      });
                    }
                  } else {
                    commitMessage = await input({
                      message: "Enter a commit message:",
                      default: "chore: prepare for PR",
                    });
                    await runGitCommand(["add", "."]);
                  }

                  spinner.start("Committing changes...");
                  try {
                    await runGitCommand(["commit", "-m", commitMessage]);
                    spinner.succeed(
                      "Changes committed. Continuing PR creation..."
                    );
                  } catch (commitError) {
                    spinner.fail(`Failed to commit changes: ${commitError}`);
                    return;
                  }

                  break;
                case "stash":
                  spinner.start("Stashing uncommitted changes...");
                  try {
                    await runGitCommand(["stash"]); // stash the changes
                    spinner.succeed(
                      "Changes stashed. Continuing PR creation..."
                    );
                  } catch (stashError) {
                    spinner.fail(`Failed to stash changes: ${stashError}`);
                    return;
                  }
                  break;
                case "cancel":
                default:
                  spinner.info("PR creation cancelled.");
                  return;
              }
            }
          } catch (error) {
            spinner.fail(
              `Error: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            process.exit(1);
          }

          const existingPr = await getPRForCurrentBranch(changes.currentBranch);

          if (existingPr) {
            spinner.start(`Updating PR #${existingPr.number}...`);
            await updatePR(existingPr.number, description);
            spinner.succeed(
              `Successfully updated PR #${existingPr.number}: ${existingPr.url}`
            );
          } else {
            while (true) {
              spinner.start("Creating PR...");

              try {
                const response = await createPR(description);
                spinner.succeed(`Successfully created PR: ${response}`);
                break;
              } catch (error) {
                if (error instanceof GhNeedsPushError) {
                  spinner.warn("Your branch is not pushed to origin.");
                  const pushCB = await confirm({
                    message: `Would you like to push branch '${changes.currentBranch}' to origin?`,
                    default: true,
                  });

                  if (pushCB) {
                    spinner.start("Pushing branch to origin...");
                    try {
                      await pushCurrentBranch(changes.currentBranch);
                      spinner.succeed(
                        "Successfully pushed to origin! Continuing PR creation..."
                      );
                    } catch (pushError) {
                      spinner.fail(
                        `Failed to push branch: ${
                          pushError instanceof Error
                            ? pushError.message
                            : pushError
                        }`
                      );
                      break;
                    }
                  } else {
                    spinner.info("PR creation cancelled.");
                    break;
                  }
                } else {
                  spinner.fail(
                    `PR creation failed: ${
                      error instanceof Error ? error.message : error
                    }`
                  );
                  break;
                }
              }
            }
          }
        }
      } else if (options.dryRun) {
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
  .argument("[provider]", "Provider name (groq, local)")
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

// Separate commit command
program
  .command("commit")
  .description(
    "Generate an AI conventional commit message (optionally commit immediately)"
  )
  .option("-b, --base <branch>", "Base branch to compare against")
  .option("-p, --provider <provider>", "AI provider (groq, local)")
  .option("-m, --model <model>", "AI model to use")
  .option("--max-files <number>", "Maximum number of files to analyze", "20")
  .option("--type-hint <type>", "Hint commit type (feat, fix, chore, etc.)")
  .option(
    "--no-stage",
    "Do not auto-stage all changes before generating the message"
  )
  .option(
    "--commit",
    "Automatically create the commit after confirmation",
    false
  )
  .action(async (options) => {
    const spinner = ora("Preparing commit context...").start();
    try {
      const cfg = loadConfig();
      options.provider = options.provider || cfg.defaultProvider || "groq";
      options.base = options.base || cfg.defaultBaseBranch || "main";
      options.model =
        options.model ||
        SUPPORTED_MODELS[options.provider as keyof typeof SUPPORTED_MODELS]
          .default;

      // Optionally stage all changes
      const status = await runGitCommand(["status", "--porcelain"]);
      if (!status.trim()) {
        spinner.fail("No changes to commit.");
        return;
      }

      if (options.stage !== false) {
        spinner.text = "Staging changes...";
        await runGitCommand(["add", "."]);
      }

      spinner.text = "Analyzing changes...";
      const changes = await getGitChanges(
        options.base,
        Number.parseInt(options.maxFiles)
      );

      spinner.text = "Generating commit message with AI...";
      let message = await generateConventionalCommitMessage(changes, {
        provider: options.provider,
        model: options.model,
        typeHint: options.typeHint,
        maxFiles: Number.parseInt(options.maxFiles),
      });
      spinner.succeed("Commit message generated.");

      let accept = false;
      while (!accept) {
        console.log("\n" + chalk.blue("═".repeat(60)));
        console.log(chalk.bold.cyan("🤖 Suggested Conventional Commit"));
        console.log(chalk.blue("═".repeat(60)));
        console.log("\n" + chalk.bold(message) + "\n");
        console.log(chalk.blue("═".repeat(60)));

        accept = await confirm({
          message: "Use this commit message?",
          default: true,
        });
        if (!accept) {
          const action = await select({
            message: "What next?",
            choices: [
              { name: "Regenerate", value: "regen" },
              { name: "Edit manually", value: "edit" },
              { name: "Cancel", value: "cancel" },
            ],
          });
          if (action === "regen") {
            spinner.start("Re-generating commit message...");
            message = await generateConventionalCommitMessage(changes, {
              provider: options.provider,
              model: options.model,
              typeHint: options.typeHint,
              maxFiles: Number.parseInt(options.maxFiles),
            });
            spinner.succeed("New commit message generated.");
            continue;
          } else if (action === "edit") {
            message = await input({
              message: "Edit commit message:",
              default: message,
            });
            accept = true;
          } else {
            console.log(chalk.yellow("Cancelled."));
            return;
          }
        }
      }

      if (
        options.commit ||
        (await confirm({ message: "Create commit now?", default: true }))
      ) {
        spinner.start("Creating commit...");
        try {
          await runGitCommand(["commit", "-m", message]);
          spinner.succeed("Commit created.");
        } catch (err) {
          spinner.fail(
            `Failed to commit: ${err instanceof Error ? err.message : err}`
          );
          return;
        }
      } else {
        console.log(message); // allow piping
      }
    } catch (err) {
      spinner.fail(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program.parse();
