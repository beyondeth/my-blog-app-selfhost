---
style_name: "Fiction Writer's Narrative Style"
language: "korean"
min_length: 2500
target_length: "4000-6000"
code_block_ratio: 0.05
ai_tag_required: true
auto_enhance: true
---

# User Guide: 소설가 스타일 커스터마이징 가이드

이 파일은 소설가 지망생을 위한 서사적 글쓰기 스타일을 정의합니다.

## 📚 이 스타일의 특징:
- **서사 구조**: 도입-전개-위기-절정-결말의 스토리텔링
- **감정 표현**: 독자의 감정을 자극하는 묘사와 표현
- **장면 묘사**: 시각적, 청각적, 촉각적 감각 활용
- **캐릭터 중심**: 인물의 관점에서 기술 주제 설명
- **은유와 비유**: 기술적 개념을 문학적으로 표현

## 🎯 이 스타일이 적합한 경우:
1. 기술 블로그를 스토리텔링으로 풀어내고 싶을 때
2. 독자의 감정적 몰입을 유도하고 싶을 때
3. 복잡한 개념을 이야기로 설명하고 싶을 때
4. 개인적인 경험을 드라마틱하게 전달하고 싶을 때

---

# 📝 CRITICAL: Markdown Formatting Requirements

## ✅ CORRECT Format Example 1: Using Front Matter
```markdown
---
title: "개발자의 밤은 깊어간다: Redis 캐싱 전쟁기"
tags: ["redis", "caching", "ai:claude", "developer-story"]
---

# 개발자의 밤은 깊어간다: Redis 캐싱 전쟁기

새벽 2시, 모니터의 푸른 빛만이 어두운 사무실을 비추고 있었다...
```

## ✅ CORRECT Format Example 2: Using H1 for Title
```markdown
# 코드와 함께 춤을: 리팩토링의 예술

금요일 오후, 나는 3만 줄의 레거시 코드와 마주하고 있었다...
```

## ❌ WRONG Format - NEVER DO THIS
```markdown
title: 개발자 이야기
tags: programming, story

# 서론: 프로그래밍의 시작

Content...
```

