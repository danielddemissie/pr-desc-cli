# PR Description CLI

An intelligent command-line interface (CLI) tool designed to streamline your development workflow by automatically generating comprehensive Pull Request (PR) descriptions from your Git changes. Leveraging free and open-source AI models, `pr-desc` analyzes your commits and file modifications to craft clear, concise, and structured PR summaries, saving you time and ensuring consistent documentation.

## Features

- 🤖 **AI-Powered Generation**: Utilizes advanced AI models to analyze Git diffs, commit messages, and file changes for intelligent description generation.
- 📝 **Flexible Output Templates**: Choose from predefined `standard`, `detailed`, or `minimal` PR description formats to match your team's conventions.
- ⚡ **Fast & Free**: Integrates with high-performance, free-tier AI providers like Groq and DeepInfra, ensuring rapid generation without cost barriers.
- 🔑 **Seamless Configuration**: Store API keys and default settings globally, allowing `pr-desc` to be used effortlessly from any project directory.
- 📋 **Model Transparency**: Easily list and select from a range of supported AI models for each provider.
- 🔧 **Robust & Reliable**: Built with TypeScript for enhanced type safety and maintainability.
- ✍️ **Custom Template Files**: Provide your own Markdown file as a template for highly tailored PR descriptions.

## Installation

To get started with `pr-desc`, install it globally via npm:

```bash
npm install -g pr-desc-cli
```

## Setup

Before using `pr-desc` to generate descriptions, you need to configure your AI provider's API key. You have several convenient options:

### Option 1: Set API Key using the CLI (Recommended)

This method stores your API key securely in a global configuration file (`~/.pr-desc/config.json`), making it accessible from any directory.

**For Groq (recommended for speed):**

pr-desc config set groq your_groq_api_key_here

**For DeepInfra:**

pr-desc config set deepinfra your_deepinfra_api_key_here

You can verify your stored configuration at any time:

```bash
pr-desc config show
pr-desc config get groq
```

### Option 2: Set Environment Variables Globally

Add your API key directly to your shell's profile file (e.g., `~/.bashrc`, `~/.zshrc`, or `~/.profile` on macOS/Linux; system environment variables on Windows).

```bash
# Example for .zshrc or .bashrc

echo 'export GROQ_API_KEY="your_groq_api_key_here"' >> ~/.zshrc
source ~/.zshrc # Reload your shell to apply changes
```

### Option 3: Create a Global `.env` File

Create a `.env` file within the global `pr-desc` configuration directory:

```bash
mkdir -p ~/.pr-desc
echo "GROQ_API_KEY=your_groq_api_key_here" > ~/.pr-desc/.env
```

### Option 4: Use Local Models with Ollama (Offline Generation)

