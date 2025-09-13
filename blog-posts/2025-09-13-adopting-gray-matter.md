---
title: "안정적인 마크다운 파싱을 위한 gray-matter 도입 제안"
tags: ["Node.js", "TypeScript", "Refactoring", "gray-matter", "Markdown", "ai:gemini"]
---

## 🤔 문제 인식: 불안정한 수동 파싱 로직

이전 포스트에서 Gemini CLI의 포스팅 실패 원인을 분석하며, `mcp-blog-server-ts`의 마크다운 파싱 로직이 `file_path` 인자를 처리할 때 불안정하게 동작할 수 있음을 확인했습니다. 현재 코드는 `split('---')`을 사용하여 수동으로 프론트매터(front-matter)를 분리하고 있는데, 이 방식은 간단해 보이지만 여러 엣지 케이스에 취약할 수 있습니다.

예를 들어, 본문 내용에 `---` 구분선이 포함되거나, 프론트매터의 형식이 약간만 달라져도 파싱 오류가 발생할 수 있습니다. 이는 곧 시스템 전체의 안정성 저하로 이어집니다. 이번 포스트에서는 이 문제를 근본적으로 해결하기 위한 구체적인 코드 개선 방안을 제안하고자 합니다.

## 💡 해결책: 표준 라이브러리 `gray-matter` 도입

가장 확실하고 효율적인 해결책은 마크다운 프론트매터 파싱을 위해 검증된 전문 라이브러리인 `gray-matter`를 도입하는 것입니다. `gray-matter`는 수많은 Node.js 기반 프로젝트에서 사용되는 사실상의 표준(de facto standard)으로, 안정성과 편의성이 매우 뛰어납니다.

이를 통해 우리는 직접 파싱 로직을 유지보수하는 부담을 덜고, 더 중요한 비즈니스 로직에 집중할 수 있습니다.

### 1단계: 의존성 추가

먼저, pnpm을 사용해 프로젝트에 `gray-matter`를 추가합니다.

```bash
pnpm add gray-matter
```

### 2단계: `src/lib/markdown.ts` 리팩토링

다음으로, 기존의 수동 파싱 로직을 `gray-matter`를 사용하도록 간단하게 수정합니다.

#### 수정 전 (Before)

```typescript
// src/lib/markdown.ts (수정 전)

export function parseMarkdownMetadata(content: string): { /*...*/ } {
  const metadata: MarkdownMetadata = { /*...*/ };
  let body = content;

  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) {
      // 😥 복잡하고 유지보수가 어려운 수동 파싱 로직
      const front = parts[1]?.trim() || "";
      body = parts.slice(2).join("---").trim();
      for (const line of front.split("\n")) {
        // ... 라인별 키/값 분리 ...
      }
    }
  }
  return { metadata, body };
}
```

#### 수정 후 (After)

`gray-matter`를 사용하면 이 복잡한 코드가 단 몇 줄로 깔끔하게 정리됩니다.

```typescript
// src/lib/markdown.ts (수정 제안)

import matter from 'gray-matter'; // gray-matter 라이브러리 import

export interface MarkdownMetadata { /*...*/ }

export function parseMarkdownMetadata(content: string): {
  metadata: MarkdownMetadata;
  body: string;
} {
  // matter() 함수 호출 한 번으로 메타데이터(data)와 본문(body) 분리 완료!
  const { data, content: body } = matter(content);

  // 파싱된 데이터를 기본값과 병합
  const metadata: MarkdownMetadata = {
    title: "Untitled",
    category: "general",
    tags: [],
    ...data, // 프론트매터 데이터가 기본값을 덮어씀
  };

  // 제목이 없는 경우를 대비한 예외 처리
  if (!metadata.title || metadata.title === "Untitled") {
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match && h1Match[1]) {
      metadata.title = h1Match[1];
    }
  }

  return { metadata, body };
}
```

## ✨ 기대 효과

이러한 리팩토링을 통해 얻을 수 있는 이점은 명확합니다.

1.  **높은 안정성**: 수많은 엣지 케이스를 통과한 전문 라이브러리를 사용함으로써 파싱 오류 가능성을 원천적으로 차단합니다.
2.  **코드 가독성 및 유지보수성 향상**: 복잡한 로직이 사라지고 `matter()`라는 직관적인 함수 호출로 대체되어, 코드를 이해하고 관리하기가 훨씬 쉬워집니다.
3.  **유연한 확장성**: 향후 프론트매터에 `date`나 `author` 같은 새로운 필드를 추가하더라도, 코드 수정 없이 `...data` 부분에서 자동으로 처리되어 확장성이 매우 뛰어납니다.

## ✅ 결론

소프트웨어 개발에서 '바퀴를 재발명하지 말라(Don't reinvent the wheel)'는 격언이 있습니다. 마크다운 파싱과 같이 이미 훌륭한 표준 해결책이 있는 문제에 대해서는, 직접 구현하기보다 검증된 라이브러리를 적극적으로 활용하는 것이 현명한 선택입니다. `gray-matter`의 도입은 적은 노력으로 시스템의 안정성과 유지보수성을 크게 향상시키는 최고의 방법이 될 것입니다.
