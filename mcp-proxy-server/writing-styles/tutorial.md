---
style_name: "Step-by-Step Tutorial Style"
language: "korean"
min_length: 3000
target_length: "4000-7000"
code_block_ratio: 0.35
ai_tag_required: true
auto_enhance: true
validation_token: "mcp-style-tutorial-v1-4f8a1c9d"
validation_challenges:
  - question: "tutorial 스타일의 최소 글자 수는?"
    answer: "3000"
  - question: "tutorial 스타일의 권장 코드 블록 비율은?"
    answer: "0.35"
  - question: "tutorial 스타일에서 강조하는 형식은?"
    answer: "step-by-step"
---

# === STYLE OVERVIEW ===

## When to Use Tutorial Style

Use this style for hands-on, step-by-step guides where readers follow along and build something.

### Perfect For
- Implementation guides ("How to build X")
- Setup and configuration tutorials
- Learning new frameworks or tools
- Code-along projects with checkpoints
- Beginner-friendly walkthroughs

### Recommended Signals
**Keywords**: "단계별", "따라하기", "구현", "만들기", "설치", "시작하기"
**Intent**: Reader wants to DO something, not just understand

### When Another Style Fits Better
- **Conceptual understanding without code** → Use `default` style
- **Narrative experience sharing** → Use `novel` style
- **Entertaining presentation** → Use `comedy` style
- **Conversational explanation** → Use `podcast` style

---

# === CORE TUTORIAL PRINCIPLES ===

## 1. Clear Prerequisites First

State requirements upfront. Readers should know if they're ready before starting.

```markdown
## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- Basic JavaScript knowledge (variables, functions, async/await)
- 30-45 minutes available
- Code editor (VS Code recommended)

**Skill level**: Beginner-Intermediate
```

## 2. Numbered Steps with Verification

Each step should be:
- Clearly numbered
- Single, focused action
- Followed by verification ("you should see...")

**Pattern**:
```markdown
### Step 3: Install Dependencies

Install required packages:
```bash
npm install express cors
```

**Verification**: Check your `package.json` - you should see express and cors under dependencies.
```

## 3. Progressive Complexity

Start simple, build incrementally. Each step adds one new concept.

- **Early steps**: Basic setup, hello world
- **Middle steps**: Core functionality
- **Later steps**: Edge cases, optimizations, best practices

## 4. Code-Heavy but Explained

Target ~35% code blocks. Every code block needs:
- **Before**: What you're about to add and why
- **Code**: Complete, copy-pasteable example
- **After**: What changed and how to verify

---

# === WRITING GUIDELINES ===

## Tutorial Structure Template

```markdown
## Introduction
What you'll build and why it's useful

## Prerequisites
- Required software/knowledge
- Time estimate
- Skill level

## What You'll Learn
- Learning objective 1
- Learning objective 2
- Learning objective 3

## Project Setup

### Step 1: Initialize Project
Instructions + code + verification

### Step 2: Configure Environment
Instructions + code + verification

## Core Implementation

### Step 3: Build Feature A
Instructions + code + verification + checkpoint

### Step 4: Build Feature B
Instructions + code + verification + checkpoint

## Testing and Debugging

### Step 5: Write Tests
Instructions + code + verification

### Step 6: Common Issues
Troubleshooting guide

## Next Steps
Where to go from here
```

## Step Format Standard

Each step follows this pattern:

```markdown
### Step N: [Action Verb] [What]

[Brief explanation of what this step accomplishes]

**Action**: [What reader should do]

```[language]
[Complete code example]
```

**Expected result**: [What they should see/get]

**Checkpoint**: [Optional verification command]
```bash
npm test
```
```

## Verification and Checkpoints

After significant steps, add checkpoint validation:

```markdown
**Checkpoint**: Let's verify everything works so far.

Run the development server:
```bash
npm run dev
```

Open `http://localhost:3000` - you should see:
- Welcome message displayed
- No console errors
- Status indicator showing green

