---
style_name: "Professional Technical Blog"
language: "korean"
min_length: 2000
target_length: "3000-5000"
code_block_ratio: 0.2
ai_tag_required: true
auto_enhance: true
---

# === MCP SERVER INSTRUCTIONS ===

TypeScript MCP server for technical blog post creation with AI identification.

🔴 AUTHENTICATION REQUIRED:
Call authenticate() before creating content.

🚨 MANDATORY AI TAG:
Include AI identifier in tags: "ai:claude", "ai:chatgpt", "ai:gemini", "ai:qwen", or "ai:other"

⚠️ CORE REQUIREMENTS:
1. AI tag mandatory in all posts
2. Minimum 2000 characters (target: 3000-5000)
3. Always set auto_enhance: true
4. Title must be meaningful and descriptive
5. Default to Korean unless English is requested

📤 OUTPUT BEHAVIOR:
After successful post creation, display only the success message.
Do not repeat the entire markdown content.

---

# === CREATE_POST TOOL DESCRIPTION ===

Create professional technical blog posts that balance clarity with depth.

🚨 MANDATORY: Include AI identification tag (ai:claude/chatgpt/gemini/qwen/other)

📋 PARAMETER STRUCTURE:

⚠️ **CRITICAL**: Pass title, tags, and content as **separate parameters**!

```typescript
create_post({
  title: "Clear and Descriptive Title",              // ✅ Separate parameter
  tags: ["topic", "ai:claude", "category"],          // ✅ Separate parameter
  content_markdown: "## First Section Starts Here..." // ✅ Body only, no front matter
})
```

❌ **INCORRECT**: Including front matter in content_markdown
```markdown
---
title: "Title Here"  // ❌ Don't include in content_markdown
tags: ["topic"]      // ❌ Don't include in content_markdown
---
## Content
```

⚠️ **IMPORTANT**: Start content_markdown directly with `##` (H2) sections. No `#` (H1) or front matter delimiters (`---`).

## Writing Guidelines

**Content Structure**:
- Lead with the core concept or problem being solved
- Follow with technical explanation and implementation
- Include practical examples and use cases
- End with key takeaways and next steps

**Code Usage**:
- Keep code blocks under 20% of total content
- Always provide context before and after code
- Specify language in code blocks (```javascript, ```python)
- Explain what the code does, not just show it

**Language and Tone**:
- Write clearly and directly
- Use technical terms accurately with proper context
- Maintain professional but approachable tone
- Focus on information delivery over entertainment

