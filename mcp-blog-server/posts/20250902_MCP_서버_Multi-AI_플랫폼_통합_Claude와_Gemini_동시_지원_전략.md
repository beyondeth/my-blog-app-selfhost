---
title: "MCP 서버 Multi-AI 플랫폼 통합: Claude와 Gemini 동시 지원 전략"
tags: ["MCP", "Multi-platform", "Claude", "Gemini", "TypeScript", "API통합", "크로스플랫폼"]
date: 2025-09-02T22:13:09.675821
---

# MCP 서버 Multi-AI 플랫폼 통합: Claude와 Gemini 동시 지원 전략

## 🎯 도전 과제

MCP(Model Context Protocol) 서버를 Claude Desktop에서만이 아니라 Google의 Gemini CLI에서도 작동하게 만들기. 각 AI 플랫폼마다 설정 방식과 통신 프로토콜이 다른 상황에서 하나의 통합 서버로 모든 플랫폼을 지원하는 설계.

## 📊 플랫폼별 차이점 분석

### 설정 파일 위치
- **Claude Desktop**: 
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- **Gemini CLI**: 
  - 모든 OS: `~/.gemini/settings.json` (통일됨)

### 통신 프로토콜 차이

| 항목 | Claude Desktop | Gemini CLI |
|------|---------------|------------|
| **주력 프로토콜** | stdio (표준 입출력) | HTTP |
| **환경 변수 전달** | `"env": { }` | `"headers": { }` |
| **인증 방식** | 환경 변수 | HTTP 헤더 또는 CLI 인자 |

## 🏗️ 통합 아키텍처 설계

### 멀티 트랜스포트 전략

```typescript
interface UnifiedMCPServer {
  transports: {
    stdio: StdioServerTransport,    // Claude Desktop
    http: HTTPServerTransport,       // Gemini CLI (primary)
    sse: SSEServerTransport         // Future support
  },
  
  authMethods: {
    env: EnvironmentAuth,           // Claude: process.env
    headers: HeaderAuth,            // Gemini: HTTP headers
    args: ArgumentAuth              // CLI: --api-key
  }
}
```

## 💡 플랫폼별 최적 설정

### Claude Desktop 설정
```json
{
  "mcpServers": {
    "blog": {
      "command": "npx",
      "args": ["-y", "@myblog/mcp-server"],
      "env": {
        "BLOG_API_KEY_ID": "your_key_id",
        "BLOG_API_KEY_SECRET": "your_secret",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

### Gemini CLI 설정

#### Option A: HTTP 서버 방식 (권장)
```json
{
  "mcpServers": {
    "blog": {
      "httpUrl": "http://localhost:3456/mcp",
      "headers": {
        "X-API-KEY-ID": "your_key_id",
        "X-API-KEY-SECRET": "your_secret"
      }
    }
  }
}
```

#### Option B: 로컬 명령어 방식
```json
{
  "mcpServers": {
    "blog": {
      "command": "npx",
      "args": [
        "-y", 
        "@myblog/mcp-server",
        "--transport", "http",
        "--port", "3456",
        "--api-key-id", "your_key_id"
      ]
    }
  }
}
```

## 🔧 핵심 구현 전략

### 1. 자동 트랜스포트 감지

```typescript
async function detectAndStartTransport() {
  // Gemini는 보통 HTTP 요청으로 시작
  if (process.env.HTTP_PORT || args.port) {
    return startHTTPServer(args.port || 3456);
  }
  
  // Claude는 stdio로 시작
  if (process.stdin.isTTY === false) {
    return startStdioServer();
  }
  
  // 명시적 지정 지원
  switch(transport) {
    case 'http': return startHTTPServer();
    case 'stdio': return startStdioServer();
    case 'both': return startBothServers(); // 동시 지원!
  }
}
```

### 2. 통합 인증 처리

```typescript
function getCredentials() {
  return {
    // 우선순위: CLI 인자 > HTTP 헤더 > 환경 변수
    apiKeyId: 
      args.apiKeyId ||                    // CLI
      headers['X-API-KEY-ID'] ||          // Gemini
      process.env.BLOG_API_KEY_ID,        // Claude
      
    apiKeySecret: 
      args.apiKeySecret ||
      headers['X-API-KEY-SECRET'] ||
      process.env.BLOG_API_KEY_SECRET
  };
}
```

### 3. 플랫폼별 응답 포맷 자동 조정

```typescript
// Claude는 JSON-RPC 형식
const claudeResponse = {
  jsonrpc: "2.0",
  id: requestId,
  result: data
};

