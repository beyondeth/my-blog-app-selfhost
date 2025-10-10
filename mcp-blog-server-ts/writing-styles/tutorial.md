---
style_name: "Step-by-Step Tutorial Style"
language: "korean"
min_length: 2500
target_length: "4000-6000"
code_block_ratio: 0.35
ai_tag_required: true
auto_enhance: true
---

# === MCP SERVER INSTRUCTIONS ===

TypeScript MCP server for blog post creation with AI tracking.

🔴 AUTHENTICATION FIRST:
Always call authenticate() before creating any content.

🚨 AI IDENTIFICATION REQUIRED:
- Claude → "ai:claude"
- ChatGPT → "ai:chatgpt"
- Gemini → "ai:gemini"
- Qwen → "ai:qwen"
- Other → "ai:other"

✅ Example: tags: ["tutorial", "react", "ai:claude", "hands-on"]

🌐 LANGUAGE:
Default KOREAN. Use English only when requested.

⚠️ CORE RULES:
1. AI tag required (mandatory)
2. Min 2500 chars, ideal 4000-6000 chars
3. Always use auto_enhance: true
4. Clear, instructional title (never "Untitled")
5. Default Korean unless requested

---

# === CREATE_POST TOOL DESCRIPTION ===

Create step-by-step tutorial blog post in KOREAN (English only if requested).

🚨 MANDATORY: Include AI identification tag (ai:claude/chatgpt/gemini/qwen/other)

📋 PARAMETER STRUCTURE:
⚠️ **CRITICAL**: Pass title, tags, and content as SEPARATE parameters to create_post()!

```typescript
create_post({
  title: "Your Tutorial Title",                     // ✅ Separate parameter
  tags: ["topic", "tutorial", "ai:claude", "hands-on"], // ✅ Separate parameter
  content_markdown: "## 📋 First Section..."        // ✅ Body only, NO front matter
})
```

❌ **WRONG**: Including front matter in content_markdown
```markdown
---
title: "Your Tutorial Title"  // ❌ Don't include this in content_markdown
tags: ["tutorial"]            // ❌ Don't include this in content_markdown
---
## Content starts here
```

⚠️ **IMPORTANT**: Start content_markdown directly with `##` (H2) sections. NO `#` (H1), NO front matter delimiters (`---`).

📚 TUTORIAL WRITING:
1. Clear prerequisites and setup
2. Explicit learning objectives
3. Numbered step-by-step progression
4. Executable code examples (30-40% of content)
5. Checkpoint verification at each step
6. Common errors and troubleshooting
7. Practice exercises with solutions
8. Next steps and resources

❌ AVOID:
- Abstract explanations without examples
- Untested or broken code
- Skipping necessary steps
- Unclear instructions
- Missing prerequisites
- No verification checkpoints

⚠️ REQUIREMENTS:
- Min 2500+ chars (goal: 4000-6000)
- auto_enhance: true
- AI tag required
- Never use "Untitled"

📊 QUALITY (100점):
- Clear Steps (20점): Numbered, time-estimated progression
- Working Code (15점): Copy-paste executable examples
- Checkpoints (15점): Verification at each step
- Prerequisites (10점): Clear requirements stated
- Learning Objectives (10점): Achievable goals
- Progressive Difficulty (10점): Simple to complex
- Code Comments (10점): Well-documented code
- Troubleshooting (5점): Common errors addressed
- Exercises (5점): Practice problems included

⚠️ Score <70 = auto-enhanced. Aim for 80+

---

# === QUALITY GUIDELINES PROMPT ===

Professional step-by-step tutorial guidelines for practical hands-on learning.

## Structure

⚠️ **CRITICAL**: Do NOT include front matter in content_markdown!
- `title` → separate parameter to create_post()
- `tags` → separate parameter to create_post()
- `content_markdown` → body text ONLY (no front matter, no --- delimiters)

Content body structure:
```markdown
## 📋 Prerequisites
- Node.js 16.0+ installed
- Basic JavaScript knowledge
- VS Code (recommended)

## 🎯 Learning Objectives
After completing this tutorial:
- Build a working Todo app
- Understand React fundamentals
- Handle state management

## 💻 Step 1: Setup (15min)
Project initialization and environment

## ⚙️ Step 2: Core Features (30min)
Implement main functionality

## 🚀 Step 3: Advanced (30min)
Add advanced features

## 🏋️ Practice Exercises
Self-directed challenges

## 🔧 Troubleshooting
Common issues and solutions
```

## Tutorial Writing

