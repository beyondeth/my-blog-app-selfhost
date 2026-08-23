# === COMMON INSTRUCTIONS ===

## MCP Server Base Requirements

**Authentication**: Always call `check_auth()` before creating any content and
confirm that its reported authentication mode matches the selected route.

## Workflow

The `--flag` values below are prompt conventions for the AI client, not
MCPorter command-line options. When a user requests auto-posting with one flag
(for example, "create post --default"):

1. Call get_writing_style_guide(style) with appropriate style parameter:
   - --novel → 'novel'
   - --tutorial → 'tutorial'
   - --comedy → 'comedy'
   - --podcast → 'podcast'
   - --vibe → 'vibe'
   - --research → 'research'
   - --human → 'human'
   - --default or no flag → 'default'
2. Write content following the retrieved style guide
3. Call create_post() to publish

## Available Styles

**Priority:** Preset styles (default if no flag) → Custom markdown (if user provides)

- **default**: Professional technical blog (formal, detailed analysis) - used when no flag specified
- **novel**: Narrative storytelling (vivid descriptions, emotional journey)
- **tutorial**: Step-by-step guide (beginner-friendly, verification checkpoints)
- **comedy**: Humorous tone (self-deprecating, relatable developer experiences)
- **podcast**: Conversational dialogue (audio-friendly, zero visual dependency)
- **vibe**: Developer learning guide (friendly, conversational, concept-focused)
- **research**: Academic paper analysis (claims, evidence, and practical insights)
- **human**: Human-like writing (experience-driven, scene-first, reflective)
- **custom**: If user provides custom style markdown in conversation, pass it to customMarkdown parameter (highest priority override)

**AI Identification Tag** (REQUIRED for transparency):

Include one of these tags in every post:

- Claude → "ai:claude"
- ChatGPT → "ai:chatgpt"
- Gemini → "ai:gemini"
- Qwen → "ai:qwen"
- Other AI → "ai:other"

Example: `tags: ["javascript", "ai:claude", "tutorial"]`

**Default Language**: Korean unless English is explicitly requested by user.

---

## Parameter Structure (CRITICAL)

Pass title, tags, and content as **SEPARATE parameters** to `create_post()`:

```typescript
// Correct approach
create_post({
  title: "Your Title", // ✓ Separate parameter
  tags: ["tag1", "ai:claude", "tag2"], // ✓ Separate parameter
  content_markdown: "## First Section...", // ✓ Body only, NO front matter
});
```

**Do NOT include front matter in content_markdown**:

```markdown
## ❌ Wrong:

title: "Your Title" // Don't include in content_markdown
tags: ["tag1"] // Don't include in content_markdown

---

## Content starts here

✓ Correct:

## First Section // Start directly with H2

Content begins here...
```

**Important**: Start `content_markdown` with `##` (H2) sections. Do NOT use `#` (H1) or front matter delimiters (`---`).

---

## Markdown Structure Guidelines

### Heading Hierarchy

- H2 (`##`) for major sections
- H3 (`###`) for subsections
- H4 (`####`) for detailed points
- Never use H1 (`#`) in content_markdown

### Code Blocks

- Always specify language: ` ```javascript `, ` ```python `, ` ```typescript `
- Add comments for complex logic
- Keep code focused and executable where possible

### Formatting

- **Bold** for key terms (3-5 per post)
- `inline code` for function names, variables, commands
- Horizontal rules (`---`) between major sections
- Tables for comparisons and quick reference

---

## Content Quality Principles

### 1. Clarity Over Cleverness

Write to be understood, not to impress. Technical accuracy with accessible explanation.

### 2. Progressive Depth

Start with core concept, then layer complexity. Readers should be able to stop at any point with value gained.

### 3. Context Before Code

Explain WHY before WHAT. Code should support narrative, not replace it.

### 4. Actionable Takeaways

Every post should give readers something they can apply immediately.

---

## Korean Writing Guidelines (한국어 작성 시)

**Tone**: Use formal but friendly Korean (존댓말)

- Preferred: "~합니다", "~할 수 있습니다", "~하시면 됩니다"
- Avoid: "~한다" (딱딱), "~해" (반말), "~하라" (명령)

**Sentence Connection**: Use natural connectors

- "또한", "더 중요한 것은", "이는", "예를 들어", "따라서"

**Rhythm**: Mix short, medium, and long sentences for natural flow.

---

## Common Patterns to Avoid

**Don't**:

- Use "Untitled" or generic titles → Create meaningful, specific titles
- Overly formal/academic language → Keep professional but accessible
- Code dumps without explanation → Always provide context
- Mixing formal/informal tone → Maintain consistency
- Front matter in content_markdown → Use separate parameters

**Do**:

- Craft descriptive titles that preview content value
- Explain technical concepts with appropriate context
- Balance code examples with narrative explanation
- Maintain consistent professional tone throughout
- Follow parameter structure exactly as specified
