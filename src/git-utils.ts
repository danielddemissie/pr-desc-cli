import { spawn } from "child_process";

import simpleGit from "simple-git";
import type {
  GitChanges,
  FileChange,
  CommitInfo,
  FileStatus,
} from "./types.ts";
import { GhError, GhNeedsPushError } from "./types.js";

const git = simpleGit();

/**
 * Get the git changes between the current branch and a specified base branch.
 * @param baseBranch Base branch to compare against
 * @param maxFiles Maximum number of files to include in the changes
 * @returns A promise that resolves to an object containing git changes information.
 */
export async function getGitChanges(
  baseBranch: string,
  maxFiles: number,
  mode: "branch" | "staged" = "branch"
): Promise<GitChanges> {
  try {
    await git.fetch();
    const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    // mode base
    let diffRangeArg = `${baseBranch}...HEAD`;
    let log: any;

    if (mode === "branch") {
      log = await git.log({
        from: baseBranch,
        to: "HEAD",
        maxCount: 10,
      });
    } else {
      log = await git.log({
        maxCount: 10,
      });
    }

    const diffSummary =
      mode === "branch"
        ? await git.diffSummary([diffRangeArg])
        : await git.diffSummary(["--cached"]);

    const numstatArgs =
      mode === "branch"
        ? ["diff", diffRangeArg, "--numstat"]
        : ["diff", "--cached", "--numstat"];
    const numstatOutput = await git.raw(numstatArgs);
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
        patch = await git.diff([
          ...(mode === "branch" ? [diffRangeArg] : ["--cached"]),
          "--",
          file.file,
        ]);
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

    const commits: CommitInfo[] = (log?.all || []).map((commit: any) => ({
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
      mode,
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

export async function createPR(body: string): Promise<string> {
  const args = ["pr", "create", "--fill", "--body-file", "-"];
  return runGhCommand(args, body);
}

export async function updatePR(prNumber: number, body: string): Promise<void> {
  const args = ["pr", "edit", String(prNumber), "--body-file", "-"];
  await runGhCommand(args, body);
}

function runGhCommand(args: string[], body?: string): Promise<string> {
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

    gh.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    gh.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        if (stderr.includes("must first push the current branch")) {
          reject(new GhNeedsPushError());
        } else {
          reject(new GhError(`gh command failed with code ${code}: ${stderr}`));
        }
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

export async function pushCurrentBranch(branchName: string): Promise<void> {
  try {
    await runGitCommand(["push", "--set-upstream", "origin", branchName]);
  } catch (error) {
    throw new Error(
      `Failed to push current branch '${branchName}': ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
