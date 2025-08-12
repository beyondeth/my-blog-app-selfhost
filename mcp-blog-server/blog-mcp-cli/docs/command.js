const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const { setupPython } = require('./python');
const { updateClaudeConfig } = require('./claude');

// Function to get config directory based on mode
function getConfigDir() {
  return process.env.BLOG_MCP_LOCAL === 'true' 
    ? path.join(process.cwd(), '.blog-mcp') 
    : path.join(process.env.HOME, '.blog-mcp');
}

// These will be set dynamically
let CONFIG_DIR;
let ENV_FILE;
let CONFIG_FILE;

async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(path.join(CONFIG_DIR, 'logs'), { recursive: true });
}

async function init() {
  // Set config paths
  CONFIG_DIR = getConfigDir();
  ENV_FILE = path.join(CONFIG_DIR, '.env');
  CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
  
  console.log(chalk.blue('🚀 Initializing blog MCP server...'));
  console.log(chalk.gray(`Using config directory: ${CONFIG_DIR}`));
  
  await ensureConfigDir();
  
  // Check if already configured
  try {
    await fs.access(ENV_FILE);
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Configuration already exists. Overwrite?',
      default: false
    }]);
    
    if (!overwrite) {
      console.log(chalk.yellow('Configuration unchanged.'));
      return;
    }
  } catch {}
  
  // Collect configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'Blog API URL:',
      default: 'http://localhost:3000'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Login email:',
      validate: (input) => input.includes('@') || 'Please enter a valid email'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Login password:',
      mask: '*'
    }
  ]);
  
  // Write .env file
  const envContent = `BLOG_API_URL=${answers.apiUrl}
BLOG_EMAIL=${answers.email}
BLOG_PASSWORD=${answers.password}
`;
  
  await fs.writeFile(ENV_FILE, envContent);
  await fs.chmod(ENV_FILE, 0o600); // Secure permissions
  
  // Write config file
  const config = {
    apiUrl: answers.apiUrl,
    email: answers.email,
    setupDate: new Date().toISOString()
  };
  
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  
  console.log(chalk.green('✅ Configuration saved!'));
  
  // Setup Python environment
  console.log(chalk.blue('📦 Setting up Python environment...'));
  await setupPython();
  
  // Update Claude config
  console.log(chalk.blue('🤖 Updating Claude Code configuration...'));
  await updateClaudeConfig();
  
  console.log(chalk.green('✨ Setup complete! Run "blog-mcp start" to start the server.'));
}

