# PR Description CLI

An intelligent command-line interface (CLI) tool designed to streamline your development workflow by automatically generating comprehensive Pull Request (PR) descriptions from your Git changes. Leveraging free and open-source AI models, `pr-desc` analyzes your commits and file modifications to craft clear, concise, and structured PR summaries, saving you time and ensuring consistent documentation.

## Features

- 🤖 **AI-Powered Generation**: Utilizes advanced AI models to analyze Git diffs, commit messages, and file changes for intelligent description generation.
- 📝 **Flexible Output Templates**: Choose from predefined `standard`, `detailed`, or `minimal` PR description formats to match your team's conventions.
- ⚡ **Fast & Free**: Integrates with high-performance, free-tier AI providers like Groq and DeepInfra, ensuring rapid generation without cost barriers.
- 🔑 **Seamless Configuration**: Store API keys and default settings globally, allowing `pr-desc` to be used effortlessly from any project directory.
- 📋 **Model Transparency**: Easily list and select from a range of supported AI models for each provider.
- 🔧 **Robust & Reliable**: Built with TypeScript for enhanced type safety and maintainability.
- ✍️ **Custom Template Files (Incoming)**: Soon, you'll be able to provide your own Markdown file as a template for more tailored PR descriptions.

## Installation

To get started with `pr-desc`, install it globally via npm:

```bash
npm install -g pr-desc-cli
```

## Setup

Before using `pr-desc` to generate descriptions, you need to configure your AI provider's API key. You have several convenient options:

### Option 1: Set API Key using the CLI (Recommended)

This method stores your API key securely in a global configuration file (`~/.pr-desc/config.json`), making it accessible from any directory.

# For Groq (recommended for speed):

pr-desc config set groq your_groq_api_key_here

# For DeepInfra:

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

# Limit the number of files analyzed to prevent excessive token usage (default is 20)

pr-desc gen --max-files 15
```

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

## Available Providers & Models

The CLI supports the following free and open-source AI providers. You can specify a model using the `-m` or `--model` option.

| Provider  | Default Model                       | Other Options                                                                                             |
| --------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Groq      | `llama-3.3-70b-versatile`           | `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`                                              |
| DeepInfra | `meta-llama/Llama-3.3-70B-Instruct` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`, `deepseek-ai/DeepSeek-V3`, `deepseek-ai/DeepSeek-R1-Turbo` |
| Local     | `llama3.3`                          | `llama3.1`, `codellama`, `deepseek-r1`                                                                    |

## New Features Incoming!

We're constantly working to enhance `pr-desc`. Here's a highly anticipated feature currently in development:

### Custom Template File

**Feature:** You will soon be able to provide your own Markdown file as a template for generating PR descriptions. This will allow for ultimate customization, enabling teams to enforce specific PR formats, include mandatory sections (e.g., JIRA ticket numbers, test plans), or embed project-specific guidelines directly into the generated description.

**How it will work:** A new command-line option, likely `--template-file <path/to/your/template.md>`, will be introduced. `pr-desc` will read this file, inject the AI-generated content into placeholders within your custom template, and output the final, tailored PR description. This provides a "better way" than just `--template` by giving you full control over the structure and static content of your PRs.

Stay tuned for updates!
