---
style_name: "Tech Podcast Script Style"
language: "korean"
min_length: 5000
target_length: "5000-8000"
code_block_ratio: 0.05
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Podcast Style

Use this style for audio-friendly, conversational content formatted as dialogue between host and guest (or solo host).

### Perfect For
- Technical concepts explained conversationally
- Interview-style explorations of topics
- Q&A format discussions
- Explanations that benefit from back-and-forth dialogue
- Content consumed while multitasking (driving, exercising, commuting)

### Recommended Signals
**Keywords**: "대화", "질문", "설명", "토론", "인터뷰"
**Intent**: Conversational, easy-to-follow explanation without visual dependency

### When Another Style Fits Better
- **Code-heavy implementation** → Use `default` style
- **Visual diagrams essential** → Use `default` style
- **Narrative storytelling** → Use `novel` style

---

# === CORE PODCAST PRINCIPLES ===

## 1. Natural Spoken Language

Write how people actually talk, not how they write.

**Written**: "We will now examine the implementation of concurrent rendering."

**Spoken**: "Alright, so let's talk about concurrent rendering. You know how React used to block the whole page when rendering something big? Yeah, that's over."

**Pattern**: Use contractions, conversational starters ("so", "well", "you know"), natural flow

## 2. Voice Markers for Pacing

Add markers that indicate how text should be "heard."

**Markers**:
- [pause] - before important points
- [laughs] - after jokes or amusing observations
- [emphasis] - on key terms
- [thoughtful tone] - when considering complex ideas
- [excited] - for breakthroughs or important revelations

**Minimum**: 5+ voice markers per post

## 3. Zero Visual Dependency

Everything must make sense when heard, not seen. Replace all visual references with verbal descriptions.

**Avoid**: "As you can see in the diagram..."
**Instead**: "Picture this in your mind: imagine data flowing like a waterfall..."

**Pattern**: "Imagine", "Picture this", "Think of it like" → verbal analogies replace diagrams

## 4. Dialogue as Explanation

Break complex topics into conversational exchanges. Host asks clarifying questions readers would ask.

**Example**:
```markdown
**Host**: So what exactly is a closure?

**Guest**: Great question. Think of it like... a backpack.

**Host**: [laughs] A backpack?

**Guest**: Yeah! A function is like a person, and a closure is the backpack they carry. It holds stuff from where they came from.

**Host**: Okay, so even when the function goes somewhere else...

**Guest**: Exactly! It still has access to those variables. The backpack goes with them.
```

---

# === WRITING GUIDELINES ===

## Podcast Structure Template

```markdown
## [00:00] Cold Open
[Brief hook or intriguing question]
**Host**: "Have you ever wondered why..."

## [00:30] Intro
[Intro music]
**Host**: "Welcome to Tech Talk Podcast! I'm [name]..."

## [02:00] Episode Overview
**Host**: "Today we're covering three things..."

## [05:00] Main Segment 1
**Host**: "Let's start with..."
[Conversational exploration with guest]

## [15:00] Main Segment 2
[Build on previous segment]

## [25:00] Q&A / Lightning Round
[Quick-fire listener questions]

## [28:00] Key Takeaways
**Host**: "Let's recap what you need to remember..."

## [30:00] Outro & Call-to-Action
**Host**: "That's all for today! Subscribe, rate, share..."
```

## Time Markers

Use timestamps for major sections (every 5-10 minutes):
- Creates sense of duration
- Helps listeners navigate
- Signals natural breaks
- Mimics actual podcast structure

**Format**: `## [MM:SS] Section Name`

Example:
```markdown
## [00:00] Cold Open
## [02:30] Introduction
## [05:00] Topic Overview
## [12:00] Deep Dive
## [25:00] Listener Questions
```

## Dialogue Format Standards

**Speaker tags**: Use **Bold** for speaker names

```markdown
**Host**: Welcome back! Today we're diving into React hooks.

**Guest**: Happy to be here!

**Host**: So, hooks. Where do we even start?

**Guest**: [laughs] Good question. Let's go back to 2018...
```

**Voice markers**: Place in [brackets]
```markdown
**Guest**: And then I discovered the bug.

[pause]

It was in the config file.

[emphasis]

That I wrote.

[laughs]

**Host**: [laughs] Oh no!
```

## Verbal Code Explanations

Limit code to <5%. When code is necessary, read it aloud verbally.

**Instead of showing**:
```javascript
const [state, setState] = useState(0);
```

**Say it conversationally**:
```markdown
**Guest**: So in your code, you'd write something like: const - that's declaring a constant - and then square brackets with two things inside.

**Host**: What are those two things?

**Guest**: First one is "state" - that's your actual value. Second is "setState" - that's how you change it.

**Host**: Got it. So I read the state, and I set the state.

**Guest**: Exactly! And all this equals "useState" with your starting value.
```

