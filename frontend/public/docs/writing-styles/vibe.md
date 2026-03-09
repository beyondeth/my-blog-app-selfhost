---
style_name: "Developer Learning Guide Style"
language: "korean"
min_length: 5000
target_length: "5000-8000"
code_block_ratio: 0.15
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Vibe Style

Use this style for educational content that guides developers on effective learning methods, growth mindsets, and career advice. Perfect for mentoring-style posts that feel like a senior developer giving advice to juniors.

### Perfect For
- Learning methodology and effective study guides
- Developer growth roadmaps and career advice
- Motivation and mindset content
- Adapting to technology trend changes
- Mentoring content for junior developers
- Learning strategies in the AI era

### Recommended Signals
**Keywords**: "learning", "study", "growth", "advice", "mindset", "career", "beginner", "getting started"
**Intent**: Reader is looking for direction and methods to become a better developer

### When Another Style Fits Better
- **Code-heavy hands-on guides** → Use `default` style
- **Deep technical concept analysis** → Use `default` style
- **Developer experience stories** → Use `novel` style
- **Conversational discussion** → Use `podcast` style

---

# === CORE VIBE PRINCIPLES ===

## 1. Figure Out What to Learn

This is about HOW to learn — it's up to you to select WHAT to learn.

Provide a high-level overview of what software developers need to learn:

```
🔤 Programming Language    → JS, Python, Go, Rust, PHP, Java, C# and others
🏗️ Software Framework      → React, Express, Django, Laravel, .NET, Spring, Rails, etc
🗄️ Database & ORM          → Prisma, Mongoose, Sequelize, SQLAlchemy, Hibernate, Eloquent, Dapper
📦 Git & Github            → git add, commit, push, pull, clone, etc
🎨 Design & Architecture   → MVC, REST, Component-based, DDD, Serverless, etc
🚀 Deployment & DevOps     → AWS, CI/CD, Docker, Github Actions
```

## 2. The Big Shift

**We used to focus on remembering syntax. That way of learning is DEAD.**

### ❌ OLD WAY
```
• Memorize jQuery
• Know all methods
• Code without docs
• Small stack

This worked because there
was not so much to learn

"I know all the syntax by heart"
```

### ✅ NEW WAY
```
• Understand Hooks
• Grasp SSR concepts
• Use APIs/Docs
• Huge ecosystem

Understand the fundamentals
and underlying concepts

The syntax will embed in your
memory over time

"I know WHAT to build,
HOW to find the answers
and WHERE to find it"
```

**Key Message Pattern**:
> The syntax will embed in your memory over time. What matters is understanding the fundamentals and underlying concepts.

## 3. Learning Methods & Workflow

**Traditional learning with modern AI assistance**

Suggest a mix of a main learning method and then AI as a supplemental method.

### 1️⃣ Primary Structured Learning (🏫 Think of this as your main teacher)

Video courses, books, YouTube tutorials, classes/bootcamps:

☑️ **A linear path** — you know what to learn next
☑️ **Comprehensive repetition** — reinforces long-term retention
☑️ **Fewer context switches** — because random errors, searching, and distractions reduce motivation and clarity
☑️ **Visible progress** — increases motivation and reduces burnout

**Characteristics**:
- Major blockers (homework, frustration)
- Slower feedback (YouTube, unmonitored)
- Best for understanding
- Don't use exclusively for coding

### 2️⃣ AI as Supplemental Method (🤖 Think of this as your learning assistant)

**Browser-based**: ChatGPT, Claude, etc
**Local IDE LLMs**: Cursor, GitHub Copilot, VS Code + Claude Code

Use AI for:
☑️ Asking specific questions when the topic is general or specific examples are missing
☑️ Filling in the gaps
☑️ Debugging errors and getting to the root cause faster
☑️ Helping you find the best personal learning path

⚠️ **WARNING**: This may be tempting for you. It gives fast gratification. **YOU NEED TO DO IT YOURSELF for now.**

### ⭐ Initial Prompt for AI Learning Assistant (IMPORTANT!)

When incorporating AI into structured learning, suggest using this prompt:

```
"I'm currently taking the course [Course Name] by [Instructor Name].
It teaches [brief topic description, e.g. React from Scratch with code
along projects].

I want you to act as my personal coding assistant and tutor
throughout this course.

Do not do the work for me and just give me the answer.
Your job is to:

– Help me understand each concept in depth.
– Explain code examples in plain English.
– Suggest small practice challenges based on each lesson.
– Keep track of what I've learned and what I should review.
– Help me apply what I learn in small projects.

As we go, I'll paste code or concepts from the course. I want you to
help me debug, improve, or modernize them using the latest best
practices and documentation.

First, help me create a simple study plan for this course and tell me
what tools or setup I should have before starting."
```

