import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { GitChanges, GenerateOptions } from "./types.js";

export async function generatePRDescription(
  changes: GitChanges,
  options: GenerateOptions
): Promise<string> {
  const model = getAIModel(options.provider, options.model);
  const prompt = buildPrompt(changes, options.template);

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.7,
    maxTokens: 1000,
  });

  return text;
}

function getAIModel(provider: string, modelName?: string) {
  switch (provider) {
    case "groq":
      const groq = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      });
      return groq(modelName || "llama-3.1-70b-versatile");

    case "deepinfra":
      const deepinfra = createOpenAI({
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey: process.env.DEEPINFRA_API_KEY,
      });
      return deepinfra(modelName || "meta-llama/Meta-Llama-3.1-70B-Instruct");

    case "local":
      const ollama = createOpenAI({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama", // Ollama doesn't need a real API key
      });
      return ollama(modelName || "llama3.1");

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function buildPrompt(changes: GitChanges, template: string): string {
  const basePrompt = `
You are an expert software engineer writing a Pull Request description. 
Analyze the following git changes and create a comprehensive PR description.

## Git Changes Summary:
- Files changed: ${changes.files.length}
- Insertions: ${changes.stats.insertions}
- Deletions: ${changes.stats.deletions}
- Commits: ${changes.commits.length}

## Recent Commits:
${changes.commits.map((commit) => `- ${commit.message}`).join("\n")}

## File Changes:
${changes.files
  .map(
    (file) => `
**${file.path}** (${file.status})
${file.additions > 0 ? `+${file.additions}` : ""} ${
      file.deletions > 0 ? `-${file.deletions}` : ""
    }
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

  const templates = {
    standard: `${basePrompt}

Create a PR description with:
1. A clear, concise title
2. What changes were made
3. Why these changes were necessary
4. Any breaking changes or important notes

Format as markdown.`,

    detailed: `${basePrompt}

Create a detailed PR description with:
1. ## Summary - Brief overview
2. ## Changes Made - Detailed list of changes
3. ## Technical Details - Implementation specifics
4. ## Testing - How to test these changes
5. ## Breaking Changes - Any breaking changes
6. ## Additional Notes - Any other relevant information

Format as markdown with proper sections.`,

    minimal: `${basePrompt}

Create a minimal PR description with:
- One line summary of what was changed
- Brief bullet points of key changes
- Any breaking changes (if applicable)

Keep it concise and to the point.`,
  };

  return templates[template as keyof typeof templates] || templates.standard;
}
