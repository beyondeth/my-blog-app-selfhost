#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { init, start, stop, status, logs } = require('../lib/commands');

program
  .name('blog-mcp')
  .description('Personal MCP server for blog posting')
  .version('0.3.0');

program
  .command('init')
  .description('Initialize blog MCP configuration')
  .option('-l, --local', 'Use local project directory instead of global')
  .action(async (options) => {
    if (options.local) {
      process.env.BLOG_MCP_LOCAL = 'true';
    }
    await init();
  });

program
  .command('start')
  .description('Start MCP server in background')
  .option('-l, --local', 'Use local project directory')
  .action((options) => {
    if (options.local) process.env.BLOG_MCP_LOCAL = 'true';
    start();
  });

program
  .command('stop')
  .description('Stop MCP server')
  .option('-l, --local', 'Use local project directory')
  .action((options) => {
    if (options.local) process.env.BLOG_MCP_LOCAL = 'true';
    stop();
  });

program
  .command('status')
  .description('Check MCP server status')
  .option('-l, --local', 'Use local project directory')
  .action((options) => {
    if (options.local) process.env.BLOG_MCP_LOCAL = 'true';
    status();
  });

program
  .command('logs')
  .description('View MCP server logs')
  .option('-f, --follow', 'Follow log output')
  .option('-l, --local', 'Use local project directory')
  .action((options) => {
    if (options.local) process.env.BLOG_MCP_LOCAL = 'true';
    logs(options);
  });

// Hidden command for Claude Code integration
program
  .command('run-mcp', { hidden: true })
  .description('Run MCP server directly')
  .action(() => {
    const { runMCP } = require('../lib/mcp-runner');
    runMCP();
  });

program.parse();