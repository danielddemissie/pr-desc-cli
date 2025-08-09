# PR Description CLI

An AI-powered CLI tool that generates Pull Request descriptions from your git changes using free and open-source AI models.

## Features

- 🤖 **Multiple Free AI Providers**: Groq, DeepInfra, and local Ollama models
- 📝 **Smart Analysis**: Analyzes git diffs, commits, and file changes
- 🎨 **Multiple Templates**: Standard, detailed, and minimal PR description formats
- ⚡ **Fast & Free**: Uses free AI APIs with no usage limits
- 🔧 **TypeScript**: Built with TypeScript for reliability

## Installation

\`\`\`bash
npm install -g pr-description-cli

# or

yarn global add pr-description-cli
\`\`\`

## Setup

1. **Get a free API key** from one of these providers:

   - [Groq](https://console.groq.com) (Recommended - fastest)
   - [DeepInfra](https://deepinfra.com) (Good alternative)
   - [Ollama](https://ollama.ai) (Local models)

2. **Set environment variables**:
   \`\`\`bash
   export GROQ_API_KEY="your_key_here"

# or

export DEEPINFRA_API_KEY="your_key_here"
\`\`\`

3. **Run setup command**:
   \`\`\`bash
   pr-desc setup
   \`\`\`

## Usage

### Basic Usage

\`\`\`bash

# Generate PR description for current branch vs main

pr-desc generate

# Use different base branch

pr-desc gen -b develop

# Use different AI provider

pr-desc gen -p deepinfra

# Use detailed template

pr-desc gen --template detailed
\`\`\`

### Advanced Options

\`\`\`bash
pr-desc generate \
 --base main \
 --provider groq \
 --model llama-3.1-70b-versatile \
 --template detailed \
 --max-files 15
\`\`\`

### Available Templates

- `standard` - Balanced description with key sections
- `detailed` - Comprehensive description with all sections
- `minimal` - Concise summary with bullet points

### Available Providers

- `groq` - Fast, free Groq API (recommended)
- `deepinfra` - DeepInfra free tier
- `local` - Local Ollama models

## Examples

### Standard Template Output

\`\`\`markdown

## Summary

Added user authentication system with JWT tokens and password hashing

## Changes Made

- Implemented JWT-based authentication middleware
- Added password hashing with bcrypt
- Created user registration and login endpoints
- Added protected route middleware

## Breaking Changes

- All API endpoints now require authentication header
- Updated user model schema
  \`\`\`

### Integration with Git Workflow

\`\`\`bash

# After making changes and commits

git add .
git commit -m "Add user authentication"

# Generate PR description

pr-desc gen --template detailed

# Copy output and create PR

gh pr create --title "Add user authentication" --body "$(pr-desc gen)"
\`\`\`

## Development

\`\`\`bash

# Clone and install

git clone <repo>
cd pr-description-cli
npm install

# Run in development

npm run dev generate

# Build

npm run build
