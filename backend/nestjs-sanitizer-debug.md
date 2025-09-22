# NestJS HTML Sanitizer 자동포스팅 오류 해결기: iframe 제거부터 import 수정까지

## 🔥 문제의 시작

블로그 자동포스팅 기능을 사용하던 중, 갑자기 HTTP 500 에러가 발생하기 시작했습니다. MCP(Model Context Protocol)를 통한 자동포스팅이 계속 실패하는 상황이었죠. 에러 메시지는 단순했지만, 해결 과정은 꽤 복잡했습니다.

```
Post creation failed: Failed to create post (HTTP 500): {"statusCode":500,"message":"Internal server error"}
```

## 🔍 첫 번째 원인: iframe 검증 로직의 복잡성

### 문제 상황

처음 백엔드 로그를 확인했을 때, HTML Sanitizer 서비스에서 문제가 발생하고 있다는 것을 발견했습니다. 특히 iframe 관련 검증 로직이 문제의 핵심이었죠.

기존 코드는 YouTube 비디오 임베딩을 지원하기 위해 복잡한 iframe 검증 로직을 포함하고 있었습니다:

```typescript
// 기존의 복잡한 iframe 검증 코드
private readonly allowedIframeHostnames = ['www.youtube.com', 'youtube.com', 'youtu.be'];

private isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    return this.allowedIframeHostnames.includes(hostname);
  } catch {
    return false;
  }
}

// DOMPurify 설정에 iframe 관련 설정들
transformTags: {
  iframe: (tagName, attribs) => {
    const src = attribs.src || '';
    if (!this.isYouTubeUrl(src)) {
      return false;  // 타입 에러 발생!
    }
    // ...
  }
}
```

### 첫 번째 해결 시도

자동포스팅은 iframe이 필요 없는 기능이었기 때문에, 과감하게 모든 iframe 관련 코드를 제거하기로 결정했습니다.

제거한 항목들:
- `ALLOWED_TAGS`에서 `'iframe'` 제거
- `ALLOWED_ATTR`에서 `'frameborder', 'allow', 'allowfullscreen'` 제거
- `ADD_TAGS`, `ADD_ATTR` 설정 제거
- `allowedIframeHostnames` 배열 제거
- `isYouTubeUrl()` 메서드 제거
- `transformTags.iframe` 함수 제거
- DOMPurify의 `afterSanitizeAttributes` hook 제거

## 🔥 두 번째 문제: CommonJS 모듈 import 에러

### 새로운 에러 발생

iframe 코드를 제거한 후에도 여전히 500 에러가 발생했습니다. 이번엔 다른 에러였죠:

```
DOMPurify sanitization failed, falling back to sanitize-html:
TypeError: Cannot read properties of undefined (reading 'sanitize')

TypeError: (0 , sanitize_html_1.default) is not a function
```

### 원인 분석

TypeScript와 CommonJS 모듈 간의 호환성 문제였습니다. `isomorphic-dompurify`와 `sanitize-html` 라이브러리가 CommonJS 형식으로 export되는데, ES6 default import 구문으로 import하면서 문제가 발생한 것입니다.

```typescript
// ❌ 잘못된 import 방식 (ES6 default import)
import DOMPurify from 'isomorphic-dompurify';
import sanitizeHtml from 'sanitize-html';

// 실제로는 이렇게 호출되어 에러 발생
DOMPurify.sanitize(html);  // DOMPurify는 undefined
sanitizeHtml(html);  // sanitizeHtml은 function이 아님
```

### 최종 해결책

CommonJS 모듈을 올바르게 import하도록 수정했습니다:

```typescript
// ✅ 올바른 import 방식 (namespace import)
import * as DOMPurify from 'isomorphic-dompurify';
import * as sanitizeHtml from 'sanitize-html';

// 이제 정상적으로 작동
DOMPurify.sanitize(html);  // ✅
sanitizeHtml(html);  // ✅
```

## 📝 완전한 해결 과정 정리

### 1단계: 문제 파악
- 자동포스팅 시 HTTP 500 에러 지속 발생
- 백엔드 로그 확인 → HTML Sanitizer 서비스 문제

### 2단계: iframe 코드 제거
- 자동포스팅에 불필요한 iframe 지원 코드 전면 제거
- 코드 복잡도 대폭 감소

### 3단계: import 문제 수정
- CommonJS 모듈 호환성 문제 발견
- namespace import (`import * as`) 방식으로 변경

### 4단계: 서버 재시작 및 테스트
- NestJS 개발 서버 재컴파일
- 자동포스팅 재시도 → 성공!

## 💡 교훈과 인사이트

### 1. 과도한 기능은 독이 될 수 있다
iframe 지원 같은 복잡한 기능이 실제로 사용되지 않는다면, 과감히 제거하는 것이 좋습니다. 불필요한 복잡성은 유지보수를 어렵게 만들고 예상치 못한 버그의 원인이 됩니다.

### 2. TypeScript와 CommonJS 호환성
TypeScript 프로젝트에서 CommonJS 모듈을 사용할 때는 import 방식에 주의해야 합니다. 특히 `esModuleInterop` 설정이 없다면 namespace import를 사용하는 것이 안전합니다.

### 3. 에러 로그의 중요성
처음에는 단순한 500 에러로만 보였지만, 백엔드 로그를 자세히 살펴보니 구체적인 에러 메시지가 있었습니다. 항상 로그를 꼼꼼히 확인하는 습관이 중요합니다.

## 🚀 최종 결과

- ✅ HTML Sanitizer 코드 간소화 (약 100줄 제거)
- ✅ 자동포스팅 기능 정상 작동
- ✅ 코드 유지보수성 향상
- ✅ 보안성 강화 (iframe 제거로 XSS 공격 벡터 감소)

## 📌 핵심 코드 변경사항

```typescript
// html-sanitizer.service.ts

// Before
import DOMPurify from 'isomorphic-dompurify';
import sanitizeHtml from 'sanitize-html';

// After
import * as DOMPurify from 'isomorphic-dompurify';
import * as sanitizeHtml from 'sanitize-html';

// iframe 관련 코드 전체 제거
// - 약 100줄의 검증 로직 제거
// - YouTube URL 검증 함수 제거
// - DOMPurify transform hooks 제거
```

---

이번 경험을 통해 "적은 것이 많은 것이다(Less is More)"라는 원칙을 다시 한번 실감했습니다. 때로는 기능을 추가하는 것보다 제거하는 것이 더 나은 해결책이 될 수 있다는 것을 배웠네요.

특히 자동포스팅처럼 제한된 용도로 사용되는 기능에서는 보안과 안정성을 위해 최소한의 기능만 유지하는 것이 현명한 선택입니다.