async function start() {
  // Set config paths
  CONFIG_DIR = getConfigDir();
  ENV_FILE = path.join(CONFIG_DIR, '.env');
  CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
  const PID_FILE = path.join(CONFIG_DIR, 'server.pid');
  
  console.log(chalk.blue('▶️  Starting MCP server...'));
  
  // Check configuration
  try {
    await fs.access(ENV_FILE);
  } catch {
    console.log(chalk.red('❌ Not configured. Run "blog-mcp init" first.'));
    return;
  }
  
  // Check if already running
  try {
    const pid = await fs.readFile(PID_FILE, 'utf-8');
    // Check if process is actually running
    try {
      process.kill(parseInt(pid), 0);
      console.log(chalk.yellow('⚠️  MCP server is already running.'));
      console.log(chalk.gray(`PID: ${pid}`));
      console.log(chalk.gray(`Stop it with: blog-mcp stop${process.env.BLOG_MCP_LOCAL ? ' --local' : ''}`));
      return;
    } catch {
      // Process not running, remove stale PID file
      await fs.unlink(PID_FILE).catch(() => {});
    }
  } catch {
    // No PID file, continue
  }
  
  // Ensure logs directory exists
  await fs.mkdir(path.join(CONFIG_DIR, 'logs'), { recursive: true });
  
  // Load environment variables
  require('dotenv').config({ path: ENV_FILE });
  
  const pythonPath = path.join(CONFIG_DIR, 'venv', 'bin', 'python');
  const serverPath = path.join(CONFIG_DIR, 'python', 'src', 'mcp_server.py');
  const logFile = path.join(CONFIG_DIR, 'logs', 'server.log');
  const errorFile = path.join(CONFIG_DIR, 'logs', 'error.log');
  
  // Start Python process in background
  const env = {
    ...process.env,
    PYTHONPATH: path.join(CONFIG_DIR, 'python', 'src'),
    BLOG_MCP_CONFIG: CONFIG_DIR,
    PYTHONUNBUFFERED: '1'  // Force unbuffered output
  };
  
  // Use nohup for background execution
  const command = `nohup "${pythonPath}" "${serverPath}" >> "${logFile}" 2>> "${errorFile}" & echo $!`;
  
  exec(command, { cwd: CONFIG_DIR, env }, async (error, stdout, stderr) => {
    if (error) {
      console.error(chalk.red('❌ Failed to start MCP server:'), error.message);
      return;
    }
    
    const pid = stdout.trim();
    if (pid && !isNaN(parseInt(pid))) {
      // Save PID
      await fs.writeFile(PID_FILE, pid);
      
      console.log(chalk.green('✅ MCP server started successfully!'));
      console.log(chalk.gray('📊 PID: ') + pid);
      console.log(chalk.gray('📁 Config: ') + CONFIG_DIR);
      console.log(chalk.gray('📝 Logs: ') + `blog-mcp logs${process.env.BLOG_MCP_LOCAL ? ' --local' : ''}`);
      
      // Wait a bit and show initial output
      setTimeout(async () => {
        try {
          const logs = await fs.readFile(logFile, 'utf-8');
          const lines = logs.split('\n').slice(-5).filter(l => l.trim());
          if (lines.length > 0) {
            console.log(chalk.gray('\n📋 Initial output:'));
            lines.forEach(line => console.log(chalk.gray('  ' + line)));
          }
        } catch {}
      }, 1000);
    } else {
      console.error(chalk.red('❌ Failed to get server PID'));
    }
  });
}

async function stop() {
  // Set config paths  
  CONFIG_DIR = getConfigDir();
  const PID_FILE = path.join(CONFIG_DIR, 'server.pid');
  
  console.log(chalk.blue('⏹️  Stopping MCP server...'));
  
  try {
    const pid = await fs.readFile(PID_FILE, 'utf-8');
    
    // Kill the process
    try {
      process.kill(parseInt(pid), 'SIGTERM');
      
      // Wait a bit to ensure it's stopped
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if really stopped
      try {
        process.kill(parseInt(pid), 0);
        // Still running, force kill
        process.kill(parseInt(pid), 'SIGKILL');
      } catch {
        // Process stopped successfully
      }
      
      // Remove PID file
      await fs.unlink(PID_FILE).catch(() => {});
      
      console.log(chalk.green('✅ MCP server stopped.'));
    } catch (err) {
      console.error(chalk.red('❌ Failed to stop server:'), err.message);
      console.log(chalk.gray('The process might have already stopped.'));
      
      // Remove PID file anyway
      await fs.unlink(PID_FILE).catch(() => {});
    }
  } catch {
    console.log(chalk.yellow('⚠️  No running MCP server found.'));
  }
}