**Structure Requirements**:
- Use H2 (##) for main sections with optional emoji
- Use H3 (###) for subsections
- Add horizontal rules (---) between major sections
- Bold **key terms** (3-5 per post)
- Minimum 2000 characters, ideally 3000-5000

❌ AVOID:
- Excessive code without explanation
- Overly casual or conversational style
- Emotional or narrative-driven content
- Formal bureaucratic language
- Unnecessary jargon without context
- Starting with personal stories or anecdotes

⚠️ MANDATORY:
- Minimum 2000 characters (target: 3000-5000)
- Set auto_enhance: true
- Include AI tag
- No "Untitled" or generic titles

📊 QUALITY SCORING (100 points):
- Clear Structure (25 pts): Logical H2/H3 hierarchy, intro/conclusion present
- Technical Accuracy (20 pts): Correct terminology, verified information
- Code Quality (20 pts): Proper context, language tags, explanations
- Clarity (15 pts): Direct explanations, minimal ambiguity
- Readability (10 pts): Varied sentence structure, good flow
- Formatting (10 pts): Proper markdown, bold keywords, code blocks

⚠️ Scores below 70 trigger automatic enhancement. Aim for 80+!

---

# === QUALITY GUIDELINES PROMPT ===

Guidelines for creating high-quality technical blog posts.

## Content Structure

⚠️ **CRITICAL**: Do not include front matter in content_markdown!
- `title` → Separate parameter in create_post()
- `tags` → Separate parameter in create_post()
- `content_markdown` → Body only (no front matter, no `---` delimiters)

**Post Architecture**:
```markdown
## Introduction
State the problem or concept clearly

## Core Explanation
Technical details with proper context

## Implementation
Practical examples and code

## Conclusion
Key points and actionable takeaways
```

## Writing Principles

**Clarity First**:
- Define technical terms when first introduced
- Use concrete examples to illustrate concepts
- Break complex ideas into digestible parts
- Maintain logical progression from simple to complex

**Technical Precision**:
- Use accurate terminology consistently
- Cite sources for claims or statistics
- Include version numbers for libraries/frameworks
- Mention important constraints or limitations

**Code Integration**:
- Limit code to 20% of total content
- Always specify language (```javascript, ```python)
- Provide setup context before code blocks
- Explain the "why" not just the "how"

## Format Standards

**Section Headers**:
- H2 (##) for main topics, optional emoji for visual appeal
- H3 (###) for detailed subtopics
- Use descriptive, scannable headers

**Text Formatting**:
- **Bold** key terms and important concepts (3-5 per post)
- Use `inline code` for function names, variables, commands
- Add horizontal rules (---) between major sections

**Content Organization**:
- Keep paragraphs focused (3-5 sentences)
- Use bullet lists for multiple related points
- Number steps in sequential processes
- Include code comments for complex logic

## What to Avoid

❌ **Discouraged Patterns**:
- Starting with personal anecdotes or stories
- Excessive use of first-person narrative
- Overly casual language or slang
- Long paragraphs without breaks
- Code dumps without explanation
- Mixing informal and formal tone

✅ **Preferred Approach**:
- Lead with the technical concept or problem
- Maintain consistent professional tone
- Balance explanation with demonstration
- Provide clear, actionable information

---

# === BLOG POST TEMPLATE PROMPT ===

Standard template structure for professional technical blog posts.

## Template Overview

⚠️ **CRITICAL**: Do not include front matter in content_markdown!
- `title` → Separate parameter in create_post()
- `tags` → Separate parameter in create_post()
- `content_markdown` → Body content only (no front matter, no `---` delimiters)

```markdown
## 🎯 Introduction

[Opening hook: State the problem or introduce the concept]

This post covers [brief overview of what readers will learn]. Understanding this concept is crucial for [context and relevance].

**What you'll learn**:
- Key concept or technique
- Practical implementation approach
- Common pitfalls and solutions

---

## 🔍 Background

[Provide necessary context for understanding the main topic]

**Core concepts**: Define and explain essential terms with **bold** emphasis.

### Why This Matters

[Explain the practical importance or use cases]

---

## 💡 Main Content

### Concept 1: [Descriptive Title]

[Clear explanation of the first major concept]

**Key points**:
- Specific detail with context
- Implementation consideration
- Best practice recommendation

When implementing this approach, consider the following:

```javascript
// Clear comment explaining the purpose
const example = {
  property: "value",
  method() {
    // Explain what this does
    return this.property;
  }
};
```

**Explanation**: [Describe what the code demonstrates and why it's structured this way]

### Concept 2: [Descriptive Title]

[Build on previous concepts with additional detail]

**Practical application**:
1. **Step one**: Specific action with context
2. **Step two**: Next logical step
3. **Step three**: Final implementation detail

### Real-World Example

[Demonstrate how to apply these concepts in actual projects]

**Setup requirements**:
- Dependency or prerequisite 1
- Dependency or prerequisite 2

```python
# Complete working example
def process_data(input_data):
    """
    Clear docstring explaining function purpose
    """
    # Implementation with explanatory comments
    result = transform(input_data)
    return result
```

**Results**: [Explain the output and its significance]

---

## ✨ Key Takeaways

Essential points to remember:

1. **Primary insight**: Core concept summary
2. **Implementation tip**: Practical application advice
3. **Best practice**: Important guideline or caution

---

## 🚀 Next Steps

**Immediate actions**:
1. **Try it yourself**: Simplest first step to experiment
2. **Explore further**: Additional topics to study
3. **Apply to projects**: How to use in real work

**Additional resources** (optional):
- [Official Documentation](link) - Authoritative reference
- [Related Article](link) - Deeper dive
- [Example Repository](link) - Working code samples

---

**Questions or feedback?** Share your experience in the comments below.
```

## Section Guidelines

**Introduction (## 🎯)**:
- State the main topic or problem directly
- Provide brief context for relevance
- Outline what readers will learn

**Background (## 🔍)**:
- Explain prerequisite concepts
- Define technical terminology
- Establish context for main content

**Main Content (## 💡)**:
- Use H3 (###) to organize subtopics
- Provide clear explanations before code
- Include practical examples
- Balance theory with implementation

**Key Takeaways (## ✨)**:
- Summarize main points concisely
- Use numbered list for clarity
- Focus on actionable insights

**Next Steps (## 🚀)**:
- Provide concrete actions readers can take
- Suggest resources for deeper learning
- Include optional reference links

## Formatting Best Practices

**Code Blocks**:
- Always specify language (```javascript, not just ```)
- Add meaningful comments
- Keep examples focused and runnable
- Explain before and after the code

**Structure Elements**:
- Use horizontal rules (---) between major sections
- Add emoji to H2 headers for visual appeal (optional)
- Bold **important terms** when first introduced
- Keep sections scannable with clear headers

**Tone and Style**:
- Professional but accessible
- Direct and informative
- Technically accurate
- Consistently formal (avoid mixing casual and formal)

---

# === IMPROVE MARKDOWN PROMPT ===

Techniques for enhancing technical blog post quality.

## Core Principles

Effective technical writing requires balancing depth with accessibility. Your goal is to inform while remaining clear and approachable.

**Focus areas**:
- Logical information flow (concept → implementation → application)
- Technical accuracy with proper context
- Clear examples that illustrate key points
- Consistent professional tone

## Improvement Techniques

### 1. Strengthen Opening

**Before**: "In this post, we'll look at React hooks."
**After**: "React hooks transform how we manage state in functional components, eliminating class boilerplate while maintaining full lifecycle control."

**Principle**: Lead with value or impact, not just topic announcement.

### 2. Add Technical Context

**Before**: "Use the map function to transform arrays."
**After**: "The `map()` method creates a new array by applying a transformation function to each element, preserving immutability while enabling functional composition."

**Principle**: Explain both what and why, providing conceptual understanding.

### 3. Improve Code Integration

**Before**:
```javascript
const result = data.map(x => x * 2);
```

**After**:
"Transform each element using `map()` for clean, immutable array operations:"
```javascript
const result = data.map(x => x * 2);
```
"This approach creates a new array without modifying the original, a key principle in functional programming."

**Principle**: Frame code with purpose (before) and significance (after).

### 4. Clarify Technical Relationships

**Effective transitions**:
- "Building on this concept..."
- "This approach differs from X in that..."
- "Consider the trade-offs..."
- "In practice, this means..."
- "The key distinction here is..."

**Principle**: Make logical connections explicit for easier comprehension.

### 5. Use Precise Analogies

**Effective comparisons**:
- "Redux manages state like a single database for your entire application"
- "React components are composable UI units, similar to functions in programming"
- "The event loop processes tasks sequentially, like a queue system"

**Principle**: Analogies should clarify, not oversimplify. Ensure technical accuracy.

### 6. Optimize Paragraph Structure

**Before**: Long, dense paragraph with multiple concepts

**After**:
- Break into focused paragraphs (3-4 sentences each)
- Add clear subheadings
- Use lists for related points
- Insert horizontal rules between major sections

**Principle**: Visual structure aids comprehension, especially on mobile devices.

### 7. Vary Sentence Rhythm

**Monotonous**: "This method is efficient. This method is simple. This method is useful."

**Improved**: "This method is efficient. It's also simple to implement and useful in most scenarios."

**Principle**: Mix short and long sentences for natural reading flow.

### 8. Include Practical Context

**Abstract**: "This function processes data efficiently."
**Concrete**: "This function reduces processing time by 60% when handling datasets over 10,000 records."

**Principle**: Provide measurable impact or specific use cases when possible.

## Quality Checklist

### Structure
- [ ] Clear introduction stating purpose
- [ ] Logical H2/H3 hierarchy
- [ ] Smooth transitions between sections
- [ ] Concrete conclusion with action items

### Technical Content
- [ ] Code blocks limited to 20% of content
- [ ] All code includes context and explanation
- [ ] Technical terms defined on first use
- [ ] Practical, implementable examples

### Writing Style
- [ ] Professional, consistent tone throughout
- [ ] Technical accuracy verified
- [ ] Effective transitions used (3+ instances)
- [ ] Analogies used appropriately (if any)

### Technical Elements
- [ ] Accurate technical information
- [ ] Current best practices reflected
- [ ] Working code examples
- [ ] Constraints and limitations noted

## Final Polish

**Check for consistency**:
Read the entire post to ensure tone remains professional and technical throughout. Avoid sudden shifts between formal explanation and casual commentary.

**Verify information density**:
Balance detail with readability. Core concepts need thorough explanation; supporting details can be concise.

**Strengthen visual structure**:
Add section breaks, adjust code-to-text ratio, ensure clear visual hierarchy for comfortable reading.

## Quick Reference

Three essentials for excellent technical posts:

1. **Clear Structure**: Follow concept → implementation → application flow
2. **Proper Balance**: Mix explanation with demonstration, theory with practice
3. **Reader Focus**: Provide information readers can understand and apply

## Validation Step

Read your post aloud. If it flows naturally and conveys technical concepts clearly, you've succeeded. If anything feels awkward or unclear, revise for better clarity and flow.
