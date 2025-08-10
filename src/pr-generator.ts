import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { GitChanges, GenerateOptions } from "./types.js";
import { getDefaultModel } from "./models.js";
import { getApiKey } from "./config.js";

export async function generatePRDescription(
  changes: GitChanges,
  options: GenerateOptions
): Promise<string> {
  const model = getAIModel(options.provider, options.model);
  const prompt = buildPrompt(
    changes,
    options.template,
    options.customTemplateContent
  );

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.7,
    maxTokens: 1000,
  });

  return text;
}

function getAIModel(provider: string, modelName?: string) {
  const defaultModel = getDefaultModel(provider);

  switch (provider) {
    case "groq":
      const groqApiKey = getApiKey("groq");
      if (!groqApiKey) {
        throw new Error(
          "GROQ_API_KEY not found. Set it globally with 'export GROQ_API_KEY=your_key' or use 'pr-desc config set groq your_key'"
        );
      }
      const groq = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: groqApiKey,
      });
      return groq(modelName || defaultModel);

    case "deepinfra":
      const deepinfraApiKey = getApiKey("deepinfra");
      if (!deepinfraApiKey) {
        throw new Error(
          "DEEPINFRA_API_KEY not found. Set it globally with 'export DEEPINFRA_API_KEY=your_key' or use 'pr-desc config set deepinfra your_key'"
        );
      }
      const deepinfra = createOpenAI({
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey: deepinfraApiKey,
      });
      return deepinfra(modelName || defaultModel);

    case "local":
      const ollama = createOpenAI({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return ollama(modelName || defaultModel);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function buildPrompt(
  changes: GitChanges,
  template: string,
  customTemplateContent?: string
): string {
  const gitDataSection = `
## Git Changes Data for Analysis:
- Base Branch: ${changes.baseBranch}
- Current Branch: ${changes.currentBranch}
- Files changed: ${changes.files.length}
- Insertions: ${changes.stats.insertions}
- Deletions: ${changes.stats.deletions}

### Recent Commits:
${changes.commits
  .map((commit) => `- ${commit.message} (${commit.hash.slice(0, 7)})`)
  .join("\n")}

### Detailed File Changes:
${changes.files
  .map(
    (file) => `
**${file.path}** (Status: ${file.status}, +${file.additions}, -${
      file.deletions
    })
${
  file.patch
    ? `\`\`\`diff\n${file.patch.slice(0, 500)}${
        file.patch.length > 500 ? "..." : ""
      }\n\`\`\``
    : ""
}
`
  )
  .join("\n")}
`;

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

Create a PR description with:
1. A clear, concise title
2. What changes were made
3. Why these changes were necessary
4. Any breaking changes or important notes

Format as markdown.`,

    detailed: `${gitDataSection}

Create a detailed PR description with:
1. ## Summary - Brief overview
2. ## Changes Made - Detailed list of changes
3. ## Technical Details - Implementation specifics
4. ## Testing - How to test these changes
5. ## Breaking Changes - Any breaking changes
6. ## Additional Notes - Any other relevant information

Format as markdown with proper sections.`,

    minimal: `${gitDataSection}

Create a minimal PR description with:
- One line summary of what was changed
- Brief bullet points of key changes
- Any breaking changes (if applicable)

Keep it concise and to the point.`,
  };

  return templates[template as keyof typeof templates] || templates.standard;
}
