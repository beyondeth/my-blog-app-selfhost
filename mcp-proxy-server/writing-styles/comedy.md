---
style_name: "Tech Comedy Blog Style"
language: "korean"
min_length: 2000
target_length: "3000-4500"
code_block_ratio: 0.15
ai_tag_required: true
auto_enhance: true
validation_token: "mcp-style-comedy-v1-3e7b5a2f"
validation_challenges:
  - question: "comedy 스타일의 최소 글자 수는?"
    answer: "2000"
  - question: "comedy 스타일에서 사용하는 주요 요소는?"
    answer: "humor"
  - question: "comedy 스타일의 목표 글자 수 범위는?"
    answer: "3000-4500"
---

# === STYLE OVERVIEW ===

## When to Use Comedy Style

Use this style to share technical content through humor, self-deprecation, and relatable developer disasters.

### Perfect For
- Coding mistakes and "learning experiences"
- Bug hunting adventures that went hilariously wrong
- Tech industry observations and absurdities
- Relatable developer struggles
- Lighthearted takes on serious tech topics

### Recommended Signals
**Keywords**: "실수", "대참사", "웃긴", "재앙", "삽질", "멘붕"
**Intent**: Entertain while educating, make readers feel less alone in their mistakes

### When Another Style Fits Better
- **Professional, serious topic** → Use `default` style
- **Emotional journey focus** → Use `novel` style
- **Hands-on guide needed** → Use `tutorial` style
- **Code-heavy content (>20%)** → Use `default` or `tutorial` style

---

# === CORE COMEDY PRINCIPLES ===

## 1. Self-Deprecation, Not Punching Down

Mock yourself and your past mistakes, never mock juniors, users, or others' struggles.

**Good**: "I'm basically a professional Googler with a CS degree."
**Bad**: "Junior devs these days can't even write a for loop." ❌

**Technique**: Share your own disasters. Readers laugh WITH you at shared experiences, not AT others.

## 2. Exaggeration for Effect

Amplify mundane frustrations to absurd levels for comic impact.

**Mundane**: "The build was slow."

**Exaggerated**: "I clicked 'build'. The fan started spinning. Somewhere, a glacier began melting. I aged three years. My coffee went cold, then evaporated. The heat death of the universe felt imminent. Build: complete."

**Pattern**: Normal event → escalating observations → absurd conclusion → actual result

## 3. Relatable Disasters

Comedy comes from recognition. Reference universal developer experiences.

**Universal experiences**:
- "Works on my machine" ¯\\\_(ツ)\_/¯
- Deploying on Friday at 5 PM
- `// TODO: Fix this later` (from 2019)
- Stack Overflow copy-paste without understanding
- `git push --force` followed by instant regret

## 4. Setup → Punchline Structure

Build expectation, then subvert it.

**Example**:
"After 6 hours of debugging, I finally found the issue.

A typo.

In the config file.

That I wrote.

Five minutes ago.

I'm a professional."

**Technique**: Short lines, strategic pauses, escalating reveal, self-aware conclusion

---

# === WRITING GUIDELINES ===

## Comedy Structure Template

```markdown
## Opening: The Confession
"I need to confess something. Last Tuesday, I committed a crime..."

## Act 1: False Confidence
"It started so well. (Narrator: It did not start well.)"

## Act 2: Everything Burns
"Phase 1: Hmm, weird.
Phase 2: Okay, definitely weird.
Phase 3: OH NO."

## Act 3: The "Solution"
**Option A**: Fix it properly (Effort: High, Pride: Intact)
**Option B**: `git revert HEAD` (Effort: Low, Pride: Destroyed)

I chose Option B.

## Epilogue: What I "Learned"
"Technical lesson: Actually read the docs.
Life lesson: Hubris is my downfall.
Career lesson: Never deploy before coffee."
```

## Comedic Voice and Tone

**Korean comedy writing**:
- Use informal but friendly 존댓말: "~했습니다" (not "~했다" or "~해")
- Self-deprecating asides: "(저는 전문가입니다)" = "(I'm a professional)"
- Narrator device: "내레이터: 그렇지 않았습니다" = "Narrator: It was not fine"

**Timing techniques**:
- Short paragraphs for punchlines
- Strategic line breaks before reveals
- Parenthetical commentary for comic asides
- Escalating lists (Rule of Three)

## Formatting for Comedy

### Pacing with Line Breaks
```markdown
저는 커피를 마셨습니다.

코드를 작성했습니다.

프로덕션에 배포했습니다.

금요일 오후 5시에.

저는 괴물입니다.
```

### Lists for Escalation
```markdown
**Things I Tried**:
1. Googling ✅ (Found nothing)
2. More Googling ✅✅ (Still nothing)
3. Stack Overflow ✅✅✅ (2012 post, deprecated)
4. Crying ✅✅✅✅ (Surprisingly unhelpful)
5. Turning it off and on again ✅✅✅✅✅ (It worked.)

I'm a professional.
```

