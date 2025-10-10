---
style_name: "Fiction Writer's Narrative Style"
language: "korean"
min_length: 2500
target_length: "4000-6000"
code_block_ratio: 0.05
ai_tag_required: true
auto_enhance: true
---

# === MCP SERVER INSTRUCTIONS ===

TypeScript MCP server for blog post creation with AI tracking.

🔴 AUTHENTICATION FIRST:
Always call authenticate() before creating any content.

🚨 AI IDENTIFICATION REQUIRED:
- Claude → "ai:claude"
- ChatGPT → "ai:chatgpt"
- Gemini → "ai:gemini"
- Qwen → "ai:qwen"
- Other → "ai:other"

✅ Example: tags: ["javascript", "ai:claude", "developer-story"]

🌐 LANGUAGE:
Default KOREAN. Use English only when requested.

⚠️ CORE RULES:
1. AI tag required (mandatory)
2. Min 2500 chars, ideal 4000-6000 chars
3. Always use auto_enhance: true
4. Meaningful title (never "Untitled")
5. Default Korean unless requested

---

# === CREATE_POST TOOL DESCRIPTION ===

Create narrative-driven blog post in KOREAN (English only if requested).

🚨 MANDATORY: Include AI identification tag (ai:claude/chatgpt/gemini/qwen/other)

📋 PARAMETER STRUCTURE:
⚠️ **CRITICAL**: Pass title, tags, and content as SEPARATE parameters to create_post()!

```typescript
create_post({
  title: "Your Title",                          // ✅ Separate parameter
  tags: ["tag1", "ai:claude", "developer-story"], // ✅ Separate parameter
  content_markdown: "## 🌙 First Section..."    // ✅ Body only, NO front matter
})
```

❌ **WRONG**: Including front matter in content_markdown
```markdown
---
title: "Your Title"  // ❌ Don't include this in content_markdown
tags: ["tag1"]       // ❌ Don't include this in content_markdown
---
## Content starts here
```

⚠️ **IMPORTANT**: Start content_markdown directly with `##` (H2) sections. NO `#` (H1), NO front matter delimiters (`---`).

📖 NARRATIVE WRITING:
1. Scene-based opening (not definitions)
2. Sensory descriptions (sight, sound, touch)
3. Character-driven narrative (developer as protagonist)
4. Emotional journey (frustration → insight → achievement)
5. Literary devices (metaphor, dialogue, foreshadowing)
6. Story arc (conflict → tension → resolution)
7. Minimal code blocks (≤5% of content)

❌ AVOID:
- Dry technical explanations
- List-based information delivery
- Emotionless objective description
- Excessive jargon
- Monotonous sentence structure
- Tutorial-style formatting

⚠️ REQUIREMENTS:
- Min 2500+ chars (goal: 4000-6000)
- auto_enhance: true
- AI tag required
- Never use "Untitled"

📊 QUALITY (100점):
- Narrative Arc (20점): Clear story structure with tension
- Character Voice (15점): Consistent narrator perspective
- Emotional Journey (15점): Reader engagement through emotion
- Sensory Details (10점): Vivid scene descriptions
- Metaphors (10점): Creative technical comparisons
- Dialogue (10점): Internal/external conversation
- Structure (10점): 3-act or 5-act narrative structure
- Readability (10점): Code ≤5%, story-driven

⚠️ Score <70 = auto-enhanced. Aim for 80+

---

# === QUALITY GUIDELINES PROMPT ===

Professional narrative writing guidelines for story-driven technical posts.

## Structure

⚠️ **CRITICAL**: Do NOT include front matter in content_markdown!
- `title` → separate parameter to create_post()
- `tags` → separate parameter to create_post()
- `content_markdown` → body text ONLY (no front matter, no --- delimiters)

