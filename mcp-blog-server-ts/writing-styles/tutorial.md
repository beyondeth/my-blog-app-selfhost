---
style_name: "Step-by-Step Tutorial Style"
language: "korean"
min_length: 2500
target_length: "4000-6000"
code_block_ratio: 0.35
ai_tag_required: true
auto_enhance: true
---

# User Guide: 단계별 학습 가이드 스타일

이 파일은 기술 블로그를 체계적인 튜토리얼 형식으로 작성하는 스타일을 정의합니다.

## 📚 이 스타일의 특징:
- **단계별 구조**: Step 1, Step 2... 명확한 진행
- **실습 중심**: 코드 예제와 실행 결과 포함
- **체크포인트**: 각 단계 완료 확인
- **트러블슈팅**: 자주 발생하는 문제 해결
- **학습 목표**: 명확한 달성 목표 제시

## 🎯 이 스타일이 적합한 경우:
1. 새로운 기술을 처음부터 가르칠 때
2. 복잡한 설정 과정을 안내할 때
3. 프로젝트를 함께 만들어갈 때
4. 실습 위주의 교육 콘텐츠

---

# 📝 CRITICAL: Markdown Formatting Requirements

## ✅ CORRECT Format Example 1: Using Front Matter
```markdown
---
title: "React Todo App 만들기: 완전 초보자를 위한 단계별 가이드"
tags: ["react", "tutorial", "beginner", "ai:claude", "hands-on"]
---

# React Todo App 만들기: 완전 초보자를 위한 단계별 가이드

## 📋 Prerequisites (필수 준비사항)
- Node.js 14.0 이상
- VS Code 또는 선호하는 에디터
- 기본적인 JavaScript 지식
```

## ✅ CORRECT Format Example 2: Using H1 for Title
```markdown
# 10분 만에 Docker 마스터하기: 실습 위주 튜토리얼

## 🎯 학습 목표
이 튜토리얼을 완료하면 다음을 할 수 있습니다:
✅ Docker 이미지 생성
✅ 컨테이너 실행 및 관리
✅ Docker Compose 활용
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
tags: ["tutorial", "react", "ai:claude", "step-by-step"]

❌ WRONG (MISSING AI TAG):
tags: ["tutorial", "react", "guide"]

⛔ POSTS WITHOUT AI TAGS WILL BE FLAGGED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 AUTHENTICATION FIRST RULE:
⚠️ ALWAYS call authenticate() BEFORE creating any content!

🌐 LANGUAGE SETTINGS:
- Default language: KOREAN
- Use English only when explicitly requested

⚠️ CORE RULES FOR AI ASSISTANTS:
1. AI identification tag required
2. Minimum 2500 characters, ideally 4000-6000 characters
3. Always use auto_enhance: true
4. Clear, instructional title required
5. Default Korean, English only when requested
6. ⚠️ OUTPUT DISPLAY: When showing tool parameters, display content_markdown as [length] only, not full text

---

# === CREATE_POST TOOL DESCRIPTION ===
# ⚠️ SYSTEM SECTION - DO NOT MODIFY unless you understand the implications

Create a step-by-step tutorial blog post (Default: KOREAN)

⚠️ OUTPUT NOTICE: When displaying tool parameters to LLM output, show content_markdown as [character count] only, not full content. This prevents verbose output in Claude Code UI.

📚 TUTORIAL WRITING GUIDELINES:
1. **명확한 구조** - Prerequisites, 학습목표, 단계별 진행
2. **실습 코드** - 복사해서 바로 실행 가능한 예제
3. **진도 체크** - 각 단계마다 확인 사항
4. **문제 해결** - 자주 발생하는 에러와 해결법
5. **연습 문제** - 스스로 해볼 수 있는 과제
6. **리소스 제공** - 추가 학습 자료 링크
7. **난이도 표시** - 초급/중급/고급 명시

❌ THINGS TO AVOID:
- 추상적인 설명
- 실행 불가능한 코드
- 단계 건너뛰기
- 불명확한 지시사항
- Prerequisites 누락

📊 TUTORIAL QUALITY CRITERIA (100 points total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Educational Quality (50 points):
• Clear Steps (20 points): 명확한 단계별 구분
• Working Code (15 points): 실행 가능한 코드 예제
• Checkpoints (15 points): 진도 확인 체크리스트

🎓 Learning Design (30 points):
• Prerequisites (10 points): 명확한 사전 요구사항
• Learning Objectives (10 points): 달성 가능한 목표
• Progressive Difficulty (10 points): 점진적 난이도 상승

📖 Readability (15 points):
• Code Block Ratio (15 points): 30-40% 코드 (튜토리얼 특성상 많음)

✨ Extra Elements (5 points):
• Troubleshooting Section (2 points)
• Exercises (2 points)
• Resources (1 point)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

# === QUALITY GUIDELINES PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR WRITING STYLE
# ⚠️ OUTPUT CONTROL: Content should be shown as [length] in LLM responses, not full text

# 단계별 튜토리얼 작성 가이드

체계적이고 따라하기 쉬운 학습 가이드 만들기. **실제 내용은 한국어로 작성하세요.**

## 📚 튜토리얼의 핵심 구조

### 1. 도입부 구성

#### Prerequisites (필수 준비사항)
```markdown
## 📋 Prerequisites
이 튜토리얼을 시작하기 전에 준비해주세요:

