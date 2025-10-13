# MCP Remote Blog Server

**Production-ready Remote MCP Server** for secure blog post creation with OAuth2 PKCE authentication.

## 📋 Overview

Remote MCP (Model Context Protocol) server that enables AI assistants to create blog posts through secure OAuth2 authentication. Built with `@modelcontextprotocol/sdk` using **Modern Streamable HTTP transport** (2025-03-26 spec) and integrated with a backend API's OAuth2 system.

### 🏗 Architecture

```
Claude Code CLI → MCP Server (Streamable HTTP) → Backend API (OAuth2 + Bearer Token)
                     ↕
                  Redis (Sessions)
```

**Architecture Layers:**
- **MCP Transport Layer**: Streamable HTTP with Mcp-Session-Id header (stateful mode)
- **OAuth Session Layer**: Redis-based persistent authentication storage
- **Backend Integration**: Bearer token forwarding to existing OAuth2 PKCE system

**Key Design Decisions:**
- **Modern Streamable HTTP**: Single /mcp endpoint with JSON-RPC 2.0 protocol
- **Remote MCP**: Code stays on cloud server, never exposed to users
- **Separate Instance**: Independent deployment (mcp.codebase.blog)
- **Backend Integration**: Uses existing OAuth2 PKCE system
- **Session-based Preferences**: User settings stored in Redis
- **Two Session Types**:
  - MCP Session: Claude ↔ MCP Server transport (in-memory, Mcp-Session-Id)
  - OAuth Session: MCP Server ↔ Backend API (Redis, sessionId parameter)

## ✨ Core Features

### 🔐 Authentication
- **OAuth2 PKCE Flow**: Secure authorization without client secrets
- **Bearer Token**: Access token managed in Redis sessions
- **Automatic Refresh**: Token renewal before expiration

### ✍️ Blog Post Creation
- **Rich Content**: Markdown-based with full formatting support
- **Tags & Categories**: Organized content management
- **Writing Styles**: Customizable with 3 modes:
  - **Preset**: Built-in styles (novel, tutorial, comedy, podcast, default)
  - **URL**: Remote style guide fetching
  - **Inline**: Direct markdown input

### 🎨 User Preferences
- **Session Storage**: User settings persist across requests
- **Default Styles**: Set preferred writing style per session
- **Flexible Override**: Request-level style specification

### 🔍 Diagnostics
- **Connection Testing**: Backend API health checks
- **Session Validation**: Token and session status
- **OAuth Endpoint Verification**: Authorization flow testing

## 🛠 MCP Tools

### 1. `authenticate`
Start OAuth2 PKCE authentication flow.

**Input:** None
**Output:**
- Authorization URL
- Session ID

**Example:**
```json
{
  "name": "authenticate"
}
```

**Response:**
```
🔐 OAuth2 인증을 시작합니다.

https://backend.example.com/oauth/authorize?response_type=code&client_id=...

Session ID: a1b2c3d4e5f6...
```

### 2. `create_post`
Create a new blog post with authentication.

**Input:**
- `sessionId` (required): Session ID from authentication
- `title` (required): Post title
- `content_markdown` (required): Post content in markdown
- `tags` (optional): Array of tag strings
- `category` (optional): Category string
- `writingStyle` (optional): Preset name, URL, or inline markdown

**Example:**
```json
{
  "name": "create_post",
  "arguments": {
    "sessionId": "a1b2c3d4e5f6...",
    "title": "My First Post",
    "content_markdown": "# Hello World\n\nThis is my first blog post!",
    "tags": ["tech", "blogging"],
    "category": "Technology",
    "writingStyle": "novel"
  }
}
```

**Writing Style Priority:**
1. `writingStyle` parameter (request-level)
2. `session.preferences.defaultWritingStyle` (session-level)
3. No style (default)

### 3. `set_preferences`
Set user preferences for the session.

**Input:**
- `sessionId` (required): Session ID
- `defaultWritingStyle` (optional): Default writing style
- `preferences` (optional): Other custom settings

**Example:**
```json
{
  "name": "set_preferences",
  "arguments": {
    "sessionId": "a1b2c3d4e5f6...",
    "defaultWritingStyle": "tutorial",
    "preferences": {
      "autoSave": true,
      "theme": "dark"
    }
  }
}
```

### 4. `diagnose_connection`
Diagnose Backend API connection and session status.

**Input:**
- `sessionId` (optional): Session ID to check

**Example:**
```json
{
  "name": "diagnose_connection",
  "arguments": {
    "sessionId": "a1b2c3d4e5f6..."
  }
}
```

**Response:**
```
🔍 Backend API 연결 진단

✅ Backend API: 정상 작동 중
   - Status: ok
   - URL: https://backend.example.com

✅ OAuth2 Authorization: 사용 가능

✅ Session: 활성 상태
   - Session ID: a1b2c3d4...
   - Access Token: ✅ 유효
   - Preferences: {"defaultWritingStyle":"tutorial"}
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- Redis server
- Backend API with OAuth2 PKCE support

### 1. Installation

```bash
pnpm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your actual values
```

**Required Environment Variables:**
```env
# OAuth2 Configuration (from Backend API)
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret
OAUTH_REDIRECT_URI=http://localhost:7777/callback