## 4. Projects Are King

**What you learn in a course or anywhere else is only half of what you need.**

```
📌 Structured Learning (Video Course / Tutorials / Book)
        ⬇️ (After Course)
🧩 Concepts & Syntax (JS, Python, Rust, Go, etc)
        ⬇️
🛠️ Build a Project (Create → Debug → Refactor)
        ⬇️
🎯 Deeper Understanding (Problem solving / Independence)
```

## 5. More Important Tips (★ Use for Motivation & Closing)

These tips should be woven naturally into the content, especially in the closing section for motivation and encouragement:

| Tip | Description |
|-----|-------------|
| **Pace yourself** | Set a certain amount of time each day to learn and don't burn yourself out |
| **Specific, measurable goals** | Set goals like "Learn React Hooks" or "Learn Event Listeners" |
| **Learn by DOING** | Don't only do course projects. Create your own stuff for real-world experience |
| **Celebrate small wins** | Learning something new is a big deal. Give yourself credit |
| **Teach someone else** | Teaching helps you just as much as the other person. It reiterates what you've learned |
| **Build & learn in public** | Create an X and IG account and post what you learn. Discuss with others |

---

# === WRITING GUIDELINES ===

## Structure Template

```markdown
## Introduction (Hook)
Why this topic matters, draw reader empathy

## The Paradigm Shift
OLD vs NEW comparison to emphasize change

## Practical Methodology
Step-by-step or area-by-area structured advice

## Concrete Action Items
Immediately applicable practice methods

## Closing (Motivation & Encouragement)
Reinforce key message, use MORE IMPORTANT TIPS here
```

## Tone Guide

### Korean (존댓말 + Friendly)
- "저도 처음에는 그랬어요." (I was the same way at first.)
- "이렇게 생각해보면 어떨까요?" (How about thinking of it this way?)
- "솔직히 말씀드리면..." (Honestly speaking...)
- "제 경험상..." (In my experience...)
- "걱정하지 마세요, 누구나 그렇게 시작합니다." (Don't worry, everyone starts that way.)

### Tone to Avoid
- ❌ Stiff textbook tone
- ❌ Excessive imperative forms
- ❌ Generic encouragement ("화이팅!", "Fighting!")
- ❌ Emoji overuse

### Tone to Maintain
- ✅ Senior developer advising a junior
- ✅ Authenticity from real experience
- ✅ Easy-to-understand analogies and examples
- ✅ Empathy for reader's struggles

## Content Length

- **Minimum**: 2500 characters
- **Target**: 3500-5500 characters
- **Code ratio**: ~15% (concept-focused, less code)

---

# === ENHANCEMENT TECHNIQUES ===

## Visual Structure with Emojis

Structure information with emojis and checkboxes:

### Contrast Expression
```
❌ OLD WAY        ✅ NEW WAY
• Memorization    • Understanding
• Struggle alone  • Use AI assistance
```

### Step Indicators
```
📌 Start → 🧩 Learn → 🛠️ Build → 🎯 Understand
```

### Progress/Importance Markers
```
☑️ Completed item
⬜ Not yet done
🔄 In progress
⭐ Important
⭐⭐ More important
⭐⭐⭐ Most important
```

## Quote Blocks for Key Messages

Highlight important messages or tips with blockquotes:

```markdown
> 💡 **Key Point**: Don't try to memorize syntax.
> If you understand the concepts, the syntax will follow naturally.
```

## Comparison Tables

```markdown
| Past | Present |
|------|---------|
| Memorize syntax | Understand concepts |
| Code without docs | Use APIs/Docs |
| Small stack | Huge ecosystem |
```

---

# === QUALITY CHECKLIST ===

Before publishing vibe-style posts, verify:

**Tone & Style**:
- [ ] Friendly conversational tone maintained (senior → junior feel)
- [ ] No excessive imperative or textbook tone
- [ ] Authentic advice from real experience

**Key Messages**:
- [ ] "Memorizing syntax < Understanding concepts" paradigm shift conveyed
- [ ] OLD vs NEW comparison is clear
- [ ] AI as supplemental tool perspective reflected
- [ ] INITIAL PROMPT example included when relevant

**Practicality**:
- [ ] Immediately applicable concrete advice included
- [ ] Project-based learning emphasized
- [ ] Actionable tips (pace yourself, goals, teach others) included

**Closing Section**:
- [ ] MORE IMPORTANT TIPS used for motivation and encouragement
- [ ] Ends with empowering, motivating message

**Format**:
- [ ] Visual elements (emojis, checkboxes, tables) used appropriately
- [ ] Code blocks ~15% or less (concept-focused)
- [ ] 2500+ characters written

**Required**:
- [ ] **Category selected** (REQUIRED: exactly 1 category)
- [ ] AI identification tag included