// Gemini는 REST-like 응답
const geminiResponse = {
  status: "success",
  data: data,
  timestamp: new Date().toISOString()
};

// 자동 감지 및 변환
function formatResponse(data, platform) {
  return platform === 'claude' 
    ? formatJsonRpc(data)
    : formatRest(data);
}
```

## 🚀 설치 마법사 UX 개선

```bash
$ npx @myblog/mcp-server setup

🤖 Which AI platform are you using?
> Claude Desktop
  Gemini CLI
  Both
  Other

📍 Detected platform configuration:
- Claude: ~/Library/Application Support/Claude/... ✓
- Gemini: ~/.gemini/settings.json ✓

🔧 Recommended setup:
- Claude: stdio transport (optimal)
- Gemini: HTTP transport on port 3456

✅ Configuration written to both platforms!
```

## 📋 구현 로드맵

### Phase 1: 트랜스포트 추상화 (Week 1)
- 공통 인터페이스 설계
- stdio/HTTP 어댑터 구현
- 자동 감지 로직

### Phase 2: 플랫폼 감지 (Week 2)
- AI 플랫폼 자동 인식
- 설정 파일 자동 발견
- 플랫폼별 최적화

### Phase 3: 통합 테스트 (Week 3)
- Claude Desktop 테스트
- Gemini CLI 테스트
- 동시 실행 테스트

### Phase 4: 배포 (Week 4)
- npm 패키지 배포
- 플랫폼별 가이드
- 비디오 튜토리얼

## 🎯 핵심 설계 원칙

### DO's ✅
- **단일 코드베이스**: 하나의 서버가 모든 플랫폼 지원
- **자동 감지**: 플랫폼 자동 인식 및 최적 설정
- **폴백 메커니즘**: 한 방식 실패 시 다른 방식 시도
- **통합 인증**: 모든 인증 방식 통합 처리

### DON'Ts ❌
- 플랫폼별 분기 최소화
- 하드코딩 피하기
- Breaking Changes 방지

## 📊 예상 성과

| 지표 | 목표 | 이점 |
|------|------|------|
| **플랫폼 지원** | Claude + Gemini 100% | 사용자 선택권 확대 |
| **설치 시간** | <3분 (양쪽 모두) | 진입 장벽 낮춤 |
| **코드 재사용** | 90% 공통 코드 | 유지보수 효율 |
| **사용자 증가** | 2배 예상 | 시장 확대 |

## 🎬 결론

**"Write Once, Run Everywhere"** - Java의 오래된 약속을 MCP 서버에서 실현합니다.

하나의 MCP 서버로:
- Claude Desktop ✅
- Gemini CLI ✅
- 미래의 AI 플랫폼 ✅

핵심은 **추상화**와 **자동 감지**입니다. 사용자는 자신이 선호하는 AI 플랫폼에서 동일한 기능을 사용할 수 있고, 개발자는 하나의 코드베이스만 관리하면 됩니다.

## 💭 인사이트

AI 플랫폼들이 각자의 방식을 고집하는 현 상황에서, 통합 서버는 단순한 기술적 해결책을 넘어 **생태계 표준화**의 첫걸음이 될 수 있습니다.

MCP가 진정한 "프로토콜"이 되려면, 이런 멀티 플랫폼 지원이 필수적입니다.

---

*이 포스트는 Claude Desktop의 MCP 서버를 통해 작성되었으며, 곧 Gemini에서도 동일하게 작동할 예정입니다.* 🚀