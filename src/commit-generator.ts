import { generateText } from "ai";
import type { GitChanges, CommitMessageOptions } from "./types.js";
import { getAIModel } from "./models.js";
import { formatCommitMessage } from "./utils.js";

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

  function buildPrompt(
    changes: GitChanges,
    options: CommitMessageOptions,
    maxDiffLines: number = 500,
    maxFiles: number = 20,
    fileSummaries: string
  ): string {
    console.log(fileSummaries, changes);
    const gitDataSection = `
## Git Context
**Base Branch:** ${changes.baseBranch}  
**Current Branch:** ${changes.currentBranch}  
**Files Changed:** ${changes.files.length}  
**Insertions:** ${changes.stats.insertions}  
**Deletions:** ${changes.stats.deletions}  

### Recent Commits
${changes.commits
  .map((commit) => `- ${commit.message.trim()} (${commit.hash.slice(0, 7)})`)
  .join("\n")}

### File Changes
${changes.files
  .slice(0, maxFiles)
  .map((file) => {
    const patch = file.patch
      ? file.patch.slice(0, maxDiffLines) +
        (file.patch.length > maxDiffLines ? "..." : "")
      : "";
    return `**${file.path}** — Status: ${file.status}, +${file.additions}, -${
      file.deletions
    }
${patch ? `\`\`\`diff\n${patch}\n\`\`\`` : ""}`;
  })
  .join("\n\n")}

${
  changes.files.length > maxFiles
    ? `\n...and ${changes.files.length - maxFiles} more files changed.`
    : ""
}`;

    const finalAiInstructionForCommit = `
Do *not* include any meta information or explanations — just the commit message
Do *not* include any labels like "Since I don't see the staged git diff, I'll provide a generic example based on common commit messages"
Do *not* include any labels like "Based on the staged git diff, I will generate a single Conventional Commit message." just the commit message
Do *not* include any labels like "Here's a suggested PR description", "Feel free to modify it"
Do *not* include any emojis.
Do *not* include any labels like "This is a suggested commit message" — just the commit message
Do *not* include any labels like "Unfortunately, I don't see any staged git diff output in your question. However, I can guide you on how to generate a Conventional Commit message based on common practices." just the commit message

Return *only* the commit line.
`;

    const basePrompt = `You are an expert software engineer. Based on the staged git diff, generate a SINGLE Conventional Commit message.
Rules:
- Use format: <type>(<optional scope>): <short imperative summary>
- type *must* be one of: feat, fix, docs, style, refactor, perf, test, chore, build, ci
- Summary *must* be <= 72 characters
- Do NOT include body or footer; ONLY the first line
- No trailing period
- Be precise and specific.
${options.typeHint ? `Preferred type (hint): ${options.typeHint}` : ""}`;

    return `
Git Changes: ${gitDataSection}
File summary: ${fileSummaries}
Base Prompt: ${basePrompt}
Final Instruction: ${finalAiInstructionForCommit}
`;
  }

  const prompt = buildPrompt(changes, options, 500, 20, fileSummaries);
  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.3,
    maxTokens: 60,
  });

  return formatCommitMessage(text);
}
