import AnthropicAIProvider from './anthropic.js';
import { terminalService } from '../../scripts/modules/terminal-service.js';
import { log } from '../../scripts/modules/utils.js';

/**
 * Claude Code AI Provider
 * Extends Anthropic provider with terminal command execution capabilities
 */
export default class ClaudeCodeAIProvider extends AnthropicAIProvider {
  constructor() {
    super();
    this.name = 'claude-code';
    this.displayName = 'Claude Code';
    this.description = 'Claude with terminal command execution capabilities';
  }

  /**
   * Override generateText to support terminal commands
   */
  async generateText(params) {
    const { messages, terminalCommands, executeBeforeResearch, projectRoot } = params;
    
    // If no terminal commands, just use parent implementation
    if (!terminalCommands || terminalCommands.length === 0) {
      return super.generateText(params);
    }
    
    // Find system and user messages
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessage = messages.find(m => m.role === 'user');
    
    let enhancedMessages = [...messages];
    
    if (executeBeforeResearch) {
      // Execute commands and include results in context
      const results = await this.executeTerminalCommands(terminalCommands, projectRoot);
      const terminalContext = this.formatTerminalResults(results);
      
      // Update system message with terminal context
      if (systemMessage) {
        const enhancedSystemContent = `${systemMessage.content}\n\n## Terminal Context\n\nThe following terminal commands were executed to provide real-time context:\n\n${terminalContext}`;
        enhancedMessages = messages.map(m => 
          m.role === 'system' 
            ? { ...m, content: enhancedSystemContent }
            : m
        );
      }
    } else {
      // Include commands in user prompt for AI to consider
      const commandList = terminalCommands.map(cmd => `- ${cmd}`).join('\n');
      
      if (userMessage) {
        const enhancedUserContent = `${userMessage.content}\n\n## Available Terminal Commands\n\nConsider the output of these terminal commands when formulating your response:\n${commandList}`;
        enhancedMessages = messages.map(m => 
          m.role === 'user' 
            ? { ...m, content: enhancedUserContent }
            : m
        );
      }
    }
    
    // Call parent generateText with enhanced messages
    return super.generateText({
      ...params,
      messages: enhancedMessages
    });
  }

  /**
   * Execute terminal commands and collect results
   */
  async executeTerminalCommands(commands, projectRoot) {
    const results = [];
    
    for (const command of commands) {
      try {
        const result = await terminalService.executeCommand(command, {
          cwd: projectRoot,
          timeout: 30000
        });
        results.push(result);
      } catch (error) {
        log('warn', `Failed to execute command "${command}": ${error.message}`);
        results.push({
          command,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
          error: true
        });
      }
    }
    
    return results;
  }

  /**
   * Format terminal results for AI context
   */
  formatTerminalResults(results) {
    return results.map((result, index) => {
      let formatted = `### Command ${index + 1}: \`${result.command}\`\n`;
      
      if (result.blocked) {
        formatted += `**Status:** Blocked for safety\n`;
        formatted += `**Reason:** ${result.stderr}\n`;
      } else {
        formatted += `**Exit Code:** ${result.exitCode}\n`;
        
        if (result.stdout) {
          formatted += `**Output:**\n\`\`\`\n${result.stdout}\n\`\`\`\n`;
        }
        
        if (result.stderr && result.exitCode !== 0) {
          formatted += `**Error:**\n\`\`\`\n${result.stderr}\n\`\`\`\n`;
        }
      }
      
      if (result.truncated) {
        formatted += `*Note: Output was truncated*\n`;
      }
      
      return formatted;
    }).join('\n');
  }

  /**
   * Special method for Claude-specific terminal commands
   */
  async executeClaudeCommand(command, context) {
    // Parse Claude-specific commands
    const [cmdName, ...args] = command.split(' ');
    
    switch (cmdName) {
      case 'claude-search':
        return this.claudeSearch(args.join(' '), context);
      case 'claude-analyze':
        return this.claudeAnalyze(args.join(' '), context);
      case 'claude-explain':
        return this.claudeExplain(args.join(' '), context);
      default:
        // Fall back to regular terminal command
        return terminalService.executeCommand(command, context);
    }
  }

  /**
   * Claude-specific search command
   */
  async claudeSearch(query, context) {
    const searchCommands = [
      `grep -r "${query}" ${context.searchPath || '.'}`,
      `find ${context.searchPath || '.'} -name "*${query}*"`,
      `git log --grep="${query}" --oneline -10`
    ];

    const results = await terminalService.executeCommands(searchCommands, { 
      continueOnError: true,
      cwd: context.projectRoot 
    });
    
    return {
      command: `claude-search ${query}`,
      results: results.map(r => ({
        command: r.command,
        matches: r.stdout.split('\n').filter(line => line.trim()).length,
        preview: r.stdout.split('\n').slice(0, 5).join('\n')
      }))
    };
  }

  /**
   * Claude-specific analyze command
   */
  async claudeAnalyze(target, context) {
    const analyzeCommands = [
      `wc -l ${target}`,
      `file ${target}`,
      `head -20 ${target}`
    ];

    const results = await terminalService.executeCommands(analyzeCommands, { 
      continueOnError: true,
      cwd: context.projectRoot 
    });
    
    return {
      command: `claude-analyze ${target}`,
      analysis: {
        lineCount: results[0]?.stdout?.trim(),
        fileType: results[1]?.stdout?.trim(),
        preview: results[2]?.stdout
      }
    };
  }

  /**
   * Claude-specific explain command
   */
  async claudeExplain(target, context) {
    // This integrates with the AI to explain code
    const fileContent = await terminalService.executeCommand(`cat ${target}`, {
      cwd: context.projectRoot
    });
    
    if (fileContent.exitCode === 0) {
      // Use AI to explain the code
      const explanation = await this.generateText({
        systemPrompt: 'You are a code explanation expert. Explain the following code clearly and concisely.',
        prompt: `Explain this code:\n\n\`\`\`\n${fileContent.stdout}\n\`\`\``,
        maxTokens: 500
      });
      
      return {
        command: `claude-explain ${target}`,
        explanation: explanation.text
      };
    }
    
    return {
      command: `claude-explain ${target}`,
      error: 'Could not read file',
      stderr: fileContent.stderr
    };
  }
}