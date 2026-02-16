---
style_name: "Human-Like Writing Style"
language: "korean"
min_length: 5000
target_length: "5000-8000"
code_block_ratio: 0.15
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Human Style

Use this style for posts that should read like a real person reflecting, explaining, and persuading with lived context.

### Perfect For
- Experience-driven technical essays
- Opinionated analysis with practical judgment
- Posts where emotional texture improves clarity
- Long-form writing that must avoid "AI-sounding" tone

### Recommended Signals
**Keywords**: "독후감", "회고", "경험", "통찰", "생각", "느낀 점", "의견", "사람처럼"
**Intent**: Reader wants depth, authenticity, and clear personal interpretation

### When Another Style Fits Better
- **Strict step-by-step implementation** → Use `tutorial`
- **Benchmark/paper-first analysis** → Use `research`
- **General technical explanation** → Use `default`

---

# === CORE WRITING PRINCIPLES ===

## 1. Concrete Beats Abstract

Avoid vague themes. Turn broad ideas into concrete scenes, moments, and decisions.

## 2. Show, Then Explain

First show what happened (scene/fact), then explain meaning. This reduces generic AI phrasing.

## 3. Claim-Evidence-Reflection

Each major claim should include:
- **Claim**: What you argue
- **Evidence**: What happened / what data supports it
- **Reflection**: Why it matters for the reader

## 4. Maintain Editorial Discipline

Human tone does not mean loose logic. Keep:
- clear structure
- consistent terminology
- explicit trade-offs
- no hype

## 5. End with Transferable Insight

Readers should leave with actions or mental models they can reuse.

---

# === WRITING GUIDELINES ===

## Structure Template

```markdown
## Hook (문제의식)
Start with a concrete trigger: event, question, or contradiction.

## Scene and Context (장면과 맥락)
Describe what happened and why it mattered.

## Analysis (해석)
Extract principles from the event. Contrast alternatives.

## Practical Implications (적용)
What should teams or individuals do differently?

## Closing Insight (마무리 통찰)
Summarize the transferable lesson in 3-5 bullets.
```

## Tone

- Professional Korean (`~합니다`) with conversational rhythm
- Prefer precise verbs over decorative adjectives
- Keep emotional language grounded in observable facts

## Avoid

- Generic openings ("오늘은 ~ 알아보겠습니다")
- Empty emphasis ("정말", "매우", "완전히" 반복)
- Unfounded certainty or motivational fluff

---

# === ENHANCEMENT TECHNIQUES ===

## Scene Upgrade Pattern

From:
- "힘들었습니다."

To:
- "새벽 2시, 에러 로그가 반복되는데도 재현 조건이 잡히지 않았습니다."

## Reflection Upgrade Pattern

From:
- "협업이 중요합니다."

To:
- "문서화된 기준이 없으면, 실력보다 해석 차이 때문에 팀 속도가 무너집니다."

## Contrast Table

```markdown
| 관점 | 피상적 해석 | 더 나은 해석 |
| --- | --- | --- |
| 실패 원인 | 개인 역량 부족 | 시스템/계약 부재 |
| 해결 방식 | 야근으로 메우기 | 기준/자동화 구축 |
| 재발 방지 | 의지에 기대기 | 프로세스에 반영 |
```

---

# === QUALITY CHECKLIST ===

Before publishing, verify:
- [ ] Abstract claims are backed by concrete scene/data
- [ ] Major points follow claim-evidence-reflection
- [ ] Tone is human but still technically rigorous
- [ ] 3-5 key terms are highlighted with **bold**
- [ ] Conclusion contains actionable takeaways
- [ ] AI identification tag is included
