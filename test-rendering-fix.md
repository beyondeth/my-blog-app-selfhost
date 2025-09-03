---
title: "마크다운 렌더링 충돌 해결: 코드 블록 처리 개선"
tags: ["markdown", "rendering", "bugfix", "frontend", "backend"]
date: 2025-09-03
---

## 📋 문제 상황

MCP Prompts 시스템 구현 후 코드 블록 렌더링이 깨지는 문제가 발생했습니다. 특히 마크다운 예제를 보여주는 코드 블록에서 **이스케이프된 백틱**이 문제를 일으켰죠.

---

## 🔍 근본 원인 분석

### 문제가 된 패턴

마크다운 예제를 보여줄 때 이런 패턴을 사용했습니다:

```markdown
코드 블록은 이렇게 작성합니다:
triple-backtick + language
코드 내용
triple-backtick
```

### 처리 과정의 충돌

1. **MCP Prompts**: 이스케이프된 백틱 포함
2. **Backend 변환**: 백틱을 `&#96;`로 이스케이프
3. **이중 이스케이프**: 파싱 오류 발생
4. **Frontend**: 깨진 HTML 구조 수신

---

## 💡 해결 방법

### 1. Backend 마크다운 렌더러 개선

```typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\`/g, '[[ESCAPED_BACKTICK]]')  // 임시 보호
.replace(/`/g, '&#96;')                    // 일반 백틱만 이스케이프
.replace(/\[\[ESCAPED_BACKTICK\]\]/g, '`'); // 복원
```

### 2. MCP Prompts 수정

마크다운 예제에서 백틱을 직접 사용하지 않고 설명적 표현 사용:
- `[triple-backtick]javascript` 형식
- `[code block with javascript language]` 표기

### 3. Frontend 렌더러 강화

```javascript
// 더 많은 언어 지원
const supportedLanguages = [
  'typescript', 'javascript', 'python', 
  'bash', 'json', 'yaml', 'sql'
];

// 유연한 패턴 매칭
/<pre[^>]*><code class="language-([\w]+)">/gi
```

---

## 🚀 개선 결과

### Before: 깨진 코드 블록
- 이스케이프 충돌로 인한 파싱 오류
- 코드 블록이 일반 텍스트로 표시
- 구조가 깨진 HTML 출력

### After: 정상 렌더링
- ✅ 모든 코드 블록 정상 표시
- ✅ 언어별 syntax highlighting
- ✅ 마크다운 예제도 올바르게 표시

---

## 📊 기술적 세부사항

### 파일 수정 내역

1. **Backend** (`markdown-renderer.service.ts`)
   - 이스케이프 로직 개선
   - 이중 이스케이프 방지

2. **MCP Server** (`index.ts`)
   - 프롬프트에서 문제 패턴 제거
   - 설명적 표현 사용

3. **Frontend** (`ContentRenderer.tsx`)
   - 패턴 매칭 개선
   - 더 많은 언어 지원

### 테스트 케이스

```python
# Python 코드 예제
def hello_world():
    print("Hello, World!")
```

```bash
# Bash 스크립트 예제
echo "Testing code blocks"
npm run build
```

```json
{
  "test": "JSON formatting",
  "status": "working"
}
```

---

## 🎯 결론

**마크다운 렌더링 파이프라인**의 각 단계를 분석하여:
1. 이스케이프 충돌 지점 식별
2. 각 레이어별 최적화 적용
3. 호환성 문제 완전 해결

이제 모든 종류의 마크다운 콘텐츠가 **정확하게 렌더링**됩니다! 🚀