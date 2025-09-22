# 📚 Writing Style Customization Guide

## 🎨 Writing Style System Overview

MCP Blog Server는 다양한 글쓰기 스타일을 지원하는 유연한 커스터마이징 시스템을 제공합니다.

### 시스템 구조

```
writing-styles/
├── default.md         # 기본 블로그 스타일
├── novel.md          # 소설가 스타일 (예제)
├── marketing.md      # 마케팅 카피 스타일
├── academic.md       # 학술 논문 스타일
└── technical.md      # 기술 문서 스타일
```

### 🔧 작동 원리

1. **스타일 파일 선택**: 환경 변수로 사용할 스타일 파일 지정
2. **파라미터 적용**: 각 스타일 파일의 설정값이 글 생성에 반영
3. **품질 평가**: 스타일별 맞춤 평가 기준 적용

---

## 📖 스타일 파일 구조

각 스타일 파일은 다음 섹션으로 구성됩니다:

### 1️⃣ **Configuration Header** (설정 메타데이터)
```yaml
---
style_name: "스타일 이름"
language: "korean"
min_length: 2000
target_length: "3000-5000"
code_block_ratio: 0.2      # 코드 블록 비율 (0.0-1.0)
ai_tag_required: true      # AI 태그 필수 여부
auto_enhance: true         # 자동 품질 개선 여부
---
```

### 2️⃣ **System Sections** (시스템 섹션 - 수정 주의)
- MCP 서버 동작 제어
- AI 식별 태그 규칙
- 마크다운 형식 요구사항

### 3️⃣ **User Customizable Sections** (사용자 커스터마이징 섹션)
- **Quality Guidelines**: 글쓰기 가이드라인과 품질 기준
- **Blog Post Template**: 글 구조 템플릿
- **Improvement Checklist**: 개선 체크리스트

---

## 🎯 커스터마이징 방법

### Step 1: 새 스타일 파일 생성

```bash
# 기존 스타일을 복사하여 시작
cp writing-styles/default.md writing-styles/my-style.md
```

### Step 2: Configuration 수정

```yaml
---
style_name: "My Custom Style"
language: "korean"          # 또는 "english"
min_length: 1500            # 최소 글자 수
target_length: "2500-4000"  # 목표 글자 수
code_block_ratio: 0.1       # 코드 10% 이하
ai_tag_required: true
auto_enhance: true
---
```

### Step 3: 품질 가이드라인 수정

USER SECTION 3개를 수정:
1. **Quality Guidelines**: 글쓰기 원칙과 스타일
2. **Blog Post Template**: 글 구조와 섹션
3. **Improvement Checklist**: 품질 체크리스트

### Step 4: 환경 변수 설정

```bash
# .env 파일에 추가
WRITING_STYLE_FILE=writing-styles/my-style.md
```

### Step 5: MCP 서버 재시작

---

## 📚 스타일 예제

### 🎭 소설가 스타일 (novel.md)
- **특징**: 서사 중심, 감정 표현 강조, 장면 묘사
- **구조**: 도입-전개-위기-절정-결말
- **문체**: 은유, 비유, 감각적 표현 활용

### 📈 마케팅 스타일 (marketing.md)
- **특징**: 설득력, 행동 유도, 이익 중심
- **구조**: 문제-해결책-이익-CTA
- **문체**: 간결하고 임팩트 있는 표현

### 🎓 학술 스타일 (academic.md)
- **특징**: 객관성, 논리성, 근거 기반
- **구조**: 서론-이론-방법론-결과-고찰
- **문체**: 정확하고 중립적인 어조

### 💻 기술 문서 스타일 (technical.md)
- **특징**: 명확성, 구체성, 실용성
- **구조**: 개요-설치-사용법-API-FAQ
- **문체**: 간단명료, 코드 예제 중심

---

## 🔍 커스터마이징 팁

### 효과적인 스타일 설계

1. **목적 명확화**: 글의 목적과 독자층 정의
2. **톤 일관성**: 전체적으로 일관된 어조 유지
3. **구조 체계화**: 논리적인 흐름 설계
4. **평가 기준 맞춤화**: 스타일에 맞는 품질 기준 설정

### 피해야 할 것들

- ❌ System Section 무분별한 수정
- ❌ 마크다운 형식 규칙 위반
- ❌ AI 태그 규칙 제거
- ❌ 최소 길이 요구사항 무시

### 테스트 방법

1. 스타일 파일 생성 후 환경변수 설정
2. MCP 서버 재시작
3. 간단한 글 생성 테스트
4. 생성된 글의 스타일 확인
5. 필요시 파라미터 조정

---

## 🚀 고급 커스터마이징

### 다국어 지원
```yaml
language: "english"  # 또는 "korean", "japanese", etc.
```

### 동적 스타일 전환
```javascript
// 환경변수를 런타임에 변경
process.env.WRITING_STYLE_FILE = 'writing-styles/novel.md';
```

### 스타일 조합
여러 스타일의 요소를 결합하여 하이브리드 스타일 생성 가능

---

## 📝 예제: 소설가 스타일 적용

### Before (기본 스타일)
"오늘은 React 성능 최적화에 대해 알아보겠습니다. 먼저 useMemo를 활용한 방법을..."

### After (소설가 스타일)
"개발자의 모니터에 붉은 경고창이 떴다. 렌더링 시간 2.5초. 사용자들의 불만이 폭주하기 시작했고, 그는 절박한 심정으로 React 프로파일러를 켰다. 그리고 그 순간, 모든 문제의 원인을 발견했다..."

---

## 🤝 커뮤니티 스타일 공유

자신만의 스타일을 만들었다면 커뮤니티와 공유하세요!

1. GitHub에 스타일 파일 업로드
2. 스타일 설명과 예제 포함
3. Pull Request 제출
4. 커뮤니티 피드백 반영

---

## 📧 지원 및 문의

- 스타일 커스터마이징 관련 질문
- 버그 리포트
- 기능 제안

GitHub Issues에서 `[Style]` 태그를 사용해주세요.