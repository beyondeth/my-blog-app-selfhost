
# Gemini CLI에서 mcp-blog-server-ts 설정 및 실행 가이드

이 문서는 Gemini CLI 환경에서 `mcp-blog-server-ts` 프로젝트를 설정하고 실행하여, 블로그 포스트 자동화 기능을 사용하는 방법을 안내합니다.

## 단계별 실행 방법

### 1. 디렉토리 이동
모든 명령어는 `mcp-blog-server-ts` 프로젝트 루트에서 실행해야 합니다.
```bash
cd /path/to/your/project/mcp-blog-server-ts
```

### 2. 의존성 설치
`pnpm`을 사용하여 프로젝트에 필요한 라이브러리를 설치합니다. 이 과정은 최초 한 번만 필요합니다.
```bash
pnpm install
```

### 3. 설정 파일 준비
`claude_desktop_config_example.json` 파일을 복사하여 `claude_desktop_config.json` 파일을 생성하고, 내부에 Claude, AWS, GitHub 등의 API 키와 엔드포인트 정보를 입력합니다.

### 4. 프로젝트 빌드
TypeScript 코드를 JavaScript로 컴파일합니다. 소스 코드가 변경될 때마다 이 과정이 필요할 수 있습니다.
```bash
pnpm run build
```

### 5. 서버 실행
다음 명령어를 통해 커맨드 라인(stdio) 모드로 MCP 서버를 실행할 수 있습니다.
```bash
pnpm run start
```
실행 후 "TypeScript MCP Blog Server running in stdio mode" 메시지가 나타나면, 서버가 입력을 기다리는 상태가 된 것입니다. 이제 이 터미널을 통해 직접 자동 포스팅 명령을 내릴 수 있습니다.
