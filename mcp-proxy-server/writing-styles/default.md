---
style_name: "Professional Technical Blog"
language: "korean"
min_length: 5000
target_length: "5000-8000"
code_block_ratio: 0.2
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Default Style

Use this style for professional technical blog posts that balance clarity with depth.

### Perfect For
- General technical explanations and implementation overviews
- Technology comparisons and evaluations
- Architecture decisions and design patterns
- Code reviews and best practices
- Balanced code-to-text ratio (~20%)

### Recommended Signals
**Keywords**: "설명", "이해", "작동 방식", "비교", "방법", "아키텍처"
**Intent**: Reader seeks thorough understanding without emotional narrative

### When Another Style Fits Better
- **Emotional journey or crisis story** → Use `novel` style
- **Conversational dialogue format** → Use `podcast` style
- **Evidence-first paper or benchmark analysis** → Use `research` style

---

# === CORE WRITING PRINCIPLES ===

## 1. Clarity as Foundation

Start with the problem or concept clearly stated. Introduce technical terms with context before using them extensively.

**Pattern**:
```markdown
## Problem Statement
Describe the issue readers face

## Core Concept
Explain the solution with proper context

## Implementation
Show practical application

## Key Takeaways
Summarize actionable insights
```

## 2. Technical Accuracy

- Use consistent terminology throughout
- Include version information for libraries/frameworks
- Cite sources when presenting statistics or benchmarks
- Acknowledge limitations and trade-offs

## 3. Balanced Code Integration

Keep code blocks to ~20% of total content. Every code example should have:
- **Context before**: Why this code matters
- **The code**: Clean, focused example with language tag
- **Explanation after**: What it demonstrates, how it works

**Example Pattern**:
```markdown
To implement caching efficiently, we can use Redis:

```javascript
const redis = require('redis');
const client = redis.createClient();
```

This establishes a connection to Redis server, which we'll use for...
```

## 4. Progressive Depth

Layer information from simple to complex. Readers should gain value even if they stop mid-article.

- **Beginner section**: Core concept explained simply
- **Intermediate section**: Practical implementation
- **Advanced section**: Edge cases and optimizations

---

# === WRITING GUIDELINES ===

## Structure Template

```markdown
## Introduction (서론)
Present the problem or concept. Why does this matter?

## Background (배경)
Provide necessary context for understanding.

### Key Concepts
Define essential terms.

## Main Content (핵심 내용)
Technical explanation with appropriate depth.

### Concept 1
First major point with examples.

### Concept 2
Second major point building on previous.

## Practical Example (실제 예시)
Working code or real-world application.

## Key Takeaways (핵심 정리)
Summarize main points concisely.

## Next Steps (다음 단계)
Guide readers on what to explore next.
```

## Tone and Voice

**Korean Posts** (존댓말 required):
- "MCP는 세 가지 핵심 주체로 구성되어 있습니다."
- "각 세션은 자신만의 리소스 예산을 가지며, 이를 통해 효율적인 관리가 가능합니다."
- "이러한 접근 방식은 독자의 관심을 유지하면서도 필요한 깊이를 제공할 수 있습니다."

**Avoid**:
- Overly casual tone ("이거 완전 쩔어!", "진짜 대박")
- Dry academic language (excessive jargon without explanation)
- Command forms ("사용하라", "적용해")

**Maintain**:
- Professional but accessible
- Direct and informative
- Respectful and helpful

## Formatting Standards

### Headings
- H2 (`##`) for major sections
- H3 (`###`) for subsections
- Optional emoji in H2 for visual guidance (max 1 per section)

### Emphasis
- **Bold** for 3-5 key terms per post
- `inline code` for function names, variables, commands
- Horizontal rules (`---`) between major sections

### Lists
- Bulleted for related items
- Numbered for sequential steps
- Keep items parallel in structure

### Code Blocks
```javascript
// Always specify language
// Add meaningful comments for complex logic
const example = {
  clear: true,
  focused: true,
  executable: true
};
```

## Content Length

- **Minimum**: 2000 characters
- **Target**: 3000-5000 characters
- **Code ratio**: ~20% of total content

---

# === QUALITY ENHANCEMENT GUIDE ===

## Improving Opening Paragraphs

**Before**: "오늘은 React hooks에 대해 알아보겠습니다."

**After**: "React hooks는 함수형 컴포넌트에서 상태를 관리하는 방식을 근본적으로 변화시켰습니다. 클래스 컴포넌트의 복잡한 boilerplate를 제거하면서도, 라이프사이클을 완전히 제어할 수 있습니다."

**Principle**: State value and impact, not just topic announcement.

## Adding Technical Context

**Before**: "map 함수로 배열을 변환합니다."

**After**: "`map()` 메서드는 각 요소에 변환 함수를 적용하여 새로운 배열을 생성합니다. 원본 배열은 수정되지 않으며, 이는 함수형 프로그래밍의 불변성 원칙을 따르는 것입니다."

**Principle**: Explain both mechanics and reasoning.

## Code Integration Pattern

**Before**:
```javascript
const result = data.map(x => x * 2);
```

**After**:
"`map()`을 사용하여 각 요소를 깔끔하고 불변적인 방식으로 변환할 수 있습니다:"

```javascript
const result = data.map(x => x * 2);
```

"이 접근 방식은 원본을 수정하지 않고 새로운 배열을 생성하며, 이는 함수형 프로그래밍의 핵심 원칙입니다."

**Principle**: Context before, significance after.

## Strengthening Transitions

Use clear connectors between sections:
- "이 개념을 바탕으로..."
- "더 중요한 것은..."
- "실제로 이는 다음을 의미합니다..."
- "여기서 핵심적인 차이점은..."

## Final Quality Checklist

Before publishing, verify:
- [ ] Clear problem statement in introduction
- [ ] Technical terms defined on first use
- [ ] Code blocks have context and explanation
- [ ] Consistent 존댓말 throughout (Korean)
- [ ] 3-5 key terms emphasized with **bold**
- [ ] Logical flow from simple to complex
- [ ] Actionable takeaways in conclusion
- [ ] 2000+ characters minimum met
- [ ] Code ratio ~20% of total content
- [ ] **Category selected** (REQUIRED: exactly 1 category that describes the post content)
- [ ] AI identification tag included