For completely offline PR description generation, you can use local AI models via [Ollama](https://ollama.ai/).

**Recommended Local Model:**
For a good balance of performance and resource usage, we recommend `llama3.1` (the 8B version). It's highly capable for instruction-following and general text generation, making it ideal for PR descriptions.

**Setup Steps for macOS:**

1.  **Install Ollama**:

    - Download the macOS application from [https://ollama.ai/download](https://ollama.ai/download).
    - Install it by dragging the app to your Applications folder.
    - Launch Ollama; it will run in the background.

2.  **Pull the `llama3.1` Model**:
    Open your Terminal and run:

    ```bash
    ollama pull llama3.1
    ```

    This will download the model weights (approx. 4.7 GB).

3.  **Verify Installation**:
    You can list installed models with `ollama list`.

4.  **Use `pr-desc` with the Local Model**:
    Once `llama3.1` is pulled, specify the `local` provider and `llama3.1` model:
    ```bash
    pr-desc generate --provider local --model llama3.1
    ```
    This will use your local `llama3.1` model for generation.

## Usage

Navigate to any of your local Git repositories with unmerged changes to generate a PR description.

### Generate PR Description

```bash
# Generate PR description for current branch compared to 'main' (default)

pr-desc generate

# Use a different base branch for comparison

pr-desc gen -b develop

# Specify an AI provider (e.g., 'deepinfra', 'local' for Ollama)

pr-desc gen -p deepinfra

# Select a specific AI model (use 'pr-desc models' to see options)

pr-desc gen -m "llama-3.1-8b-instant"

# Apply a predefined PR template style

pr-desc gen --template detailed

# Use a custom Markdown template file

# The AI will fill this template based on the git changes.

# See 'Custom Template Files' section below for details.

pr-desc gen --template-file ./my-pr-template.md

# Limit the number of files analyzed to prevent excessive token usage (default is 20)

pr-desc gen --max-files 15
```

### Seamless Integration with GitHub CLI (`gh`)

You can seamlessly integrate `pr-desc` with the [GitHub CLI](https://cli.github.com/) to automatically create pull requests with the AI-generated description, **without creating any temporary files to store pr-desc output**.

**Prerequisites:**

1.  **Install GitHub CLI (`gh`)**: Follow the installation instructions on the [official GitHub CLI documentation](https://cli.github.com/).
2.  **Authenticate `gh`**: Run `gh auth login` and follow the prompts to authenticate with your GitHub account.

**How to use:**

Pipe the output of `pr-desc` directly into `gh pr create`. We'll use `grep -v` to filter out the decorative lines from `pr-desc`'s output, ensuring only the clean Markdown description is passed.

```bash
pr-desc generate | grep -v '═' | grep -v '🚀' | gh pr create --fill --body-file -
```

- `pr-desc generate`: Generates the PR description.
- `| grep -v '═' | grep -v '🚀'`: Pipes the output and filters out lines containing '═' (the separator) and '🚀' (the success message icon).
- `| gh pr create`: Pipes the filtered description to the `gh pr create` command.
- `--fill`: This option tells `gh` to automatically fill in the PR title and body from the current branch's commits. The piped content from `pr-desc` will then override the body.
- `--body-file -`: This crucial part tells `gh pr create` to read the PR body content from standard input (the pipe), instead of a file.

This single command will:

1.  Generate your PR description using AI.
2.  Clean up the output.
3.  Create a new pull request on GitHub, automatically filling its title and using the AI-generated content as its body.

### List Available Models

Discover which AI models are supported by each provider:

```bash
# List all available providers and their default models

pr-desc models

# List all models available for a specific provider

pr-desc models -p groq
```

### Manage Configuration

Control your `pr-desc` settings and API keys:

```bash
# Set an API key for a provider

pr-desc config set <provider> <api-key>

# Example: pr-desc config set groq sk-abc123def456

# Retrieve a stored API key (shows a partial key for security)

pr-desc config get <provider>

# Example: pr-desc config get groq

# Display your entire global configuration

pr-desc config show
```

## Available Templates

`pr-desc` offers three built-in templates to structure your PR descriptions:

- `standard` - (Default) A balanced description including a clear title, a summary of changes, the rationale behind them, and any important notes.
- `detailed` - A comprehensive description with dedicated sections for Summary, Changes Made, Technical Details, Testing instructions, Breaking Changes, and Additional Notes.
- `minimal` - A concise, one-line summary followed by brief bullet points of key changes and any applicable breaking changes.

## Custom Template Files

You can now provide your own Markdown file as a template for generating PR descriptions using the `--template-file <path>` option. This allows for ultimate customization, enabling teams to enforce specific PR formats, include mandatory sections, or embed project-specific guidelines directly into the generated description.

When you use a custom template, `pr-desc` will provide the AI model with all the relevant Git changes data and your template. The AI will then be instructed to fill out your template based on the provided data.

**Example `my-pr-template.md`:**

```markdown
# Pull Request: {{TITLE}}

## Summary of Changes

AI will fill this section with a high-level summary of the changes

## What was changed?

AI will detail the specific modifications made

## Why was this change made?

AI will explain the rationale and problem solved

## Technical Details

AI can elaborate on implementation specifics here

## How to Test

1.  Checkout this branch.
2.  Run \`npm install\` and \`npm run dev\`.
3.  Navigate to [relevant URL/feature].
4.  Verify [specific test steps].

## Breaking Changes (if any)

AI will list any breaking changes or write "None"
```

The AI will analyze the git changes and attempt to fill the sections of your custom template. You can guide the AI by adding comments like `AI will fill this section` within your template.

This provides a powerful way to standardize your team's PRs while still leveraging AI for content generation.

## Available Providers & Models

The CLI supports the following free and open-source AI providers. You can specify a model using the `-m` or `--model` option.

| Provider  | Default Model                       | Other Options                                                                                             |
| --------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Groq      | `llama-3.3-70b-versatile`           | `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`                                              |
| DeepInfra | `meta-llama/Llama-3.3-70B-Instruct` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`, `deepseek-ai/DeepSeek-V3`, `deepseek-ai/DeepSeek-R1-Turbo` |
| Local     | `llama3.3`                          | `llama3.1`, `codellama`, `deepseek-r1`                                                                    |
