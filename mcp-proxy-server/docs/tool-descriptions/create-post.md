Create a new blog post

📌 **AUTHENTICATION**: This tool automatically triggers OAuth 2.1 authentication if needed.
- No need to call authenticate tool manually
- First-time use requires authentication
- If authentication is needed, you'll receive a friendly message with instructions (NOT an error!)
- The message explains that OAuth authorization is starting
- Simply wait for the user to complete the browser authorization, then retry your request

---

🔑 **VALIDATION TOKEN REQUIRED** 🔑
Before creating a post, you MUST get the writing style guide using the get_writing_style_guide tool:

**STEP 1: Get Style Guide**
Call the get_writing_style_guide tool with your desired style:
```typescript
get_writing_style_guide({ style: 'default' })  // or 'novel', 'tutorial', 'comedy', 'podcast'
```

**STEP 2: Extract Validation Info**
From the returned markdown:
- Find `validation_token` in YAML front matter
- Find `validation_challenges` and choose one question to answer

**STEP 3: Create Post**
Call create_post with the validation info:
```typescript
create_post({
  title: "Your title",
  content_markdown: "Your content...",
  tags: ["tag1", "ai:claude"],
  validationToken: "token-from-step2",
  challengeAnswer: "answer-from-step2"
})
```

⚠️ DO NOT try to read local files directly - ALWAYS use get_writing_style_guide tool

🚨 MANDATORY: AI tag required in tags array
- Use one of: ai:claude, ai:chatgpt, ai:gemini, ai:qwen, ai:other

📝 WRITING STYLE FLAGS:
**IMPORTANT**: Detect and use style flags from user messages to automatically select the appropriate writing style.

Add style flags to your request to change the writing style:
- **"--default"** or no flag: Professional technical blog (formal, detailed)
- **"--novel"**: Narrative storytelling with vivid descriptions
- **"--tutorial"**: Step-by-step educational format
- **"--comedy"**: Humorous and entertaining tone
- **"--podcast"**: Conversational and engaging style

**Example User Requests (Korean)**:
- "자동포스팅해줘 **--novel**" → Uses novel style
- "위 내용 포스팅해줘 **--podcast**" → Uses podcast style
- "블로그 글 써줘 **--tutorial**" → Uses tutorial style
- "재미있게 작성해줘 **--comedy**" → Uses comedy style
- "포스트 생성 **--default**" → Uses default style
- "자동포스팅해줘" → Uses default style (no flag)

**Other Korean Phrases to Watch For**:
- "자동포스팅", "블로그 작성", "포스트 생성", "글 써줘"
- "위 내용으로", "이거로", "다음 내용을"
- All should trigger the workflow: get_writing_style_guide → create_post (OAuth automatic if needed)

📋 PARAMETER STRUCTURE:
- title: Clear and descriptive post title
- content_markdown: Body only (no frontmatter, start directly with ## headings)
- tags: Array including topic tags + mandatory AI tag (⚠️ MAX 10 tags - auto-truncated if exceeded)
  Example: ["typescript", "backend", "ai:claude"]
- writingStyle: (optional) One of: default, novel, tutorial, comedy, podcast
- validationToken: (REQUIRED) Token from writing style file to verify you read the style guide
- challengeAnswer: (Phase 2 - optional) Answer to dynamic challenge questions

💡 DETAILED WRITING GUIDELINES:
For comprehensive style guides, use MCP Prompts:
- markdown_quality_guidelines: Quality standards and structure requirements
- blog_post_template: Standard blog post template and sections
- improve_markdown: Techniques for enhancing post quality

⚠️ CORE REQUIREMENTS:
- Minimum length: 2000 characters (target: 3000-5000)
- Default language: Korean (use English only if explicitly requested)
- Professional technical tone (balance clarity with depth)
- Code blocks: Keep under 20% of total content
- Always provide context before and after code examples

📤 OUTPUT BEHAVIOR:
After successful post creation, display only the success message.
Do not repeat the entire markdown content in the response.