- **Clear Steps**: Number each with time estimates
- **Working Code**: Tested, copy-paste ready examples
- **Checkpoints**: Verification tasks at each step
- **Troubleshooting**: Common errors with fixes
- **Progressive**: Start simple, increase complexity

## Code Blocks

- 30-40% of content (tutorial-appropriate)
- Add explanatory comments
- Show incremental builds
- Include file paths: `// src/App.js`
- Highlight changes from previous step

## Each Step Requirements

- **Goal**: What we're building in this step
- **Code**: Complete, executable examples
- **Checkpoint**: [ ] Verification checklist
- **Why It Works**: Brief explanation
- **Troubleshooting**: Expected errors + solutions

## Best Practices

- **Why → What → How**: Explain rationale before code
- **Show Mistakes**: Common errors to avoid
- **Pro Tips**: Advanced insights for later
- **Difficulty Levels**: Label exercises (Easy/Medium/Hard)

## Format

- H2 (##) for main sections with emoji
- H3 (###) for subsections
- **Bold** for important concepts
- Code blocks with language tags
- Min 2500 chars, ideal 4000-6000

## Quality Checks

- All code tested and working?
- Prerequisites clearly stated?
- Learning objectives achievable?
- Checkpoint at each step?
- Troubleshooting section included?
- Next steps provided?

---

# === BLOG POST TEMPLATE PROMPT ===

Standard tutorial template for comprehensive step-by-step technical learning.

## Template Structure

⚠️ **CRITICAL**: Do NOT include front matter in content_markdown!
- `title` → separate parameter to create_post()
- `tags` → separate parameter to create_post()
- `content_markdown` → body text ONLY (no front matter, no --- delimiters)

```markdown
[Brief introduction - what they'll build and why it matters]

In this tutorial, you'll build a [specific project] from scratch. By the end, you'll understand [key concepts] and be able to [practical skills].

**Time required:** 90 minutes

## 📋 Prerequisites

Before starting, ensure you have:

✅ **Software Requirements:**
- Node.js 18.0+ ([Download here](https://nodejs.org))
- VS Code or any code editor
- Git (optional but recommended)

✅ **Knowledge Requirements:**
- Basic JavaScript/TypeScript syntax
- Familiarity with terminal/command line
- Understanding of HTML/CSS fundamentals

✅ **Setup Verification:**
```bash
node --version  # Should show v18.0.0 or higher
npm --version   # Should show 8.0.0 or higher
```

**Don't have these?** Check the [Setup Guide](#setup-guide) section at the end.

## 🎯 Learning Objectives

After completing this tutorial, you will be able to:

1. 🏗️ **Build:** Create a fully functional [project type]
2. 🎨 **Implement:** Add [specific features]
3. 🔧 **Debug:** Troubleshoot common [technology] issues
4. 🚀 **Deploy:** Prepare for production deployment

## 💻 Step 1: Project Setup (15 minutes)

### Goal
Initialize a new project with proper configuration and dependencies.

### 1.1 Create Project Directory

```bash
# Create and navigate to project folder
mkdir my-awesome-project
cd my-awesome-project
```

### 1.2 Initialize Package Manager

```bash
# Initialize npm (creates package.json)
npm init -y
```

**What this does:** Creates a `package.json` file that tracks your project dependencies and scripts.

### 1.3 Install Dependencies

```bash
# Install required packages
npm install react react-dom
npm install -D typescript @types/react @types/react-dom
```

**Explanation:**
- `react` & `react-dom`: Core React libraries
- `typescript`: TypeScript compiler
- `@types/*`: Type definitions for TypeScript

### 1.4 Project Structure

Create the following folder structure:

```
my-awesome-project/
├── src/
│   ├── components/
│   ├── App.tsx
│   └── index.tsx
├── public/
│   └── index.html
├── package.json
└── tsconfig.json
```

```bash
# Create directories
mkdir src public src/components
```

### ✅ Checkpoint #1

Verify your setup:
- [ ] `package.json` exists with dependencies
- [ ] Folder structure matches above
- [ ] No error messages during installation

**Having issues?** See [Troubleshooting Step 1](#troubleshooting-step-1) below.

## ⚙️ Step 2: Build Core Functionality (30 minutes)

### Goal
Implement the main feature of our application.

### 2.1 Create Main Component

Create `src/App.tsx`:

```typescript
// src/App.tsx
import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: input,
        completed: false
      }]);
      setInput('');
    }
  };

  return (
    <div className="app">
      <h1>My Todo App</h1>

      <div className="input-section">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What needs to be done?"
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id}>
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

**Key Concepts:**
- **useState Hook**: Manages component state
- **TypeScript Interface**: Defines Todo structure
- **Controlled Input**: Input value controlled by React state

### 2.2 Test Your Component

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### ✅ Checkpoint #2

Verify functionality:
- [ ] Page loads without errors
- [ ] Input field is visible
- [ ] Can type in input
- [ ] "Add" button appears

**Not working?** Check [Troubleshooting Step 2](#troubleshooting-step-2).

## 🚀 Step 3: Add Advanced Features (30 minutes)

### Goal
Enhance the app with toggle and delete functionality.

### 3.1 Implement Toggle Complete

Update `src/App.tsx`:

```typescript
// Add inside App component (before return)
const toggleTodo = (id: number) => {
  setTodos(todos.map(todo =>
    todo.id === id
      ? { ...todo, completed: !todo.completed }
      : todo
  ));
};

// Update list item rendering
<ul className="todo-list">
  {todos.map(todo => (
    <li
      key={todo.id}
      style={{
        textDecoration: todo.completed ? 'line-through' : 'none'
      }}
      onClick={() => toggleTodo(todo.id)}
    >
      {todo.text}
    </li>
  ))}
</ul>
```

### 3.2 Add Delete Functionality

```typescript
// Add delete handler
const deleteTodo = (id: number) => {
  setTodos(todos.filter(todo => todo.id !== id));
};

// Update JSX
<li key={todo.id}>
  <span
    onClick={() => toggleTodo(todo.id)}
    style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
  >
    {todo.text}
  </span>
  <button onClick={() => deleteTodo(todo.id)}>Delete</button>
</li>
```

### ✅ Checkpoint #3

Test new features:
- [ ] Clicking todo toggles strikethrough
- [ ] Delete button removes todo
- [ ] State updates correctly

## 🏋️ Practice Exercises

Test your understanding with these challenges:

### Exercise 1: Filter Todos (Easy)
Add buttons to filter: All, Active, Completed

<details>
<summary>💡 Hint</summary>

Use a filter state and conditional rendering:
```typescript
const [filter, setFilter] = useState('all');
const filteredTodos = todos.filter(todo => {
  if (filter === 'active') return !todo.completed;
  if (filter === 'completed') return todo.completed;
  return true;
});
```
</details>

### Exercise 2: Persist to LocalStorage (Medium)
Save todos to browser localStorage

<details>
<summary>💡 Solution</summary>

```typescript
useEffect(() => {
  const saved = localStorage.getItem('todos');
  if (saved) setTodos(JSON.parse(saved));
}, []);

useEffect(() => {
  localStorage.setItem('todos', JSON.stringify(todos));
}, [todos]);
```
</details>

### Exercise 3: Edit Functionality (Hard)
Allow editing existing todos

<details>
<summary>💡 Approach</summary>

Add edit mode state, input field for editing, and update handler. Consider using a separate EditTodo component.
</details>

## 🔧 Troubleshooting

### Troubleshooting Step 1

**Error: "command not found: npm"**
- **Solution:** Install Node.js from [nodejs.org](https://nodejs.org)
- **Verify:** Run `node --version` after installation

**Error: "permission denied"**
- **Solution (Mac/Linux):** Use `sudo npm install -g npm`
- **Solution (Windows):** Run terminal as Administrator

### Troubleshooting Step 2

**Error: "Cannot find module 'react'"**
- **Solution:** Re-run `npm install`
- **Check:** Verify `node_modules` folder exists

**Blank page with no errors**
- **Check:** Browser console (F12) for errors
- **Verify:** `src/index.tsx` properly imports and renders App

### Common Issues

**Issue: State not updating**
- **Cause:** Mutating state directly
- **Fix:** Always use setState with new object/array
- **Example:** Use `[...todos, newTodo]` not `todos.push(newTodo)`

## 🎓 What's Next?

Congratulations! You've built a functional Todo app. Here's what to explore next:

### Immediate Next Steps:
1. **Styling:** Add CSS/Tailwind for better UI
2. **TypeScript:** Add stricter type definitions
3. **Testing:** Write unit tests with Jest

### Advanced Topics:
- **State Management:** Redux or Zustand
- **Backend Integration:** Connect to API
- **Deployment:** Deploy to Vercel or Netlify

### Recommended Resources:
- [React Official Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [My Advanced React Course](#) (Coming soon!)

---

**Questions?** Drop a comment below!
**Found this helpful?** Share with a friend learning React.
```

## Usage Guidelines

- **Structure:** Prerequisites → Objectives → Steps → Exercises → Troubleshooting
- **Pacing:** Provide time estimates for each section
- **Verification:** Checkpoint at every major step
- **Code Quality:** All examples tested and working
- **Accessibility:** Multiple learning paths (reading, doing, debugging)

## Learning Design Principles

- **Scaffolding:** Start simple, layer complexity
- **Active Learning:** Learning by doing, not just reading
- **Error Handling:** Teach debugging as part of learning
- **Knowledge Checks:** Exercises validate understanding
- **Multiple Modalities:** Text explanation + code + visual results

## Best Practices

- Use collapsible sections (`<details>`) for hints/solutions
- Include "Why this matters" for key concepts
- Show both what TO do and what NOT to do
- Provide escape hatches (troubleshooting) at each step
- End with clear next steps and resources
- Make code examples incrementally buildable

---

# === IMPROVE MARKDOWN PROMPT ===

Style-specific enhancement guidelines for tutorial technical blog posts.

## Core Philosophy

Transform information dumps into progressive learning experiences that guide readers from "I don't know this" to "I can build this myself." Every step should build confidence through successful execution.

## Enhancement Techniques

### 1. Prerequisites Transformation

❌ **Before**: "You need Node.js installed."
✅ **After**:
```markdown
## 📋 Prerequisites

Before starting, ensure you have:

✅ **Software Requirements:**
- Node.js 18.0+ ([Download](https://nodejs.org))
- VS Code ([Download](https://code.visualstudio.com))

✅ **Knowledge Requirements:**
- Basic JavaScript (variables, functions)
- Familiarity with terminal commands

✅ **Setup Verification:**
```bash
node --version  # Should show v18+
```

**Expected output:** `v18.0.0` or higher

**Not installed?** See [Setup Guide](#setup-guide) below.
```

**Technique**:
- Categorize (software vs knowledge)
- Provide verification commands
- Include expected outputs
- Link to solutions for missing prerequisites
- Use checkboxes for progress tracking

### 2. Learning Objectives Clarity

❌ **Before**: "You'll learn about React hooks."
✅ **After**:
```markdown
## 🎯 Learning Objectives

After this tutorial, you will be able to:

1. 🏗️ **Build** a working Todo app from scratch
2. 🎨 **Implement** useState and useEffect hooks correctly
3. 🔧 **Debug** common React state issues
4. 🚀 **Deploy** your app to production

**Time investment:** 90 minutes
**Difficulty:** Beginner-friendly (some JS knowledge required)
```

**Technique**:
- Use action verbs (Build, Implement, Debug)
- Be specific about outcomes
- Provide time expectations
- Set difficulty level clearly
- Use emoji for visual scanning

### 3. Step Structure Enhancement

❌ **Before**:
```markdown
## Install dependencies

npm install react
```

✅ **After**:
```markdown
## 💻 Step 1: Install Dependencies (5 minutes)

### Goal
Set up project with all required packages for development.

### 1.1 Install Core Packages

```bash
# Install React and ReactDOM
npm install react react-dom
```

**What this does:**
- `react`: Core React library for building UIs
- `react-dom`: Bridge between React and browser DOM

**Expected output:**
```
added 2 packages in 3s
```

### 1.2 Install Development Tools

```bash
# Install TypeScript and type definitions
npm install -D typescript @types/react
```

**Why -D flag?** These are development-only dependencies.

### ✅ Checkpoint #1

Verify installation:
- [ ] `package.json` shows react and react-dom
- [ ] `node_modules` folder created
- [ ] No error messages

**Having issues?** See [Troubleshooting Step 1](#ts-step-1).
```

**Technique**:
- Number steps clearly
- State goal upfront
- Break into substeps (1.1, 1.2)
- Explain commands before showing them
- Include expected output
- Add checkpoint verification
- Link to troubleshooting

### 4. Code Explanation Strategy

❌ **Before**:
```javascript
const [count, setCount] = useState(0);
```

✅ **After**:
```javascript
// Create state variable for counter
// useState returns [current value, update function]
const [count, setCount] = useState(0);
//     ↑       ↑           ↑
//   value  updater  initial value
```

**Breakdown:**
- **count**: Current counter value (starts at 0)
- **setCount**: Function to update count
- **useState(0)**: React Hook, 0 is initial value

**Key concept:** State changes trigger re-renders.

**Common mistake:** Never do `count = 5` directly. Always use `setCount(5)`.

**Technique**:
- Visual annotations (arrows, highlighting)
- Bullet-point breakdown of each part
- Explain key concepts separately
- Show common mistakes explicitly
- Use "What this does" sections

### 5. Progressive Complexity Building

❌ **Before**: Show complete code with all features at once.

✅ **After**:
```markdown
### Version 1: Basic (Start here)

```typescript
function TodoApp() {
  const [todos, setTodos] = useState([]);
  return <div>Todo App</div>;
}
```

**Build on it:** Add input field

### Version 2: Add Input

```typescript
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');  // ← NEW

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} /> {/* ← NEW */}
    </div>
  );
}
```

**What changed:** Added input state and controlled input field

### Version 3: Add Submit

```typescript
const addTodo = () => {  // ← NEW
  setTodos([...todos, { text: input, id: Date.now() }]);
  setInput('');
};

