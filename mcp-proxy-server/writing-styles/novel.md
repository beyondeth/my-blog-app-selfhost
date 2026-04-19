---
style_name: "Fiction Writer's Narrative Style"
language: "english"
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
**Keywords**: "late night", "incident", "crisis", "debugging", "struggle", "realization", "journey"
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
"Tuesday, 3:47 AM. The customer dashboard was still loading..."

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

## Voice and Tone

**Narrative voice**: Past tense, first-person storytelling
- "By the third coffee, it had already gone cold." (not "The coffee became cold.")
- "We decided to roll out Redis." (captures the decision moment)

**Dialogue**: Use direct quotes for realism
```markdown
Sarah leaned over my shoulder. "You're still using `SELECT *`?"

"It's a debugging session, not production."

"It's been three hours already."

She was right. Pride writes bad architecture.
```

## Sensory and Temporal Markers

### Time Markers
- Specific timestamps: "Tuesday, 3:47 AM"
- Duration markers: "three hours later", "48 hours had passed"
- Environmental changes: "the sun came up", "the office went dark"

### Physical Details
- Coffee count: "third coffee", "cold coffee"
- Screen/monitor: "error logs filling the monitor"
- Surroundings: "the office AC", "nothing but keyboard clicks"

### Emotional State (through action)
- "My hands shook." (nervous)
- "I took a long breath." (preparing)
- "I laughed." (ironic or bitter)

## Formatting for Narrative Flow

### Pacing
- **Crisis/action**: Short, punchy sentences
  ```
  The error surfaced.
  I tried again.
  It failed again.
  ```

- **Reflection**: Longer, thoughtful sentences
  ```
  Six months earlier, I would have cowboy-coded this: deploy fast,
  debug in production, move on. But the 14-hour incident on Tuesday
  taught me something different...
  ```

### Dialogue Format
```markdown
**Sarah**: "Is this really the problem?"

**Me**: "...maybe."

**Sarah**: *turns the laptop toward me*

**Me**: "...oh no."
```

### Section Breaks
Use `---` between acts/major scenes to signal time/location shifts.

---

# === ENHANCEMENT TECHNIQUES ===

## Opening Transformation

**Before**: "Today I want to share what we learned from optimizing our API."

**After**: "Tuesday, 10:47 AM. The customer dashboard loaded. Then kept loading. Fifteen seconds passed. My coffee went cold. A Slack message from the CEO appeared: '?????'"

**Principle**: Start with a specific moment, not a topic announcement.

## Failed Attempts as Tension

Chronicle escalating failures:

```markdown
**Attempt 1**: Redis caching. Two hours later, it crashed again.

**Attempt 2**: Database read replicas. The write master was still drowning.

**Attempt 3**: Horizontal scaling. AWS costs doubled. Performance did not move.

**4 AM realization**: We had been caching the wrong thing from the start.
```

## Metaphor for Technical Concepts

**Abstract**: "Event-driven architecture separates concerns."

**Narrative**: "Imagine a restaurant kitchen. Servers don't cook. Chefs don't deliver plates. Everyone waits for a signal: 'Order in!' or 'Table seven!' Then each person does exactly their part. That's event-driven architecture. Everything is waiting, listening, and ready to react."

## Character Arc Through Tech Journey

**Before**: "I learned that architecture planning matters."

**After**: "Six months earlier, I would have cowboy-coded this solution: ship fast, debug in production, move on. But Tuesday's 14-hour outage taught me that technical debt is never paid with code alone. It gets paid with the team's sleep, the CEO's trust, and the user's patience.

Now I write boring, over-documented, well-tested code.

And I sleep."

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