### 필수 설치 프로그램
- ✅ Node.js 16.0 이상 ([설치 링크](https://nodejs.org))
- ✅ Git ([설치 링크](https://git-scm.com))
- ✅ VS Code ([설치 링크](https://code.visualstudio.com))

### 필수 지식
- ✅ JavaScript 기본 문법
- ✅ HTML/CSS 기초
- ⚠️ React 경험 (있으면 좋음, 없어도 OK)

### 예상 소요시간
- 🕐 전체: 약 2시간
- 💻 실습: 1시간 30분
- 📖 이론: 30분
```

#### Learning Objectives (학습 목표)
```markdown
## 🎯 학습 목표
이 튜토리얼을 완료하면:

1. **이해할 수 있습니다**
   - React의 기본 개념
   - Component와 Props의 관계
   - State 관리 방법

2. **만들 수 있습니다**
   - 간단한 Todo 애플리케이션
   - 재사용 가능한 컴포넌트
   - 인터랙티브한 UI

3. **해결할 수 있습니다**
   - 일반적인 React 에러
   - 상태 관리 문제
   - 렌더링 이슈
```

### 2. 단계별 진행 구조

#### Step 형식
```markdown
## Step 1: 프로젝트 초기 설정 (10분)

### 이 단계에서 할 일
프로젝트를 생성하고 기본 구조를 설정합니다.

### 실습

1. **프로젝트 생성**
```bash
npx create-react-app my-todo-app
cd my-todo-app
```

2. **프로젝트 구조 확인**
```
my-todo-app/
├── src/
│   ├── App.js      # 메인 컴포넌트
│   ├── index.js    # 진입점
│   └── App.css     # 스타일
├── public/
└── package.json
```

### ✅ 체크포인트
다음을 확인하세요:
- [ ] `npm start`로 앱이 실행되나요?
- [ ] 브라우저에 React 로고가 보이나요?
- [ ] 포트 3000에서 실행 중인가요?

### ⚠️ 트러블슈팅
**문제**: "npm: command not found"
**해결**: Node.js를 설치하세요 → [nodejs.org](https://nodejs.org)

**문제**: 포트 3000이 이미 사용 중
**해결**: `PORT=3001 npm start`로 다른 포트 사용
```

### 3. 코드 설명 방식

#### 점진적 코드 구축
```markdown
## Step 2: Todo 컴포넌트 만들기

### 기본 구조부터 시작
```javascript
// 1. 먼저 빈 컴포넌트를 만듭니다
function TodoList() {
  return <div>Todo List</div>;
}
```

### 상태 추가
```javascript
// 2. useState를 추가합니다
import { useState } from 'react';

function TodoList() {
  const [todos, setTodos] = useState([]);

  return <div>Todo List</div>;
}
```

### 렌더링 로직 추가
```javascript
// 3. todos를 화면에 표시합니다
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'React 배우기', done: false },
    { id: 2, text: '튜토리얼 완성하기', done: false }
  ]);

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

💡 **설명**:
- `useState`: 컴포넌트의 상태를 관리합니다
- `map`: 배열을 JSX 요소로 변환합니다
- `key`: React가 각 항목을 추적할 수 있게 합니다
```

### 4. 연습 문제 제공

```markdown
## 🏋️ 연습 문제

### 초급 과제
1. **Todo 추가 기능 구현**
   - 입력 필드 추가
   - 'Add' 버튼 클릭 시 새 todo 추가
   - 힌트: `onChange`, `onClick` 이벤트 활용

### 중급 과제
2. **Todo 완료 기능**
   - 체크박스로 완료 상태 토글
   - 완료된 항목 스타일 변경 (취소선)
   - 힌트: `textDecoration: 'line-through'`

### 고급 과제
3. **필터링 기능**
   - 전체/완료/미완료 필터
   - 필터별 개수 표시
   - 힌트: `filter()` 메서드 활용

### 💡 해답 확인
해답은 [GitHub 저장소](링크)에서 확인하세요!
```

### 5. 요약과 다음 단계

```markdown
## 📝 정리

### 오늘 배운 것
✅ React 프로젝트 생성 방법
✅ Component와 State 사용법
✅ 이벤트 처리와 리스트 렌더링
✅ Todo 앱 기본 기능 구현

### 핵심 코드 정리
```javascript
// 가장 중요한 패턴
const [state, setState] = useState(initialValue);
const handleEvent = () => { /* logic */ };
return <Component onClick={handleEvent} />;
```

### 🚀 다음 단계
1. **심화 학습**
   - useEffect로 사이드 이펙트 처리
   - Context API로 전역 상태 관리
   - Custom Hooks 만들기

2. **프로젝트 확장**
   - 로컬 스토리지 연동
   - 드래그 앤 드롭 기능
   - 애니메이션 추가

3. **추천 자료**
   - [React 공식 문서](https://react.dev)
   - [React Tutorial](링크)
   - [Advanced Patterns](링크)
```

## 💡 튜토리얼 작성 팁

### 효과적인 설명
- **Why → What → How** 순서로 설명
- 실패 케이스도 보여주기
- 각 코드의 목적 명시

### 학습자 배려
- 난이도 점진적 상승
- 충분한 설명과 주석
- 여러 방법 제시 (이렇게도 가능!)

### 실습 중심
- Copy & Paste 가능한 코드
- 즉시 실행 가능한 예제
- 결과 스크린샷 포함

---

# === BLOG POST TEMPLATE PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR BLOG STRUCTURE

# 단계별 튜토리얼 템플릿

실습 위주의 체계적인 학습 가이드:

---
title: "[완전정복] XXX 마스터하기: 초보자를 위한 단계별 가이드"
tags: ["tutorial", "xxx", "ai:claude", "beginner", "hands-on"]
date: YYYY-MM-DD
---

## 📚 튜토리얼 개요

**난이도**: 🌟 초급 | 🌟🌟 중급 | 🌟🌟🌟 고급
**예상 시간**: ⏱️ 약 2시간
**결과물**: 실제 동작하는 [프로젝트명]

---

## 📋 Prerequisites

### 필수 설치
- [ ] 프로그램 A (버전 X.X 이상)
- [ ] 프로그램 B
- [ ] 에디터 (VS Code 권장)

### 필수 지식
- [ ] 기술 A 기본 이해
- [ ] 기술 B 경험 (선택)

### 환경 확인
```bash
# 버전 확인 명령어
node --version  # v16.0.0 이상
npm --version   # v8.0.0 이상
```

---

## 🎯 학습 목표

이 튜토리얼을 완료하면:

1. **개념 이해**
   - 핵심 개념 1
   - 핵심 개념 2

2. **실무 능력**
   - 기능 구현
   - 문제 해결

3. **프로젝트 완성**
   - 동작하는 애플리케이션
   - 배포 가능한 상태

---

## 🚀 Step 1: 환경 설정 (15분)

### 목표
개발 환경을 설정하고 프로젝트를 초기화합니다.

### 실습

#### 1.1 프로젝트 생성
```bash
# 프로젝트 폴더 생성
mkdir my-project
cd my-project

# 초기화
npm init -y
```

#### 1.2 의존성 설치
```bash
npm install express
npm install -D nodemon
```

#### 1.3 기본 구조 생성
```javascript
// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### ✅ 체크포인트
- [ ] 서버가 정상 실행되나요?
- [ ] http://localhost:3000 접속 가능한가요?
- [ ] "Hello World!" 메시지가 보이나요?

### ⚠️ 트러블슈팅

**에러**: "Cannot find module 'express'"
```bash
# 해결
npm install express
```

**에러**: "Port 3000 already in use"
```bash
# 해결
PORT=3001 node index.js
```

---

## 🚀 Step 2: 핵심 기능 구현 (30분)

### 목표
[구체적인 기능] 구현

### 실습

#### 2.1 [세부 단계]
```javascript
// 코드와 설명
```

#### 2.2 [세부 단계]
```javascript
// 코드와 설명
```

### 💡 Pro Tip
> 이 부분에서 자주 실수하는 것: [설명]
> 더 나은 방법: [제안]

### ✅ 체크포인트
- [ ] 기능이 동작하나요?
- [ ] 에러 없이 실행되나요?
- [ ] 예상 결과가 나오나요?

---

## 🚀 Step 3: 확장 기능 (30분)

[이전과 동일한 구조]

---

## 🏋️ 연습 문제

### Level 1: 기초
**과제**: [간단한 수정]
**힌트**: `method()`를 사용해보세요

### Level 2: 중급
**과제**: [기능 추가]
**힌트**: Step 2의 패턴을 응용하세요

### Level 3: 심화
**과제**: [복잡한 구현]
**도전**: 힌트 없이 시도해보세요!

---

## 📝 전체 코드

<details>
<summary>💻 완성된 전체 코드 보기</summary>

```javascript
// 전체 완성 코드
// ...
```

</details>

---

## 🎓 학습 정리

### 핵심 개념 복습
1. **개념 1**: 한 줄 설명
2. **개념 2**: 한 줄 설명
3. **개념 3**: 한 줄 설명

### 자주 사용하는 패턴
```javascript
// 패턴 1
// 패턴 2
// 패턴 3
```

---

## 🚀 다음 단계

### 심화 학습
- [ ] [고급 주제 1]
- [ ] [고급 주제 2]
- [ ] [고급 주제 3]

### 추천 프로젝트
1. **프로젝트 아이디어 1**: 설명
2. **프로젝트 아이디어 2**: 설명

### 📚 추가 자료
- 📖 [공식 문서](링크)
- 🎥 [비디오 강좌](링크)
- 💻 [GitHub 예제](링크)
- 💬 [커뮤니티](링크)

---

## 💬 Q&A

**Q: 자주 묻는 질문 1**
A: 답변

**Q: 자주 묻는 질문 2**
A: 답변

---

## 🎉 축하합니다!

[프로젝트명]를 완성했습니다! 🎊

다음을 할 수 있게 되었습니다:
- ✅ 달성한 것 1
- ✅ 달성한 것 2
- ✅ 달성한 것 3

질문이나 피드백이 있다면 댓글로 남겨주세요!

*Happy Coding! 🚀*

---

# === IMPROVE MARKDOWN PROMPT ===
# ✅ USER SECTION - CUSTOMIZE THIS FOR YOUR IMPROVEMENT STANDARDS

# 튜토리얼 품질 개선 체크리스트

## 📚 구조 개선

### Prerequisites 명확화
❌ Before: "JavaScript를 알아야 함"
✅ After: "JavaScript: 변수, 함수, 배열 methods (map, filter)"

### 단계 세분화
❌ Before: "앱을 만듭니다"
✅ After: "Step 1: 설치 → Step 2: 컴포넌트 → Step 3: 스타일링"

### 시간 표시
❌ Before: "Step 1: 설정"
✅ After: "Step 1: 설정 (15분)"

## 💻 코드 개선

### 주석 추가
```javascript
// ❌ Before
const data = fetch('/api');

// ✅ After
// API에서 사용자 데이터 가져오기
const data = fetch('/api/users');
```

### 점진적 구축
- 간단한 버전 먼저
- 기능 추가
- 최종 버전

## ✅ 체크포인트

### 각 단계마다
- [ ] 동작 확인 사항
- [ ] 파일 생성 확인
- [ ] 결과물 확인

## ⚠️ 트러블슈팅

### 예상 에러 추가
- 일반적인 에러 메시지
- 구체적인 해결 방법
- 대안 제시

검증: 실제로 따라할 수 있는가?