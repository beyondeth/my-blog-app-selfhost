---
title: "MCP 서버 과도한 엔지니어링 실수: Docker는 필요 없었다"
tags: ["MCP", "Over-engineering", "개발실수", "KISS원칙", "TypeScript", "DevOps", "로컬도구"]
date: 2025-09-02T21:52:18.382400
---

# MCP 서버 과도한 엔지니어링 실수: Docker는 필요 없었다

## 🤦 실수를 인정합니다

방금 Python MCP 서버를 TypeScript로 마이그레이션하면서 큰 실수를 했습니다. **MCP(Model Context Protocol) 서버는 로컬 도구인데, 저는 이것을 엔터프라이즈 서버 애플리케이션처럼 다뤘습니다.**

## 🎯 MCP 서버의 실제 사용 방식

MCP 서버는 이렇게 작동합니다:

```bash
# 사용자가 npm으로 설치
npm install @myblog/mcp-blog-server

# Claude Desktop이 로컬에서 실행
npx @myblog/mcp-blog-server --transport stdio
```

각 사용자가:
- **자신의 컴퓨터에서** 실행
- **자신의 API 키로** 인증  
- **자신의 블로그에** 포스팅
- **Claude Desktop과 로컬 통신**으로 연결

## ❌ 제가 잘못 추가한 것들

### Docker 관련 (전부 불필요!)
```yaml
# 이런 거 필요 없었습니다
Dockerfile
docker-compose.yml
.dockerignore
k8s/
  ├── deployment.yaml
  ├── service.yaml
  └── ingress.yaml
```

### 과도한 DevOps 설정
- **Blue-Green 배포** → 로컬 도구에 무슨 Blue-Green? 
- **Kubernetes 매니페스트** → 개인 PC에서 실행하는데 K8s?
- **Prometheus/Grafana** → 로컬 CLI 도구 모니터링?
- **Canary 배포** → npm install만 하면 되는데?

### 복잡한 CI/CD
```yaml
# 이전 (과도함)
jobs:
  - lint-and-typecheck
  - test (unit, integration, e2e, performance)  
  - build-docker-image
  - security-scan
  - deploy-staging
  - smoke-test
  - deploy-production
  - monitor-metrics
```

```yaml
# 이후 (적절함)
jobs:
  - test
  - build
  - publish-npm
```

## 🤔 왜 이런 실수를 했을까?

### 1. DevOps 에이전트의 과잉 반응
DevOps-Automator 에이전트가 "프로덕션 배포"라는 단어를 보고 자동으로 엔터프라이즈 패턴을 적용했습니다.

### 2. 용어의 혼동
- "배포" → 서버 배포로 이해 (실제: npm 패키지 배포)
- "프로덕션" → 클라우드 환경으로 이해 (실제: 사용자 로컬)
- "서버" → 웹 서버로 이해 (실제: MCP 프로토콜 서버)

### 3. Context7 참조의 오해
Context7도 MCP 서버지만, 제가 이것을 웹 서비스 아키텍처로 착각했습니다.

## ✅ 실제로 필요했던 것

```json
{
  "필요": {
    "npm 패키지 설정": "✅",
    "Claude Desktop 연동 가이드": "✅",
    "간단한 CI": "✅",
    "사용자 문서": "✅"
  },
  "불필요": {
    "Docker": "❌",
    "Kubernetes": "❌",
    "모니터링": "❌",
    "복잡한 배포": "❌"
  }
}
```

## 📁 정리 후 깔끔한 구조

```
mcp-blog-server-ts/
├── src/              # 핵심 코드
├── dist/             # 빌드 결과
├── .github/
│   └── workflows/
│       └── ci.yml    # 간단한 테스트만
├── package.json      # npm 배포 설정
├── tsconfig.json     # TypeScript 설정
└── README.md         # 사용자 가이드
```

## 🎓 배운 교훈

### 1. 도구의 본질 이해하기
MCP는 **로컬 개발 도구**입니다. Claude Desktop의 확장 기능이지, 독립적인 웹 서비스가 아닙니다.

### 2. 적절한 엔지니어링
- 간단한 도구는 간단하게
- 복잡성은 필요할 때만
- 과도한 추상화 피하기

### 3. AI 에이전트도 실수한다
AI가 제안하는 모든 것을 무비판적으로 받아들이지 말고, 실제 요구사항을 먼저 명확히 해야 합니다.

## 🚀 올바른 사용법

이제 정리된 MCP 서버는 이렇게 사용합니다:

```bash
# 1. 설치
npm install -g @myblog/mcp-blog-server

# 2. Claude Desktop 설정에 추가
# ~/Library/Application Support/Claude/claude_desktop_config.json

# 3. Claude Desktop 재시작

# 완료! Docker 없음, K8s 없음, 그냥 작동!
```

## 💭 마무리

때로는 엔지니어링을 **덜** 하는 것이 **더** 좋은 엔지니어링입니다. 

MCP 서버는 사용자의 로컬 환경에서 Claude와 블로그를 연결하는 간단한 다리 역할만 하면 됩니다. Docker 컨테이너에 넣고, Kubernetes로 오케스트레이션하고, Prometheus로 모니터링할 필요가 전혀 없었습니다.

**KISS (Keep It Simple, Stupid)** 원칙을 다시 한 번 되새기게 되는 경험이었습니다.

---

*이 포스트는 과도하게 엔지니어링되지 않은, 깔끔하게 정리된 TypeScript MCP 서버를 통해 작성되었습니다.* 😄