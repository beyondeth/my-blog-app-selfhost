# === COMMON INSTRUCTIONS ===

## MCP Server Base Requirements

- Always authenticate before creating or publishing content.
- Use preset `style` when the user selected a built-in writing mode.
- Use `customMarkdown` when the caller provides a local or user-authored style guide.
- Use `styleAlias` when custom markdown came from a named local preset so the route can preserve traceability.

## Workflow

When the user requests auto-posting with style flags:

1. Resolve the style source.
   - Built-in preset flag: `--default`, `--pm`, `--designer`, etc.
   - Custom local style flag: route-specific resolver loads markdown, then passes it as `customMarkdown`.
2. Call `get_writing_style_guide(...)`.
3. Write the post using the returned guide only.
4. Call `create_post(...)`.

## Available Preset Styles

- `default`: professional technical explanation
- `novel`: narrative storytelling
- `podcast`: conversational dialogue format
- `vibe`: developer growth and learning guide
- `research`: evidence-first analysis
- `pm`: product narrative and decision rationale
- `designer`: design case study and UX reasoning
- `marketer`: growth and performance storytelling

## AI Identification Tag

Include one of these tags in every post:

- Claude → `ai:claude`
- ChatGPT → `ai:chatgpt`
- Gemini → `ai:gemini`
- Qwen → `ai:qwen`
- Other AI → `ai:other`

## Parameter Structure

Pass title, tags, and content as separate parameters to `create_post()`.

- `title`: final headline
- `tags`: max 10
- `content_markdown`: body only

Do not include front matter inside `content_markdown`.

## Markdown Structure Rules

- Start content with `##` sections, never `#`
- Use H2 for major sections and H3/H4 for detail
- Keep code blocks language-tagged
- Use tables only when comparison speed matters
- Use bold sparingly for real emphasis, not decoration

## Content Quality Principles

### 1. Strong Point of View

Every post must make a real claim, not just summarize a topic.

### 2. Evidence Before Abstraction

When numbers, experiments, user feedback, examples, screenshots, or outcomes exist, use them. Do not replace evidence with vague language.

### 3. Outcome-Oriented Structure

Readers should quickly understand:

- who this is for
- what changed
- why it matters
- what to do next

### 4. Scan-Friendly Layout

Keep sections explicit and front-load the most important point of each section.

### 5. Reusable Takeaways

Close every post with lessons, heuristics, or a checklist that the reader can reuse.

## Korean Writing Rules

- Use professional Korean with natural rhythm: `~합니다`, `~할 수 있습니다`
- Avoid empty hype, filler, and generic openings
- Prefer concrete verbs over ornamental adjectives
- Keep terminology consistent through the whole post

## Common Patterns to Avoid

- Generic openings such as `오늘은 ... 알아보겠습니다`
- Empty intensifiers such as `정말`, `매우`, `완전히`
- Paragraphs that explain a concept without an example
- Long sections with no reader payoff
- AI-sounding summaries with no concrete stance

# === QUALITY ENHANCEMENT GUIDE ===

## Editorial Pass Order

### Pass 1: Hook

The first 2-3 lines should make one of these immediately clear:

- a painful problem
- a surprising result
- a sharp opinion
- a concrete situation with stakes

### Pass 2: Proof

For every major claim, check whether it has at least one of:

- number
- example
- comparison
- quote
- scenario

### Pass 3: Reader Relevance

Add a sentence that answers `그래서 독자는 무엇을 얻는가?` in each major section.

### Pass 4: Compression

Delete sentences that only restate the previous sentence.

### Pass 5: Finish Strong

The ending should not simply “wrap up.” It should leave the reader with:

- a decision rule
- a checklist
- a next action
- a memorable line grounded in the post

# === ENHANCEMENT TECHNIQUES ===

## Claim -> Evidence -> Implication

Use this pattern repeatedly:

```markdown
주장: 무엇이 달라졌는가
근거: 어떤 데이터/사례/관찰이 이를 뒷받침하는가
의미: 그래서 팀이나 독자는 무엇을 바꿔야 하는가
```

## Before -> After -> Why

This is the default pattern for examples:

```markdown
이전 상태
바꾼 방식
왜 더 나아졌는가
```

## Make the Scannable Version Visible

For long posts, include at least one of:

- short bullet recap
- table
- checklist
- comparison block

## Prefer Specific Nouns

Replace vague nouns with concrete nouns.

- `문제가 있었다` → `상세 조회 API의 응답 시간이 1.8초까지 늘어났다`
- `성과가 좋았다` → `전환율이 2.1%에서 3.4%로 올랐다`

# === QUALITY CHECKLIST ===

- The title promises a real outcome or insight
- The opening contains a concrete hook
- The post has a visible target reader and goal
- Each major section contains proof, not only explanation
- The structure is skimmable without reading every sentence
- The ending contains reusable takeaways
- The tone sounds authored, not auto-filled
