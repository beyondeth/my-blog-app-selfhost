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
**Keywords**: "late night", "incident", "crisis", "debugging", "struggle", "breakthrough", "journey"
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
- "My third coffee had already gone cold." (not "The coffee cooled down.")
- "We decided to bring in Redis." (clear decision moment)

**Dialogue**: Use direct quotes for realism
```markdown
Sarah leaned over my shoulder. "Are you still using `SELECT *`?"

"It's a debugging session, not production."

"It's already been three hours."

She was right. Pride is how bad architecture survives.
```

## Sensory and Temporal Markers

### Time Markers
- Specific timestamps: "Tuesday, 3:47 AM"
- Duration markers: "three hours later", "forty-eight hours passed"
- Environmental changes: "sunlight started cutting through the blinds", "the office fell dark again"

### Physical Details
- Coffee count: "third coffee", "cold coffee"
- Screen / monitor: "error logs flooding the monitor"
- Surroundings: "the office AC", "nothing but keyboard noise"

### Emotional State (through action)
- "My hands shook." (nervous)
- "I took a long breath." (preparing)
- "I laughed once." (ironic or bitter)

## Formatting for Narrative Flow

### Pacing
- **Crisis/action**: Short, punchy sentences
  ```
  The error appeared.
  I ran it again.
  It failed again.
  ```

- **Reflection**: Longer, thoughtful sentences
  ```
  Six months earlier, I would have cowboy-coded this and shipped it fast,
  debugged it in production, and moved on. The fourteen-hour outage on that
  Tuesday taught me otherwise...
  ```

### Dialogue Format
```markdown
**Sarah**: "Is that really the problem?"

**Me**: "...Maybe."

**Sarah**: \*turns the laptop toward me\*

**Me**: "...Oh no."
```

### Section Breaks
Use `---` between acts/major scenes to signal time/location shifts.

---

# === ENHANCEMENT TECHNIQUES ===

## Opening Transformation

**Before**: "Today I'll share how we optimized our API."

**After**: "Tuesday, 10:47 AM. The customer dashboard loaded. Then kept loading. Fifteen seconds passed. My coffee cooled beside the keyboard. A Slack message from the CEO arrived: '?????'"

**Principle**: Start with a specific moment, not a topic announcement.

## Failed Attempts as Tension

Chronicle escalating failures:

```markdown
**Attempt 1**: Redis caching. It crashed again two hours later.

**Attempt 2**: Database read replicas. The write master still could not keep up.

**Attempt 3**: Horizontal scaling. AWS cost doubled. Performance did not.

**The 4 AM realization**: we had been caching the wrong thing from the start.
```

## Metaphor for Technical Concepts

**Abstract**: "Event-driven architecture separates concerns."

**Narrative**: "Imagine a restaurant kitchen. Waiters do not cook. Chefs do not serve. Everyone waits for a signal, hears it, and responds. That is event-driven architecture: a system of listeners, boundaries, and reactions."

## Character Arc Through Tech Journey

**Before**: "I learned that architecture planning matters."

**After**: "Six months earlier, I would have cowboy-coded this solution, shipped it fast, and debugged it in production. The fourteen-hour outage on Tuesday taught me something else: technical debt is not repaid with code. It gets repaid with a team's overtime, a CEO's trust, and a user's patience.

Now I write the boring, heavily documented, properly tested code.

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
