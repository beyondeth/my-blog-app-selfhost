---
style_name: "Research Insight Analysis Style"
language: "english"
min_length: 6000
target_length: "6000-9000"
code_block_ratio: 0.1
ai_tag_required: true
---

# === STYLE OVERVIEW ===

## When to Use Research Insight Style

Use this style for analyzing academic papers and translating them into clear, practical insights for readers.

### Perfect For
- Paper reviews and literature analyses
- Summaries of new methods or models
- Benchmark/result analysis with implications
- Research trend synthesis and gap analysis
- Critical evaluation of limitations and risks

### Recommended Signals
**Keywords**: "paper", "arXiv", "experiment", "dataset", "baseline", "ablation", "reproduction", "limitations", "insights"
**Intent**: Reader wants to understand a paper's contribution and what it means in practice

### When Another Style Fits Better
- **General concept explanation** → Use `default` style
- **Story-driven experience** → Use `novel` style
- **Conversational dialogue** → Use `podcast` style
- **Mentoring/learning guide** → Use `vibe` style

---

# === CORE WRITING PRINCIPLES ===

## 1. Separate Claims from Insights

Clearly distinguish what the paper claims vs. your analysis.

- **Paper claims**: the contributions or results stated by the paper
- **Analysis / insight**: your interpretation, implications, or critique

## 2. Evidence-First Summaries

Every key claim should be anchored to evidence:
- Dataset and task context
- Evaluation metrics
- Baselines compared
- Absolute numbers and relative deltas

Avoid unsourced speculation or overgeneralization.

## 3. Comparative Framing

Readers need to know "compared to what." Always include:
- Prior work reference point
- What changed (method, data, compute, objective)
- Why the improvement matters

## 4. Limitations are Mandatory

Discuss constraints explicitly:
- Data bias or scope limits
- Compute or latency costs
- Missing ablations or weak baselines
- Risks in deployment or generalization

## 5. Translate to Practical Decisions

End each major section with a short "so what":
- What should practitioners do differently?
- What trade-offs are acceptable?
- Where to be cautious?

---

# === WRITING GUIDELINES ===

## Paper Analysis Structure Template

```markdown
## Paper Snapshot
- Title / Authors / Venue / Year
- One-sentence contribution summary
- Reference: arXiv/DOI or official link

## Problem & Context
What gap does the paper address? Why does it matter?

## Method Summary
Key idea and how it differs from prior work

## Experimental Setup
Datasets, metrics, baselines, compute budget

## Results & Findings
Table or bullet summary of main results

## Ablation & Analysis
What components drive performance?

## Limitations & Risks
Explicit constraints and missing validations

## Practical Insights
Actionable takeaways for real-world use

## Open Questions
What should be tested next?

## Key Takeaways
3-5 concise bullets
```

## Tone and Voice

- Formal and clear. Prefer direct, neutral English over hype.
- Keep sentences short when stating results
- Use neutral language, avoid hype or salesy tone

## Citation Handling

- Provide paper title and year on first mention
- Use stable identifiers when possible (arXiv ID, DOI)
- Quote numbers exactly as reported (do not inflate)

---

# === ENHANCEMENT TECHNIQUES ===

## Insight Ladder

Turn results into insight using a three-step pattern:

1. **Observation**: What the paper shows (fact)
2. **Implication**: Why it matters (impact)
3. **Action**: What to do with it (decision)

## Contrast Table

Use a compact table to show differences:

```markdown
| Aspect | Prior Work | This Paper | Impact |
| --- | --- | --- | --- |
| Objective | X | Y | Better alignment |
| Data | A | B | Broader coverage |
| Metric | M | N | More robust |
```

## Risk Framing

Add a short "risk callout" for deployment:
- "This method can introduce too much latency for real-time use."
- "Performance may drop sharply when the data distribution shifts."

---

# === QUALITY CHECKLIST ===

Before publishing, verify:
- [ ] Paper title/venue/year are identified
- [ ] Claims and insights are clearly separated
- [ ] Datasets, metrics, and baselines are explicit
- [ ] Limitations and risks are stated
- [ ] Practical insights are actionable
- [ ] No hype or unsupported claims
- [ ] 3-5 key terms emphasized with **bold**
- [ ] AI identification tag included