# Backend API
BACKEND_BASE_URL=http://localhost:3000
BACKEND_API_URL=http://localhost:3000/api/v1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

See `.env.example` for all available options.

### 3. Build

```bash
pnpm build
```

### 4. Run

#### Development Mode
```bash
pnpm dev
```

#### Production Mode
```bash
pnpm start
```

## 🔧 Claude Code Configuration

### Modern Streamable HTTP Transport (Recommended)

Create or update `~/.config/claude-code/.mcp.json`:

**Production (Remote Server):**
```json
{
  "mcpServers": {
    "codebase_blog": {
      "url": "https://mcp.codebase.blog/api/v1/mcp",
      "transport": "http"
    }
  }
}
```

**Local Development:**
```json
{
  "mcpServers": {
    "codebase_blog": {
      "url": "http://localhost:8000/api/v1/mcp",
      "transport": "http"
    }
  }
}
```

Or use the provided templates:
```bash
# Production
cp .mcp.json.example ~/.config/claude-code/.mcp.json

# Local Development
cp .mcp.json.local ~/.config/claude-code/.mcp.json
```

**Key Features of Streamable HTTP:**
- ✅ Single `/mcp` endpoint for all requests
- ✅ `Mcp-Session-Id` header for session tracking
- ✅ JSON-RPC 2.0 protocol
- ✅ Stateful mode with automatic session management
- ✅ DELETE endpoint for session cleanup
- ✅ DNS rebinding protection
- ✅ CORS configuration for allowed origins

## 📁 Project Structure

```
mcp-proxy-server/
├── src/
│   ├── config/
│   │   └── env.validation.ts      # Environment variable validation (Zod)
│   ├── services/
│   │   ├── SessionService.ts      # Session & token management (Redis)
│   │   └── WritingStyleService.ts # Writing style loader & parser
│   ├── tools/
│   │   ├── authenticate.ts        # OAuth2 PKCE tool
│   │   ├── create-post.ts         # Post creation tool (with parsing)
│   │   ├── set-preferences.ts     # Preferences management
│   │   └── diagnose-connection.ts # Diagnostic tool
│   ├── middleware/
│   │   └── error-handler.ts       # Error handling middleware
│   ├── routes/
│   │   ├── session.routes.ts      # Session management routes
│   │   ├── proxy.routes.ts        # Backend proxy routes
│   │   ├── oauth.routes.ts        # OAuth callback routes
│   │   └── mcp.routes.ts          # Additional MCP routes
│   ├── utils/
│   │   └── logger.ts              # Pino logger configuration
│   ├── types/
│   │   └── index.ts               # TypeScript type definitions
│   └── index.ts                   # Express + Streamable HTTP entry point
├── writing-styles/                # Preset writing styles (YAML + sections)
│   ├── novel.md                   # Creative narrative style
│   ├── tutorial.md                # Step-by-step instructional
│   ├── comedy.md                  # Humorous and engaging
│   ├── podcast.md                 # Conversational script format
│   └── default.md                 # Standard blog post
├── public/                        # Static files (OAuth callback HTML)
├── .env.example                   # Environment variables template
├── .mcp.json.example              # MCP client config (production)
├── .mcp.json.local                # MCP client config (local dev)
├── .gitignore                     # Git ignore patterns
├── tsconfig.json                  # TypeScript configuration
└── package.json
```

**Architecture Components:**
- **Express Server**: HTTP server with middleware stack
- **MCP Streamable HTTP**: Single POST /api/v1/mcp endpoint
- **Session Management**: Stateful transport storage + Redis sessions
- **Tool Handlers**: 4 MCP tools with context injection
- **Writing Style Parser**: YAML front matter + section parsing

## 🔐 Security Features

### OAuth2 PKCE Flow
1. **Authorization Request**: Generate code_challenge from code_verifier
2. **Callback Handling**: Verify state and exchange authorization code
3. **Token Exchange**: Use code_verifier to obtain access token
4. **Token Refresh**: Automatic renewal before expiration

### Session Management
- **Redis Storage**: Distributed session management
- **PKCE Verifier**: Separate key with 10-minute TTL
- **Token Storage**: Encrypted access/refresh tokens
- **Session TTL**: 24-hour default (configurable)

### Security Best Practices
- ✅ Environment variable validation (Zod)
- ✅ Sensitive data never exposed in logs
- ✅ PKCE verifier one-time use
- ✅ Token automatic refresh
- ✅ Session validation with IP/User-Agent (optional)

## 📊 Writing Styles

Writing styles support **YAML front matter** + **section parsing** for structured style definitions.

### Style File Format

```markdown
---
style_name: "Tutorial Style"
language: "korean"
min_length: 2000
target_length: "3000-5000"
code_block_ratio: 0.2
ai_tag_required: true
auto_enhance: true
---

# === MCP SERVER INSTRUCTIONS ===
General instructions for the MCP server...

# === CREATE_POST TOOL DESCRIPTION ===
Description for the create_post tool...

# === QUALITY GUIDELINES PROMPT ===
Quality guidelines for content...

# === BLOG POST TEMPLATE PROMPT ===
Template for blog posts...

# === IMPROVE MARKDOWN PROMPT ===
Instructions for improving markdown...
```