---

# === CONVERSATION TECHNIQUES ===

## Technique 1: Active Listening Host

Host responds naturally, asks clarifying questions, confirms understanding.

**Pattern**:
```markdown
**Guest**: ...and that's when we implemented Redis.

**Host**: Okay, so basically you're caching the expensive queries?

**Guest**: Exactly!

**Host**: And that solved the performance issue?

**Guest**: Well, mostly. Here's where it gets interesting...
```

**Purpose**: Host represents audience, asks questions they'd ask

## Technique 2: Analogies Over Abstractions

Replace technical jargon with physical metaphors.

**Abstract**: "Middleware intercepts requests."

**Analogy**:
```markdown
**Guest**: Think of middleware like security at a concert.

**Host**: [laughs] Okay, I'm listening.

**Guest**: Fans trying to get in - that's your requests. Inside, the band is playing - that's your server. But before fans reach the band, they go through security.

**Host**: Security checks tickets, searches bags...

**Guest**: Exactly! Middleware does the same - checks authentication, validates data, maybe blocks bad requests entirely.

**Host**: And the band never sees the troublemakers!

**Guest**: Perfect! That's middleware.
```

## Technique 3: Building on Previous Points

Create conversational flow by referencing what was just said.

```markdown
**Guest**: ...so that's why we chose PostgreSQL.

**Host**: Right, and you mentioned earlier it handles JSONB well?

**Guest**: Yes! That ties into...

**Host**: This is starting to make sense. So when you have...
```

**Pattern**: Reference callbacks create coherent dialogue, not disconnected Q&A

## Technique 4: Audience Engagement

Directly address listeners, create participatory feeling.

```markdown
**Host**: How many of you listening have debugged a race condition?

[pause]

Yeah, I see you nodding. It's awful, right?

**Guest**: The worst! So here's what helped me...

**Host**: Listeners, take notes on this part.
```

---

# === ENHANCEMENT TECHNIQUES ===

## Transforming Written to Spoken

**Before**: "Subsequently, we shall examine concurrent rendering."

**After**:
```markdown
**Host**: Alright, next up - concurrent rendering.

**Guest**: Yeah, so here's the thing...

[pause]

You know how React used to freeze when rendering big updates?

**Host**: Oh yeah, the whole "lock up" thing.

**Guest**: Exactly! Concurrent rendering fixes that completely.
```

**Principle**: Informal language, conversational starters, natural interruptions

## Adding Energy Markers

**Before**: "This feature is important."

**After**:
```markdown
**Guest**: Okay, this next part?

[emphasis]

This is what changed everything for me.

**Host**: [intrigued] Really?

**Guest**: [excited] Yes! When I discovered this...

[pause]

It was like someone turned on the lights.

**Host**: [laughs] Now you've got me curious.
```

**Pattern**: Build anticipation with markers, vary vocal energy

## Rapid-Fire Q&A Format

```markdown
## [25:00] Lightning Round

[Upbeat transition]

**Host**: Alright, rapid-fire questions from listeners! Ready?

**Guest**: Let's do it!

**Host**: Question one from @DevMike: "Best way to learn React?"

**Guest**: Build something. Anything. A to-do app counts.

**Host**: Nice! Question two from @CodeNewbie: "Hooks or classes?"

**Guest**: Hooks. Next question.

[laughs]

**Host**: Okay, one more...
```

---

# === QUALITY CHECKLIST ===

Before publishing podcast-style posts, verify:

**Audio-Friendly**:
- [ ] No visual references ("see diagram", "as shown")
- [ ] All concepts explained through analogies/verbally
- [ ] Code blocks <5% and verbalized when present
- [ ] Everything makes sense when read aloud

**Dialogue Quality**:
- [ ] Natural conversational flow (contractions, informal language)
- [ ] 5+ voice markers ([pause], [laughs], [emphasis])
- [ ] Host asks clarifying questions naturally
- [ ] Back-and-forth feels authentic, not scripted

**Structure**:
- [ ] Time markers every 5-10 minutes
- [ ] Clear episode structure (intro → main → Q&A → outro)
- [ ] 3+ direct audience addresses
- [ ] Call-to-action in outro

**Engagement**:
- [ ] Analogies replace abstract concepts
- [ ] Builds on previous points (callbacks)
- [ ] Energy varies (excited, thoughtful, surprised markers)
- [ ] Quotable moments exist

**Required**:
- [ ] **Category selected** (REQUIRED: exactly 1 category that describes the post content)
- [ ] AI identification tag included

**Avoid**:
- [ ] Formal written language ("Subsequently...", "One shall...")
- [ ] Long unbroken monologues (break into dialogue)
- [ ] Visual dependency (diagrams, charts, "see figure X")
- [ ] Silent code dumps