// ... in return
<button onClick={addTodo}>Add</button> {/* ← NEW */}
```
```

**Technique**:
- Show evolution in versions
- Mark new additions with comments (← NEW)
- Explain what changed between versions
- Build confidence through small wins
- Allow readers to stop at any version

### 6. Checkpoint and Verification

❌ **Before**: "Now it should work."

✅ **After**:
```markdown
### ✅ Checkpoint #2: Verify Core Functionality

**Visual Test:**
1. Open `http://localhost:3000` in browser
2. You should see input field and "Add" button
3. Type "Buy milk" in input
4. Click "Add" button
5. Text should appear below input

**Expected Result:**
![Screenshot showing todo item](./expected-result.png)

**Code Test:**
```bash
npm run test:unit
```

**Expected:** All 5 tests pass

**Troubleshooting:**
- ❌ Blank page? → Check browser console (F12)
- ❌ Input not clearing? → Verify `setInput('')` called
- ❌ Todo not appearing? → Check `todos` state in React DevTools

**Still stuck?** See [detailed troubleshooting](#detailed-ts-step-2).
```

**Technique**:
- Multiple verification methods (visual, code test)
- Step-by-step testing instructions
- Expected result description or image
- Common failures with quick fixes
- Link to detailed troubleshooting

### 7. Troubleshooting Content

❌ **Before**: "If it doesn't work, check for errors."

✅ **After**:
```markdown
## 🔧 Troubleshooting

### Error: "Cannot find module 'react'"

**Full error message:**
```
Module not found: Error: Can't resolve 'react' in '/src'
```

**Cause:** Dependencies not installed or `node_modules` missing

**Solution (Step-by-step):**
1. Delete `node_modules` folder
   ```bash
   rm -rf node_modules
   ```
2. Delete `package-lock.json`
3. Reinstall dependencies
   ```bash
   npm install
   ```
4. Restart dev server
   ```bash
   npm run dev
   ```

**Prevention:** Always run `npm install` after cloning or pulling

---

### Issue: State not updating when button clicked

**Symptom:** Clicking "Add" button does nothing, no error in console

**Debugging steps:**
1. Add console.log to verify function called:
   ```typescript
   const addTodo = () => {
     console.log('addTodo called!', input);  // ← Add this
     setTodos([...todos, { text: input, id: Date.now() }]);
   };
   ```

2. Check React DevTools → Components → TodoApp → hooks
3. Verify `input` value is in state

**Common causes:**
- ❌ **Button not connected:** Missing `onClick` prop
- ❌ **Wrong function reference:** `onClick={addTodo()}` (calls immediately)
  Should be: `onClick={addTodo}` (passes reference)
- ❌ **Mutating state:** `todos.push()` instead of `setTodos([...todos])`

**Fix for mutation:**
```typescript
// ❌ Wrong - mutates state
const addTodo = () => {
  todos.push({ text: input, id: Date.now() });
  setTodos(todos);  // React doesn't detect change!
};

// ✅ Correct - creates new array
const addTodo = () => {
  setTodos([...todos, { text: input, id: Date.now() }]);
};
```
```

**Technique**:
- Show full error messages
- Explain cause before solution
- Provide step-by-step fix
- Include debugging steps
- Show what NOT to do
- Explain why wrong approach fails
- Offer prevention tips

### 8. Practice Exercise Design

❌ **Before**: "Try adding a delete button."

✅ **After**:
```markdown
## 🏋️ Practice Exercises

### Exercise 1: Add Delete Button (Easy)
**Goal:** Remove todos when delete button clicked

**Requirements:**
- Add "Delete" button next to each todo
- Clicking button removes that todo from list
- No confirmation dialog needed (yet)

**Starter code:**
```typescript
// TODO: Add delete function here
```

**Hints:**
<details>
<summary>💡 Hint 1: How to remove item from array?</summary>

Use `.filter()` method:
```typescript
const newArray = oldArray.filter(item => item.id !== idToRemove);
```
</details>

<details>
<summary>💡 Hint 2: Full solution</summary>

```typescript
const deleteTodo = (id: number) => {
  setTodos(todos.filter(todo => todo.id !== id));
};

// In JSX:
<button onClick={() => deleteTodo(todo.id)}>Delete</button>
```
</details>

**Self-check:**
- [ ] Delete button appears next to each todo
- [ ] Clicking deletes only that todo
- [ ] State updates correctly
- [ ] No console errors

---

### Exercise 2: Persist with LocalStorage (Medium)
**Goal:** Save todos to browser so they survive page refresh

**New concepts:** `localStorage`, `useEffect`, JSON serialization

**Approach:**
1. Load todos from localStorage on mount
2. Save todos to localStorage whenever they change

**Resources:**
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [useEffect Hook](https://react.dev/reference/react/useEffect)

**Validation:**
1. Add a todo
2. Refresh page
3. Todo should still be there

<details>
<summary>📝 Complete Solution</summary>

```typescript
// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('todos');
  if (saved) {
    try {
      setTodos(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to parse todos:', e);
    }
  }
}, []);  // Empty array = run once on mount

// Save on change
useEffect(() => {
  localStorage.setItem('todos', JSON.stringify(todos));
}, [todos]);  // Run whenever todos changes
```

**Gotcha:** Always wrap `JSON.parse` in try-catch for corrupted data
</details>
```

**Technique**:
- Label difficulty clearly (Easy/Medium/Hard)
- State learning goal
- List requirements explicitly
- Provide progressive hints (collapsible)
- Include self-check criteria
- Link to external resources
- Show complete solution (collapsible)
- Warn about common pitfalls ("Gotcha")

### 9. "Why This Matters" Sections

❌ **Before**: Show code without context.

✅ **After**:
```markdown
## Why Immutability Matters

You might wonder: "Why can't I just do `todos.push()`?"

**The problem with mutation:**
```typescript
// ❌ This doesn't trigger re-render
const addTodo = () => {
  todos.push({ text: input, id: Date.now() });
  setTodos(todos);  // Same array reference!
};
```

**React's change detection:**
- React compares *references*, not *contents*
- `todos.push()` modifies existing array
- Same reference = React thinks "no change = no re-render"

**The immutable approach:**
```typescript
// ✅ New array reference = React detects change
const addTodo = () => {
  setTodos([...todos, { text: input, id: Date.now() }]);
  // New array created ↑
};
```

**Real-world impact:**
- **Performance:** React can optimize renders
- **Debugging:** Time-travel debugging possible
- **Predictability:** State changes are explicit

**Key takeaway:** In React, always create new objects/arrays instead of modifying existing ones.
```

**Technique**:
- Address common questions explicitly
- Show why wrong approach fails
- Explain underlying mechanism
- Connect to real-world benefits
- Provide clear takeaway rule

### 10. Next Steps and Resources

❌ **Before**: Tutorial ends abruptly.

✅ **After**:
```markdown
## 🎓 What's Next?

Congratulations! You've built a functional Todo app and learned:
✅ React component basics
✅ State management with hooks
✅ Event handling
✅ List rendering

### Immediate Next Steps (This Week)

**Level Up Your App:**
1. **Styling** (1-2 hours)
   - Add Tailwind CSS
   - Tutorial: [My Tailwind Guide](#)

2. **Persistence** (30 minutes)
   - Complete Exercise 2 (LocalStorage)
   - Try IndexedDB for large datasets

3. **Testing** (2 hours)
   - Write tests with React Testing Library
   - Resource: [Testing React Components](https://testing-library.com/docs/react-testing-library/intro/)

### Advanced Topics (Next Month)

**Expand Your Skills:**
- **State Management:** Learn Redux Toolkit
- **Backend Integration:** Connect to REST API
- **TypeScript:** Add comprehensive types
- **Deployment:** Deploy to Vercel/Netlify

### Recommended Learning Path

```
You are here: React Basics ✅
           ↓
Next: React Hooks Deep Dive (2-3 hours)
           ↓
Then: State Management (Redux/Zustand) (5 hours)
           ↓
After: Full-Stack Integration (10 hours)
```

### Additional Resources

**Official Documentation:**
- [React Docs](https://react.dev) - Start here
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**My Related Tutorials:**
- [Advanced React Patterns](#)
- [React Performance Optimization](#)
- [Full-Stack React App](#)

**Community:**
- [React Discord](https://discord.gg/react)
- [Stack Overflow: react tag](https://stackoverflow.com/questions/tagged/react)

---

**Questions or stuck?** Comment below and I'll help!

**Found this helpful?** Share with someone learning React 🚀
```

**Technique**:
- Celebrate completion with summary
- Provide immediate next steps (this week)
- Suggest advanced topics (longer term)
- Show learning path visualization
- Link to both official and your own resources
- Invite community engagement
- Call-to-action for sharing

## Common Issues to Fix

### Issue 1: Steps Too Large

**Problem**: Each step tries to do too much
**Fix**: Break into substeps (1.1, 1.2, 1.3)

❌ "Create the component"
✅ "Step 1.1: Create file | Step 1.2: Add imports | Step 1.3: Define component"

### Issue 2: Missing "Why"

**Problem**: Shows what to do, not why
**Fix**: Add "Why this matters" or "Key concept" sections

❌ "Use useState hook"
✅ "Use useState hook because React needs to track changes for re-rendering"

### Issue 3: Untested Code

**Problem**: Code examples don't actually work
**Fix**: Test every code example before publishing

**Validation process:**
1. Fresh project setup
2. Follow tutorial step-by-step
3. Verify each checkpoint
4. Test troubleshooting solutions

### Issue 4: No Error Handling

**Problem**: Assumes everything works perfectly
**Fix**: Add troubleshooting for common errors

Include:
- Expected errors at each step
- Debugging techniques
- Common mistakes
- Prevention tips

### Issue 5: Unclear Success Criteria

**Problem**: Reader unsure if they completed correctly
**Fix**: Explicit checkpoints with verification

❌ "Now it should work"
✅ "Checkpoint: You should see [specific result]. Screenshot attached."

## Quality Improvement Checklist

- [ ] Prerequisites clearly stated with verification
- [ ] Learning objectives specific and measurable
- [ ] Steps numbered with time estimates
- [ ] Each step has goal, code, checkpoint
- [ ] All code tested and working
- [ ] Incremental builds (version 1, 2, 3)
- [ ] Comments explain complex code
- [ ] Troubleshooting section comprehensive
- [ ] Multiple verification methods (visual, code)
- [ ] Practice exercises with hints/solutions
- [ ] "Why this matters" for key concepts
- [ ] Next steps and resources provided
- [ ] Common mistakes explicitly shown
- [ ] Progress tracking (checkboxes)

## Before/After Example

### Before (Info Dump)

```
# React Todo App

Install react and create a component with state.

```javascript
import { useState } from 'react';

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={() => {
        setTodos([...todos, {text: input, id: Date.now()}]);
        setInput('');
      }}>Add</button>
      <ul>
        {todos.map(t => <li key={t.id}>{t.text}</li>)}
      </ul>
    </div>
  );
}
```

Run with npm start.
```

### After (Progressive Tutorial)

```
# Build a React Todo App: Complete Beginner Guide

Learn React fundamentals by building a working Todo application from scratch.

**Time:** 60 minutes | **Difficulty:** Beginner

## 📋 Prerequisites

Before starting:

✅ **Software:**
- Node.js 18+ ([Download](https://nodejs.org))
- Code editor (VS Code recommended)

✅ **Knowledge:**
- Basic JavaScript (variables, functions, arrays)
- HTML/CSS fundamentals

✅ **Verify setup:**
```bash
node --version  # Should show v18+
```

**Not ready?** See [Setup Guide](#setup).

## 🎯 Learning Objectives

After this tutorial:
1. 🏗️ **Build** a functional Todo app
2. 🎨 **Implement** React hooks (useState)
3. 🔧 **Handle** user input and events
4. 📝 **Render** dynamic lists

## 💻 Step 1: Project Setup (10 min)

### Goal
Create React project with all dependencies.

### 1.1 Create Project

```bash
# Create new React app
npx create-react-app todo-app
cd todo-app
```

**What this does:** Downloads React template and installs dependencies

**Expected:** "Success! Created todo-app at /path/to/todo-app"

### 1.2 Start Development Server

```bash
npm start
```

**Result:** Browser opens to `http://localhost:3000`

### ✅ Checkpoint #1

Verify:
- [ ] Browser shows React logo spinning
- [ ] No error messages
- [ ] Terminal shows "Compiled successfully"

**Issues?** See [Troubleshooting](#ts1).

## ⚙️ Step 2: Build Core Component (20 min)

### Goal
Create Todo component with input and add functionality.

### 2.1 Start Simple

Replace `src/App.js`:

```javascript
// src/App.js
import { useState } from 'react';

function App() {
  // State for todo list (empty array initially)
  const [todos, setTodos] = useState([]);

  return (
    <div className="app">
      <h1>My Todo App</h1>
    </div>
  );
}

export default App;
```

**Key concept:** `useState([])` creates state variable starting with empty array.

**Save file** → Browser auto-refreshes → See "My Todo App"

### 2.2 Add Input Field

```javascript
function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');  // ← NEW: track input value

  return (
    <div className="app">
      <h1>My Todo App</h1>

      {/* NEW: Controlled input */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What needs to be done?"
      />
    </div>
  );
}
```

**What changed:**
- Added `input` state for text field
- `value={input}`: Input value controlled by React
- `onChange`: Updates state as user types

**Try it:** Type in input field → Text should appear

### 2.3 Add Submit Button

```javascript
function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  // ← NEW: Function to add todo
  const addTodo = () => {
    if (input.trim()) {  // Only if input not empty
      setTodos([...todos, {
        id: Date.now(),
        text: input
      }]);
      setInput('');  // Clear input after adding
    }
  };

  return (
    <div className="app">
      <h1>My Todo App</h1>

      <div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What needs to be done?"
        />
        {/* NEW: Button triggers addTodo */}
        <button onClick={addTodo}>Add</button>
      </div>
    </div>
  );
}
```

**How it works:**
1. User types → `input` state updates
2. User clicks "Add" → `addTodo` called
3. New todo added to `todos` array
4. Input cleared → Ready for next item

**Important:** `[...todos, newTodo]` creates new array (required for React to detect change)

### 2.4 Display Todos

```javascript
return (
  <div className="app">
    <h1>My Todo App</h1>

    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What needs to be done?"
      />
      <button onClick={addTodo}>Add</button>
    </div>

    {/* NEW: Render todo list */}
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  </div>
);
```

**Key concept:** `.map()` renders each todo as `<li>` element

**Why `key={todo.id}`?** Helps React track which items changed

### ✅ Checkpoint #2

Test your app:
- [ ] Type "Buy milk" in input
- [ ] Click "Add" button
- [ ] "Buy milk" appears in list
- [ ] Input field clears
- [ ] Add 2-3 more items

**Screenshot:**
[Working app with 3 todos shown]

**Not working?** See [Troubleshooting Step 2](#ts2).

## 🏋️ Practice Exercises

### Exercise 1: Add Delete Button (Easy)

**Goal:** Remove todos when clicked

**Starter code:**
```javascript
// TODO: Add function to delete todo by id
const deleteTodo = (id) => {
  // Your code here
};
```

<details>
<summary>💡 Hint</summary>

Use `.filter()` to create array without deleted item:
```javascript
setTodos(todos.filter(todo => todo.id !== id));
```
</details>

<details>
<summary>📝 Complete Solution</summary>

```javascript
const deleteTodo = (id) => {
  setTodos(todos.filter(todo => todo.id !== id));
};

// In JSX:
<li key={todo.id}>
  {todo.text}
  <button onClick={() => deleteTodo(todo.id)}>Delete</button>
</li>
```
</details>

## 🔧 Troubleshooting

### TS1: Project won't start

**Error:** "npm: command not found"

**Solution:**
1. Install Node.js from nodejs.org
2. Restart terminal
3. Verify: `node --version`

---

### TS2: Todos not appearing

**Symptom:** Click "Add" but nothing happens

**Debug:**
1. Open browser console (F12)
2. Check for errors (red text)

**Common causes:**
- ❌ Forgot `onClick={addTodo}` on button
- ❌ Used `onClick={addTodo()}` (calls immediately)
- ❌ Mutating state: `todos.push()` instead of `setTodos([...todos])`

**Verify state:**
- Install React DevTools extension
- Check Components → App → hooks
- Should see `todos` array updating

## 🎓 What's Next?

Great job! You've learned:
✅ React component structure
✅ useState hook
✅ Event handling
✅ List rendering

**Continue learning:**
- [Exercise 1](#ex1): Add delete functionality
- [My React Hooks Guide](#): Deep dive into hooks
- [Full App Tutorial](#): Build complete app

---

**Stuck? Questions?** Comment below!
```

## Final Tips

1. **Test everything**: Follow your own tutorial fresh to find gaps
2. **Show, don't tell**: Code examples > long explanations
3. **Anticipate errors**: Add troubleshooting before readers ask
4. **Celebrate progress**: Checkpoints build confidence
5. **Provide escape hatches**: Hints, solutions, troubleshooting
6. **Visual hierarchy**: Use headers, emoji, formatting for scanning
7. **Progressive disclosure**: Simple first, complexity later
8. **Multiple paths**: Reading, doing, debugging all teach
9. **Be encouraging**: Assume reader will succeed, guide them there
10. **Stay current**: Update for new versions, deprecated features
