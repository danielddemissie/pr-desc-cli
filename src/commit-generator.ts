import { generateText } from "ai";
import type { GitChanges } from "./types.js";
import { getAIModel } from "./models.js";

export interface CommitMessageOptions {
  provider: string;
  model?: string;
  maxFiles?: number;
  maxDiffLines?: number;
  typeHint?: string; // e.g. feat, fix, chore, docs
}

export async function generateConventionalCommitMessage(
  changes: GitChanges,
  options: CommitMessageOptions
): Promise<string> {
  const model = await getAIModel(options.provider, options.model);
  const maxFiles = options.maxFiles ?? 20;
  const maxDiffLines = options.maxDiffLines ?? 400;

  const fileSummaries = changes.files
    .slice(0, maxFiles)
    .map((f) => {
      const patch = f.patch
        ? f.patch.slice(0, maxDiffLines) +
          (f.patch.length > maxDiffLines ? "..." : "")
        : "";
      return `FILE: ${f.path} STATUS: ${f.status} +${f.additions} -${f.deletions}\n${patch}`;
    })
    .join("\n\n");

  const prompt = `You are an expert software engineer. Based on the staged git diff, generate a SINGLE Conventional Commit message.
Rules:
- Use format: <type>(<optional scope>): <short imperative summary>
- type must be one of: feat, fix, docs, style, refactor, perf, test, chore, build, ci
- Summary must be <= 72 characters
- Do NOT include body or footer; ONLY the first line
- No trailing period
- Be precise and specific.
${options.typeHint ? `Preferred type (hint): ${options.typeHint}` : ""}

Git Context:
Base: ${changes.baseBranch}
Branch: ${changes.currentBranch}
Recent commit messages for reference (avoid duplicates):
${changes.commits.map((c) => `- ${c.message}`).join("\n")}

Changed Files (subset):\n${fileSummaries}

Return only the commit line.`;

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.3,
    maxTokens: 60,
  });

  // Post-process: take first line, trim, strip quotes/backticks
  const firstLine = text
    .split(/\r?\n/)[0]
    .trim()
    .replace(/^['"`]|['"`]$/g, "");
  return firstLine;
}
