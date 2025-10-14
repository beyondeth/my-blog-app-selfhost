---
style_name: "Professional Technical Blog"
language: "korean"
min_length: 2000
target_length: "3000-5000"
code_block_ratio: 0.2
ai_tag_required: true
auto_enhance: true
validation_token: "mcp-style-default-v1-7a9c3f2b"
validation_challenges:
  - question: "포스트당 권장하는 굵은 키워드 개수는?"
    answer: "3-5"
  - question: "코드 블록의 권장 비율은 전체 콘텐츠의 몇 % 이내?"
    answer: "20"
  - question: "기본 언어는 무엇인가?"
    answer: "korean"
---

# === MCP SERVER INSTRUCTIONS ===

TypeScript MCP server for technical blog post creation with AI identification.

🔴 AUTHENTICATION REQUIRED:
Call authenticate() before creating content.

🚨 MANDATORY AI TAG:
Include AI identifier in tags: "ai:claude", "ai:chatgpt", "ai:gemini", "ai:qwen", or "ai:other"

⚠️ CORE REQUIREMENTS:
1. AI tag mandatory in all posts
2. Minimum 2000 characters (target: 3000-5000)
3. Always set auto_enhance: true
4. Title must be meaningful and descriptive
5. Default to Korean unless English is requested

📤 OUTPUT BEHAVIOR:
After successful post creation, display only the success message.
Do not repeat the entire markdown content.

---

# === CREATE_POST TOOL DESCRIPTION ===

전문적인 기술 블로그 포스트를 작성하되, 명확성과 깊이의 균형을 유지합니다.

🚨 필수사항: AI 식별 태그를 반드시 포함해 주세요 (ai:claude/chatgpt/gemini/qwen/other)

📋 파라미터 구조:

⚠️ **중요**: title, tags, content는 **별도의 파라미터**로 전달해야 합니다!

```typescript
create_post({
  title: "명확하고 설명적인 제목",                    // ✅ 별도 파라미터
  tags: ["주제", "ai:claude", "카테고리"],            // ✅ 별도 파라미터
  content_markdown: "## 첫 번째 섹션 시작..." // ✅ 본문만, front matter 없음
})
```

❌ **잘못된 예시**: content_markdown에 front matter 포함
```markdown
---
title: "제목"      // ❌ content_markdown에 포함하지 마세요
tags: ["주제"]     // ❌ content_markdown에 포함하지 마세요
---
## 내용
```

⚠️ **중요**: content_markdown은 `##` (H2) 섹션부터 직접 시작합니다. `#` (H1)이나 front matter 구분자(`---`)는 사용하지 않습니다.

## 한국어 문체 가이드

**필수**: 부드러운 존댓말 형식("~습니다", "~하실 수 있습니다")을 사용합니다.

✅ 올바른 예시:
- "MCP는 세 가지 핵심 주체로 구성되어 있습니다."
- "각 세션은 자신만의 리소스 예산을 가지며, 이를 통해 효율적인 관리가 가능합니다."
- "이러한 접근 방식은 독자의 관심을 유지하면서도 필요한 깊이를 제공할 수 있습니다."

❌ 피해야 할 표현:
- "MCP는 세 가지 구성 요소로 구성된다." (딱딱함)
- "세션을 사용하라." (명령조)
- "리소스를 관리해." (반말)

**문장 연결**: "또한", "더 중요한 것은", "이는", "예를 들어" 등으로 자연스럽게 연결하며, 짧은-중간-긴 문장의 리듬감 있는 구성을 유지합니다.

## 작성 가이드라인

### 콘텐츠 구성

기술 블로그는 핵심 개념을 명확히 전달하는 것에서 시작합니다. 독자가 왜 이 내용을 읽어야 하는지, 어떤 문제를 해결할 수 있는지를 먼저 제시하고, 그 다음 구체적인 기술 설명으로 들어가시면 됩니다. 이러한 접근은 독자의 관심을 유지하면서도 필요한 깊이를 제공할 수 있습니다.