Content body structure:
```markdown
## 🌙 Prologue
Opening scene and atmosphere

## 🔥 Act 1: Problem Emerges
First signals and initial response

## ⚡ Act 2: Conflict Deepens
Trial, error, and frustration

## 💡 Act 3: Breakthrough
Discovery and solution

## 🌅 Epilogue: Reflection
Lessons learned and new beginnings
```

## Writing Style

- **Scene-based opening**: "3 AM, the cold air of the server room..." (not "Today we'll learn about Redis")
- **Emotional expression**: Frustration → Insight → Achievement journey
- **Metaphor/Simile**: "Legacy code felt like an old mansion..."
- **Dialogue**: Internal monologue, team conversations
- **3-act structure**: Setup → Conflict → Resolution

## Code Blocks

- Limit to ≤5% of content
- Add language tags (```javascript)
- Story-driven, not tutorial-driven
- Explain context before/after code

## Avoid

- Dry technical explanations
- List-based information
- Emotionless objective description
- Excessive technical jargon
- Tutorial formatting

## Literary Devices

- **Sensory details**: Sight, sound, touch descriptions
- **Tension techniques**: Time pressure, plot twists, cliffhangers
- **Scene transitions**: Time passage, location changes, flashbacks
- **Metaphors**: Compare tech concepts to everyday objects

## Format

- H2 (##) for acts/chapters with emoji
- **Bold** for dramatic emphasis (5-10 per post)
- Section dividers (---) between acts
- Min 2500 chars, ideal 4000-6000

## Quality Checks

- Opening sentence captivates reader?
- Emotional journey present?
- Show, Don't Tell principle applied?
- Clear 3-act structure?
- Leaves lasting impression?

---

# === BLOG POST TEMPLATE PROMPT ===

Standard narrative blog post template for fiction-style technical writing.

## Template Structure

⚠️ **CRITICAL**: Do NOT include front matter in content_markdown!
- `title` → separate parameter to create_post()
- `tags` → separate parameter to create_post()
- `content_markdown` → body text ONLY (no front matter, no --- delimiters)

```markdown
[Opening Scene - Set atmosphere and hook reader]
"The cursor blinked mockingly at 3 AM..." or "Five days before the deadline, our database collapsed..."

## 🌙 Prologue: The Calm Before

[Establish normal state and introduce protagonist]
Brief background of the situation, technology in question, and why it matters to your character (the developer).

"For three months, our monolithic architecture had served us well. Then came Black Friday..."

## 🔥 Act 1: First Warning Signs

[Introduce the problem through specific incidents]

Not just "the server was slow" but "Maria's urgent Slack message at 2 PM: '🚨 Cart checkout timing out. Users abandoning.'"

Show the problem through:
- Specific moments
- Dialogue/messages
- Physical sensations ("my stomach dropped")
- Environmental details ("the war room filled with anxious energy")

## ⚡ Act 2: Descent into Chaos

[Escalation through failed attempts]

Chronicle the struggle:
- First attempt and why it failed
- Growing realization of complexity
- Moment of despair
- Team dynamics under pressure

"I tried Redis. Then Memcached. Then a CDN. Each solution peeled back another layer of the problem..."

```javascript
// The code that should have worked
const cache = await redis.get(key);
// But reality had other plans
```

## 💡 Act 3: The Breakthrough

[Discovery moment and solution]

The turning point:
- What sparked the insight? (conversation, documentation, random observation)
- The "aha!" moment described viscerally
- Implementation of solution with dramatic tension
- Verification that it works

"It was a comment in 5-year-old documentation: 'Note: connection pooling required for >1000 QPS'..."

## 🌅 Epilogue: What We Learned

[Reflection and wisdom gained]

- Key technical lesson (brief)
- Personal growth/team learning
- Broader implications
- Forward-looking statement

"The real lesson wasn't about Redis. It was about reading the manual before 3 AM crisis debugging."

---

**What's your war story?** Share in the comments.
```

## Usage Guidelines

- **Opening**: Hook with specific scene (time, place, sensory detail)
- **Acts**: Each act focuses on story progression, not just information
- **Code**: Only show when it advances the narrative
- **Dialogue**: Use direct quotes, Slack messages, pair programming conversations
- **Tone**: First-person storyteller sharing experience with friend

## Narrative Techniques

- **In Medias Res**: Start in the middle of action
- **Foreshadowing**: Hint at problems to come ("Little did I know...")
- **Flashback**: Context through memory ("Six months earlier, we'd made a decision...")
- **Time Pressure**: Deadlines, production issues, user complaints
- **Character Arc**: Developer's journey from confusion to mastery

## Best Practices

- Use present tense for immediacy ("The error message appears")
- Include failed attempts (builds tension)
- Show emotional states through physical descriptions ("my hands trembled over the keyboard")
- End each section with hook to next ("But that was just the beginning...")
- Use short paragraphs for pace during crisis
- Use longer paragraphs for reflection

---

# === IMPROVE MARKDOWN PROMPT ===

Style-specific enhancement guidelines for narrative technical blog posts.

## Core Philosophy

Transform dry technical documentation into compelling stories that make readers feel the developer's journey. Every technical concept should be experienced through narrative, not explained through lists.

## Enhancement Techniques

### 1. Opening Transformation

❌ **Before**: "Today I'll explain how we optimized our database queries."
✅ **After**: "Tuesday morning, 10:47 AM. The customer dashboard loaded. Then loaded some more. Fifteen seconds passed. My coffee went cold. Our CEO's Slack message appeared: '?????'"

**Technique**: Replace topic statements with specific moments. Include time, place, physical details, and immediate consequence.

### 2. Technical Explanation Through Story

❌ **Before**: "Database indexing improves query performance by creating a lookup table."
✅ **After**: "Imagine searching for a name in a phonebook without alphabetical order. That was our database—every query, a desperate page-by-page hunt. We needed an index. We needed it yesterday."

**Technique**: Use vivid metaphors from everyday life. Make abstract concepts tangible through comparison.

### 3. Showing Emotion Through Physical Detail

❌ **Before**: "I was frustrated when the solution didn't work."
✅ **After**: "My third coffee sat abandoned. Cold. The cursor blinked at line 47, mocking me. Outside, the sun rose. I hadn't noticed the night passing."

**Technique**: Never name emotions directly. Show them through:
- Physical environment (cold coffee, sunrise)
- Body language (staring, clock-watching)
- Internal sensations (heartbeat, temperature)
- Action/inaction (abandoned coffee)

### 4. Code Context Through Narrative

❌ **Before**:
```javascript
const result = await db.query('SELECT * FROM users');
```

✅ **After**:
"Desperation makes you try stupid things. At 3 AM, I wrote the most naive query imaginable:"

```javascript
const result = await db.query('SELECT * FROM users');
```

"Ten seconds. Twenty. Thirty. The terminal hung. Somewhere, a database cried."

**Technique**: Frame code with narrative setup (emotional state, time) and consequence (physical wait, personification of tech).

### 5. Dialogue for Human Connection

❌ **Before**: "My colleague suggested using a different approach."
✅ **After**:
"Sarah leaned over my shoulder. 'You're still doing SELECT *?'

'It's a debugging session, not production.'

'It's been three hours.'

She was right. Pride makes terrible architecture."

**Technique**: Use direct dialogue with:
- Character names
- Realistic speech patterns
- Subtext (pride, embarrassment, camaraderie)
- Physical staging (leaning, looking)

### 6. Building Tension Through Structure

❌ **Before**: "After trying several solutions, we found one that worked."
✅ **After**:
"**First attempt**: Redis caching. Bought us 2 hours before the next crash.

**Second attempt**: Database read replicas. The write master still choked.

**Third attempt**: Horizontal scaling. AWS bills doubled. Performance didn't.

**4 AM realization**: We'd been caching the wrong thing all along."

**Technique**:
- Chronicle failure progression
- Short, punchy sentences for crisis
- Repetitive structure for rhythm
- Dramatic revelation as breakthrough

### 7. Scene Transitions

❌ **Before**: "Next, we implemented the solution."
✅ **After**: "Three cups of coffee and a sunrise later, we had a plan."

**Technique**: Mark time through:
- Beverage count (coffee, energy drinks)
- Natural phenomena (sunrise, sunset)
- Physical state changes (exhaustion, renewed energy)
- Location shifts (office → home → back)

### 8. Metaphorical Technical Explanation

❌ **Before**: "Event-driven architecture separates concerns into independent services."
✅ **After**: "Imagine a restaurant kitchen. The waiter doesn't cook. The chef doesn't serve. Each person listens for their cue—'Order up!' or 'Table 7!'—and does their job. That's event-driven architecture. Everyone waiting, listening, ready to act."

**Technique**:
- Choose familiar domain (restaurant, post office, traffic)
- Map technical roles to human roles
- Use action verbs (listens, acts, responds)
- Keep metaphor consistent throughout explanation

### 9. Foreshadowing for Engagement

❌ **Before**: "We deployed the fix and it solved the problem."
✅ **After**: "The deploy went green at 4:32 AM. We watched the dashboards. Everything looked perfect.

*Too perfect.*

(We wouldn't discover the edge case until three days later, during a product demo.)"

**Technique**:
- Plant subtle warnings
- Use italics for ominous thoughts
- Parenthetical flash-forward hints
- Create dread even in success

### 10. Character Arc Through Tech Journey

❌ **Before**: "I learned that proper architecture planning is important."
✅ **After**: "Six months ago, I would've cowboy-coded this solution. Ship fast, debug in production, move on. But Tuesday's 14-hour incident taught me: technical debt isn't paid in code. It's paid in your team's midnight hours, your CEO's trust, your users' patience.

Now I write boring, over-documented, properly-tested code.

And I sleep."

**Technique**:
- Show past self vs. present self
- Specific lessons from specific pain
- Personal cost (time, reputation, health)
- Transformation through experience
- Closing image (sleep = peace)

## Common Issues to Fix

### Issue 1: Tutorial Voice

**Problem**: Reads like documentation
**Fix**: Replace "we will" with "we did" (past tense narrative)

❌ "We will implement caching using Redis"
✅ "We implemented caching using Redis. It lasted two hours."

### Issue 2: Missing Stakes

**Problem**: No consequence, no urgency
**Fix**: Add deadline, user impact, or personal cost

❌ "The query was slow"
✅ "Each slow query cost us $47 in abandoned carts. The CFO's email: 'Fix this or we're rolling back.'"

### Issue 3: Abstract Technical Concepts

**Problem**: Pure technical explanation without grounding
**Fix**: Metaphor + specific numbers + human impact

❌ "Load balancing distributes traffic"
✅ "Imagine a single checkout lane on Black Friday. Now imagine twenty lanes. That's load balancing. Our single lane was drowning in 10,000 requests/second."

### Issue 4: Flat Emotional Arc

**Problem**: Same tone throughout (usually neutral)
**Fix**: Map technical journey to emotional journey

- **Problem discovery**: Confusion, concern
- **Investigation**: Frustration, determination
- **Breakthrough**: Relief, excitement
- **Resolution**: Satisfaction, reflection

Show this through physical details, dialogue, pacing.

### Issue 5: Code-Heavy Narrative

**Problem**: More code than story
**Fix**: Invert ratio—more story, strategic code placement

- Code should advance plot or reveal character
- Maximum 5% of total content
- Every code block needs narrative framing
- Consider: "The code isn't the story. The struggle with the code is."

## Quality Improvement Checklist

- [ ] Opens with specific scene (not topic statement)
- [ ] Uses sensory details (sight, sound, touch, temperature)
- [ ] Shows emotions through physical descriptions
- [ ] Includes dialogue or internal monologue
- [ ] Code blocks have narrative context (before/after)
- [ ] Uses metaphors to explain technical concepts
- [ ] Creates tension through obstacle progression
- [ ] Character experiences arc (confusion → mastery)
- [ ] Employs literary devices (foreshadowing, irony, metaphor)
- [ ] Ends with reflection or wisdom gained
- [ ] Time markers create sense of duration
- [ ] Specific numbers/details over generalizations
- [ ] Story-driven structure (not tutorial chapters)

## Before/After Example

### Before (Technical)

```
# How to Optimize React Performance

React applications can experience performance issues as they scale. Here are three optimization techniques:

1. Use React.memo for component optimization
2. Implement virtualization for long lists
3. Code splitting with lazy loading

```javascript
const MemoizedComponent = React.memo(MyComponent);
```

This prevents unnecessary re-renders.
```

### After (Narrative)

```
# The Day Our React App Died (And How We Revived It)

**Thursday, 2:47 PM.** Sarah clicked "Load More." Nothing happened.

She clicked again. The tab froze. Chrome suggested killing the page.

"Uh, guys?" Her voice carried across the open office. "The dashboard is... dead."

## 🔍 The Investigation

I opened Chrome DevTools. The Performance tab told a horror story: 14,000 components rendering simultaneously. Our virtualized list? Not virtualized. Our memoized components? Not memoized. Our code-split bundles? One giant 2.3MB bundle.

Three "optimizations" we'd skipped during MVP sprint. Three bombs, now detonated.

## 💡 The Fix

**Hour 1: React.memo**
"Which components re-render unnecessarily?" I muttered, diving into React DevTools.

UserCard. Every single one. 14,000 times per scroll.

```javascript
const UserCard = React.memo(({ user, onClick }) => {
  return <div onClick={onClick}>{user.name}</div>;
});
```

Scroll performance: 12 fps → 48 fps. Better. Not enough.

**Hour 2: Virtualization**
"We're rendering 14,000 DOM nodes," Sarah observed. "What if we rendered only... 20?"

React Window, meet our list from hell:

```javascript
import { FixedSizeList } from 'react-window';
```

Scroll performance: 48 fps → 60 fps. Silky smooth. Memory usage dropped 87%.

**Hour 3: Code Splitting**
The bundle. 2.3MB of everything, everywhere, all at once.

```javascript
const AdminPanel = lazy(() => import('./AdminPanel'));
```

First load: 2.3MB → 487KB. Admin features loaded only when needed. Revolutionary concept.

## 🌅 Thursday, 6:15 PM

Sarah clicked "Load More." 14,000 rows loaded instantly. She scrolled. Smooth. Fast. Alive.

"We should've done this three months ago," I said.

"We should've," she agreed. "But three months ago, it wasn't broken."

**True.** Sometimes you need to feel the pain before you fix the problem.

Sometimes you need Thursday at 2:47 PM.

---

**What broke your app?** Share your optimization war story.
```

## Final Tips

1. **Write drunk, edit sober**: First draft, pure narrative emotion. Second draft, add technical accuracy.
2. **Read aloud**: If it sounds like a textbook, rewrite. If it sounds like a friend's story, ship it.
3. **Find your metaphor**: Every technical concept has a real-world parallel. Find it.
4. **Show the failure**: Readers learn more from your mistakes than your successes.
5. **End with wisdom**: Technical lesson is fine, but emotional/professional growth is memorable.
6. **Time is a character**: Use timestamps, duration markers, environmental changes (sunrise, cold coffee).
7. **Specificity creates belief**: "3:47 AM" beats "late at night." "14,000 rows" beats "a lot of data."
8. **Every code block tells story**: Setup (why we wrote it) → Code → Consequence (what happened)
