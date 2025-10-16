⚠️ **AUTHENTICATION REQUIRED**: You must call the `authenticate` tool FIRST and wait for authentication to complete before calling this tool.

Get writing style guidelines for blog post creation

📖 **USAGE**: Call this tool AFTER authentication to get the complete writing style guide for your chosen style.

**What you get:**
- Complete markdown content with style guidelines
- `validation_token` in YAML front matter (required for create_post)
- `validation_challenges` in YAML front matter (questions and answers)
- Detailed writing instructions and examples

**Parameters:**
- style: One of 'default', 'novel', 'tutorial', 'comedy', 'podcast' (default: 'default')

🎨 **WRITING STYLE FLAGS DETECTION**:
When users include style flags in their requests, detect and use them:
- **"--default"** or no flag → style: 'default' (Professional technical blog)
- **"--novel"** → style: 'novel' (Narrative storytelling with vivid descriptions)
- **"--tutorial"** → style: 'tutorial' (Step-by-step educational format)
- **"--comedy"** → style: 'comedy' (Humorous and entertaining tone)
- **"--podcast"** → style: 'podcast' (Conversational and engaging style)

**Example User Requests**:
- "자동포스팅해줘 **--novel**" → Call with `{ style: 'novel' }`
- "위 내용으로 블로그 작성해줘 **--podcast**" → Call with `{ style: 'podcast' }`
- "튜토리얼 형식으로 포스팅 부탁해 **--tutorial**" → Call with `{ style: 'tutorial' }`
- "재미있게 써줘 **--comedy**" → Call with `{ style: 'comedy' }`
- "자동포스팅해줘" → Call with `{ style: 'default' }` (or omit parameter)

**Workflow:**
1. Detect style flag from user message (e.g., "--novel")
2. Call: get_writing_style_guide({ style: 'novel' })
3. Extract validation_token from YAML front matter
4. Choose one validation_challenge and find its answer
5. Use both when calling create_post with writingStyle: 'novel'

⚠️ This is the ONLY way to get style guidelines - do NOT try to read local files directly.