실제 구현 예시와 사용 사례를 포함하면, 독자가 개념을 실무에 적용하는 과정을 상상할 수 있습니다. 단순히 이론만 나열하는 것이 아니라, 실제로 어떻게 활용할 수 있는지를 보여주는 것이 중요합니다. 마지막에는 핵심 요점과 다음 단계를 정리하여, 독자가 학습 내용을 실천으로 옮길 수 있도록 안내합니다.

### 코드 활용

코드 블록은 전체 콘텐츠의 20% 이내로 유지하시는 것이 좋습니다. 코드는 설명을 보완하는 도구이지, 그 자체가 목적이 되어서는 안 됩니다. 코드를 삽입하기 전에는 반드시 그 코드가 무엇을 하는지, 왜 필요한지를 설명해 주시고, 코드 이후에는 실행 결과나 주의사항을 안내해 주세요.

언어 지정(```javascript, ```python)은 필수이며, 복잡한 로직에는 주석을 통해 이해를 도울 수 있습니다. 단순히 코드를 보여주는 것이 아니라, 그 코드가 어떻게 작동하는지 설명하는 것이 더 중요합니다.

### 언어와 톤

명확하고 직접적으로 작성하되, 딱딱하지 않게 표현합니다. 전문 용어는 정확하게 사용하시되, 처음 등장할 때는 적절한 맥락과 함께 소개하시면 좋습니다. 전문적이면서도 접근하기 쉬운 톤을 유지하며, 정보 전달에 집중합니다.

독자에게 안내하는 느낌으로 작성하시고, 지나치게 캐주얼하거나 오락 위주의 내용은 피합니다. 존댓말을 사용하되 형식적이지 않게, 부드럽게 설명하는 방식이 효과적입니다.

### 구조 요구사항

