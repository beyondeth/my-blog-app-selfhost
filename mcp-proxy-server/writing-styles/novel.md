---
style_name: "Fiction Writer's Narrative Style"
language: "korean"
min_length: 5000
target_length: "5000-8000"
code_block_ratio: 0.05
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Novel Style

Use this style to transform technical experiences into compelling narratives with characters, conflict, and resolution.

### Perfect For
- Production crisis stories and incident postmortems
- Debugging journeys (frustration → breakthrough → solution)
- Technical decision-making processes with stakes
- Learning experiences with emotional arcs
- War stories that teach through experience

### Recommended Signals
**Keywords**: "새벽", "장애", "위기", "디버깅", "고군분투", "깨달음", "여정"
**Emotional intent**: User wants to share the experience, not just the solution

### When Another Style Fits Better
- **Balanced technical explanation** → Use `default` style
- **Code-heavy content (>10%)** → Use `default` or `research` style

---

# === CORE NARRATIVE PRINCIPLES ===

## 1. Show, Don't Tell

Transform abstract feelings into concrete, sensory details.

**Avoid**: "I was frustrated when the bug appeared."

**Instead**: "My third coffee sat abandoned, cold. The cursor blinked at line 47, mocking me. Outside, the sun rose. I hadn't noticed the night passing."

**Technique**: Use physical environment, body language, and specific details to convey emotion without naming it.

## 2. Specificity Creates Belief

Precise details make stories credible and immersive.

**Avoid**: "The query was slow."

**Instead**: "The dashboard loaded. Then loaded some more. Fifteen seconds passed. My coffee went cold. The CEO's Slack message appeared: '?????'"

**Pattern**: Time + observation + consequence + reaction

## 3. Code as Story Evidence

Code blocks should advance the narrative, not replace it. Keep under 5% of total content.

**Purpose**: Show the desperation, brilliance, or folly of a decision—not just what the code does.

**Example**:
"Desperation makes you try stupid things. At 3 AM, I wrote the most naive query imaginable:"
```javascript
const result = await db.query('SELECT * FROM users');
```
"Ten seconds. Twenty. Thirty. The terminal hung. Somewhere, a database cried."

## 4. Three-Act Structure

Build tension through narrative arc:
- **Act 1 (Setup)**: Normal state, problem emerges
- **Act 2 (Conflict)**: Attempts fail, situation worsens, revelation
- **Act 3 (Resolution)**: Breakthrough, solution, reflection

---

# === WRITING GUIDELINES ===

## Narrative Structure Template

```markdown
## Opening Scene
Specific time, place, sensory detail
"화요일 새벽 3시 47분. 고객 대시보드가 로딩 중이었다..."

## Act 1: The Problem Emerges
First signals, initial response, growing concern
Physical details, dialogue, environmental markers

## Act 2: Descent and Discovery
Failed attempts, escalation, team dynamics
Chronicle the struggle with specific moments

## Act 3: The Breakthrough
Insight moment, solution, verification
The "aha!" described viscerally

## Reflection: What Changed
Technical lesson (brief), personal growth, forward-looking insight
```

## Voice and Tone (Korean)

**Narrative voice**: Past tense, first-person storytelling
- "세 번째 커피는 이미 식어있었다" (not "세 번째 커피가 식었다")
- "우리는 Redis를 도입하기로 했다" (decision moment)

**Dialogue**: Use direct quotes for realism
```markdown
Sarah가 내 어깨 너머로 말했다. "아직도 SELECT * 쓰고 있어?"

"디버깅 세션이야, 프로덕션 아니고."

"이미 3시간째야."

그녀가 맞았다. 자존심이 나쁜 아키텍처를 만든다.
```

## Sensory and Temporal Markers

### Time Markers
- Specific timestamps: "화요일 새벽 3시 47분"
- Duration markers: "3시간 후", "48시간이 지났다"
- Environmental changes: "해가 떠올랐다", "사무실이 어두워졌다"

### Physical Details
- Coffee count: "세 번째 커피", "식은 커피"
- Screen/monitor: "모니터를 채운 에러 로그"
- Surroundings: "사무실의 냉방", "키보드 타이핑 소리만"

### Emotional State (through action)
- "손이 떨렸다" (nervous)
- "심호흡을 했다" (preparing)
- "웃음이 나왔다" (ironic/bitter)

