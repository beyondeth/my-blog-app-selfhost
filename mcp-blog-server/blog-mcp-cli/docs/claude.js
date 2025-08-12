const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

const CLAUDE_CONFIG = path.join(process.env.HOME, '.claude', 'claude_desktop_config.json');

function getConfigDir() {
  return process.env.BLOG_MCP_LOCAL === 'true' 
    ? path.join(process.cwd(), '.blog-mcp') 
    : path.join(process.env.HOME, '.blog-mcp');
}

async function updateClaudeConfig() {
  try {
    // Read existing config
    let config = {};
    try {
      const content = await fs.readFile(CLAUDE_CONFIG, 'utf-8');
      config = JSON.parse(content);
    } catch {
      console.log(chalk.yellow('Claude config not found, creating new one...'));
    }
    
    // Ensure mcpServers object exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add our MCP server
    const CONFIG_DIR = getConfigDir();
    config.mcpServers['my-blog'] = {
      command: 'node',
      args: [
        path.join(__dirname, '..', 'bin', 'blog-mcp.js'),
        'run-mcp'
      ],
      env: {
        BLOG_MCP_CONFIG: CONFIG_DIR,
        BLOG_MCP_LOCAL: process.env.BLOG_MCP_LOCAL || 'false'
      }
    };
    
    // Write updated config
    await fs.mkdir(path.dirname(CLAUDE_CONFIG), { recursive: true });
    await fs.writeFile(CLAUDE_CONFIG, JSON.stringify(config, null, 2));
    
    console.log(chalk.green('✅ Claude Code configuration updated!'));
    console.log(chalk.gray('Restart Claude Code to apply changes.'));
  } catch (err) {
    console.error(chalk.red('Failed to update Claude config:'), err);
  }
}

module.exports = {
  updateClaudeConfig
};