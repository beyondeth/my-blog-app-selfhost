---
style_name: "Tech Podcast Script Style"
language: "korean"
min_length: 2500
target_length: "3500-5000"
code_block_ratio: 0.05
ai_tag_required: true
auto_enhance: true
---

# User Guide: 테크 팟캐스트 스크립트 스타일 가이드

이 파일은 기술 블로그를 팟캐스트 에피소드 스크립트처럼 작성하는 스타일을 정의합니다.

## 🎙️ 이 스타일의 특징:
- **대화 형식**: 진행자와 게스트의 자연스러운 대화
- **구어체**: 말하듯이 자연스러운 문체
- **청취자 소통**: "여러분", "청취자 분들" 직접 호명
- **음성 지시문**: [웃음], [잠시 멈춤], [효과음] 표시
- **에피소드 구조**: 인트로-본론-아웃트로

## 🎯 이 스타일이 적합한 경우:
1. 팟캐스트 콘텐츠로 변환 예정인 글
2. 인터뷰 형식의 기술 설명
3. 대화로 풀어내는 복잡한 개념
4. 커뮤니티와 소통하는 친근한 콘텐츠

---

# 📝 CRITICAL: Markdown Formatting Requirements

## ✅ CORRECT Format Example 1: Using Front Matter
```markdown
---
title: "[EP.42] React 18의 모든 것 - 페이스북 개발자와의 대화"
tags: ["podcast", "react", "interview", "ai:claude", "tech-talk"]
---

# [EP.42] React 18의 모든 것 - 페이스북 개발자와의 대화

🎙️ **진행자**: 안녕하세요, 테크톡 팟캐스트의 진행자 김개발입니다...
```

## ✅ CORRECT Format Example 2: Using H1 for Title
```markdown
# 개발자 라디오 EP.7: 주니어가 묻고 시니어가 답하다

[인트로 음악]
**진행자**: 안녕하세요 여러분! 돌아온 개발자 라디오입니다...
```

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
tags: ["podcast", "react", "ai:claude", "tech-talk"]

❌ WRONG (MISSING AI TAG):
tags: ["podcast", "react", "interview"]

⛔ POSTS WITHOUT AI TAGS WILL BE FLAGGED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 AUTHENTICATION FIRST RULE:
⚠️ ALWAYS call authenticate() BEFORE creating any content!

🌐 LANGUAGE SETTINGS:
- Default language: KOREAN
- Use English only when explicitly requested

⚠️ CORE RULES FOR AI ASSISTANTS:
1. AI identification tag required
2. Minimum 2500 characters, ideally 3500-5000 characters
3. Always use auto_enhance: true
4. Episode-style title required
5. Default Korean, English only when requested

---

# === CREATE_POST TOOL DESCRIPTION ===
# ⚠️ SYSTEM SECTION - DO NOT MODIFY unless you understand the implications

Create a podcast script style blog post (Default: KOREAN)

🎙️ PODCAST SCRIPT GUIDELINES:
1. **대화 형식** - 진행자/게스트 또는 Q&A 형식
2. **구어체 사용** - "그쵸", "네", "아하" 등 자연스러운 말투
3. **청취자 참여** - 직접 호명하고 질문 던지기
4. **음성 지시문** - [웃음], [잠시 멈춤], [강조] 등
5. **시간 마커** - [00:00], [05:23] 등 타임스탬프
6. **에피소드 구조** - 인트로, 본론, 요약, 아웃트로
7. **친근한 톤** - 격식 없는 편안한 대화

❌ THINGS TO AVOID:
- 딱딱한 문어체
- 시각적 설명 (그림, 다이어그램 참조)
- 긴 코드 블록
- 복잡한 수식이나 도표
- 일방적 설명

