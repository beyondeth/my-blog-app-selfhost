const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

function getConfigDir() {
  return process.env.BLOG_MCP_LOCAL === 'true' 
    ? path.join(process.cwd(), '.blog-mcp') 
    : path.join(process.env.HOME, '.blog-mcp');
}

async function checkPython() {
  // Try to find Python 3
  const pythonCommands = ['python3', 'python'];
  
  for (const cmd of pythonCommands) {
    try {
      const result = await new Promise((resolve) => {
        const proc = spawn(cmd, ['--version']);
        proc.on('close', (code) => resolve(code === 0));
      });
      
      if (result) {
        return cmd;
      }
    } catch {}
  }
  
  throw new Error('Python 3 not found. Please install Python 3.8 or higher.');
}

async function setupPython() {
  const CONFIG_DIR = getConfigDir();
  const VENV_DIR = path.join(CONFIG_DIR, 'venv');
  
  const python = await checkPython();
  
  // Create virtual environment
  console.log(chalk.gray('Creating Python virtual environment...'));
  await new Promise((resolve, reject) => {
    const proc = spawn(python, ['-m', 'venv', VENV_DIR]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Failed to create virtual environment'));
    });
  });
  
  // Copy Python MCP server files
  const sourceDir = path.join(__dirname, '..', 'python');
  const targetDir = path.join(CONFIG_DIR, 'python');
  
  await fs.mkdir(targetDir, { recursive: true });
  await copyDir(sourceDir, targetDir);
  
  // Install dependencies
  console.log(chalk.gray('Installing Python dependencies...'));
  const pip = path.join(VENV_DIR, 'bin', 'pip');
  
  await new Promise((resolve, reject) => {
    const proc = spawn(pip, ['install', '-r', path.join(targetDir, 'requirements.txt')]);
    proc.stdout.on('data', (data) => {
      console.log(chalk.gray(data.toString().trim()));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Failed to install dependencies'));
    });
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

module.exports = {
  setupPython
};