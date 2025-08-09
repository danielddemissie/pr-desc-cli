import simpleGit from "simple-git";
import type { GitChanges, FileChange, CommitInfo } from "./types.ts";

const git = simpleGit();

export async function getGitChanges(
  baseBranch: string,
  maxFiles: number
): Promise<GitChanges> {
  try {
    // Get current branch
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Get diff stats
    const diffSummary = await git.diffSummary([`${baseBranch}...HEAD`]);

    // Get recent commits
    const log = await git.log({
      from: baseBranch,
      to: "HEAD",
      maxCount: 10,
    });

    // Get detailed file changes
    const files: FileChange[] = [];
    const diffFiles = diffSummary.files.slice(0, maxFiles);

    for (const file of diffFiles) {
      try {
        const patch = await git.show([`${baseBranch}...HEAD`, "--", file.file]);

        files.push({
          path: file.file,
          status: getFileStatus(file),
          additions: file.insertions,
          deletions: file.deletions,
          patch: patch,
        });
      } catch (error) {
        // If we can't get the patch, still include the file
        files.push({
          path: file.file,
          status: getFileStatus(file),
          additions: file.insertions,
          deletions: file.deletions,
          patch: null,
        });
      }
    }

    const commits: CommitInfo[] = log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name || "Unknown",
      date: commit.date,
    }));

    return {
      baseBranch,
      currentBranch: currentBranch.trim(),
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

function getFileStatus(file: any): string {
  if (file.insertions > 0 && file.deletions === 0) return "added";
  if (file.insertions === 0 && file.deletions > 0) return "deleted";
  if (file.insertions > 0 && file.deletions > 0) return "modified";
  return "unknown";
}