If something's wrong, review Steps 2-4 before continuing.
```

## Common Pitfalls Section

Include troubleshooting for predictable errors:

```markdown
## Common Issues

### "Module not found" Error

**Symptom**: `Cannot find module 'express'`

**Solution**:
1. Verify you ran `npm install`
2. Check `node_modules` folder exists
3. Delete `node_modules` and `package-lock.json`, reinstall

### Port Already in Use

**Symptom**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill
```
```

---

# === CODE INTEGRATION GUIDELINES ===

## Complete, Copy-Pasteable Code

Every code example should be:
- **Syntactically complete**: No `...` or incomplete imports
- **Copy-pasteable**: Can be copied directly without modification
- **Contextualized**: File path indicated

**Example**:
```markdown
Create `src/server.js`:
```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```
```

## Incremental Code Building

Show how code evolves. Use comments to highlight what's new:

```markdown
Update `src/server.js` to add error handling:
```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// ✨ New: Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**What changed**: Added error handling middleware that catches all errors and returns a friendly JSON response.
```

## File Structure Clarity

Show file tree when creating multiple files:

```markdown
### Step 4: Create Project Structure

Create these files:

```
project/
├── src/
│   ├── server.js      # Express server
│   ├── routes/
│   │   └── api.js     # API routes
│   └── middleware/
│       └── auth.js    # Authentication
├── package.json
└── .env
```

Now create each file...
```

---

# === ENHANCEMENT TECHNIQUES ===

## Improving Step Clarity

**Before**: "설정 파일을 만드세요."

**After**:
"### Step 2: Create Configuration File

Create `.env` in your project root:
```
DATABASE_URL=postgresql://localhost:5432/mydb
PORT=3000
```

**Why this matters**: Environment variables keep sensitive data out of version control.

**Verification**: Run `cat .env` - you should see both variables listed."

**Principle**: What + How + Why + Verify

## Progressive Difficulty Markers

Indicate complexity level:

```markdown
### Step 5: Basic Authentication ⭐

[Simple username/password check]

### Step 8: JWT-Based Auth ⭐⭐

[Token generation and validation]

### Step 12: OAuth Integration ⭐⭐⭐

[Third-party OAuth flow]
```

## Visual Progress Indicators

Help readers track progress:

```markdown
## Progress: 40% Complete

✅ Project setup
✅ Core functionality
🔄 Testing (current step)
⬜ Deployment
⬜ Optimizations
```

## Alternative Paths

Offer choices when appropriate:

```markdown
### Step 6: Choose Your Database

**Option A: PostgreSQL** (Recommended for production)
```bash
npm install pg
```

**Option B: SQLite** (Easier for learning)
```bash
npm install better-sqlite3
```

This tutorial continues with Option A (PostgreSQL). If you chose Option B, the SQL syntax remains the same, but connection code differs slightly.
```

---

# === QUALITY CHECKLIST ===

Before publishing tutorial-style posts, verify:

**Structure**:
- [ ] Prerequisites clearly stated upfront
- [ ] Learning objectives listed
- [ ] Steps numbered sequentially
- [ ] Each step has single, clear action

**Code Quality**:
- [ ] All code examples are complete and copy-pasteable
- [ ] File paths indicated for every code block
- [ ] Language tags on all code blocks
- [ ] Incremental changes marked (✨ New, // Updated)

**Verifiability**:
- [ ] Verification steps after major changes
- [ ] Checkpoints at 25%, 50%, 75% completion
- [ ] Expected output/result described
- [ ] Common errors section included

**Usability**:
- [ ] Time estimate provided
- [ ] Skill level indicated
- [ ] Next steps / further learning suggested
- [ ] 3000+ characters minimum met
- [ ] Code blocks ~35% of total content

**Avoid**:
- [ ] Skipping verification steps
- [ ] Incomplete code examples with `...`
- [ ] Assuming prior knowledge not in prerequisites
- [ ] Mixing multiple concepts in one step
