import { generateText } from "ai";
import type { GitChanges, GenerateOptions } from "./types.js";
import { getAIModel } from "./models.js";

export async function generatePRDescription(
  changes: GitChanges,
  options: GenerateOptions
): Promise<string> {
  const model = await getAIModel(options.provider, options.model);
  const maxFiles = options.maxFiles ?? 20;
  const maxDiffLines = options.maxDiffLines ?? 500;

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
    template: string,
    fileSummaries: string,
    customTemplateContent?: string
  ): string {
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

### File Changes summary
${fileSummaries}
`;

    const finalAiInstruction = `
Do *not* include any meta information or explanations — just the PR content
Do **not** include labels like "PR Description:", "Title:", or meta text — only the final PR content.
Do *not* include any labels like "Here's a suggested PR description", "Feel free to modify it"
`;

    // Check for custom template content
    if (customTemplateContent) {
      return `
You are an expert software engineer writing a Pull Request description.
Analyze the following git changes and generate a PR description that strictly adheres to the provided custom Markdown template.
Fill in the sections of the template using the git changes data.

${gitDataSection}

## Custom PR Template:
${customTemplateContent}

Please generate the PR description by filling the custom template based on the git changes provided.
${finalAiInstruction}
`;
    }

    const templates = {
      standard: `${gitDataSection}

You are an expert software engineer.  
Write a **standard** **production-ready** Pull Request description in clean Markdown.
${finalAiInstruction}  

Follow this exact structure:

# Title
[Short, clear title summarizing the change in under 10 words.]

## Summary of Changes
[Concise high-level overview of what this PR does, focusing on the end result.]

## What Was Changed
[List the specific code modifications, features added, bugs fixed, or files updated. Use bullet points for clarity.]

## Why This Change Was Made
[Explain the rationale, problem solved, or context from related work.]


## Technical Details
[Include implementation specifics, relevant algorithms, dependencies, DB changes, env vars, or API modifications.]


## How to Test
1. Checkout this branch.
2. Run \`npm install\` and \`npm run dev\`.
3. Navigate to **[feature/page/URL]**.
4. Perform **[specific actions]**.
5. Verify **[expected results]**.


## Breaking Changes
[List any breaking changes or write \`None\`. Include migration steps if applicable.]
**NOTE** Breaking Changes **includes but not limited** to the following conditions:

1. A new feature implemented
2. A Big refactor to current implementation

## Related Issues / References
[Optional: Link to Jira ticket, GitHub issue, or related PR.]
`,

      detailed: `${gitDataSection}

You are an expert software engineer.  
Write a **production-ready** and **comprehensive** Pull Request description in clean Markdown.  
${finalAiInstruction}

Follow this exact structure:

# Title
[Short, clear title summarizing the change in under 10 words.]

## Summary of Changes
[Brief high-level overview of what this PR achieves.]

## Changes Made
[Detailed bullet list of modifications, new features, and fixes.]

## Technical Details
[Explain the approach, important design decisions, dependencies, DB changes, env vars, or API changes.]

## Testing
[Steps to test the PR — actions, expected results, and verification points.]

## Breaking Changes
[List any breaking changes or write \`None\`. Include migration instructions if necessary.]

## Additional Notes
[Optional extra context, performance considerations, or known limitations.]
`,

      minimal: `${gitDataSection}

You are an expert software engineer.  
Write a **concise** and **minimal** Pull Request description in clean Markdown.  
${finalAiInstruction}

Follow this exact structure:

# Title
[Short, clear title summarizing the change.]

## Summary
[A two line summary of what was changed.]

## Key Changes
[Bullet points summarizing the main changes.]
`,
    };

    return templates[template as keyof typeof templates] || templates.standard;
  }

  const prompt = buildPrompt(
    changes,
    options.template,
    fileSummaries,
    options.customTemplateContent
  );

  if (options.refineFrom) {
    const prev = options.refineFrom.trim();
    const refinePrompt = `Previous PR description:
"
${prev}
"

Based on the git diff below, improve or correct the suggestion to make it more clear, complete, and professional. Return ONLY the corrected PR content (no explanation):
<diff>
${fileSummaries}
</diff>

Rules:
- Do not include any meta information or explanations — just the PR content
- Do not include labels like "PR Description:", "Title:", or meta text — only the final PR content.
- Do not include any labels like "Here's a suggested PR description", "Feel free to modify it"
${options.template ? `- Follow the ${options.template} template structure` : ""}
${
  options.customTemplateContent
    ? `- Follow the provided custom template structure`
    : ""
}
`;
    try {
      const res = await generateText({
        model,
        prompt: refinePrompt,
        temperature: 0.15,
        maxTokens: 800,
      });
      const out = (
        (res as any)?.text ??
        (res as any)?.output?.[0]?.content ??
        ""
      ).trim();
      return out || prev;
    } catch (err) {
      // just fallback to original prompt
      console.error("Error during refine:", err);
      return prev;
    }
  }

  try {
    const res = await generateText({
      model,
      prompt,
      temperature: 0.3,
      maxTokens: 800,
    });
    return (
      (res as any)?.text ??
      (res as any)?.output?.[0]?.content ??
      "Error: No response from AI"
    ).trim();
  } catch (err) {
    console.error("Error during PR generation:", err);
    return "Error: Unable to generate PR description";
  }
}
