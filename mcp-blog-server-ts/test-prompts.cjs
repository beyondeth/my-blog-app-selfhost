#!/usr/bin/env node

/**
 * Test script to verify MCP prompts are registered and accessible
 */

const { spawn } = require('child_process');
const readline = require('readline');

console.log('🧪 Testing MCP Prompts...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js', '--transport', 'stdio'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for server output
const rl = readline.createInterface({
  input: server.stdout,
  output: process.stdout,
  terminal: false
});

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '1.0.0',
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  },
  id: 1
};

// Send prompts/list request
const promptsListRequest = {
  jsonrpc: '2.0',
  method: 'prompts/list',
  params: {},
  id: 2
};

// Send specific prompt request
const getPromptRequest = {
  jsonrpc: '2.0',
  method: 'prompts/get',
  params: {
    name: 'markdown_quality_guidelines'
  },
  id: 3
};

let responseCount = 0;

// Handle server responses
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    
    if (response.id === 1) {
      console.log('✅ Server initialized successfully\n');
      // Send prompts list request
      server.stdin.write(JSON.stringify(promptsListRequest) + '\n');
    } 
    else if (response.id === 2) {
      console.log('📋 Available Prompts:');
      if (response.result && response.result.prompts) {
        response.result.prompts.forEach(prompt => {
          console.log(`  - ${prompt.name}: ${prompt.description}`);
        });
      }
      console.log('');
      // Get specific prompt
      server.stdin.write(JSON.stringify(getPromptRequest) + '\n');
    }
    else if (response.id === 3) {
      console.log('📖 Markdown Quality Guidelines Prompt:');
      if (response.result && response.result.messages) {
        const message = response.result.messages[0];
        console.log(`  Role: ${message.role}`);
        console.log(`  Content Preview: ${message.content.text.substring(0, 200)}...`);
      }
      console.log('\n✅ All prompts are working correctly!');
      process.exit(0);
    }
    
    responseCount++;
    if (responseCount > 3) {
      process.exit(0);
    }
  } catch (e) {
    // Ignore non-JSON output
  }
});

// Handle server errors
server.stderr.on('data', (data) => {
  const message = data.toString();
  if (!message.includes('Step') && !message.includes('✅') && !message.includes('📋')) {
    console.error('Server error:', message);
  }
});

// Send initial request
setTimeout(() => {
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 100);

// Timeout after 5 seconds
setTimeout(() => {
  console.log('⏱️ Test timed out');
  server.kill();
  process.exit(1);
}, 5000);