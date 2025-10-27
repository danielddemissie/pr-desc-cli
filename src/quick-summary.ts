import chalk from "chalk";
import { generateConventionalCommitMessage } from "./commit-generator.js";
import { GenerateOptions, GitChanges } from "./types.js";
import { mapTypeToLabel } from "./utils.js";

export async function generateQuickSummary(
  changes: GitChanges,
  options: GenerateOptions
): Promise<string> {
  const filesChanged =
    changes.stats && typeof changes.stats.filesChanged === "number"
      ? changes.stats.filesChanged
      : changes.files.length;
  const insertions = (changes.stats && changes.stats.insertions) || 0;
  const deletions = (changes.stats && changes.stats.deletions) || 0;

  let suggestedCommit: string | undefined = undefined;
  try {
    suggestedCommit = await generateConventionalCommitMessage(changes, {
      provider: options.provider ?? "",
      model: options.model ?? "",
      maxFiles: options.maxFiles ?? 20,
    });
  } catch (e) {
    suggestedCommit = undefined;
  }

  const summaryLines: string[] = [];
  summaryLines.push(chalk.green(`✔ ${filesChanged} files changed`));
  summaryLines.push(
    chalk.green(`✔ ${insertions} insertions / ${deletions} deletions`)
  );

  if (suggestedCommit) {
    const m = suggestedCommit.match(/^([a-zA-Z0-9_-]+)(?:\([^)]*\))?:/);
    const typeLabel = m ? mapTypeToLabel(m[1]) : "Unknown";
    summaryLines.push(chalk.yellow(`🧠 PR type: ${typeLabel}`));
    summaryLines.push(chalk.cyan(`💬 Commit: ${suggestedCommit}`));
  }

  return summaryLines.join("\n");
}