async function status() {
  // Set config paths
  CONFIG_DIR = getConfigDir();
  const PID_FILE = path.join(CONFIG_DIR, 'server.pid');
  
  console.log(chalk.blue('📊 MCP Server Status:'));
  console.log(`   Config: ${CONFIG_DIR}`);
  
  try {
    const pid = await fs.readFile(PID_FILE, 'utf-8');
    
    // Check if process is running
    try {
      process.kill(parseInt(pid), 0);
      
      console.log(`   Status: ${chalk.green('online')}`);
      console.log(`   PID: ${pid}`);
      
      // Try to get process info
      const psCommand = process.platform === 'darwin' 
        ? `ps -p ${pid} -o %cpu,%mem,etime,command`
        : `ps -p ${pid} -o %cpu,%mem,etime,cmd`;
        
      exec(psCommand, (err, stdout) => {
        if (!err && stdout.includes(pid)) {
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].trim().split(/\s+/);
            if (parts.length >= 3) {
              console.log(`   CPU: ${parts[0]}`);
              console.log(`   Memory: ${parts[1]}`);
              console.log(`   Uptime: ${parts[2]}`);
            }
          }
        }
      });
      
      // Show recent logs
      const errorLog = path.join(CONFIG_DIR, 'logs', 'error.log');
      const serverLog = path.join(CONFIG_DIR, 'logs', 'server.log');
      
      try {
        const errors = await fs.readFile(errorLog, 'utf-8');
        const recentErrors = errors.split('\n').slice(-3).filter(l => l.trim());
        if (recentErrors.length > 0) {
          console.log(chalk.red('\n❌ Recent errors:'));
          recentErrors.forEach(line => console.log(chalk.red('  ' + line)));
        }
      } catch {}
      
      try {
        const logs = await fs.readFile(serverLog, 'utf-8');
        const recentLogs = logs.split('\n').slice(-3).filter(l => l.trim());
        if (recentLogs.length > 0) {
          console.log(chalk.gray('\n📋 Recent output:'));
          recentLogs.forEach(line => console.log(chalk.gray('  ' + line)));
        }
      } catch {}
      
    } catch {
      console.log(`   Status: ${chalk.red('offline')}`);
      console.log(chalk.gray(`   Last known PID: ${pid}`));
      
      // Remove stale PID file
      await fs.unlink(PID_FILE).catch(() => {});
    }
  } catch {
    console.log(`   Status: ${chalk.yellow('not running')}`);
    console.log(chalk.gray(`   Run "blog-mcp start${process.env.BLOG_MCP_LOCAL ? ' --local' : ''}" to start the server`));
  }
}

async function logs(options) {
  // Set config paths
  CONFIG_DIR = getConfigDir();
  
  const serverLogFile = path.join(CONFIG_DIR, 'logs', 'server.log');
  const errorLogFile = path.join(CONFIG_DIR, 'logs', 'error.log');
  
  try {
    if (options.follow) {
      // Follow logs in real-time
      console.log(chalk.blue('📋 Following logs (Ctrl+C to exit)...'));
      const tail = spawn('tail', ['-f', serverLogFile, errorLogFile]);
      tail.stdout.pipe(process.stdout);
      tail.stderr.pipe(process.stderr);
      
      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      // Show last lines from both logs
      let hasLogs = false;
      
      try {
        const serverLogs = await fs.readFile(serverLogFile, 'utf-8');
        if (serverLogs.trim()) {
          console.log(chalk.blue('📋 Server logs:'));
          const lines = serverLogs.split('\n').slice(-30).filter(l => l).join('\n');
          console.log(lines);
          hasLogs = true;
        }
      } catch {}
      
      try {
        const errorLogs = await fs.readFile(errorLogFile, 'utf-8');
        if (errorLogs.trim()) {
          console.log(chalk.red('\n❌ Error logs:'));
          const lines = errorLogs.split('\n').slice(-20).filter(l => l).join('\n');
          console.log(lines);
          hasLogs = true;
        }
      } catch {}
      
      if (!hasLogs) {
        console.log(chalk.gray('No logs found.'));
        console.log(chalk.gray(`Make sure the server is running: blog-mcp status${process.env.BLOG_MCP_LOCAL ? ' --local' : ''}`));
      }
    }
  } catch (err) {
    console.log(chalk.yellow('Unable to read log files.'));
    console.log(chalk.gray(`Logs directory: ${path.join(CONFIG_DIR, 'logs')}`));
  }
}

module.exports = {
  init,
  start,
  stop,
  status,
  logs
};