### Preset Styles (Built-in)
Located in `writing-styles/` directory:
- `novel.md` - Creative narrative style
- `tutorial.md` - Step-by-step instructional
- `comedy.md` - Humorous and engaging
- `podcast.md` - Conversational script format
- `default.md` - Standard blog post

**Usage:**
```json
{
  "writingStyle": "tutorial"
}
```

**Parsed Output:**
- **Metadata**: Style name, language, length requirements, etc.
- **Instructions**: Section-by-section parsed content
- **Backend Integration**: Metadata + instructions sent to Backend API

### URL-based Styles
Fetch and parse style guide from remote URL:
```json
{
  "writingStyle": "https://example.com/styles/technical.md"
}
```

### Inline Styles
Provide style directly as markdown (supports YAML + sections):
```json
{
  "writingStyle": "---\nstyle_name: \"Custom\"\n---\n\n# === INSTRUCTIONS ===\nWrite professionally..."
}
```

## 🛠 Development Commands

```bash
# Development server with auto-reload
pnpm dev

# Build TypeScript
pnpm build

# Production server
pnpm start

# Type checking
tsc --noEmit

# Clean build artifacts
rm -rf dist/
```

## 🔍 Troubleshooting

### Redis Connection Failed
```bash
# Check Redis status
redis-cli ping

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis
```

### Authentication Issues
1. Verify `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
2. Check `OAUTH_REDIRECT_URI` matches Backend configuration
3. Ensure Backend API is running and accessible
4. Use `diagnose_connection` tool for detailed status

### Token Expired
Tokens automatically refresh. If refresh fails:
1. Re-authenticate with `authenticate` tool
2. Check Backend API token endpoint
3. Verify Redis session exists

### Writing Style Not Loading
1. **Preset**: Check file exists in `writing-styles/`
2. **URL**: Verify URL is accessible (10s timeout)
3. **Inline**: Check markdown formatting

## 📈 Backend API Integration

### Required Endpoints

**Authorization:**
```
GET /oauth/authorize
```

**Token Exchange:**
```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=<code>&
code_verifier=<verifier>&
client_id=<client_id>&
client_secret=<client_secret>&
redirect_uri=<redirect_uri>
```

**Token Refresh:**
```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=<token>&
client_id=<client_id>&
client_secret=<client_secret>
```

**Post Creation:**
```
POST /api/v1/mcp/posts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Post Title",
  "content_markdown": "# Content",
  "tags": ["tag1"],
  "category": "Category",
  "writingStyle": "optional style guide"
}
```

**Health Check:**
```
GET /api/v1/mcp/health
```

## 🌐 HTTP Endpoints

The server exposes the following endpoints:

### MCP Streamable HTTP Transport
```
POST /api/v1/mcp
- Single endpoint for all MCP requests
- Headers: Mcp-Session-Id (optional, auto-generated)
- Body: JSON-RPC 2.0 request
- Response: JSON or SSE stream

DELETE /api/v1/mcp
- Session cleanup endpoint
- Headers: Mcp-Session-Id (required)
- Response: 204 No Content
```

### Health & Status
```
GET /health
- Server health check
- Returns: { status: "healthy", service: "MCP Proxy Server", ... }
```

### OAuth Callback
```
GET /oauth/callback
- OAuth2 callback handler
- Displays success/error status
- Served from public/ directory
```

## 🚀 Production Deployment

### Docker (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY dist/ ./dist/
COPY writing-styles/ ./writing-styles/
COPY public/ ./public/

# Expose port
EXPOSE 8000

# Start server
CMD ["node", "dist/index.js"]
```

**Build & Run:**
```bash
docker build -t mcp-proxy-server .
docker run -d \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e BACKEND_BASE_URL=https://api.codebase.blog \
  -e REDIS_HOST=redis \
  --name mcp-proxy \
  mcp-proxy-server
```

### Environment
- Set `NODE_ENV=production`
- Use production Redis instance
- Configure proper OAuth2 credentials
- Set appropriate session TTL
- Enable session strict mode if needed
- Configure CORS origins for production
- Set up DNS for mcp.codebase.blog

### Monitoring

See [MONITORING.md](./MONITORING.md) for detailed monitoring setup.

**Quick Start:**
```bash
# Start Prometheus + Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# - Prometheus: http://localhost:9091
# - Grafana: http://localhost:3333 (admin/admin123)
# - Metrics: http://localhost:8080/metrics
```

**Collected Metrics:**
- **HTTP**: Requests, response times, request/response sizes
- **Sessions**: Active sessions, creation/deletion rates, lifetimes
- **Redis**: Operations, duration, connection status
- **Errors**: Error rates by code and status

## 📄 License

MIT

## 👥 Contributing

Issues and PRs welcome!

## 🔗 Related Projects

- [Backend API](../backend) - OAuth2 PKCE provider
- [Frontend](../frontend) - Blog frontend application
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Official MCP protocol
