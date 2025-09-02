#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🧪 Testing TypeScript MCP Blog Server...\n');

  // Spawn the TypeScript MCP server
  const serverProcess = spawn('node', ['dist/index.js', '--transport', 'stdio'], {
    env: {
      ...process.env,
      BLOG_API_KEY_ID: 'akid_test123',
      BLOG_API_KEY_SECRET: 'aks_secret456',
      BLOG_API_URL: 'http://localhost:3000/api/v1'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Create MCP client
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js', '--transport', 'stdio'],
    env: {
      BLOG_API_KEY_ID: 'akid_test123',
      BLOG_API_KEY_SECRET: 'aks_secret456',
      BLOG_API_URL: 'http://localhost:3000/api/v1'
    }
  });

  try {
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // List available tools
    const tools = await client.listTools();
    console.log('📋 Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test diagnose_connection tool
    console.log('🔍 Testing diagnose_connection tool...');
    const diagnoseResult = await client.callTool('diagnose_connection', {});
    console.log('Result:', JSON.stringify(diagnoseResult, null, 2));
    console.log('');

    // Test authenticate tool
    console.log('🔐 Testing authenticate tool...');
    const authResult = await client.callTool('authenticate', {});
    console.log('Result:', JSON.stringify(authResult, null, 2));
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    await client.close();
    serverProcess.kill();
  }
}

// Run tests
testMCPServer().catch(console.error);