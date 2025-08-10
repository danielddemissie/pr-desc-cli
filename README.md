# PR Description CLI

An AI-powered CLI tool that generates Pull Request descriptions from your git changes using free and open-source AI models.

## Features

- 🤖 **Multiple Free AI Providers**: Groq, DeepInfra, and local Ollama models
- 📝 **Smart Analysis**: Analyzes git diffs, commits, and file changes with improved accuracy
- 🎨 **Multiple Templates**: Standard, detailed, and minimal PR description formats
- ⚡ **Fast & Free**: Uses free AI APIs with no usage limits
- 🔧 **TypeScript**: Built with TypeScript for reliability
- 🔑 **Global Configuration**: Store API keys and default settings globally for easy access from any project.
- 📋 **Model Listing**: Easily view supported models for each provider.

## Installation

### Clone the repository

```bash
git clone https://github.com/danielddemissie/pr-description-cli.git # Replace with your repo URL
cd pr-description-cli
```

### Install dependencies

```bash
npm install
```

### Build the TypeScript code

```bash
npm run build
```

### Link the CLI tool globally (recommended for easy access)

```bash
npm link
```

## Setup

Before using `pr-desc`, you need to set up your API keys. You have a few options:

### Option 1: Set API Key using the CLI (Recommended)

This will store your API key in a global configuration file (`~/.pr-desc/config.json`).

**For Groq:**

pr-desc config set groq your_groq_api_key_here

**For DeepInfra:**

pr-desc config set deepinfra your_deepinfra_api_key_here

You can verify your configuration:

```bash
pr-desc config show
pr-desc config get groq
```

### Option 2: Set Environment Variables Globally

Add the API key to your shell profile (e.g., `~/.bashrc`, `~/.zshrc`, `~/.profile` for macOS/Linux, or system environment variables for Windows).

```bash
# Example for .zshrc or .bashrc

echo 'export GROQ_API_KEY="your_groq_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

### Option 3: Create a Global `.env` File

Create a `.env` file in a global configuration directory:

```bash
mkdir -p ~/.pr-desc
echo "GROQ_API_KEY=your_groq_api_key_here" > ~/.pr-desc/.env
```

## Usage

### Generate PR Description

```bash

# Generate PR description for current branch vs main (default)

pr-desc generate

# Use a different base branch

pr-desc gen -b develop

# Use a different AI provider (e.g., deepinfra, local)

pr-desc gen -p deepinfra

# Use a specific AI model (see 'pr-desc models' for options)

pr-desc gen -m "llama-3.1-8b-instant"

# Use a specific PR template style

pr-desc gen --template detailed

# Limit the number of files analyzed (default is 20)

pr-desc gen --max-files 15
```

### List Available Models

```bash

# List all available providers and their default models

pr-desc models

# List all models for a specific provider

pr-desc models -p groq
```

### Manage Configuration

```bash

# Set an API key

pr-desc config set <provider> <api-key>

# Example: pr-desc config set groq sk-abc123def456

# Get a stored API key (shows partial key for security)

pr-desc config get <provider>

# Example: pr-desc config get groq

# Show the entire global configuration

pr-desc config show
```

## Available Templates

- `standard` - Balanced description with a clear title, changes, reasons, and notes. (Default)
- `detailed` - Comprehensive description with sections for Summary, Changes Made, Technical Details, Testing, Breaking Changes, and Additional Notes.
- `minimal` - Concise summary with bullet points of key changes and breaking changes.

## Available Providers & Models

The CLI supports the following free and open-source AI providers. You can specify a model using the `-m` or `--model` option.
