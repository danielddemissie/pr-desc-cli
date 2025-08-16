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
- ✨ **Interactive Configuration Wizard**: A guided setup process to easily configure `pr-desc` for the first time.
- 🧪 **Dry Run Mode for Generation**: Preview AI-generated PR descriptions without actually creating a PR or consuming API quotas.

---

- 🧠 **AI-Powered PR Review & Feedback (Upcoming)**: Get AI-generated suggestions and improvements for your code and PR descriptions.
- 🚀 **Direct PR Creation (Upcoming)**: Create new GitHub Pull Requests directly from the CLI with AI-generated descriptions.
- ✏️ **PR Description Editing (Upcoming)**: Update existing GitHub Pull Request descriptions with AI-generated content.

## Installation

To get started with `pr-desc`, install it globally via npm:

```bash
npm install -g pr-desc-cli
```

## Setup (Recommended)

Before using `pr-desc` to generate descriptions, you need to configure your AI provider's API key If you're not using Local model like Llama3.1. You have several convenient options:

### Setup with Interactive Wizard (Recommended)

For a quick and guided setup, run the interactive wizard:

```bash
pr-desc init
```

This will prompt you for your preferred AI provider, API keys, default template, and base branch, saving your choices to a global configuration file.

## Manual Setup

### Option 1: Use Providers Like Groq and DeepInfra

This method stores your API key securely in a global configuration file (`~/.pr-desc/config.json`), making it accessible from any directory.

```bash
pr-desc config set <provider> <api-key>
```

