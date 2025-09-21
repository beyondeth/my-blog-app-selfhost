# Content Renderer 마이그레이션 가이드

## 아키텍처 개선 내용

### 🎯 주요 변경 사항

1. **SRP (Single Responsibility Principle) 적용**
   - 단일 컴포넌트에서 여러 렌더러 컴포넌트로 분리
   - 각 컴포넌트가 단일 책임만 가짐

2. **백엔드 콘텐츠 처리**
   - 보안을 위한 서버 사이드 HTML 살균
   - 성능 향상을 위한 사전 처리

3. **DOM 조작 제거**
   - `document.querySelector` 등 직접 DOM 조작 제거
   - 순수한 React 컴포넌트 방식으로 전환

## 📁 새로운 폴더 구조

```
src/components/ui/content-renderer/
├── index.ts                        # 엔트리 포인트
├── types.ts                         # 타입 정의
├── HtmlContentRenderer.tsx         # 메인 오케스트레이터
├── components/                      # 개별 렌더러 컴포넌트
│   ├── HtmlRenderer.tsx            # HTML 렌더링
│   ├── CodeRenderer.tsx            # 코드 하이라이팅
│   ├── MermaidRenderer.tsx         # Mermaid 다이어그램
│   └── YouTubeRenderer.tsx         # YouTube 비디오
└── utils/
    └── content-parser.ts           # 콘텐츠 파싱 유틸리티
```

## 🔄 마이그레이션 방법

### 기존 코드
```typescript
import HtmlContentRendererV2 from '@/components/ui/HtmlContentRendererV2';

<HtmlContentRendererV2
  content={post.content}
  className="mt-6"
/>
```

### 새로운 코드
```typescript
import { HtmlContentRenderer } from '@/components/ui/content-renderer';

<HtmlContentRenderer
  content={post.content}
  className="mt-6"
  options={{
    enableCodeHighlight: true,
    enableMermaid: true,
    enableImageModal: true,
    enableCodeCopy: true,
    enableYouTube: true,
  }}
  onMetadataChange={(metadata) => {
    console.log('Content metadata:', metadata);
  }}
/>
```

## ✨ 새로운 기능

### 1. 메타데이터 추출
```typescript
const handleMetadataChange = (metadata: ContentMetadata) => {
  console.log('이미지 수:', metadata.imageCount);
  console.log('코드 블록 수:', metadata.codeBlockCount);
  console.log('예상 읽기 시간:', metadata.readingTime, '분');
  console.log('사용된 언어:', metadata.languages);
};
```

### 2. 선택적 기능 활성화
```typescript
// 특정 기능만 활성화
<HtmlContentRenderer
  content={content}
  options={{
    enableCodeHighlight: true,
    enableMermaid: false,      // Mermaid 비활성화
    enableYouTube: false,      // YouTube 비활성화
  }}
/>
```

### 3. 개별 컴포넌트 사용
```typescript
import { CodeRenderer, MermaidRenderer } from '@/components/ui/content-renderer';

// 코드 블록만 렌더링
<CodeRenderer
  id="code-1"
  language="javascript"
  content="console.log('Hello World');"
  showCopyButton={true}
/>

// Mermaid 다이어그램만 렌더링
<MermaidRenderer
  id="mermaid-1"
  content="graph TD\n  A-->B"
  onClick={(svg, content) => {
    console.log('Mermaid clicked');
  }}
/>
```

## 🔒 보안 개선

### 백엔드 (NestJS)
```typescript
import { ContentProcessingService } from '@/content-processing/services/content-processing.service';

// 포스트 생성/업데이트 시
const processed = await this.contentProcessing.processMarkdownHtml(htmlContent, {
  sanitize: true,
  processCode: true,
  processImages: true,
  preserveMermaid: true,
});
post.content = processed.html;
```

### 프론트엔드
- 백엔드에서 이미 살균된 콘텐츠를 받음
- 추가 클라이언트 사이드 살균으로 이중 보안
- XSS 공격 방지

## 📊 성능 개선

1. **레이지 로딩**
   - Mermaid 컴포넌트는 동적 import로 필요시에만 로드
   - 이미지와 YouTube 비디오는 lazy loading 적용

2. **메모이제이션**
   - `useMemo`로 콘텐츠 파싱 결과 캐싱
   - 불필요한 재렌더링 방지

3. **배치 처리**
   - 콘텐츠를 한 번에 파싱하여 여러 파트로 분리
   - 각 파트를 독립적으로 렌더링

## ⚠️ 주의 사항

1. **백엔드 업데이트 필요**
   - ContentProcessingModule이 PostsModule에 추가되어야 함
   - 기존 포스트는 재처리가 필요할 수 있음

2. **스타일 확인**
   - 기존 CSS 클래스가 새 컴포넌트에서도 작동하는지 확인
   - 필요시 스타일 조정

3. **테스트**
   - 다양한 콘텐츠 타입으로 테스트
   - 특히 Mermaid 다이어그램과 YouTube 비디오 확인

## 🚀 향후 개선 계획

- [ ] 서버 사이드 렌더링 최적화
- [ ] 콘텐츠 캐싱 전략 구현
- [ ] 더 많은 다이어그램 타입 지원 (PlantUML, Graphviz 등)
- [ ] 코드 실행 환경 통합 (CodeSandbox, StackBlitz)
- [ ] 실시간 협업 기능