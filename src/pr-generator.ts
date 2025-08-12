import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  GitChanges,
  GenerateOptions,
  SupportedProviders,
} from "./types.js";
import { getDefaultModel } from "./models.js";
import { getApiKey } from "./config.js";

/**
 * Generate a Pull Request description based on the provided git changes and options.
 * @param changes The git changes to include in the PR description.
 * @param options The options to customize the PR description generation.
 * @returns The generated PR description.
 */
export async function generatePRDescription(
  changes: GitChanges,
  options: GenerateOptions
): Promise<string> {
  const model = getAIModel(options.provider, options.model);
  const prompt = buildPrompt(
    changes,
    options.template,
    options.customTemplateContent,
    options.maxFiles,
    options.maxDiffLines
  );

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.7,
    maxTokens: 1000,
  });

  return text;
}

/**
 * Get the AI model for the specified provider and model name.
 * @param provider The name of the AI provider.
 * @param modelName The name of the model to use (optional).
 * @returns The AI model instance.
 */
function getAIModel(provider: string, modelName?: string) {
  const defaultModel = getDefaultModel(provider);
  const supportedProviders: SupportedProviders = {
    groq: {
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: getApiKey("groq"),
    },
    deepInfra: {
      baseURL: "https://api.deepinfra.com/v1/openai",
      apiKey: getApiKey("deepinfra"),
    },
    local: {
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama", // NOTE: just for local development
    },
  };

  // handle unsupported providers
  if (!supportedProviders[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const { baseURL, apiKey } = supportedProviders[provider];
  return createOpenAI({
    baseURL,
    apiKey,
  })(modelName || defaultModel);
}

/**
 * Build the prompt for the AI model.
 * @param changes The git changes to include in the prompt.
 * @param template The template to use for the prompt.
 * @param customTemplateContent Custom content to include in the prompt.
 * @param maxFiles The maximum number of files to include in the prompt.
 * @param maxDiffLines The maximum number of diff lines to include in the prompt.
 * @returns The constructed prompt string.
 */
function buildPrompt(
  changes: GitChanges,
  template: string,
  customTemplateContent?: string,
  maxFiles: number = 20,
  maxDiffLines: number = 500
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
}
`;

  // Check for custom template content
  if (customTemplateContent) {
    return `
You are an expert software engineer writing a Pull Request description.
Analyze the following git changes and generate a PR description that strictly adheres to the provided custom Markdown template.
Fill in the sections of the template using the git changes data.

${gitDataSection}

---

## Custom PR Template:
${customTemplateContent}

---

Please generate the PR description by filling the custom template based on the git changes provided.
`;
  }

  const templates = {
    standard: `${gitDataSection}

You are an expert software engineer.  
Write a **standard** **production-ready** Pull Request description in clean Markdown.  
Do **not** include labels like "PR Description:", "Title:", or any meta explanations — only the final PR content.

Follow this exact structure:

# Title
[Short, clear title summarizing the change in under 10 words.]

---

## Summary of Changes
[Concise high-level overview of what this PR does, focusing on the end result.]

---

## What Was Changed
[List the specific code modifications, features added, bugs fixed, or files updated. Use bullet points for clarity.]

---

## Why This Change Was Made
[Explain the rationale, problem solved, or context from related work.]

---

## Technical Details
[Include implementation specifics, relevant algorithms, dependencies, DB changes, env vars, or API modifications.]

---

## How to Test
1. Checkout this branch.
2. Run \`npm install\` and \`npm run dev\`.
3. Navigate to **[feature/page/URL]**.
4. Perform **[specific actions]**.
5. Verify **[expected results]**.

---

## Breaking Changes
[List any breaking changes or write \`None\`. Include migration steps if applicable.]

---

## Related Issues / References
[Optional: Link to Jira ticket, GitHub issue, or related PR.]
`,

    detailed: `${gitDataSection}

You are an expert software engineer.  
Write a **production-ready** and **comprehensive** Pull Request description in clean Markdown.  
Do **not** include labels like "PR Description:", "Title:", or meta text — only the final PR content.

Follow this exact structure:

# Title
[Short, clear title summarizing the change in under 10 words.]

---

## Summary of Changes
[Brief high-level overview of what this PR achieves.]

---

## Changes Made
[Detailed bullet list of modifications, new features, and fixes.]

---

## Technical Details
[Explain the approach, important design decisions, dependencies, DB changes, env vars, or API changes.]

---

## Testing
[Steps to test the PR — actions, expected results, and verification points.]

---

## Breaking Changes
[List any breaking changes or write \`None\`. Include migration instructions if necessary.]

---

## Additional Notes
[Optional extra context, performance considerations, or known limitations.]
`,

    minimal: `${gitDataSection}

You are an expert software engineer.  
Write a **concise** and **minimal** Pull Request description in clean Markdown.  
Do **not** include labels like "PR Description:", "Title:", or meta text — only the final PR content.

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