- **For Groq (recommended for speed):**

  pr-desc config set groq `your_groq_api_key_here`
  you can get your API key from [groq.com](https://console.groq.com/keys)

- **For DeepInfra:**

  pr-desc config set deepinfra `your_deepinfra_api_key_here`
  you can get your API key from [deepinfra.com](https://deepinfra.com/docs)

### Option 2: Use Local Models with Ollama

    For a good balance of performance and resource usage, I recommend using `llama3.1` (the 8B version, Weights approx 4.7GB). It's light and it's highly capable for instruction-following and general text generation, making it ideal for PR descriptions generation.

**Setup Steps:**

1.  **Install Ollama**:

    - Download the macOS application from [https://ollama.ai/download](https://ollama.ai/).

2.  **Pull the `llama3.1` Model**:
    Open your Terminal and run:

    ```bash
    ollama pull llama3.1
    ```

3.  Set your provider config to `local`

    ```bash
    pr-desc config set local ollama
    ```

4.  **Use `pr-desc` with the Local Model**:
    Once `llama3.1` is pulled, specify the `local` provider and `llama3.1` model:

    ```bash
    pr-desc generate --provider local --model llama3.1
    ```

After setting up `pr-desc` you can verify your stored configuration at any time:

```bash
pr-desc config show
pr-desc config get <provider> # to get config for specific provider
```

## Usage

Try `pr-desc` in any of your local Git repositories with unmerged changes to generate a PR description.

### Generate PR Description

```bash
pr-desc generate

pr-desc gen -b develop # Use a different base branch for comparison

pr-desc gen -p deepinfra # Specify an AI provider (e.g., 'deepinfra', 'local' for Ollama)

pr-desc gen -m "llama-3.1-8b-instant" # Select a specific AI model (use 'pr-desc models' to see options)

pr-desc gen --template detailed # Apply a predefined PR template style

pr-desc gen --template-file ./my-pr-template.md # See 'Custom Template Files' section below for details.

pr-desc gen --max-files 15 # You can limit the number of files analyzed to prevent excessive token usage (default is 20)

pr-desc generate --dry-run # Returns a decorated output
```

### Seamless Integration with GitHub CLI (`gh`)

You can seamlessly integrate `pr-desc` with the [GitHub CLI](https://cli.github.com/) to automatically create or edit pull requests with the AI-generated description.

**Prerequisites:**

1.  **Install GitHub CLI (`gh`)**: Follow the installation instructions on the [official GitHub CLI documentation](https://cli.github.com/).
2.  **Authenticate `gh`**: Run `gh auth login` and follow the prompts to authenticate with your GitHub account.

**How to use:**

Pipe the output of `pr-desc` directly into `gh pr create` or `gh pr edit`.

```bash
pr-desc generate | gh pr create --fill --body-file -
```

This single command will:

1.  Generate your PR description using AI.
2.  Create a new pull request on GitHub, automatically filling its title and using the AI-generated content as its body

### List Available Models

Discover which AI models are supported by each provider:

```bash
pr-desc models # List all available providers and their default models
pr-desc models --help # get all option for models
```

### Manage Configuration

Control your `pr-desc` settings and API keys:

```bash
pr-desc config show # Display your entire global configuration
pr-desc config --help # get all options for config
```

## Available Templates

`pr-desc` offers three built-in templates to structure your PR descriptions:

- `standard` - (Default) A balanced description including a clear title, a summary of changes, the rationale behind them, and any important notes.
- `detailed` - A comprehensive description with dedicated sections for Summary, Changes Made, Technical Details, Testing instructions, Breaking Changes, and Additional Notes.
- `minimal` - A concise, one-line summary followed by brief bullet points of key changes and any applicable breaking changes.

```bash
pr-desc gen template <template>
```

## Use Custom Template

You can now provide your own Markdown file as a template for generating PR descriptions using the `--template-file <path>` option. This allows for ultimate customization, enabling teams to enforce specific PR formats, include mandatory sections, or embed project-specific guidelines directly into the generated description.

When you use a custom template, `pr-desc` will provide the AI model with all the relevant Git changes data and your template. The AI will then be instructed to fill out your template based on the provided data.

**Example `my-pr-template.md`:**

```markdown
# Title

[Short, clear title summarizing the change in under 10 words.]

## Summary of Changes

[Provide a concise, high-level overview of what this pull request does. Focus on the end result, not implementation details.]

## What Was Changed

[List the specific code modifications, features added, bugs fixed, or files updated. Use bullet points for clarity.]

## Why This Change Was Made

[Explain the reason for the change. Include the problem it solves, any related issues, or context from previous work.]

## Technical Details

[Include implementation details, relevant algorithms, dependencies, database changes, environment variables, or API modifications.]

## Breaking Changes

[List any breaking changes or write `None`. Include migration instructions if applicable.]
```

The AI will analyze the git changes and attempt to fill the sections of your custom template. This provides a powerful way to standardize your team's PRs while still leveraging AI for content generation.

## Available Providers & Models

The CLI supports the following free and open-source AI providers. You can specify a model using the `-m` or `--model` option.

| Provider  | Default Model                                 | Other Options                                                                                   |
| --------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Groq      | `llama-3.1-8b-instant`                        | `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`                                 |
| DeepInfra | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | `meta-llama/Llama-3.3-70B-Instruct`, `deepseek-ai/DeepSeek-V3`, `deepseek-ai/DeepSeek-R1-Turbo` |
| Local     | `llama3.1`                                    | `llama3.3`, `codellama`, `deepseek-r1`                                                          |

## Upcoming Features

We're constantly working to enhance `pr-desc` and streamline your development workflow. Here's a sneak peek at what's coming next:

- ### AI-Powered PR Review & Feedback

  **Feature:** Get intelligent, AI-generated feedback on your Pull Requests. `pr-desc` will analyze the code changes and the PR description to provide suggestions for improvements, identify potential issues, and ensure consistency, acting as an automated "first reviewer."

  **Value:** Speeds up the code review process, helps maintain code quality, and ensures PRs are well-documented before human review.

- ### Direct PR Creation

  **Feature:** Create new GitHub Pull Requests directly from the `pr-desc` CLI. This command will generate the PR description using AI and then seamlessly create the PR on GitHub, leveraging the `gh` CLI internally, without any manual piping or temporary files.

  **Value:** Automates the entire PR creation workflow, from description generation to submission, saving time and reducing manual steps.

- ### PR Description Editing

  **Feature:** Update the description of an existing GitHub Pull Request using AI-generated content. You'll be able to specify a PR (by number or URL) and have `pr-desc` generate a new description (or refine the existing one) and apply it directly to the PR. This will also leverage the `gh` CLI internally.

  **Value:** Allows for easy refinement of PR descriptions after initial creation, ensuring they remain accurate and comprehensive as changes evolve.
