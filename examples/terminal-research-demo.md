# Terminal Research Demo

This example demonstrates how to use Task Master's enhanced research command with terminal command execution capabilities.

## Basic Terminal Command Research

Execute a command before research to get real-time context:

```bash
# Get current git status and use it in research
task-master research "What changes have I made and what should I test?" --terminal="git status,git diff" --execute-first

# Check test results and get recommendations
task-master research "Which tests are failing and why?" --terminal="npm test" --execute-first

# Analyze build errors
task-master research "How can I fix these build errors?" --terminal="npm run build" --execute-first
```

## Include Commands in Prompt (Without Execution)

Let the AI know which commands are available without executing them:

```bash
# AI will consider these commands when formulating response
task-master research "How should I debug this issue?" --terminal="npm run debug,npm run test:watch"
```

## Combine with Other Context Options

Use terminal commands alongside task and file context:

```bash
# Research with multiple context sources
task-master research "How can I improve performance?" \
  --id=15,16 \
  --files=src/performance.js \
  --terminal="npm run benchmark" \
  --execute-first

# Include project structure with system info
task-master research "What's the best deployment strategy?" \
  --tree \
  --terminal="node --version,npm list --depth=0" \
  --execute-first
```

## Save Research Results

Execute commands and save results to tasks:

```bash
# Research and save to a specific task
task-master research "What's causing the memory leak?" \
  --terminal="npm run profile,ps aux | grep node" \
  --execute-first \
  --save-to=23

# Research and save to a subtask
task-master research "How to optimize this query?" \
  --terminal="npm run db:explain" \
  --execute-first \
  --save-to=15.3
```

## Using Claude Code Provider

To use the enhanced Claude Code provider with terminal capabilities:

1. Update your `.taskmasterconfig` to use `claude-code` as a provider:

```json
{
  "models": {
    "research": {
      "provider": "claude-code",
      "modelId": "claude-3-7-sonnet-20250219"
    }
  }
}
```

2. The Claude Code provider will automatically handle terminal commands when specified.

## Safety Features

The terminal service includes safety checks to prevent dangerous commands:

- Commands like `rm -rf`, `sudo`, and dangerous patterns are blocked
- Output is truncated if too large
- Commands have a timeout (default 30 seconds)
- Only whitelisted safe commands are allowed by default

## Examples of Blocked Commands

These commands will be blocked for safety:

```bash
# These will NOT execute
task-master research "Clean up files" --terminal="rm -rf node_modules"
task-master research "System info" --terminal="sudo cat /etc/passwd"
```

## Custom Claude Commands

The Claude Code provider supports special commands:

```bash
# Search for patterns across the codebase
task-master research "Where is authentication handled?" --terminal="claude-search auth"

# Analyze specific files
task-master research "What does this module do?" --terminal="claude-analyze src/auth.js"

# Get AI explanations of code
task-master research "How does this work?" --terminal="claude-explain src/complex-algorithm.js"
```