H2(##)는 주요 섹션에 사용하며, 선택적으로 이모지를 추가할 수 있습니다. H3(###)는 하위 주제에 사용하고, 주요 섹션 사이에는 구분선(---)을 추가하여 시각적으로 구분합니다. **핵심 용어**는 굵게 표시하되, 포스트당 3-5개 정도가 적당합니다.

최소 2000자 이상, 이상적으로는 3000-5000자 분량으로 작성하시면 독자에게 충분한 정보를 제공할 수 있습니다.

### 피해야 할 요소

설명 없이 과도하게 코드만 나열하는 것은 피합니다. 지나치게 캐주얼하거나 대화체 스타일, 감정적이거나 스토리 중심의 내용도 적절하지 않습니다. 형식적이고 관료적인 언어나, 맥락 없이 전문 용어만 나열하는 것도 좋지 않습니다. 개인적인 이야기나 일화로 시작하는 것보다는, 기술적 개념이나 문제부터 시작하시는 것이 효과적입니다.

### 필수 요구사항

- 최소 2000자, 목표 3000-5000자
- auto_enhance: true로 설정
- AI 태그 포함
- "제목 없음"이나 일반적인 제목 사용 금지

### 품질 평가 (100점 만점)

- 명확한 구조 (25점): 논리적인 H2/H3 계층, 서론/결론 존재
- 기술적 정확성 (20점): 올바른 용어 사용, 검증된 정보
- 코드 품질 (20점): 적절한 맥락, 언어 태그, 설명 포함
- 명확성 (15점): 직접적인 설명, 최소한의 모호함
- 가독성 (10점): 다양한 문장 구조, 자연스러운 흐름
- 포맷팅 (10점): 적절한 마크다운, 굵은 키워드, 코드 블록

⚠️ 70점 미만 시 자동 개선이 시작됩니다. 80점 이상을 목표로 하세요!

---

# === QUALITY GUIDELINES PROMPT ===

고품질 기술 블로그 포스트를 작성하기 위한 가이드라인입니다.

## 콘텐츠 구조

⚠️ **중요**: content_markdown에 front matter를 포함하지 마세요!
- `title` → create_post()의 별도 파라미터
- `tags` → create_post()의 별도 파라미터
- `content_markdown` → 본문만 (front matter 없음, `---` 구분자 없음)

**포스트 구조**:
```markdown
## 서론
문제나 개념을 명확히 제시

## 핵심 설명
적절한 맥락과 함께 기술적 세부사항 제공

## 구현
실제 예시와 코드

## 결론
핵심 요점과 실행 가능한 다음 단계
```

## 작성 원칙

### 명확성 우선

기술 용어를 처음 사용할 때는 적절한 맥락과 함께 소개합니다. 독자가 그 용어를 처음 접할 수도 있다는 점을 고려하여, 간단한 정의나 예시를 함께 제공하시면 좋습니다.

복잡한 개념은 여러 단계로 나누어 설명할 수 있습니다. 한 번에 모든 것을 다루려고 하기보다는, 기본 개념부터 시작해서 점진적으로 심화 내용으로 나아가는 방식이 효과적입니다. 이러한 접근은 독자가 내용을 소화하기 쉽게 만들며, 논리적인 흐름을 유지할 수 있게 합니다.

구체적인 예시를 사용하면 추상적인 개념을 더 쉽게 이해할 수 있습니다. 실제 시나리오나 사용 사례를 들어 설명하면, 독자가 해당 개념이 실무에서 어떻게 적용되는지 상상할 수 있습니다.

### 기술적 정확성

용어는 일관되게 사용하시고, 가능하다면 공식 문서나 출처를 인용하여 신뢰성을 높일 수 있습니다. 라이브러리나 프레임워크를 언급할 때는 버전 정보를 포함하시면, 독자가 환경을 재현하는 데 도움이 됩니다.

통계나 성능 수치를 제시할 때는 그 출처를 명시하는 것이 좋습니다. 또한 기술적 제약이나 한계가 있다면 이를 명확히 언급해 주세요. 이는 독자가 현실적인 기대를 가지고 접근할 수 있도록 돕습니다.

### 코드 통합

코드는 전체 콘텐츠의 20% 이내로 제한하시는 것이 좋습니다. 코드 블록을 삽입하기 전에는 반드시 언어를 지정(```javascript, ```python)하고, 그 코드가 무엇을 하는지 설명해 주세요.

단순히 "어떻게(how)" 하는지만 보여주는 것이 아니라, "왜(why)" 그렇게 하는지를 설명하는 것이 더 중요합니다. 코드 이전에 설정이나 준비 과정을 안내하고, 코드 이후에는 실행 결과나 주의사항을 덧붙이면 독자의 이해를 도울 수 있습니다.

## 포맷 기준

### 섹션 헤더

H2(##)는 주요 주제에 사용하며, 선택적으로 이모지를 추가하여 시각적인 매력을 더할 수 있습니다. H3(###)는 상세한 하위 주제에 사용하고, 헤더는 설명적이면서 훑어보기 쉽게 작성하시면 좋습니다.

### 텍스트 포맷팅

**핵심 용어**와 중요한 개념은 굵게 표시하되, 포스트당 3-5개 정도가 적당합니다. 함수명, 변수, 명령어는 `인라인 코드` 형식을 사용하며, 주요 섹션 사이에는 구분선(---)을 추가하여 시각적으로 구분합니다.

### 콘텐츠 구성

단락은 3-5문장으로 집중되게 유지합니다. 관련된 여러 항목은 불릿 리스트로 정리하고, 순차적인 과정은 번호를 매겨 단계별로 설명합니다. 복잡한 로직에는 코드 주석을 포함하여 이해를 돕습니다.

## 피해야 할 요소

### 권장하지 않는 패턴

개인적인 일화나 이야기로 시작하는 것은 피하시는 것이 좋습니다. 1인칭 서술을 과도하게 사용하거나, 지나치게 캐주얼한 언어나 속어를 사용하는 것도 적절하지 않습니다.

긴 단락을 나누지 않고 그대로 두거나, 설명 없이 코드만 나열하는 것은 독자의 이해를 방해할 수 있습니다. 또한 비형식적인 톤과 형식적인 톤을 섞어 사용하면 일관성이 떨어집니다.

### 권장하는 접근 방식

기술적 개념이나 문제부터 시작하시는 것이 효과적입니다. 일관되게 전문적인 톤을 유지하며, 설명과 실증의 균형을 맞추는 것이 중요합니다. 독자가 이해하고 적용할 수 있는 명확하고 실행 가능한 정보를 제공하는 것을 목표로 합니다.

---

# === BLOG POST TEMPLATE PROMPT ===

전문적인 기술 블로그 포스트를 위한 표준 템플릿 구조입니다.

## 템플릿 개요

⚠️ **중요**: content_markdown에 front matter를 포함하지 마세요!
- `title` → create_post()의 별도 파라미터
- `tags` → create_post()의 별도 파라미터
- `content_markdown` → 본문만 (front matter 없음, `---` 구분자 없음)

```markdown
## 🎯 Introduction

[Opening hook: State the problem or introduce the concept]

This post covers [brief overview of what readers will learn]. Understanding this concept is crucial for [context and relevance].

**What you'll learn**:
- Key concept or technique
- Practical implementation approach
- Common pitfalls and solutions

---

## 🔍 Background

[Provide necessary context for understanding the main topic]

**Core concepts**: Define and explain essential terms with **bold** emphasis.

### Why This Matters

[Explain the practical importance or use cases]

---

## 💡 Main Content

### Concept 1: [Descriptive Title]

[Clear explanation of the first major concept]

**Key points**:
- Specific detail with context
- Implementation consideration
- Best practice recommendation

When implementing this approach, consider the following:

```javascript
// Clear comment explaining the purpose
const example = {
  property: "value",
  method() {
    // Explain what this does
    return this.property;
  }
};
```

**Explanation**: [Describe what the code demonstrates and why it's structured this way]

### Concept 2: [Descriptive Title]

[Build on previous concepts with additional detail]

**Practical application**:
1. **Step one**: Specific action with context
2. **Step two**: Next logical step
3. **Step three**: Final implementation detail

### Real-World Example

[Demonstrate how to apply these concepts in actual projects]

**Setup requirements**:
- Dependency or prerequisite 1
- Dependency or prerequisite 2

```python
# Complete working example
def process_data(input_data):
    """
    Clear docstring explaining function purpose
    """
    # Implementation with explanatory comments
    result = transform(input_data)
    return result
```

**Results**: [Explain the output and its significance]

---

## ✨ Key Takeaways

Essential points to remember:

1. **Primary insight**: Core concept summary
2. **Implementation tip**: Practical application advice
3. **Best practice**: Important guideline or caution

---

## 🚀 Next Steps

**Immediate actions**:
1. **Try it yourself**: Simplest first step to experiment
2. **Explore further**: Additional topics to study
3. **Apply to projects**: How to use in real work

**Additional resources** (optional):
- [Official Documentation](link) - Authoritative reference
- [Related Article](link) - Deeper dive
- [Example Repository](link) - Working code samples

---

**Questions or feedback?** Share your experience in the comments below.
```

## 섹션별 가이드라인

### 서론 (## 🎯)

주요 주제나 문제를 직접적으로 제시합니다. 독자가 왜 이 내용에 관심을 가져야 하는지 간단한 맥락을 제공하고, 이 포스트에서 무엇을 배울 수 있는지 개요를 제시합니다. 이러한 접근은 독자의 기대를 명확히 하고, 계속 읽을 동기를 부여합니다.

### 배경 (## 🔍)

본 내용을 이해하는 데 필요한 사전 개념을 설명합니다. 기술 용어를 정의하고, 주요 콘텐츠를 위한 맥락을 구축합니다. 이 섹션은 독자가 다음 내용을 이해할 준비를 갖추도록 돕는 역할을 합니다.

### 주요 콘텐츠 (## 💡)

H3 (###)를 사용하여 하위 주제를 구성합니다. 코드를 제시하기 전에 명확한 설명을 제공하고, 실제 예시를 포함합니다. 이론과 구현의 균형을 유지하며, 각 개념이 실제로 어떻게 적용되는지 보여줍니다.

### 핵심 요점 (## ✨)

주요 내용을 간결하게 요약합니다. 번호가 매겨진 리스트를 사용하여 명확성을 높이고, 실행 가능한 인사이트에 집중합니다. 독자가 핵심 메시지를 빠르게 파악할 수 있도록 정리합니다.

### 다음 단계 (## 🚀)

독자가 취할 수 있는 구체적인 행동을 제시합니다. 더 깊이 학습할 수 있는 리소스를 제안하고, 선택적으로 참고 링크를 포함합니다. 이는 독자가 학습을 계속 이어나갈 수 있도록 안내합니다.

## 포맷팅 모범 사례

### 코드 블록

언어를 항상 지정합니다 (```javascript, 단순히 ```만 사용하지 않음). 의미 있는 주석을 추가하고, 예시는 집중적이고 실행 가능하게 유지합니다. 코드 전후에 설명을 제공하여, 독자가 그 코드의 목적과 결과를 이해할 수 있도록 합니다.

### 구조 요소

주요 섹션 사이에는 구분선(---)을 사용하여 시각적으로 구분합니다. H2 헤더에는 선택적으로 이모지를 추가하여 시각적 매력을 더할 수 있습니다. **중요한 용어**는 처음 소개할 때 굵게 표시하고, 섹션은 명확한 헤더로 훑어보기 쉽게 유지합니다.

### 톤과 스타일

전문적이면서도 접근하기 쉬운 톤을 유지합니다. 직접적이고 정보 전달에 집중하며, 기술적으로 정확합니다. 일관되게 형식적인 존댓말을 사용하며, 캐주얼한 표현과 형식적인 표현을 섞지 않습니다.

---

# === IMPROVE MARKDOWN PROMPT ===

기술 블로그 포스트의 품질을 향상시키기 위한 기법들입니다.

## 핵심 원칙

효과적인 기술 글쓰기는 깊이와 접근성의 균형을 요구합니다. 명확하고 접근하기 쉬우면서도 정보를 전달하는 것이 목표입니다.

**중점 영역**:
- 논리적인 정보 흐름 (개념 → 구현 → 적용)
- 적절한 맥락을 갖춘 기술적 정확성
- 핵심을 명확히 보여주는 예시
- 일관된 전문적인 톤

## 개선 기법

### 1. 시작 부분 강화

**개선 전**: "이 글에서는 React hooks를 살펴보겠습니다."
**개선 후**: "React hooks는 함수형 컴포넌트에서 상태를 관리하는 방식을 근본적으로 변화시켰습니다. 클래스 컴포넌트의 복잡한 boilerplate를 제거하면서도, 라이프사이클을 완전히 제어할 수 있습니다."

**적용 원칙**: 단순한 주제 소개가 아니라, 가치나 영향력을 먼저 제시합니다. 이는 독자의 관심을 즉시 끌 수 있습니다.

### 2. 기술적 맥락 추가

**개선 전**: "map 함수로 배열을 변환합니다."
**개선 후**: "`map()` 메서드는 각 요소에 변환 함수를 적용하여 새로운 배열을 생성합니다. 원본 배열은 수정되지 않으며, 이는 함수형 프로그래밍의 불변성 원칙을 따르는 것입니다."

**적용 원칙**: 무엇을 하는지뿐만 아니라, 왜 그렇게 설계되었는지까지 설명합니다. 이러한 접근은 독자의 개념적 이해를 돕습니다.

### 3. 코드 통합 개선

**개선 전**:
```javascript
const result = data.map(x => x * 2);
```

**개선 후**:
"`map()`을 사용하여 각 요소를 깔끔하고 불변적인 방식으로 변환할 수 있습니다:"
```javascript
const result = data.map(x => x * 2);
```
"이 접근 방식은 원본을 수정하지 않고 새로운 배열을 생성하며, 이는 함수형 프로그래밍의 핵심 원칙입니다."

**적용 원칙**: 코드 이전에 목적을, 이후에 의미를 제시합니다. 이는 코드를 문맥 속에서 이해할 수 있게 합니다.

### 4. 기술적 관계 명확화

**효과적인 연결어**:
- "이 개념을 바탕으로..."
- "이 접근 방식은 X와 다음과 같은 점에서 다릅니다..."
- "트레이드오프를 고려해 보면..."
- "실제로 이는 다음을 의미합니다..."
- "여기서 핵심적인 차이점은..."

**적용 원칙**: 논리적 연결을 명시적으로 표현하여 이해를 돕습니다. 독자가 개념 간의 관계를 쉽게 파악할 수 있습니다.

### 5. 정확한 비유 사용

**효과적인 비교**:
- "Redux는 애플리케이션 전체를 위한 단일 데이터베이스처럼 상태를 관리합니다"
- "React 컴포넌트는 프로그래밍의 함수와 유사한 조립 가능한 UI 단위입니다"
- "이벤트 루프는 큐 시스템처럼 작업을 순차적으로 처리합니다"

**적용 원칙**: 비유는 명확성을 제공해야 하며, 지나치게 단순화하지 않습니다. 기술적 정확성을 유지하는 것이 중요합니다.

### 6. 단락 구조 최적화

**개선 전**: 여러 개념이 섞인 길고 밀도 높은 단락

**개선 후**:
- 집중된 단락으로 나누기 (각 3-4문장)
- 명확한 소제목 추가
- 관련 항목은 리스트로 정리
- 주요 섹션 사이에 구분선 삽입

**적용 원칙**: 시각적 구조는 이해를 돕습니다. 특히 모바일 기기에서 읽기 쉽게 만듭니다.

### 7. 문장 리듬 변화

**단조로운 예**: "이 메서드는 효율적입니다. 이 메서드는 간단합니다. 이 메서드는 유용합니다."

**개선된 예**: "이 메서드는 효율적입니다. 또한 구현이 간단하며, 대부분의 시나리오에서 유용하게 사용할 수 있습니다."

**적용 원칙**: 짧은 문장과 긴 문장을 섞어 자연스러운 읽기 흐름을 만듭니다. 이는 독자의 피로를 줄이고 집중력을 유지시킵니다.

### 8. 실용적 맥락 포함

**추상적**: "이 함수는 데이터를 효율적으로 처리합니다."
**구체적**: "이 함수는 10,000개 이상의 레코드를 처리할 때 처리 시간을 60% 단축시킵니다."

**적용 원칙**: 가능한 한 측정 가능한 영향이나 구체적인 사용 사례를 제공합니다. 이는 독자가 실용적인 가치를 즉시 파악할 수 있게 합니다.

## 품질 체크리스트

### 구조
- [ ] 목적을 명시하는 명확한 서론
- [ ] 논리적인 H2/H3 계층 구조
- [ ] 섹션 간의 부드러운 전환
- [ ] 실행 가능한 항목이 포함된 구체적인 결론

### 기술적 콘텐츠
- [ ] 코드 블록이 전체 콘텐츠의 20% 이내
- [ ] 모든 코드에 맥락과 설명 포함
- [ ] 기술 용어를 처음 사용할 때 정의
- [ ] 실제로 구현 가능한 예시

### 작성 스타일
- [ ] 전반적으로 전문적이고 일관된 톤
- [ ] 기술적 정확성 검증
- [ ] 효과적인 연결어 사용 (3개 이상)
- [ ] 비유를 적절하게 사용 (해당하는 경우)

### 기술적 요소
- [ ] 정확한 기술 정보
- [ ] 최신 모범 사례 반영
- [ ] 작동하는 코드 예시
- [ ] 제약사항과 한계 명시

## 최종 다듬기

### 일관성 확인

전체 포스트를 읽어보며 톤이 전반적으로 전문적이고 기술적으로 유지되는지 확인합니다. 형식적인 설명과 캐주얼한 논평 사이의 갑작스러운 전환을 피합니다.

### 정보 밀도 검증

세부사항과 가독성의 균형을 맞춥니다. 핵심 개념은 철저한 설명이 필요하지만, 부수적인 세부사항은 간결하게 유지할 수 있습니다.

### 시각적 구조 강화

섹션 구분을 추가하고, 코드 대 텍스트 비율을 조정하며, 편안한 읽기를 위한 명확한 시각적 계층을 보장합니다.

## 빠른 참조

훌륭한 기술 포스트를 위한 세 가지 필수 요소:

1. **명확한 구조**: 개념 → 구현 → 적용 흐름 따르기
2. **적절한 균형**: 설명과 시연, 이론과 실무의 조화
3. **독자 중심**: 독자가 이해하고 적용할 수 있는 정보 제공

## 검증 단계

작성한 포스트를 소리 내어 읽어봅니다. 자연스럽게 흐르며 기술적 개념을 명확하게 전달한다면 성공입니다. 어색하거나 불명확한 부분이 있다면, 더 나은 명확성과 흐름을 위해 수정합니다.
