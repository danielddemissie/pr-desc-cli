# PR Description CLI

An intelligent command-line interface (CLI) tool designed to streamline your development workflow by automatically generating comprehensive Pull Request (PR) descriptions from your Git changes. Leveraging free and open-source AI models, `pr-desc` analyzes your commits and file modifications to craft clear, concise, and structured PR summaries, saving you time and ensuring consistent documentation.

## Features

- 🤖 **AI-Powered Generation**: Utilizes advanced AI models to analyze Git diffs, commit messages, and file changes for intelligent description generation.
- 📝 **Flexible Output Templates**: Choose from predefined `standard`, `detailed`, or `minimal` PR description formats to match your team's conventions.
- ⚡ **Fast & Free**: Integrates with high-performance, free-tier AI providers like **Groq** or local models via **Ollama**, ensuring rapid generation without cost barriers.
- 🔑 **Seamless Configuration**: Store API keys and default settings globally, allowing `pr-desc` to be used effortlessly from any project directory.
- 📋 **Model Transparency**: Easily list and select from a range of supported AI models for each provider.
- ✨ **Custom Template Files**: Provide your own Markdown file as a template for highly tailored PR descriptions.
- 🚀 **Direct PR Creation**: Automatically **create or update GitHub Pull Requests** directly from the CLI populated with AI-generated descriptions.
- 👀 **Preview & Regenerate**: When generating PR descriptions, preview the content first, then decide whether to regenerate, proceed, or cancel.
- 🔧 **Robust & Reliable**: Built with TypeScript for enhanced type safety and maintainability.
- 🧪 **Dry Run Mode for Generation**: Preview AI-generated PR descriptions without actually creating a PR or consuming API quotas.

## Installation

To get started with `pr-desc`, install it globally via npm:

```bash
npm install -g pr-desc-cli
```

## Setup (Recommended)

Before using `pr-desc` to generate descriptions, you need to configure your AI provider's API key if you're not using a local model like Llama3.1. You have several convenient options:

### Setup with Interactive Wizard (Recommended)

For a quick and guided setup, run the interactive wizard:

```bash
pr-desc init
```

This will prompt you for your preferred AI provider, API keys, default template, and base branch, saving your choices to a global configuration file.

## Manual Setup

### Option 1: Use Providers Like Groq

This method stores your API key securely in a global configuration file (`~/.pr-desc/config.json`), making it accessible from any directory.

**For Groq (recommended for speed):**

```bash
pr-desc config set groq your_groq_api_key_here
```

You can verify your stored configuration at any time:

```bash
pr-desc config show
```

### Option 2: Use Local Models with Ollama

For a good balance of performance and resource usage, I recommend using `llama3.1:70b`. It's powerful yet efficient for generating PR descriptions.

**Setup Steps:**

1. **Install Ollama**:

   - Download the macOS application from [https://ollama.ai/download](https://ollama.ai/).

2. **Pull the `llama3.1:70b` Model**:
   Open your Terminal and run:

   ```bash
   ollama pull llama3.1:70b
   ```

3. Set your provider config to `local`

   ```bash
   pr-desc config set local ollama
   ```

4. **Use `pr-desc` with the Local Model**:
   Once `llama3.1:70b` is pulled, specify the `local` provider and model:

   ```bash
   pr-desc generate --provider local --model llama3.1:70b
   ```

## Usage

Try `pr-desc` in any of your local Git repositories with unmerged changes to generate a PR description.

### Generate PR Description

```bash
pr-desc generate

pr-desc gen -b develop # Use a different base branch for comparison

pr-desc gen --template detailed # Apply a predefined PR template style

pr-desc gen --template-file ./my-pr-template.md # Use a custom template file

pr-desc gen --max-files 15 # Limit the number of files analyzed (default is 20)

pr-desc generate --dry-run # Returns a decorated preview output

pr-desc gen --gh-pr # Create or update existing GitHub PR using gh CLI
```

### Seamless Integration with GitHub CLI (`gh`)

You can seamlessly integrate `pr-desc` with the [GitHub CLI](https://cli.github.com/) to automatically create or edit pull requests with the AI-generated description.

**Prerequisites:**

1. **Install GitHub CLI (`gh`)**: Follow the installation instructions on the [official GitHub CLI documentation](https://cli.github.com/).
2. **Authenticate `gh`**: Run `gh auth login` and follow the prompts to authenticate with your GitHub account.

**How to use:**

```bash
pr-desc gen --gh-pr
```

🆒 **Cool addition**: If issues occur (like uncommitted changes or a branch not pushed to origin), `pr-desc` will guide you through them.

### List Available Models

Discover which AI models are supported by each provider:

```bash
pr-desc models # List all available providers and their default models
pr-desc models --help
```

### Manage Configuration

Control your `pr-desc` settings and API keys:

```bash
pr-desc config show # Display your entire global configuration
pr-desc config --help # Show all options
```

## Available Templates

`pr-desc` offers three built-in templates to structure your PR descriptions:

- `standard` - (Default) A balanced description including a clear title, a summary of changes, rationale, and notes.
- `detailed` - A comprehensive description with dedicated sections for Summary, Changes Made, Technical Details, Testing instructions, Breaking Changes, and Additional Notes.
- `minimal` - A concise one-line summary followed by brief bullet points.

```bash
pr-desc gen --template <template>
```

## Use Custom Template

You can provide your own Markdown file as a template for generating PR descriptions using the `--template-file <path>` option.

**Example `my-pr-template.md`:**

```markdown
# Title

[Short, clear title summarizing the change in under 10 words.]

## Summary of Changes

[Concise, high-level overview of what this pull request does.]

## What Was Changed

[List specific modifications, features added, bugs fixed, or files updated.]

## Why This Change Was Made

[Explain the reason for the change. Include the problem it solves.]

## Technical Details

[Include implementation details, dependencies, DB changes, env vars, APIs.]

## Breaking Changes

[List any breaking changes or write `None`. Include migration instructions.]
```

The AI will analyze the git changes and fill in the sections of your custom template.

## Supported Providers & Available Models

The CLI supports the following providers and models. Use `-m` / `--model` to specify:

| Provider | Default Model       | Other Options                                                                                                                                         |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groq     | `claude-3.5-sonnet` | `llama-3.1-70b-versatile`, `llama-3.3-70b-versatile`, `mixtral-8x22b-instruct`, `gemma2-27b-it`, `deepseek-v3`                                        |
| Local    | `llama3.1:70b`      | `codegemma:2b`, `phi3:3.8b-mini-4k-instruct`, `qwen2-coder:32b`, `mixtral:8x22b`, `gemma2:27b`, `deepseek-coder:33b`, `llama3.3:70b`, `codellama:70b` |
