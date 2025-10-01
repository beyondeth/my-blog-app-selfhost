---
title: "MCP 자동포스팅 도구 개선 - outputSchema 시도와 로컬 파일 저장 기능 구현"
tags: [
  "MCP",
  "TypeScript",
  "outputSchema",
  "File System",
  "Development",
  "Debugging"
]
date: 2025-10-01T14:05:34.470Z
---

# MCP 자동포스팅 도구 개선 - outputSchema 시도와 로컬 파일 저장 기능 구현

## 서론

MCP(Model Context Protocol) 자동포스팅 도구의 verbose 출력 문제를 해결하기 위해 여러 방법을 시도했습니다. 오늘은 outputSchema 적용 시도와 로컬 파일 저장 기능 구현 과정을 공유합니다.

## Part 1: outputSchema 적용 시도와 실패

### outputSchema의 이론적 가능성

PR #816의 변경사항을 참고하여 outputSchema를 통해 출력을 제어하려 했습니다:

```typescript
// outputSchema 정의 - 이론적으로 완벽해 보였던...
const createPostOutputSchema = {
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string().describe("Success message with content length, not full content")
    })
  )
};

// 도구 등록 시 적용
server.registerTool(
  "create_post",
  {
    inputSchema: createPostSchema,
    outputSchema: createPostOutputSchema  // 추가
  },
  async (args: any) => { ... }
);
```

### 실패 원인

실제 테스트 시 다음 에러가 발생했습니다:
```
MCP error -32602: Tool create_post has an output schema but no structured content was provided
```

현재 MCP 구현이 outputSchema를 완전히 지원하지 않거나, 특정 형식의 structured content가 필요한 것으로 보입니다.

### 교훈

- 이론과 실제 구현 사이에는 차이가 있음
- 새로운 기능은 충분한 테스트 후 적용해야 함
- 실패했을 때 빠르게 롤백하는 것도 중요

## Part 2: 로컬 파일 저장 기능 구현

### 문제 발견

코드를 분석하다 흥미로운 점을 발견했습니다:

1. `savePostToFile` 함수가 이미 구현되어 있었음
2. `.env` 파일에 `BLOG_POSTS_DIR` 설정도 있었음
3. **하지만 실제로 사용되지 않고 있었음!**

### 해결 방법

#### 1. filesystem.ts - 이미 있던 코드
```typescript
export async function savePostToFile(
  title: string,
  body: string,
  tags?: string[]
): Promise<string | null> {
  const postsDir = process.env['BLOG_POSTS_DIR'] || process.cwd();
  await fs.mkdir(postsDir, { recursive: true });
  
  const dateStr = new Date().toISOString().split("T")[0]?.replace(/-/g, "") || "";
  const safeTitle = generateSafeFilename(title);
  const filename = `${dateStr}_${safeTitle}.md`;
  const filePath = path.join(postsDir, filename);
  
  const fullContent = `---
title: "${title}"
tags: ${JSON.stringify(tags || [], null, 2)}
date: ${new Date().toISOString()}
---

${body}`;
  
  await fs.writeFile(filePath, fullContent, "utf-8");
  return filePath;
}
```

#### 2. index.ts - 추가한 코드
```typescript
// import 추가
import { savePostToFile } from "./lib/filesystem";

// 포스트 생성 성공 시 파일 저장
if (result.success) {
  const post = result.data?.post || result.post || result.data;
  
  // 포스트를 로컬 파일로도 저장
  let fileMessage = '';
  try {
    const savedFilePath = await savePostToFile(title, markdownContent, tags);
    if (savedFilePath) {
      console.log(`📁 포스트 파일 저장: ${savedFilePath}`);
      fileMessage = `\n📁 파일 저장: ${path.basename(savedFilePath)}`;
    }
  } catch (error) {
    console.error('📁 파일 저장 실패:', error);
    // 파일 저장 실패해도 포스트 생성 성공은 유지
  }
  
  return {
    content: [{
      type: "text",
      text: `✅ 포스트 생성 완료: ${post.title}\n🔗 URL: ${post.url}${fileMessage}`
    }]
  };
}
```

### 구현 결과

이제 자동포스팅 시:
1. **온라인 블로그에 포스트 생성** (기존 기능)
2. **로컬 파일로 백업** (새로 활성화된 기능)
3. **파일명 형식**: `YYYYMMDD_제목.md`
4. **저장 경로**: `/Users/sihyungpark/Desktop/code/my-blog-app/mcp-blog-server-ts/posts`

### 장점

- **백업**: 온라인과 로컬 모두에 저장되어 안전
- **버전 관리**: Git으로 포스트 변경 이력 추적 가능
- **오프라인 작업**: 로컬 파일을 직접 편집 가능
- **마이그레이션**: 다른 플랫폼으로 쉽게 이동 가능

## 개발 철학: 있는 것을 활용하자

이번 경험에서 중요한 교훈을 얻었습니다:

### 1. 코드베이스를 먼저 탐색하라
새로운 기능을 추가하기 전에 이미 구현된 것이 있는지 확인하자. `savePostToFile`은 이미 있었지만 사용되지 않고 있었습니다.

### 2. 환경 설정을 확인하라
`.env` 파일에 `BLOG_POSTS_DIR` 설정이 이미 있었습니다. 개발자가 의도했지만 구현이 완료되지 않은 기능이었던 것 같습니다.

### 3. 작은 연결이 큰 차이를 만든다
단 몇 줄의 코드로 이미 있던 기능을 활성화할 수 있었습니다:
- import 문 1줄
- try-catch 블록 10줄
- 결과: 완전히 새로운 기능 활성화

## verbose 출력 문제의 현재 상태

### 시도한 방법들
1. ✅ **inputSchema description**: 부분적 효과
2. ✅ **도구 description**: 부분적 효과
3. ✅ **writing style 템플릿**: 부분적 효과
4. ✅ **에러 로깅 개선**: 효과적
5. ❌ **outputSchema**: 작동하지 않음

### 현재 해결 상태
- content 전체 표시는 여전히 발생
- 하지만 여러 레벨에서 최소화 지시
- 실용적으로 사용 가능한 수준

## 결론

완벽한 해결책(outputSchema)이 작동하지 않을 때도 있습니다. 하지만 그 과정에서 예상치 못한 보물(파일 저장 기능)을 발견할 수 있습니다.

개발은 계획대로만 진행되지 않습니다. 때로는 실패가 더 나은 발견으로 이어지기도 합니다. outputSchema는 실패했지만, 그 덕분에 코드베이스를 더 깊이 탐색하게 되었고, 숨겨진 기능을 찾아낼 수 있었습니다.

### 다음 단계
- outputSchema가 제대로 지원될 때까지 대기
- 파일 저장 기능 활용한 워크플로우 개선
- 로컬 파일 편집 → 온라인 동기화 기능 검토

작은 개선이 모여 큰 차이를 만듭니다. 오늘도 한 걸음 전진했습니다.