## Formatting for Narrative Flow

### Pacing
- **Crisis/action**: Short, punchy sentences
  ```
  에러가 나타났다.
  다시 시도했다.
  또 실패했다.
  ```

- **Reflection**: Longer, thoughtful sentences
  ```
  6개월 전의 나라면 이 코드를 cowboy coding 했을 것이다. 빠르게 배포하고,
  프로덕션에서 디버깅하고, 다음으로 넘어가는 식으로. 하지만 화요일의
  14시간 장애는 내게 가르쳐줬다...
  ```

### Dialogue Format
```markdown
**Sarah**: "이게 진짜 문제야?"

**Me**: "...아마도."

**Sarah**: \*노트북을 보여줌\*

**Me**: "...아, 이런."
```

### Section Breaks
Use `---` between acts/major scenes to signal time/location shifts.

---

# === ENHANCEMENT TECHNIQUES ===

## Opening Transformation

**Before**: "오늘은 우리 API 최적화 경험을 공유하겠습니다."

**After**: "화요일 오전 10시 47분. 고객 대시보드가 로드되었다. 그리고 계속 로드되었다. 15초가 지났다. 내 커피가 식어갔다. CEO의 슬랙 메시지가 도착했다: '?????'"

**Principle**: Start with a specific moment, not a topic announcement.

## Failed Attempts as Tension

Chronicle escalating failures:

```markdown
**시도 1**: Redis 캐싱. 2시간 후 다시 크래시.

**시도 2**: Database read replicas. Write master는 여전히 버거워했다.

**시도 3**: Horizontal scaling. AWS 비용은 두 배. 성능은 그대로.

**새벽 4시의 깨달음**: 우리는 처음부터 잘못된 것을 캐싱하고 있었다.
```

## Metaphor for Technical Concepts

**Abstract**: "Event-driven architecture separates concerns."

**Narrative**: "레스토랑 주방을 상상해 보자. 웨이터는 요리하지 않는다. 셰프는 서빙하지 않는다. 각자는 자기 신호를 기다린다—'주문 들어왔어요!' 혹은 '7번 테이블!'—그리고 자기 일을 한다. 그게 event-driven architecture다. 모두가 기다리고, 듣고, 반응할 준비를 하고 있다."

## Character Arc Through Tech Journey

**Before**: "아키텍처 계획이 중요하다는 걸 배웠다."

**After**: "6개월 전의 나라면 이 솔루션을 cowboy coding 했을 것이다. 빠르게 배포, 프로덕션에서 디버깅, 다음으로 넘어가기. 하지만 화요일의 14시간 장애가 가르쳐줬다: 기술 부채는 코드로 갚는 게 아니다. 팀의 야근 시간으로, CEO의 신뢰로, 사용자의 인내심으로 갚는다.

이제 나는 지루하고, 문서화가 과한, 제대로 테스트된 코드를 쓴다.

그리고 나는 잔다."

**Principle**: Show transformation through contrasting past/present self.

---

# === QUALITY CHECKLIST ===

Before publishing novel-style posts, verify:

**Narrative Elements**:
- [ ] Opens with specific time/place (not topic statement)
- [ ] Uses sensory details (sight, sound, temperature, physical sensations)
- [ ] Shows emotions through action/environment (not by naming them)
- [ ] Includes dialogue or internal monologue
- [ ] Three-act structure present (setup → conflict → resolution)

**Technical Balance**:
- [ ] Code blocks <5% of content
- [ ] Code has narrative framing (desperation, insight, irony)
- [ ] Technical concepts explained through metaphor or story
- [ ] Solution emerges from narrative, not dumped as info

**Story Quality**:
- [ ] Specific numbers/details (not generalizations)
- [ ] Time markers create sense of duration
- [ ] Character experiences arc (confusion → understanding)
- [ ] Ends with reflection and wisdom gained

**Required**:
- [ ] **Category selected** (REQUIRED: exactly 1 category that describes the post content)
- [ ] AI identification tag included

**Avoid**:
- [ ] Tutorial-style "step 1, step 2" structure
- [ ] Excessive code (keep under 5%)
- [ ] Explaining jokes or emotions explicitly
- [ ] Flat emotional tone throughout
