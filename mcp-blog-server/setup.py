#!/usr/bin/env python3
"""Setup script for Blog MCP Server"""
import os
import sys
import json
import shutil
from pathlib import Path

def setup():
    """Setup MCP server configuration"""
    print("🚀 Setting up Blog MCP Server...")
    
    # Create config directory
    config_dir = Path.home() / '.blog-mcp'
    config_dir.mkdir(exist_ok=True)
    print(f"✅ Config directory: {config_dir}")
    
    # Copy .env.example to .env if not exists
    env_file = config_dir / '.env'
    if not env_file.exists():
        print("\n📝 Please configure your blog credentials:")
        api_url = input("Blog API URL (default: http://localhost:3000): ").strip()
        if not api_url:
            api_url = "http://localhost:3000"
            
        email = input("Blog email: ").strip()
        password = input("Blog password: ").strip()
        
        # Write .env file
        env_content = f"""# Blog API Configuration
BLOG_API_URL={api_url}
BLOG_EMAIL={email}
BLOG_PASSWORD={password}
"""
        env_file.write_text(env_content)
        os.chmod(env_file, 0o600)
        print(f"✅ Configuration saved to {env_file}")
    else:
        print(f"ℹ️  Using existing config: {env_file}")
    
    # Update Claude config
    claude_config_path = Path.home() / '.claude' / 'claude_desktop_config.json'
    claude_config_path.parent.mkdir(exist_ok=True)
    
    # Read existing config or create new
    config = {}
    if claude_config_path.exists():
        try:
            config = json.loads(claude_config_path.read_text())
        except:
            pass
    
    # Add MCP server config
    if 'mcpServers' not in config:
        config['mcpServers'] = {}
    
    src_dir = Path(__file__).parent / 'src'
    config['mcpServers']['my-blog'] = {
        "command": sys.executable,  # Use current Python interpreter
        "args": [str(src_dir / 'mcp_server.py')],
        "env": {
            "BLOG_MCP_CONFIG": str(config_dir),
            "PYTHONPATH": str(src_dir)
        }
    }
    
    # Write updated config
    claude_config_path.write_text(json.dumps(config, indent=2))
    print(f"✅ Claude config updated: {claude_config_path}")
    
    print("\n✨ Setup complete!")
    print("\n📋 Next steps:")
    print("1. Install Python dependencies: pip install -r requirements.txt")
    print("2. Restart Claude Code to load the MCP server")
    print("3. Use the blog tools in Claude Code!")
    
if __name__ == "__main__":
    setup()