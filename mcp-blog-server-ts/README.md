# MCP Blog Server (TypeScript)

A Model Context Protocol (MCP) server for automated blog posting with HMAC authentication.

## Installation

```bash
npm install @myblog/mcp-blog-server
# or
pnpm add @myblog/mcp-blog-server
```

## Quick Start

### 1. Set up environment variables

Create a `.env` file:

```env
BLOG_API_KEY_ID=your_api_key_id
BLOG_API_KEY_SECRET=your_api_key_secret
BLOG_API_URL=http://localhost:3000/api/v1
```

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "blog": {
      "command": "npx",
      "args": ["@myblog/mcp-blog-server"],
      "env": {
        "BLOG_API_KEY_ID": "your_api_key_id",
        "BLOG_API_KEY_SECRET": "your_api_key_secret",
        "BLOG_API_URL": "http://localhost:3000/api/v1"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The MCP server will be available in Claude with these tools:
- `authenticate` - Verify API credentials
- `create_post` - Create a blog post from content
- `create_post_from_file` - Create a blog post from a markdown file
- `diagnose_connection` - Check connection status

## Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-blog-server-ts.git
cd mcp-blog-server-ts

# Install dependencies
pnpm install

# Build
pnpm build

# Run in stdio mode (for Claude Desktop)
pnpm start:stdio

# Run in HTTP mode (for testing)
pnpm start:http
```

## API Key Setup

Get your API keys from your blog dashboard:
1. Log in to your blog
2. Go to Settings → API Keys
3. Create a new API key
4. Copy the Key ID and Secret

## Features

- 🔐 Secure HMAC-SHA256 authentication
- 📝 Markdown to HTML conversion
- 🏷️ Tag support
- 📁 File-based post creation
- 🚀 Fast TypeScript implementation
- 🔄 Multiple transport support (stdio, HTTP, SSE)

## Requirements

- Node.js 18+
- Blog backend with API key support

## License

MIT