### Dialogue for Humor
```markdown
**Manager**: "How's the migration going?"

**Me**: "Great! 90% done!"

*Narrator: It was 12% done.*

**Manager**: "Can we ship tomorrow?"

**Me**: "Definitely! Probably. Maybe. No."

**Manager**: "Which is it?"

**Me**: "Yes."
```

### Code as Punchline
```javascript
// My actual code (I'm not proud)
const cache = new Map();
const cacheCache = new Map();
const cacheCacheCache = new Map(); // Yes, really

// TODO: This is fine (Narrator: It was not fine)
```

---

# === COMEDY TECHNIQUES ===

## Technique 1: The Unreliable Narrator

**Example**:
"Monday morning. Coffee in hand. I was about to make the biggest mistake of Q3.

But I didn't know that yet. Past Me was optimistic.

Past Me was an idiot."

**Usage**: Present confident past-self, immediately undercut with narrator or present-self reality check.

## Technique 2: Callback Jokes

Reference earlier jokes for compounding effect:

**Early**: "My third coffee was already cold."
**Middle**: "Coffee #5 had developed sentience."
**Late**: "Coffee #8 filed a complaint with HR."

**Pattern**: Escalate absurdity with each callback.

## Technique 3: False Dichotomies

```markdown
**Two types of developers**:
1. Those who write tests
2. Liars

**Two debugging modes**:
1. "This will be quick" (Narrator: 6 hours later...)
2. "I know exactly what's wrong" (Narrator: They did not)
```

## Technique 4: Time Progression as Comedy

```markdown
**9:00 AM**: ☕ "I'll fix this in 30 minutes"
**11:00 AM**: ☕☕ "Okay, maybe an hour"
**2:00 PM**: ☕☕☕ "This should be illegal"
**5:00 PM**: ☕☕☕☕ \*quiet sobbing\*
**9:00 PM**: 💀 "I've solved it! (I haven't)"
**Midnight**: 👻 \*cackling at Stack Overflow posts from 2009\*
```

## Technique 5: Subverting Expectations

**Setup**: "After 3 days of debugging, pair programming, rubber ducking, and questioning my career choices..."

**Buildup**: "I finally discovered the root cause."

**Punchline**: "I forgot to restart the server."

**Self-aware tag**: "(I am a professional software engineer with 5 years of experience.)"

---

# === ENHANCEMENT TECHNIQUES ===

## Transforming Boring Openings

**Before**: "오늘은 캐싱에 대해 알아보겠습니다."

**After**: "I need to confess something. Last Tuesday, I committed a war crime. Against performance. Against best practices. Against my production database. I cached literally everything. Including things that shouldn't exist."

**Principle**: Open with confession + specific disaster + escalating absurdity

## Adding Humor to Technical Explanations

**Before**: "Database indexing improves query performance."

**After**: "Not using database indexes is like organizing your files by naming everything 'untitled_final_FINAL_v2_ACTUALLY_FINAL.doc' and then wondering why you can't find anything. It's beautiful, terrible chaos. Your database hates you. Your users hate you. You hate you."

**Pattern**: Relatable absurd comparison + stacking consequences + self-deprecation

## Comedic Code Context

**Before**:
```javascript
const result = await db.query('SELECT * FROM users');
```

**After**:
"In my defense, it was 4 AM and I'd had four Red Bulls. Here's what Past Me wrote:

```javascript
// Past Me was an optimist
const result = await db.query('SELECT * FROM users');
// Past Me was also a fool
```

Present Me wants to have words with Past Me. Specifically: 'WHAT. WERE. YOU. THINKING?!'"

---

# === QUALITY CHECKLIST ===

Before publishing comedy posts, verify:

**Humor Elements**:
- [ ] Opens with confession, absurd situation, or relatable disaster
- [ ] 5+ genuine laugh points throughout
- [ ] Self-deprecating without being depressing
- [ ] Relatable to developer experiences
- [ ] 3+ callbacks or running gags

**Comedy Ethics**:
- [ ] Punching up or at yourself (never down at juniors/others)
- [ ] Relatable struggles (not mean-spirited mocking)
- [ ] Inclusive humor (avoid offensive content)
- [ ] Acknowledges learning from mistakes

**Technical Balance**:
- [ ] Code blocks <15% of content
- [ ] Code includes funny comments where appropriate
- [ ] Code is part of the joke, not just shown
- [ ] Technical lesson present (but delivered humorously)

**Structure**:
- [ ] Setup → punchline rhythm maintained
- [ ] Pacing uses line breaks and short paragraphs
- [ ] Quotable moments exist ("I'm a professional")
- [ ] Ends with self-aware but hopeful reflection

**Avoid**:
- [ ] Mean-spirited humor toward others
- [ ] Offensive jokes or controversial topics
- [ ] Dry technical exposition without humor
- [ ] Explaining why things are funny
