---
style_name: "Marketplace Product Listing"
language: "english"
min_length: 1000
target_length: "1000-3000"
code_block_ratio: 0.1
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Sell Style

Use this style for digital products you want to list in the marketplace, such as prompt packs, templates, guides, or workflow kits.
It should be tighter and more conversion-oriented than a standard blog post.

### Perfect For
- AI prompt packs
- Coding templates and boilerplates
- Technical guides and tutorials
- AI workflows and automation kits
- Data analysis tools and dashboards

### Recommended Signals
**Keywords**: "--sell"
**Intent**: monetize knowledge content as a paid product

### When Another Style Fits Better
- **Free technical sharing** → Use `default`
- **Build log or growth story** → Use `vibe`
- **Deep analysis or benchmark** → Use `research`

---

# === CORE WRITING PRINCIPLES ===

## 1. Lead with the Value Proposition

State the product's core value within the first three sentences.

**Pattern**:
```
[Buyer problem / need] → [How the product solves it] → [Expected outcome / time saved]
```

**Good Example**:
> Still writing prompts from scratch every time you use ChatGPT? This prompt pack cuts the work down to minutes across technical blogs, code reviews, and API docs.

## 2. Use a Clear Preview Boundary

Insert the `<!-- preview-end -->` comment to separate the free preview from the paid section.
Only the content above this marker is shown to users who have not purchased.

**Structure**:
```markdown
[Value proposition + product overview — free preview]

<!-- preview-end -->

[Detailed content + usage guide + practical examples — paid content]
```

## 3. Build Trust with Concrete Numbers

Use specific numbers instead of abstract promises.

| ❌ Abstract | ✅ Concrete |
|----------|---------|
| "Saves time" | "Cuts the workflow from 2 hours to 10 minutes" |
| "Includes many templates" | "Includes 48 templates across 12 categories" |
| "Lots of people use it" | "150 sales in the first 2 weeks" |

---

# === WRITING GUIDELINES ===

## Required Structure

### 1. Headline
- State the product's core value in one sentence
- Include a number or a concrete result when possible
- Example: "48 ChatGPT prompts for technical writing — ship a blog post in 10 minutes"

### 2. Value proposition (free preview, 2-3 paragraphs)
- Show the buyer's problem
- Explain how this product solves it
- Summarize what is included with bullet points
- **Place this section above `<!-- preview-end -->`**

### 3. Detailed breakdown (paid content)
- List the product contents, ideally in a table
- Explain how to use each part
- Include code or prompt source only when it adds real clarity

### 4. Usage guide
- Provide step-by-step instructions
- Add notes, limits, and practical tips

### 5. Close
- End with a short summary
- Include AI tags such as `ai:claude` or `ai:chatgpt`

## Tone & Style
- Professional, but approachable
- Short, high-signal sentences
- No hype; stay anchored in actual value
- Use clear direct English instead of marketing filler

## Formatting Rules
- Use bullet points aggressively
- Use tables when they make the offer easier to scan
- Keep code blocks to key examples only
- Screenshots are encouraged when they preview the outcome

---

# === QUALITY ENHANCEMENT GUIDE ===

## Marketplace Post Checklist

### Conversion fundamentals
- [ ] Is the core value clear in the first three sentences?
- [ ] Does the copy reflect the buyer's actual pain point?
- [ ] Are there concrete numbers or outcomes?
- [ ] Is the `<!-- preview-end -->` marker in the right place?

### Content quality
- [ ] Is the product structure clearly listed?
- [ ] Is the usage flow explained step by step?
- [ ] Does the copy stay grounded in real value without hype?

### Metadata
- [ ] Is the product category correct? (`ai_prompts`, `coding_templates`, `tech_guides`, `ai_workflows`, `data_analytics`, `others`)
- [ ] Are the tags relevant? (maximum 10)
- [ ] Is an AI tag included?

---

# === QUALITY CHECKLIST ===

**Final review**

1. **Value proposition**: can a buyer understand why this is worth buying in 10 seconds?
2. **Preview**: does the content above `<!-- preview-end -->` create enough desire to continue?
3. **Length**: does it stay in the 1000-3000 character range?
4. **Trust**: are there concrete numbers or real examples?
5. **AI tags**: are the relevant AI tool tags included?
