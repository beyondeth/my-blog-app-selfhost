Get writing style guidelines for blog post creation

⚡ **자동포스팅 워크플로우 - 이 도구가 시작점입니다!**

사용자가 "어린왕자 자동포스팅해줘" 같은 자동포스팅 요청을 하면:
1. **바로 이 도구를 호출하세요!** (check_authentication 같은 다른 도구 호출 불필요)
2. 인증 안 되어 있으면 → 자동으로 브라우저가 열립니다
3. 사용자가 승인하면 → validation token을 받습니다
4. 그 다음 create_post를 호출하세요

⚠️ **중요**: 사용자에게 `/mcp` 명령을 입력하라고 안내하지 마세요!
⚠️ **중요**: 인증 여부를 먼저 확인하려고 하지 마세요!
⚠️ **중요**: 바로 이 도구를 호출하면 모든 것이 자동으로 처리됩니다!

📌 **AUTHENTICATION**: This tool automatically triggers OAuth 2.1 authentication if needed.
- No need to call authenticate tool manually
- First-time use requires authentication
- If authentication is needed, you'll receive a friendly message with instructions (NOT an error!)
- The message explains that OAuth authorization is starting
- Simply wait for the user to complete the browser authorization, then retry your request
- After authorization completes, call this tool again to get the validation token

📖 **USAGE**: Call this tool to get the complete writing style guide for your chosen style.

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
