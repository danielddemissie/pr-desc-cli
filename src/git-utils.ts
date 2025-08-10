import simpleGit from "simple-git";
import type {
  GitChanges,
  FileChange,
  CommitInfo,
  FileStatus,
} from "./types.ts";

const git = simpleGit();

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
