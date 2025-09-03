# Python에서 TypeScript로 MCP 블로그 서버 전환: 실패와 해결책

## 문제 상황

Python으로 작성된 MCP 블로그 서버를 TypeScript로 마이그레이션한 후, 자동 포스팅 기능이 작동하지 않는 문제가 발생했습니다. 인증은 계속 실패하고, 직접 스크립트로는 작동하는데 MCP 서버를 통해서는 작동하지 않는 상황이었습니다.

```bash
❌ Authentication failed
⚠️ Please check the following in your .env file:
- BLOG_API_KEY_ID (starts with akid_)
- BLOG_API_KEY_SECRET (starts with aks_)
```

## 원인 분석

### 1. URL 경로 중복 문제

TypeScript로 마이그레이션하면서 가장 큰 실수는 API URL 처리 방식의 차이를 고려하지 않은 것이었습니다.

**Python 버전 (정상 작동)**
```python
# Python에서는 BASE_URL과 API_PATH를 분리해서 관리
BASE_URL = os.getenv("BLOG_API_URL", "http://localhost:3000")
API_PATH = "/api/v1"
url = f"{BASE_URL}{API_PATH}/auth/validate"
```

**TypeScript 버전 (문제 발생)**
```typescript
// 초기 잘못된 구현
constructor() {
  this.baseUrl = process.env["BLOG_API_URL"] || "http://localhost:3000";
  this.apiUrl = `${this.baseUrl}/api/v1`;  // ❌ 중복 발생!
}
```

### 2. 환경 변수 설정 불일치

Claude Desktop 설정 파일(`claude_desktop_config.json`)에서:
```json
{
  "env": {
    "BLOG_API_URL": "http://localhost:3000",  // ❌ /api/v1 누락
  }
}
```

하지만 실제로 필요한 것은:
```json
{
  "env": {
    "BLOG_API_URL": "http://localhost:3000/api/v1",  // ✅ 완전한 경로
  }
}
```

### 3. 환경 변수 처리 방식의 차이

Python과 TypeScript에서 환경 변수를 처리하는 방식의 미묘한 차이를 간과했습니다:

- **Python**: 더 유연한 문자열 처리, 자동 타입 변환
- **TypeScript**: 엄격한 타입 체크, undefined 처리 필요

## 해결책

### 1. auth.ts 파일 수정

```typescript
constructor() {
  // BLOG_API_URL이 이미 /api/v1을 포함한다고 가정
  this.apiUrl = process.env["BLOG_API_URL"] || "http://localhost:3000/api/v1";
  this.baseUrl = this.apiUrl.replace(/\/api\/v1$/, '');
}
```

### 2. Claude Desktop 설정 업데이트

```json
{
  "codebase_blog": {
    "command": "node",
    "args": ["dist/index.js", "--transport", "stdio"],
    "env": {
      "BLOG_API_URL": "http://localhost:3000/api/v1"  // 완전한 경로 포함
    }
  }
}
```

### 3. 빌드 및 재시작

```bash
# TypeScript 재빌드
pnpm build

# Claude Desktop 재시작 필요
# MCP 서버가 새로운 설정을 읽도록
```

## 교훈과 반성

### 1. 마이그레이션 시 세부사항 놓치지 않기

언어나 프레임워크를 전환할 때는 단순히 문법만 바꾸는 것이 아니라, 각 언어의 특성과 관례를 이해해야 합니다. Python과 TypeScript는 비슷해 보이지만 환경 변수 처리, 타입 시스템, 모듈 시스템 등에서 미묘한 차이가 있습니다.

### 2. 테스트의 중요성

마이그레이션 후 즉시 통합 테스트를 실행했어야 했습니다. 단위 테스트만으로는 환경 변수 설정 같은 통합 문제를 발견하기 어렵습니다.

```bash
# 테스트 스크립트 작성 필요
npm run test:integration
```

### 3. 디버깅 접근 방식

문제 해결 과정에서 직접 스크립트로 우회하려 했던 것은 잘못된 접근이었습니다. 근본 원인을 찾아 해결하는 것이 정답입니다.

### 4. 환경 변수 문서화

환경 변수 설정은 반드시 문서화되어야 합니다:

```typescript
// .env.example
BLOG_API_KEY_ID=akid_xxxxx
BLOG_API_KEY_SECRET=aks_xxxxx
BLOG_API_URL=http://localhost:3000/api/v1  # 전체 경로 포함!
```

### 5. 마이그레이션 체크리스트

향후 비슷한 마이그레이션 시 체크리스트:

- [ ] 환경 변수 처리 방식 검토
- [ ] URL 경로 구성 방식 확인
- [ ] 타입 시스템 차이 고려
- [ ] 통합 테스트 작성 및 실행
- [ ] 설정 파일 동기화
- [ ] 문서 업데이트

## 결론

Python에서 TypeScript로의 마이그레이션은 단순한 문법 전환이 아닙니다. 각 언어와 런타임의 특성을 이해하고, 세부적인 차이점을 꼼꼼히 확인해야 합니다. 특히 환경 변수와 URL 처리 같은 기본적인 부분에서 실수하기 쉽습니다.

이번 경험을 통해 "작동하는 코드"와 "올바른 코드"의 차이를 다시 한번 깨달았습니다. 직접 스크립트로 우회하는 것은 임시방편일 뿐, 근본적인 문제 해결이 아닙니다.

**태그**: #MCP #TypeScript #Python #Migration #Debugging #EnvironmentVariables #Integration #LessonsLearned