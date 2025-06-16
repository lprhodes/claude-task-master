# Terminal Commands in Research

Task Master's research command now supports executing terminal commands to provide real-time context for AI-powered research queries. This feature allows you to gather dynamic information from your development environment and include it in your research context.

## Overview

The terminal command feature allows you to:
- Execute commands before research to get real-time context
- Include command outputs in your AI research queries
- Safely run development-related commands with built-in security
- Combine terminal output with other context sources (tasks, files, etc.)

## Basic Usage

### Execute Commands Before Research

Use `--terminal` with `--execute-first` to run commands and include their output:

```bash
task-master research "What's causing the build failure?" \
  --terminal="npm run build" \
  --execute-first
```

### Multiple Commands

Separate multiple commands with commas:

```bash
task-master research "How can I improve test coverage?" \
  --terminal="npm test,npm run coverage" \
  --execute-first
```

### Include Commands in Prompt (Without Execution)

Omit `--execute-first` to include commands in the prompt without running them:

```bash
task-master research "How should I debug this issue?" \
  --terminal="npm run debug,npm run test:watch"
```

## Advanced Examples

### Combine with Task Context

```bash
task-master research "How can I fix the authentication bug?" \
  --id=15,16 \
  --terminal="npm test auth.test.js" \
  --execute-first
```

### Combine with File Context

```bash
task-master research "Why is this function slow?" \
  --files=src/performance.js \
  --terminal="npm run profile" \
  --execute-first
```

### Full Context Research

```bash
task-master research "What's the deployment status?" \
  --id=23 \
  --files=deploy.config.js \
  --tree \
  --terminal="git status,npm run build,docker ps" \
  --execute-first
```

## Common Use Cases

### 1. Debugging Test Failures

```bash
task-master research "Which tests are failing and why?" \
  --terminal="npm test" \
  --execute-first
```

### 2. Analyzing Build Errors

```bash
task-master research "How can I fix these TypeScript errors?" \
  --terminal="npm run typecheck" \
  --execute-first
```

### 3. Performance Investigation

```bash
task-master research "What's causing the memory leak?" \
  --terminal="npm run profile,ps aux | grep node" \
  --execute-first
```

### 4. Dependency Analysis

```bash
task-master research "Which packages need updating?" \
  --terminal="npm outdated,npm audit" \
  --execute-first
```

### 5. Git Context

```bash
task-master research "What changes need to be tested?" \
  --terminal="git status,git diff" \
  --execute-first
```

## Safety Features

The terminal service includes several safety mechanisms:

### Blocked Commands

The following patterns are automatically blocked:
- `rm -rf` - Destructive file removal
- `sudo` - Elevated privileges
- `chmod 777` - Dangerous permission changes
- `curl ... | sh` - Remote code execution
- `wget ... | sh` - Remote code execution

### Safe Commands Whitelist

These commands are always allowed:
- `ls`, `pwd`, `echo`, `cat`, `grep`, `find`, `which`
- `npm list`, `npm run`, `yarn list`, `yarn run`
- `git status`, `git log`, `git branch`, `git diff`
- `node --version`, `npm --version`, `yarn --version`

### Output Limits

- Maximum output: 10KB per command
- Timeout: 30 seconds per command
- Output is truncated if too large

## Using Claude Code Provider

To enhance terminal command capabilities, use the `claude-code` provider:

1. Update `.taskmasterconfig`:

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

2. The Claude Code provider offers enhanced features:
   - Better understanding of terminal output
   - Special Claude commands (see below)
   - Optimized for development workflows

## Special Claude Commands

When using the `claude-code` provider, these special commands are available:

### claude-search

Search for patterns across your codebase:

```bash
task-master research "Where is user authentication implemented?" \
  --terminal="claude-search auth" \
  --execute-first
```

### claude-analyze

Analyze specific files or directories:

```bash
task-master research "What does this module do?" \
  --terminal="claude-analyze src/auth" \
  --execute-first
```

### claude-explain

Get AI-powered explanations of code:

```bash
task-master research "How does this algorithm work?" \
  --terminal="claude-explain src/complex-algorithm.js" \
  --execute-first
```

## Best Practices

1. **Use Specific Commands**: Be specific about what information you need
   ```bash
   # Good
   --terminal="npm test src/auth"
   
   # Less specific
   --terminal="npm test"
   ```

2. **Combine Multiple Context Sources**: Use terminal commands with tasks and files
   ```bash
   task-master research "How to fix this bug?" \
     --id=15 \
     --files=src/buggy-file.js \
     --terminal="npm test buggy-file.test.js" \
     --execute-first
   ```

3. **Save Important Results**: Use `--save-to` to preserve research
   ```bash
   task-master research "Production error analysis" \
     --terminal="npm run logs:prod" \
     --execute-first \
     --save-to=45
   ```

4. **Use for Real-Time Information**: Terminal commands are best for dynamic data
   - Test results
   - Build status
   - System state
   - Git changes

## Troubleshooting

### Command Blocked

If a command is blocked:
1. Check if it matches a dangerous pattern
2. Use alternative safe commands
3. Break complex commands into safer parts

### Command Times Out

If a command times out:
1. Ensure the command completes within 30 seconds
2. Use more specific commands that run faster
3. Consider breaking long-running commands into parts

### Output Truncated

If output is truncated:
1. Use more specific commands to reduce output
2. Filter output using grep or similar tools
3. Focus on the most relevant information

## Examples by Scenario

### Frontend Development

```bash
# Component testing
task-master research "Why is this component test failing?" \
  --files=src/components/Button.tsx \
  --terminal="npm test Button.test.tsx" \
  --execute-first

# Bundle analysis
task-master research "How can I reduce bundle size?" \
  --terminal="npm run build:analyze" \
  --execute-first
```

### Backend Development

```bash
# API testing
task-master research "Why is the API endpoint failing?" \
  --files=src/api/users.js \
  --terminal="npm test users.test.js,curl -I http://localhost:3000/api/users" \
  --execute-first

# Database queries
task-master research "How to optimize this query?" \
  --terminal="npm run db:explain 'SELECT * FROM users WHERE active = true'" \
  --execute-first
```

### DevOps

```bash
# Container status
task-master research "What's the status of our services?" \
  --terminal="docker ps,docker-compose ps" \
  --execute-first

# Deployment readiness
task-master research "Are we ready to deploy?" \
  --terminal="npm test,npm run build,git status" \
  --execute-first
```