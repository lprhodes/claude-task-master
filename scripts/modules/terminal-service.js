import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { log } from './utils.js';

const execAsync = promisify(exec);

export class TerminalService {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.timeout = options.timeout || 30000;
    this.maxOutputLength = options.maxOutputLength || 10000;
    this.safeCommands = new Set([
      'ls', 'pwd', 'echo', 'cat', 'grep', 'find', 'which',
      'npm list', 'npm run', 'yarn list', 'yarn run',
      'git status', 'git log', 'git branch', 'git diff', 'git --version',
      'node --version', 'npm --version', 'yarn --version'
    ]);
  }

  /**
   * Validates if a command is safe to execute
   */
  isCommandSafe(command) {
    const dangerousPatterns = [
      /rm\s+-rf/i,
      />\s*\/dev\/null/,
      /sudo/i,
      /chmod\s+777/i,
      /curl.*\|.*sh/i,
      /wget.*\|.*sh/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return false;
      }
    }

    // Check if command starts with a known safe command
    const baseCommand = command.trim().split(' ')[0];
    return this.safeCommands.has(baseCommand) || 
           Array.from(this.safeCommands).some(safe => command.startsWith(safe));
  }

  /**
   * Execute a terminal command with safety checks
   */
  async executeCommand(command, options = {}) {
    const startTime = Date.now();
    
    try {
      // Safety check
      if (!options.skipSafetyCheck && !this.isCommandSafe(command)) {
        log('warn', `Potentially unsafe command blocked: ${command}`);
        return {
          command,
          stdout: '',
          stderr: 'Command blocked for safety reasons',
          exitCode: 1,
          duration: Date.now() - startTime,
          blocked: true
        };
      }

      log('debug', `Executing command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd || this.projectRoot,
        timeout: options.timeout || this.timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        env: { ...process.env, ...options.env }
      });

      const duration = Date.now() - startTime;
      
      return {
        command,
        stdout: this.truncateOutput(stdout),
        stderr: this.truncateOutput(stderr),
        exitCode: 0,
        duration,
        truncated: stdout.length > this.maxOutputLength || stderr.length > this.maxOutputLength
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        command,
        stdout: this.truncateOutput(error.stdout || ''),
        stderr: this.truncateOutput(error.stderr || error.message),
        exitCode: error.code || 1,
        duration,
        error: true
      };
    }
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeCommands(commands, options = {}) {
    const results = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(command, options);
      results.push(result);
      
      // Stop on error unless specified otherwise
      if (result.exitCode !== 0 && !options.continueOnError) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute a command synchronously (for simple operations)
   */
  executeCommandSync(command, options = {}) {
    try {
      if (!options.skipSafetyCheck && !this.isCommandSafe(command)) {
        throw new Error('Command blocked for safety reasons');
      }

      const stdout = execSync(command, {
        cwd: options.cwd || this.projectRoot,
        timeout: options.timeout || this.timeout,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      return {
        stdout: this.truncateOutput(stdout),
        exitCode: 0
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error.message,
        exitCode: error.status || 1
      };
    }
  }

  /**
   * Execute Claude code terminal commands with special handling
   */
  async executeClaudeCodeCommand(command, context = {}) {
    // Special handling for Claude code commands
    const claudeCommands = {
      'claude-search': this.claudeSearch.bind(this),
      'claude-analyze': this.claudeAnalyze.bind(this),
      'claude-explain': this.claudeExplain.bind(this)
    };

    const [cmdName, ...args] = command.split(' ');
    
    if (claudeCommands[cmdName]) {
      return await claudeCommands[cmdName](args.join(' '), context);
    }

    // Fall back to regular command execution
    return await this.executeCommand(command, { ...context, skipSafetyCheck: false });
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

    const results = await this.executeCommands(searchCommands, { continueOnError: true });
    
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

    const results = await this.executeCommands(analyzeCommands, { continueOnError: true });
    
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
    // This would integrate with the AI service to explain code
    return {
      command: `claude-explain ${target}`,
      explanation: 'This command would use AI to explain the specified code or file'
    };
  }

  /**
   * Truncate output if it exceeds max length
   */
  truncateOutput(output) {
    if (!output || output.length <= this.maxOutputLength) {
      return output;
    }

    const truncated = output.substring(0, this.maxOutputLength);
    return truncated + '\n... (output truncated)';
  }

  /**
   * Format command results for display
   */
  formatResult(result) {
    const status = result.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
    const duration = chalk.gray(`(${result.duration}ms)`);
    
    let output = `${status} ${chalk.cyan(result.command)} ${duration}\n`;
    
    if (result.stdout) {
      output += chalk.gray('Output:\n') + result.stdout + '\n';
    }
    
    if (result.stderr) {
      output += chalk.red('Error:\n') + result.stderr + '\n';
    }
    
    if (result.truncated) {
      output += chalk.yellow('(Output was truncated)\n');
    }
    
    return output;
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    const commands = [
      'node --version',
      'npm --version',
      'git --version',
      'pwd'
    ];

    const results = await this.executeCommands(commands, { continueOnError: true });
    
    return {
      nodeVersion: results[0]?.stdout?.trim(),
      npmVersion: results[1]?.stdout?.trim(),
      gitVersion: results[2]?.stdout?.trim(),
      workingDirectory: results[3]?.stdout?.trim()
    };
  }

  /**
   * Check if a command is available
   */
  async isCommandAvailable(command) {
    const result = await this.executeCommand(`which ${command}`, { skipSafetyCheck: true });
    return result.exitCode === 0;
  }
}

// Export a singleton instance
export const terminalService = new TerminalService();