📊 PODCAST QUALITY CRITERIA (100 points total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎙️ Conversational Quality (50 points):
• Natural Dialogue (20 points): 자연스러운 대화 흐름
• Voice Markers (15 points): [웃음], [잠시 멈춤] 등 5개 이상
• Audience Engagement (15 points): 청취자 호명 3회 이상

🎧 Audio Optimization (30 points):
• Verbal Clarity (15 points): 음성으로 이해하기 쉬운 설명
• Time Markers (10 points): 타임스탬프 활용
• Episode Structure (5 points): 명확한 시작과 끝

📖 Readability (15 points):
• Code Block Ratio (15 points): Keep code blocks ≤5%

✨ Extra Elements (5 points):
• Sponsor Mention Style (2 points)
• Call-to-Action (2 points)
• Next Episode Teaser (1 point)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

# === QUALITY GUIDELINES PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR WRITING STYLE

# 테크 팟캐스트 스크립트 작성 가이드

기술 콘텐츠를 귀로 듣는 라디오처럼! **실제 내용은 한국어로 작성하세요.**

## 🎙️ 팟캐스트 스크립트의 핵심

### 1. 에피소드 구조

#### 인트로 (1-2분)
```
[인트로 음악 페이드인]

진행자: 안녕하세요, 테크톡 팟캐스트입니다! 저는 여러분의 진행자 김코딩이구요.
게스트: 안녕하세요, 저는 오늘의 게스트 박개발입니다.

진행자: 오늘은 정말 흥미로운 주제를 준비했는데요.
        바로 'Rust가 메모리 안전성을 보장하는 방법'입니다.

[잠시 멈춤]

진행자: 근데 박개발님, Rust 써보신 적 있으세요?
게스트: 아... 사실 어제 처음 설치했어요. [웃음]
진행자: [웃음] 완벽한 타이밍이네요! 그럼 같이 배워가면서 이야기해봐요.
```

### 2. 대화체 변환 기법

#### 문어체 → 구어체
- ❌ "이러한 방식으로 구현됩니다"
- ✅ "이렇게 만들어지는 거예요"

- ❌ "다음과 같은 장점이 있습니다"
- ✅ "어떤 점이 좋냐면요"

- ❌ "결론적으로 말씀드리면"
- ✅ "한 마디로 정리하자면"

### 3. 음성 지시문 활용

#### 감정과 분위기
- [웃음] - 가벼운 농담 후
- [진지하게] - 중요한 포인트
- [놀란 목소리로] - 신기한 발견
- [잠시 멈춤] - 생각할 시간 제공
- [한숨] - 어려운 부분 설명 전

#### 강조와 속도
- [천천히] - 중요한 개념 설명
- [빠르게] - 부가 설명
- [강조] - 핵심 단어
- [속삭이듯] - 비밀 공유하듯

### 4. 청취자 참여 유도

#### 직접 호명
"여러분도 이런 경험 있으시죠?"
"청취자 분들, 잠깐 멈추고 생각해보세요."
"지금 운전 중이신 분들은 나중에 해보세요!"

#### 상상 유도
"자, 여러분이 서버 관리자라고 상상해보세요."
"새벽 3시에 전화가 울립니다. 서버가 다운됐대요."

#### 질문 던지기
"이럴 때 여러분은 어떻게 하시나요?"
"정답은... 광고 후에 알려드릴게요! [웃음]"

### 5. 복잡한 개념 설명법

#### 비유와 예시
**진행자**: "그니까 Docker가 뭐냐면요, 이사할 때 쓰는 포장 박스 같은 거예요."
**게스트**: "오, 좋은 비유네요!"
**진행자**: "집(서버)은 다르지만 박스(컨테이너) 안의 물건(앱)은 똑같잖아요?"
**게스트**: "아하! 그래서 'Works on my machine' 문제가 해결되는군요!"

#### 단계별 설명
**진행자**: "자, 천천히 하나씩 설명드릴게요."
**게스트**: "첫 번째로 뭘 해야 하죠?"
**진행자**: "일단 터미널을 열어요. 다들 따라하고 계시죠?"
**게스트**: "그 다음은요?"

### 6. 에피소드 마무리

#### 요약
"오늘 이야기한 내용 정리해드릴게요:
- 첫째, Rust는 소유권 시스템을 써요
- 둘째, 빌림 검사기가 메모리를 체크해요
- 셋째, 그래서 메모리 안전해요!"

#### Call-to-Action
"오늘 에피소드 재밌으셨나요?
구독과 좋아요 부탁드리고요,
질문이 있으시면 tech@podcast.com으로 보내주세요!"

#### 다음 예고
"다음 주에는 '왜 개발자들은 다크모드를 좋아할까?'라는
재미있는 주제로 찾아올게요!"

## 💡 코드 설명 요령

### 음성으로 코드 설명하기
```javascript
// 이런 긴 코드 대신
const result = array.filter(x => x > 0).map(x => x * 2).reduce((a, b) => a + b, 0);
```

**설명 방식:**
"배열에서 양수만 골라내고요, [잠시 멈춤]
각각 2배로 만든 다음에, [잠시 멈춤]
다 더하는 거예요. 체이닝으로 한 줄에 끝!"

---

# === BLOG POST TEMPLATE PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR BLOG STRUCTURE

# 팟캐스트 에피소드 템플릿

---
title: "[EP.XX] 제목 - 게스트 이름과 함께"
tags: ["podcast", "topic", "ai:claude", "tech-talk", "episode-XX"]
date: YYYY-MM-DD
---

## 🎙️ 에피소드 정보
- **에피소드**: EP.XX
- **게스트**: 홍길동 (회사/직책)
- **녹음일**: 2024년 X월 X일
- **재생시간**: 약 35분

---

## [00:00] 인트로

[인트로 음악]

**진행자**: 안녕하세요, 여러분! 테크톡 팟캐스트의 [진행자 이름]입니다.
오늘도 저희 팟캐스트를 찾아주셔서 감사해요!

**게스트**: 안녕하세요, [자기소개]

**진행자**: 오늘은 정말 흥미로운 주제를 가지고 왔는데요...

---

## [02:30] 오늘의 주제 소개

**진행자**: 자, 오늘 우리가 이야기할 주제는 '[주제]'입니다.
청취자 분들, 이거 궁금하셨죠?

**게스트**: 네, 사실 이 주제가 왜 중요하냐면요...

[잠시 멈춤]

**진행자**: 잠깐, 그 전에 청취자 분들을 위해 기초부터 설명해주실 수 있을까요?

---

## [05:00] 본격적인 대화 시작

### 파트 1: 기본 개념

**게스트**: 그러니까 쉽게 말해서요...
[구체적인 설명]

**진행자**: 아하! [놀란 목소리로] 그렇군요!
근데 저희 청취자 분들이 궁금해할 것 같은데...

### 파트 2: 실제 경험 공유

**진행자**: 실제로 이걸 적용해보신 경험이 있으신가요?

**게스트**: 아, 재밌는 에피소드가 있는데요... [웃음]
[경험담 공유]

**진행자**: [웃음] 정말 그런 일이 있었군요!

---

## [15:00] 깊이 있는 토론

**진행자**: 좀 더 기술적으로 들어가볼까요?

**게스트**: 네, 이 부분은 좀 복잡한데요...
[천천히] 하나씩 설명드릴게요.

**진행자**: 청취자 분들, 어렵더라도 끝까지 들어주세요!
정말 중요한 내용이거든요.

---

## [25:00] Q&A 섹션

**진행자**: 청취자 분들이 보내주신 질문이 있는데요.
"초보자는 어떻게 시작하면 좋을까요?"

**게스트**: 아, 좋은 질문이네요! 제가 추천드리는 건...

---

## [30:00] 마무리

### 핵심 정리

**진행자**: 오늘 이야기 정리해보면:
1. 첫째, [핵심 포인트]
2. 둘째, [핵심 포인트]
3. 셋째, [핵심 포인트]

**게스트**: 네, 맞아요. 그리고 한 가지 더 덧붙이자면...

### 리소스 공유

**진행자**: 더 공부하고 싶으신 분들을 위해서
쇼노트에 링크 남겨둘게요!

---

## [33:00] 아웃트로

**진행자**: 오늘도 좋은 이야기 나눠주신 [게스트 이름]님,
정말 감사합니다!

**게스트**: 초대해주셔서 감사해요! 재밌었습니다.

**진행자**: 청취자 여러분, 오늘 에피소드 어떠셨나요?
궁금한 점이나 다음에 듣고 싶은 주제가 있다면
podcast@techtalks.com으로 메일 보내주세요!

[아웃트로 음악]

**진행자**: 그럼 다음 주에 또 만나요! 안녕~!

---

## 📎 쇼노트

### 이번 에피소드에서 언급된 자료
- [링크1]: 설명
- [링크2]: 설명
- [링크3]: 설명

### 게스트 정보
- Twitter: @username
- Blog: blog.url.com
- GitHub: github.com/username

### 다음 에피소드 예고
"[다음 주제]" - [게스트 이름]과 함께

---

## 💌 피드백 & 구독

이 팟캐스트가 도움이 되셨다면:
- 🎧 팟캐스트 구독하기
- ⭐ 별점 남기기
- 💬 리뷰 작성하기
- 📧 피드백 보내기

*음악 제공: [음원 출처]*

---

# === IMPROVE MARKDOWN PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR IMPROVEMENT STANDARDS

# 팟캐스트 스타일 개선 체크리스트

## 🎙️ 대화감 강화

### 문어체를 구어체로
❌ Before: "이것은 중요한 개념입니다"
✅ After: "이거 정말 중요해요, 여러분"

### 음성 지시문 추가
❌ Before: "다음으로 설명드리겠습니다"
✅ After: "[잠시 멈춤] 자, 이제 다음 이야기로 넘어갈게요"

### 청취자 호명
❌ Before: "이 기능은 유용합니다"
✅ After: "여러분도 이 기능 써보시면 정말 편할 거예요"

## 🎧 오디오 최적화

### 시각적 요소 제거
- 도표 → 말로 설명
- 그림 참조 → 비유로 대체
- 코드 블록 → 핵심만 언급

### 타임스탬프 추가
- 주요 섹션마다 [XX:XX] 표시
- 5-10분 단위로 구분
- 핵심 내용 시작점 명시

## 📊 에피소드 구조

### 필수 요소 체크
- [ ] 인트로 (자기소개, 주제 소개)
- [ ] 본론 (대화 형식)
- [ ] Q&A 또는 팁
- [ ] 요약 정리
- [ ] 아웃트로 (다음 예고, CTA)

전달 방식: 귀로 듣기 편하게!