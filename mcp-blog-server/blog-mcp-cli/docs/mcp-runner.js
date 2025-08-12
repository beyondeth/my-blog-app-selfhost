const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runMCP() {
  // Check if local mode
  const isLocal = process.env.BLOG_MCP_LOCAL === 'true';
  const CONFIG_DIR = process.env.BLOG_MCP_CONFIG || (isLocal ? path.join(process.cwd(), '.blog-mcp') : path.join(process.env.HOME, '.blog-mcp'));
  const ENV_FILE = path.join(CONFIG_DIR, '.env');
  const pythonPath = path.join(CONFIG_DIR, 'venv', 'bin', 'python');
  const serverPath = path.join(CONFIG_DIR, 'python', 'src', 'mcp_server.py');
  
  // Check if configured
  if (!fs.existsSync(ENV_FILE)) {
    console.error('Not configured. Run "blog-mcp init" first.');
    process.exit(1);
  }
  
  // Check if Python environment exists
  if (!fs.existsSync(pythonPath)) {
    console.error('Python environment not found. Run "blog-mcp init" again.');
    process.exit(1);
  }
  
  // Load environment variables
  require('dotenv').config({ path: ENV_FILE });
  
  // Run Python MCP server
  const proc = spawn(pythonPath, [serverPath], {
    cwd: CONFIG_DIR,
    env: {
      ...process.env,
      PYTHONPATH: path.join(CONFIG_DIR, 'python', 'src'),
      BLOG_MCP_CONFIG: CONFIG_DIR
    },
    stdio: 'inherit'
  });
  
  proc.on('error', (err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
  
  proc.on('exit', (code) => {
    process.exit(code);
  });
}

module.exports = { runMCP };