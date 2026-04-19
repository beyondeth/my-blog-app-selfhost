---
style_name: "Professional Technical Blog"
language: "english"
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
**Keywords**: "explanation", "understanding", "how it works", "comparison", "approach", "architecture"
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
## Introduction
Present the problem or concept. Why does this matter?

## Background
Provide necessary context for understanding.

### Key Concepts
Define essential terms.

## Main Content
Technical explanation with appropriate depth.

### Concept 1
First major point with examples.

### Concept 2
Second major point building on previous.

## Practical Example
Working code or real-world application.

## Key Takeaways
Summarize main points concisely.

## Next Steps
Guide readers on what to explore next.
```

## Tone and Voice

**Good examples**:
- "MCP is built around three core actors that each own a clear responsibility."
- "Each session carries its own resource budget, which makes planning and control easier."
- "This approach keeps the explanation readable without sacrificing the depth advanced readers need."

**Avoid**:
- Overly casual tone ("This is insanely awesome!", "Absolutely game-changing!")
- Dry academic language (excessive jargon without explanation)
- Command-heavy phrasing ("Use this now", "Just apply it")

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

**Before**: "Today we are going to learn about React hooks."

**After**: "React hooks fundamentally changed how state is managed in function components. They remove much of the boilerplate of class components while still giving you precise control over component lifecycle behavior."

**Principle**: State value and impact, not just topic announcement.

## Adding Technical Context

**Before**: "Use the map function to transform an array."

**After**: "`map()` applies a transform function to each element and returns a new array. The original array is left untouched, which aligns with the immutability principles of functional programming."

**Principle**: Explain both mechanics and reasoning.

## Code Integration Pattern

**Before**:
```javascript
const result = data.map(x => x * 2);
```

**After**:
"Use `map()` to transform each element in a clean, immutable way:"

```javascript
const result = data.map(x => x * 2);
```

"This approach creates a new array without mutating the original, which is one of the core principles of functional programming."

**Principle**: Context before, significance after.

## Strengthening Transitions

Use clear connectors between sections:
- "From that foundation..."
- "More importantly..."
- "In practice, this means..."
- "The key distinction here is..."

## Final Quality Checklist

Before publishing, verify:
- [ ] Clear problem statement in introduction
- [ ] Technical terms defined on first use
- [ ] Code blocks have context and explanation
- [ ] Consistent professional English throughout
- [ ] 3-5 key terms emphasized with **bold**
- [ ] Logical flow from simple to complex
- [ ] Actionable takeaways in conclusion
- [ ] 2000+ characters minimum met
- [ ] Code ratio ~20% of total content
- [ ] **Category selected** (REQUIRED: exactly 1 category that describes the post content)
- [ ] AI identification tag included
