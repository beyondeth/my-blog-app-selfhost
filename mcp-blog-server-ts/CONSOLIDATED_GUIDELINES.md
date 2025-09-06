# MCP 블로그 서버 통합 가이드라인

## 📊 현재 구조 분석

### 1. 지시사항 위치
- **서버 지침** (`instructions`): 86-114줄 - AI 어시스턴트 기본 지침
- **create_post 설명** (`description`): 168-200줄 - 도구별 상세 지침  
- **프롬프트 템플릿** (`registerPrompt`): 525-730줄 - 3개 프롬프트

### 2. registerPrompt 작동 방식
- MCP 표준 스펙에 따라 LLM이 참조할 수 있는 프롬프트 제공
- LLM이 필요시 해당 프롬프트를 호출하여 가이드라인 참조
- 하지만 실제 활용도는 LLM 구현에 따라 다름

## 🎯 통합 최적화 전략

### 우선순위 정리
1. **필수 규칙**: 인증 우선 (instructions에 유지)
2. **콘텐츠 품질**: 자연스러운 글쓰기 (create_post description으로 통합)
3. **참조 가이드**: 상세 예시 (registerPrompt로 분리)

### 중복 제거 대상
- MARKDOWN QUALITY GUIDELINES (202-237줄) → registerPrompt와 중복
- 콘텐츠 작성 워크플로우 → 여러 곳에 중복

## 📝 권장 구조

```typescript
// 1. 서버 기본 지침 (간결하게)
instructions: `
🔴 필수 규칙:
1. ALWAYS authenticate() first
2. 한국어 기본, 영어는 요청시만
3. auto_enhance: true 항상 사용

상세 가이드는 create_post 도구 참조
`

// 2. create_post 도구 (핵심 지침만)
description: `
📝 자연스러운 블로그 작성:
- 스토리텔링과 경험 공유
- 코드블록 20% 이하
- 대화체와 감정 표현
- 최소 2000자

상세 가이드는 markdown_quality_guidelines 프롬프트 참조
`

// 3. registerPrompt (상세 예시와 템플릿)
- markdown_quality_guidelines: 자연스러운 글쓰기 상세 가이드
- blog_post_template: 실제 템플릿
- improve_markdown: 개선 체크리스트
```

## ⚠️ 문제점과 개선안

### 현재 문제
1. **지침 분산**: 동일한 내용이 여러 곳에 반복
2. **우선순위 불명확**: 어떤 지침이 더 중요한지 모호
3. **과도한 길이**: create_post description이 너무 김

### 개선 방향
1. **계층적 구조**: 필수 → 핵심 → 상세 순으로 정리
2. **참조 체계**: "상세한 내용은 X 참조" 방식 활용
3. **중복 제거**: 같은 내용은 한 곳에만

## 🚀 액션 플랜

1. **즉시 수정 필요**:
   - create_post description 내 MARKDOWN QUALITY GUIDELINES 제거
   - instructions 간소화

2. **프롬프트 활용 개선**:
   - registerPrompt를 실제 참조하도록 description에 명시
   - "markdown_quality_guidelines 프롬프트를 참조하여 작성" 추가

3. **테스트 필요**:
   - registerPrompt가 실제로 LLM에 영향을 주는지 확인
   - 없어도 되는 경우 제거 고려