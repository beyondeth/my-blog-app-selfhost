# Gemini CLI MCP Prompts Integration Guide

## 📋 Overview

The MCP Blog Server now provides **prompts** that Gemini CLI can access BEFORE generating markdown content. This solves the timing issue where Gemini was generating markdown before seeing quality guidelines.

## 🚀 How It Works

### 1. Prompt Discovery
When Gemini connects to the MCP server, it can discover available prompts:
- `markdown_quality_guidelines` - Professional writing standards
- `blog_post_template` - Structured template for posts  
- `improve_markdown` - Enhancement guidelines

### 2. Automatic Prompt Loading
The MCP protocol allows Gemini to:
1. List all available prompts via `prompts/list`
2. Retrieve specific prompts via `prompts/get`
3. Apply prompt guidelines BEFORE generating content

### 3. Pre-Generation Injection
Unlike post-processing, prompts are available to Gemini at the START of the conversation, ensuring:
- Consistent formatting from the beginning
- Proper code block language specification
- Emoji usage in headings
- Bold text for important terms
- Section dividers between major sections

## 🎯 Available Prompts

### 1. `markdown_quality_guidelines`
**Purpose**: Provides comprehensive markdown writing standards
**Key Guidelines**:
- 📋 Structure with clear H2/H3 headings
- 🎨 Emojis at start of H2 headings
- 💻 Code blocks with language identifiers
- **Bold** important terms (3-5 per document)
- --- Section dividers between major sections

### 2. `blog_post_template`
**Purpose**: Ready-to-use markdown template
**Structure**:
```markdown
## 📋 Introduction
## 🔍 Background/Context  
## 💡 Main Content
## 🎯 Conclusion
## 📚 References (Optional)
```

### 3. `improve_markdown`
**Purpose**: Checklist for enhancing existing markdown
**Quick Fixes**:
- Add language identifiers to code blocks
- Add emojis to H2 headings
- Bold important terms
- Add section dividers
- Ensure proper heading hierarchy

## 🔧 Gemini CLI Usage

### Automatic Usage
When Gemini CLI connects to the MCP server, it should:
1. Query available prompts on initialization
2. Load the `markdown_quality_guidelines` prompt
3. Apply guidelines to ALL markdown generation

### Example Gemini Command
```bash
# Gemini will automatically see the prompts when using the MCP server
gemini "Write a blog post about React hooks"

# The generated markdown will automatically follow:
# - Emoji in H2 headings ✅
# - Code blocks with language ✅  
# - Bold important terms ✅
# - Proper structure ✅
```

## 📊 Quality Comparison

### Before Prompts (Gemini Default)
```markdown
## Introduction
React hooks are functions...

```
const [count, setCount] = useState(0);
```
```

### After Prompts (With Guidelines)
```markdown
## 📋 Introduction
React hooks are **functions** that allow you to use state...

```javascript
const [count, setCount] = useState(0);
```
```

## 🎨 Key Improvements

1. **Emojis**: Visual appeal with relevant emojis in H2 headings
2. **Code Language**: All code blocks specify the language
3. **Emphasis**: Important terms are **bolded** for clarity
4. **Structure**: Consistent section organization with dividers
5. **Quality**: Professional, engaging content format

## 🧪 Testing

Run the test script to verify prompts are available:
```bash
node test-prompts.cjs
```

Expected output:
```
✅ Server initialized successfully
📋 Available Prompts:
  - markdown_quality_guidelines
  - blog_post_template
  - improve_markdown
✅ All prompts are working correctly!
```

## 🔄 How Gemini Should Use This

1. **On Connection**: Gemini CLI connects to MCP server
2. **Prompt Discovery**: Automatically discovers available prompts
3. **Load Guidelines**: Retrieves `markdown_quality_guidelines` 
4. **Apply Before Generation**: Uses guidelines as system prompt
5. **Generate Quality Content**: Creates markdown following all standards

## 📈 Expected Results

With these prompts, Gemini-generated markdown will:
- Match Claude's quality standards
- Have consistent formatting
- Include proper visual elements (emojis, bold text)
- Specify code block languages
- Include introduction and conclusion sections
- Use section dividers appropriately

## 🎯 Summary

The MCP prompts solve the fundamental timing issue by providing quality guidelines to Gemini BEFORE content generation, rather than trying to fix content after it's created. This ensures consistent, high-quality markdown output regardless of which AI generates the content.