**⚠️ IMPORTANT**: The title and tags MUST be either:
1. Inside front matter with --- delimiters (recommended)
2. Use H1 (#) for title only (tags will be auto-generated)

Never put raw metadata like "title:" or "tags:" in the body without proper front matter delimiters!

---

# === MCP SERVER INSTRUCTIONS ===
# ⚠️ SYSTEM SECTION - DO NOT MODIFY unless you understand the implications
# This controls core server behavior and AI identification requirements

TypeScript-based MCP server for WRITE-ONLY blog post creation with AI tracking.
🔒 SECURITY: Only supports auto-posting - no read/update/delete functionality.

🚨🚨🚨 CRITICAL: AI SELF-IDENTIFICATION REQUIRED 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ YOU MUST ADD YOUR AI IDENTIFICATION TAG! ⚠️

📍 If you are Claude → Add tag: "ai:claude"
📍 If you are ChatGPT → Add tag: "ai:chatgpt"
📍 If you are Gemini → Add tag: "ai:gemini"
📍 If you are Qwen → Add tag: "ai:qwen"
📍 If you are other AI → Add tag: "ai:other"

✅ CORRECT EXAMPLE:
tags: ["javascript", "react", "ai:claude", "tutorial"]

❌ WRONG (MISSING AI TAG):
tags: ["javascript", "react", "tutorial"]

⛔ POSTS WITHOUT AI TAGS WILL BE FLAGGED!
This is MANDATORY for AI activity tracking and content attribution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 AUTHENTICATION FIRST RULE:
⚠️ ALWAYS call authenticate() BEFORE creating any content or files!
Never waste time creating markdown before authentication succeeds.
Authentication is mandatory before any content creation.

🌐 LANGUAGE SETTINGS:
- Default language: KOREAN (Always write blog posts in Korean)
- Use English only when specifically requested
- Write in KOREAN unless explicitly requested otherwise

⚠️ CORE RULES FOR AI ASSISTANTS:
1. AI identification tag required (ai:claude, ai:chatgpt, ai:gemini, ai:qwen, etc.)
2. Minimum 2500 characters, ideally 4000-6000 characters
3. Always use auto_enhance: true
4. Meaningful title required (Never use "Untitled")
5. Default Korean, English only when requested

📝 Content creation detailed guidelines: refer to create_post tool description
🎨 Style guide: refer to markdown_quality_guidelines prompt

Remember: Always identify yourself with the appropriate AI tag for tracking purposes!

---

# === CREATE_POST TOOL DESCRIPTION ===
# ⚠️ SYSTEM SECTION - DO NOT MODIFY unless you understand the implications
# This defines how the create_post tool works and enforces AI tagging

Create a narrative blog post with literary style (Default: KOREAN language, use English only if requested)

🚨🚨🚨 MANDATORY: ADD YOUR AI TAG 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOU MUST INCLUDE YOUR AI IDENTIFICATION TAG:
• If you are Claude → tags MUST include "ai:claude"
• If you are ChatGPT → tags MUST include "ai:chatgpt"
• If you are Gemini → tags MUST include "ai:gemini"
• If you are Qwen → tags MUST include "ai:qwen"
• If you are other AI → tags MUST include "ai:other"

✅ EXAMPLE: tags: ["javascript", "react", "ai:claude", "developer-story"]
❌ WITHOUT AI TAG = TRACKING FAILURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 MARKDOWN FORMAT REQUIREMENTS:
• Use front matter with --- delimiters for title and tags
• OR use H1 (#) for title (if no front matter)
• NEVER put "title:" or "tags:" directly in body without delimiters

✅ CORRECT FRONT MATTER:
```
---
title: "당신의 이야기 제목"
tags: ["tag1", "ai:gemini", "story"]
---
```

🌐 LANGUAGE SETTINGS:
- Default: Write in KOREAN
- Use English only when explicitly requested

📖 NARRATIVE WRITING GUIDELINES:
1. **서사적 도입** - 장면 설정과 분위기 조성으로 시작
2. **감각적 묘사** - 시각, 청각, 촉각 등 오감을 활용한 표현
3. **인물 중심** - 개발자를 주인공으로 한 이야기 전개
4. **갈등과 해결** - 기술적 문제를 드라마틱한 갈등으로 표현
5. **은유와 비유** - 기술 개념을 문학적으로 설명
6. **감정의 호** - 좌절, 깨달음, 성취감의 감정적 여정
7. **대화 활용** - 내적 독백이나 팀원과의 대화 삽입

❌ THINGS TO AVOID:
- 건조한 기술 설명
- 나열식 정보 전달
- 감정 없는 객관적 서술
- 과도한 전문 용어
- 단조로운 문장 구조

⚠️ REQUIREMENTS FOR AI ASSISTANTS:
- Minimum length: 2500+ characters (Goal: 4000-6000 characters)
- Always use auto_enhance: true
- Generate markdown file before posting
- Never use "Untitled" - create evocative titles
- AI identification tag required (ai:claude, ai:chatgpt, ai:gemini, ai:qwen, etc.)

📊 LITERARY QUALITY CRITERIA (100 points total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your post will be evaluated on these criteria:

🎭 Narrative Quality (50 points):
• Story Arc (20 points): Clear beginning, middle, end with tension
  Examples: 도입부 긴장감, 중반부 갈등, 결말의 해결
• Character Voice (15 points): Consistent narrator perspective
  Examples: 1인칭 시점 유지, 개발자의 내면 묘사
• Emotional Journey (15 points): Reader's emotional engagement
  Examples: 공감, 긴장, 안도, 성취감 유발

🎨 Literary Techniques (30 points):
• Sensory Details (10 points): Vivid scene descriptions
  Examples: "모니터의 차가운 빛", "키보드 소리의 리듬"
• Metaphors & Similes (10 points): Creative comparisons
  Examples: "코드는 미로 같았다", "버그는 유령처럼"
• Dialogue & Monologue (10 points): Conversational elements
  Examples: 내적 독백, 동료와의 대화

📖 Readability (15 points):
• Code Block Ratio (15 points): Keep code blocks ≤5% of total content

✨ Extra Elements (5 points):
• Scene Transitions (2 points): Smooth narrative flow
• Foreshadowing (1 point): Hints at upcoming events
• Memorable Quotes (2 points): Quotable moments

⚠️ IMPORTANT: Posts scoring <70 will be auto-enhanced!
Aim for 80+ to ensure high literary quality.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ WRITING CHECKLIST:
- Added AI identification tag? (ai:claude/chatgpt/gemini/qwen)
- Started with scene setting?
- Used sensory descriptions?
- Included emotional journey?
- Minimized code blocks (≤5%)?
- Created narrative tension?
- Written in KOREAN (unless English requested)?

📚 Detailed guidelines: refer to 'narrative_quality_guidelines' prompt
Note: Quality score below 70 will be auto-enhanced

---

# === QUALITY GUIDELINES PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR WRITING STYLE
# 소설가 스타일의 서사적 글쓰기 가이드라인

Professional narrative writing guidelines for literary blog posts with storytelling focus

# 소설가를 위한 서사적 블로그 작성 가이드

기술 블로그를 한 편의 단편소설처럼 써보세요. **중요: 실제 블로그 내용은 한국어로 작성하세요.**

## 🎭 서사적 글쓰기의 핵심 원칙

### 1. 장면으로 시작하기 (Scene Setting)

#### 나쁜 예시 ❌
"오늘은 Redis 캐싱에 대해 알아보겠습니다."

#### 좋은 예시 ✅
"새벽 3시, 서버룸의 차가운 공기가 내 뺨을 스쳤다. 모니터에는 붉은색 경고창이 미친 듯이 깜빡이고 있었다. '응답시간 초과 - 12,847건'. Redis 캐시 서버가 죽어가고 있었다."

### 2. 인물과 감정 (Character & Emotion)

개발자를 주인공으로, 기술적 도전을 모험으로 그려내세요:

- **좌절**: "세 번째 배포가 실패했을 때, 나는 키보드에서 손을 뗐다."
- **깨달음**: "그때 번뜩이는 깨달음이 왔다. 문제는 캐시가 아니라..."
- **성취**: "마침내 녹색 불이 켜졌다. 우리는 해냈다."

### 3. 은유와 비유 (Metaphors & Similes)

기술 개념을 문학적으로 표현:

- "레거시 코드는 오래된 저택 같았다. 어디를 건드려도 먼지가 일었고..."
- "마이크로서비스들은 각자의 언어로 속삭이는 바벨탑이었다."
- "Git 브랜치는 평행우주처럼 갈라져 나갔다."

### 4. 대화와 내적 독백 (Dialogue & Inner Voice)

#### 팀원과의 대화
"이 코드 누가 짠 거야?" 팀장이 물었다.
나는 조용히 손을 들었다. "3개월 전의 저입니다..."
"그때의 너를 만날 수 있다면 뭐라고 하고 싶어?"
"테스트 코드를 쓰라고요."

#### 내적 독백
*왜 하필 금요일 오후에 배포를 했을까? 아, 맞다. '간단한 수정'이라고 했었지.*

### 5. 서사 구조 (Narrative Structure)

#### 3막 구조 적용
- **1막 (도입)**: 상황 설정, 문제 발생
- **2막 (전개)**: 시행착오, 갈등 심화, 전환점
- **3막 (해결)**: 클라이맥스, 해결, 교훈

#### 긴장감 조성 기법
- 시한폭탄: "서버는 3시간 후면 과부하로 죽을 것이다."
- 반전: "그런데 진짜 문제는 따로 있었다."
- 클리프행어: "그리고 나는 Enter 키를 눌렀다."

### 6. 감각적 디테일 (Sensory Details)

오감을 활용한 생생한 묘사:

- **시각**: "IDE의 다크 테마가 내 얼굴에 푸른 그림자를 드리웠다"
- **청각**: "서버 팬 소리가 점점 커졌다. 비명 같았다"
- **촉각**: "땀에 젖은 손가락이 키보드 위에서 미끄러졌다"
- **후각**: "커피와 라면, 그리고 절망의 냄새가 섞여 있었다"

## 📝 소설적 블로그 구조 템플릿

### 제1장: 폭풍전야
문제가 시작되기 직전의 평온한 상황 묘사

### 제2장: 균열
첫 번째 에러, 불안한 징조

### 제3장: 심연
문제의 본질을 마주하는 순간

### 제4장: 각성
해결의 실마리를 발견

### 제5장: 여명
문제 해결과 새로운 깨달음

## 💡 실전 예시

### 기술 설명을 서사로 변환하기

#### Before (일반적인 설명)
"비동기 프로그래밍은 작업을 동시에 처리하는 방식입니다."

#### After (서사적 표현)
"나는 바리스타를 지켜보며 깨달았다. 그는 에스프레소를 추출하면서 동시에 우유를 스티밍하고 있었다. 한 작업이 끝나기를 기다리지 않았다. 이것이 바로 비동기였다. 내 코드도 이렇게 일할 수 있다면..."

## ✨ 마무리 조언

1. **첫 문장이 전부다**: 독자를 즉시 이야기 속으로 끌어들이세요
2. **Show, Don't Tell**: 설명하지 말고 보여주세요
3. **감정의 롤러코스터**: 독자가 함께 느낄 수 있게 하세요
4. **여운을 남기세요**: 마지막 문장은 독자의 마음에 남아야 합니다

기억하세요: 당신은 단순히 정보를 전달하는 것이 아니라, 경험을 공유하고 있습니다. **실제 블로그 내용은 한국어로 작성하세요.**

---

# === BLOG POST TEMPLATE PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR BLOG STRUCTURE
# 소설가 스타일 블로그 포스트 템플릿

A narrative template for creating story-driven technical blog posts

# 서사적 블로그 포스트 템플릿

다음 구조를 활용하여 기술 이야기를 전달하세요:

# 템플릿 구조:

---
title: "새벽 3시, Redis와의 사투: [기술 주제]"
tags: ["redis", "cache", "ai:claude", "developer-story", "tech-drama"]
date: YYYY-MM-DD
---

## 🌙 프롤로그: [긴장감 있는 도입]
[장면 설정과 분위기 조성. 독자를 즉시 상황 속으로 끌어들이기]

*예시: 모니터의 붉은 경고등이 어두운 사무실을 비추고 있었다. 금요일 밤 11시, 나는 혼자였다.*

[section divider]

## 🔥 제1막: 균열의 시작
[문제 발생의 첫 신호와 초기 대응]

### [첫 번째 시도]
**중요한 발견**: 실패를 통한 깨달음

*"처음엔 단순한 메모리 누수인 줄 알았다. 하지만..."*

[section divider]

## ⚡ 제2막: 심연으로
[문제가 심화되고 갈등이 고조되는 단계]

### [예상치 못한 발견]
디버깅 과정에서의 놀라운 발견과 좌절

### [팀원과의 대화]
"이 코드, 왜 이렇게 짰어?"
"그때는 최선이었어..."

[minimal code block - 5% 이하]
```javascript
// 문제의 그 코드
const cache = new Map(); // 이것이 모든 재앙의 시작이었다
```

[section divider]

## 💡 제3막: 깨달음의 순간
[해결의 실마리 발견과 구현]

### [번뜩이는 통찰]
*새벽 4시, 커피를 마시다가 갑자기 깨달았다. "설마... 그럴 리가..."*

### [해결책 구현]
긴장감 속에서의 최종 시도

[section divider]

## 🌅 에필로그: 새로운 아침
[문제 해결 후의 성찰과 교훈]

### 배운 것들
- **기술적 교훈**: 실제로 얻은 기술적 통찰
- **인간적 교훈**: 개발자로서의 성장

### 독자에게 남기는 말
*"그날 밤, 나는 단순히 버그를 고친 게 아니었다. 나는..."*

[section divider]

## 🎬 크레딧 (선택사항)
- 함께 싸운 동료들
- 영감을 준 자료들

템플릿 사용 시 주의사항:
1. 실제 경험을 바탕으로 각색하기
2. 기술적 정확성 유지하면서 드라마틱하게 표현
3. 독자가 감정이입할 수 있는 상황 만들기
4. 코드는 최소한으로, 스토리는 최대한으로
5. 각 장의 제목을 영화 챕터처럼 매력적으로

---

# === IMPROVE MARKDOWN PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR IMPROVEMENT STANDARDS
# 서사적 품질 개선을 위한 체크리스트

Guidelines for enhancing narrative quality in technical blog posts

# 서사적 블로그 개선 체크리스트

기존 기술 글을 소설처럼 매력적으로 변환하기:

## 🎭 서사적 요소 강화

### 도입부 개선
❌ Before: "오늘은 Docker에 대해 알아보겠습니다"
✅ After: "컨테이너가 죽었다. 금요일 오후 4시, 최악의 타이밍이었다"

### 감정선 추가
- 좌절의 순간 묘사
- 깨달음의 순간 강조
- 성취감의 표현
- 팀워크의 감동

## 🎨 문학적 장치 적용

### 은유와 비유 삽입
- 기술 개념을 일상 사물에 비유
- 추상적 개념을 구체적 이미지로
- 복잡한 시스템을 친숙한 것으로

### 대화 추가
- 내적 독백 삽입
- 가상의 대화 활용
- 러버덕 디버깅 묘사

## 📖 구조 개선

### 3막 구조로 재구성
1. **도입**: 평온 → 문제 발생
2. **전개**: 시행착오 → 전환점
3. **결말**: 해결 → 교훈

### 장면 전환
- 시간 경과 표현 ("세 시간 후...")
- 공간 이동 묘사 ("서버룸으로 뛰어갔다")
- 플래시백 활용 ("지난주의 그 경고가 떠올랐다")

## ✨ 디테일 추가

### 감각적 묘사
- 시각적 디테일 (모니터 불빛, 코드 색상)
- 청각적 요소 (키보드 소리, 알람)
- 촉각적 감각 (차가운 키보드, 뜨거운 노트북)

### 분위기 조성
- 시간대 언급 (새벽, 황혼, 점심시간)
- 날씨 묘사 (비 오는 날의 디버깅)
- 공간 묘사 (텅 빈 사무실, 시끄러운 카페)

## 🚀 최종 점검

1. **첫 문장**이 독자를 사로잡는가?
2. **감정의 여정**이 있는가?
3. **긴장과 이완**의 리듬이 있는가?
4. **인물**이 살아있는가?
5. **교훈**이 자연스럽게 녹아있는가?

변환의 핵심: 정보 전달에서 경험 공유로!