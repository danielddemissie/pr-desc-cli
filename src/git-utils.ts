import { spawn } from "child_process";

import simpleGit from "simple-git";
import { input, select, confirm } from "@inquirer/prompts";
import ora from "ora";

import type {
  GitChanges,
  FileChange,
  CommitInfo,
  FileStatus,
} from "./types.ts";

const git = simpleGit();

/**
 * Get the git changes between the current branch and a specified base branch.
 * @param baseBranch Base branch to compare against
 * @param maxFiles Maximum number of files to include in the changes
 * @returns A promise that resolves to an object containing git changes information.
 */
export async function getGitChanges(
  baseBranch: string,
  maxFiles: number
): Promise<GitChanges> {
  try {
    await git.fetch();
    const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    const diffSummary = await git.diffSummary([`${baseBranch}...HEAD`]);
    const log = await git.log({
      from: baseBranch,
      to: "HEAD",
      maxCount: 10,
    });

    const numstatOutput = await git.raw([
      "diff",
      `${baseBranch}...HEAD`,
      "--numstat",
    ]);
    const numstatMap: Record<string, { additions: number; deletions: number }> =
      {};
    numstatOutput.split("\n").forEach((line) => {
      if (!line.trim()) return;

      const [add, del, path] = line.split("\t");
      numstatMap[path] = {
        additions: add === "-" ? 0 : parseInt(add, 10),
        deletions: del === "-" ? 0 : parseInt(del, 10),
      };
    });

    const diffFiles = diffSummary.files.slice(0, maxFiles);
    const files: FileChange[] = [];

    for (const file of diffFiles) {
      const stats = numstatMap[file.file] || { additions: 0, deletions: 0 };

      let patch: string | null = null;
      try {
        patch = await git.diff([`${baseBranch}...HEAD`, "--", file.file]);
      } catch {
        patch = null;
      }

      files.push({
        path: file.file,
        status: getFileStatus(stats),
        additions: stats.additions,
        deletions: stats.deletions,
        patch,
      });
    }

    const commits: CommitInfo[] = log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name || "Unknown",
      date: commit.date,
    }));

    return {
      baseBranch,
      currentBranch,
      files,
      commits,
      stats: {
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        filesChanged: diffSummary.files.length,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to get git changes: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function getFileStatus(file: {
  additions: number;
  deletions: number;
}): FileStatus {
  if (file.additions > 0 && file.deletions === 0) return "added";
  if (file.additions === 0 && file.deletions > 0) return "deleted";
  if (file.additions > 0 && file.deletions > 0) return "modified";
  return "unknown";
}

// Using gh cli

export async function isGhCliInstalled(): Promise<boolean> {
  try {
    await runGhCommand(["--version"]);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getPRForCurrentBranch(
  currentBranch: string
): Promise<{ number: number; url: string } | null> {
  try {
    await handleUncommittedChanges();
    const output = await runGhCommand([
      "pr",
      "list",
      "--head",
      currentBranch,
      "--json",
      "number,url",
    ]);
    const prs = JSON.parse(output);
    if (prs.length > 0) {
      return prs[0];
    }
    return null;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Could not find a repository for")
    ) {
      throw new Error("Not a GitHub repository or no remote configured.");
    }
    return null;
  }
}

export async function createPR(
  body: string,
  currentBranch: string
): Promise<string> {
  const args = ["pr", "create", "--fill", "--body-file", "-"];
  return runGhCommand(args, body, currentBranch);
}

export async function updatePR(
  prNumber: number,
  body: string,
  currentBranch: string
): Promise<void> {
  const args = ["pr", "edit", String(prNumber), "--body-file", "-"];
  await runGhCommand(args, body, currentBranch);
}

function runGhCommand(
  args: string[],
  body?: string,
  currentBranch?: string
): Promise<string> {
  const spinner = ora("Running gh command...");
  spinner.start();
  return new Promise((resolve, reject) => {
    const gh = spawn("gh", args);
    let stdout = "";
    let stderr = "";

    if (body) {
      gh.stdin.write(body);
      gh.stdin.end();
    }

    gh.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    gh.stderr.on("data", async (data) => {
      const errorString = data.toString();
      if (errorString.includes("push the current branch")) {
        await handlePushCurrentBranch(errorString, currentBranch);
      }
    });

    gh.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`gh command failed with code ${code}: ${stderr}`));
      }
    });

    gh.on("error", (err) => {
      reject(err);
    });
  });
}

export function runGitCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn("git", args);

    let stdout = "";
    let stderr = "";

    git.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    git.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    git.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`git command failed with code ${code}: ${stderr}`));
      }
    });

    git.on("error", (err) => {
      reject(err);
    });
  });
}

export async function handleUncommittedChanges(): Promise<void> {
  const spinner = ora("Checking for uncommitted changes...");
  const gitStatus = spawn("git", ["status", "--porcelain"]);
  let stdout = "";

  gitStatus.stderr.on("data", (data) => {
    stdout += data.toString();
  });

  return new Promise((resolve, reject) => {
    gitStatus.on("close", async (code) => {
      if (stdout.trim().length > 0) {
        const action = await select({
          message: "What would you like to do?",
          choices: [
            { name: "Commit changes", value: "commit" },
            { name: "Stash changes and continue", value: "stash" },
            { name: "Cancel PR creation", value: "cancel" },
          ],
        });

        switch (action) {
          case "commit":
            const commitMessage = await input({
              message: "Enter a commit message:",
              default: "chore: prepare for PR",
            });
            spinner.start("Committing changes...");
            try {
              await runGitCommand(["add", "."]);
              await runGitCommand(["commit", "-m", commitMessage]);
              spinner.succeed("Changes committed. Retrying PR creation...");
            } catch (commitError) {
              spinner.fail(`Failed to commit changes: ${commitError}`);
            }
            break;
          case "stash":
            spinner.start("Stashing uncommitted changes...");
            try {
              await runGitCommand(["stash"]); // stash the changes
              spinner.succeed("Changes stashed. Retrying PR creation...");
            } catch (stashError) {
              spinner.fail(`Failed to stash changes: ${stashError}`);
            }
            break;
          case "cancel":
          default:
            spinner.info("PR creation cancelled.");
            reject(new Error("PR creation cancelled."));
            break;
        }
      } else {
        resolve();
      }
    });
  });
}

export async function handlePushCurrentBranch(
  errorMessage: string,
  currentBranch?: string
): Promise<void> {
  if (!currentBranch) return;

  const spinner = ora("Handling unpushed branch...");
  spinner.start();
  if (errorMessage.includes("push the current branch")) {
    spinner.warn("Your branch is not pushed to origin.");
    const pushCB = await confirm({
      message: `Would you like to push branch '${currentBranch}' to origin?`,
      default: true,
    });

    if (pushCB) {
      spinner.start("Pushing branch to origin...");
      try {
        await runGitCommand([
          "push",
          "--set-upstream",
          "origin",
          currentBranch,
        ]);
        spinner.succeed(
          "Successfully pushed to origin! Retrying PR creation..."
        );
      } catch (pushError) {
        spinner.fail(
          `Failed to push branch: ${
            pushError instanceof Error ? pushError.message : pushError
          }`
        );
        throw new Error("PR creation cancelled due to push failure.");
      }
    } else {
      spinner.info("PR creation cancelled.");
      throw new Error("PR creation cancelled by user.");
    }
  }
}
