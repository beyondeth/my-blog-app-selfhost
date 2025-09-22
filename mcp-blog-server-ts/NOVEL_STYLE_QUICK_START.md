# 🚀 Novel Style Quick Start Guide

## 📖 소설가 스타일로 블로그 쓰기 - 5분 만에 시작하기

### Step 1: 환경 변수 설정 (30초)

`.env` 파일을 열고 다음 줄을 추가하세요:

```bash
# 소설가 스타일 활성화
WRITING_STYLE_FILE=writing-styles/novel.md
```

### Step 2: MCP 서버 재시작 (30초)

```bash
# 서버 재시작
npm run restart

# 또는 Docker 사용 시
docker-compose restart mcp-blog-server
```

### Step 3: 테스트 (2분)

MCP 클라이언트에서 다음과 같이 요청하세요:

```javascript
// 예제 1: 기술적 경험을 드라마틱하게
"버그를 해결한 경험을 소설처럼 써주세요. 주제: 메모리 누수 해결기"

// 예제 2: 학습 과정을 서사로
"React를 처음 배웠을 때의 이야기를 감동적으로 써주세요"

// 예제 3: 프로젝트 완성기
"첫 오픈소스 프로젝트를 완성한 이야기를 영화처럼 써주세요"
```

### Step 4: 결과 확인 (1분)

생성된 블로그 포스트에서 다음을 확인:

✅ **서사적 도입부**: "새벽 3시, 모니터의 빛만이..."
✅ **감정 표현**: "좌절감이 밀려왔다", "마침내 해냈다"
✅ **은유와 비유**: "코드는 미로 같았다"
✅ **대화 포함**: "이 코드 누가 짠 거야?"
✅ **3막 구조**: 도입-전개-해결

---

## 🎨 스타일 비교 예시

### 입력: "Redis 캐싱 구현"

#### 기본 스타일 출력 (처음 3줄)
```
오늘은 Redis를 활용한 캐싱 전략에 대해 알아보겠습니다.
Redis는 인메모리 데이터 구조 저장소입니다.
캐싱을 통해 성능을 개선할 수 있습니다.
```

#### 소설가 스타일 출력 (처음 3줄)
```
새벽 3시, 서버룸의 차가운 공기가 내 뺨을 스쳤다.
모니터에는 붉은색 경고창이 미친 듯이 깜빡이고 있었다.
'응답시간 초과 - 12,847건'. Redis가 답이었다.
```

---

## 🔧 빠른 커스터마이징

### 감정 강도 조절

`novel.md` 파일의 219번 줄 근처에서 수정:

```markdown
# 더 드라마틱하게
"서버가 죽었다. 완전히, 처참하게."

# 조금 차분하게
"서버가 응답을 멈췄다. 조용히, 그러나 분명하게."
```

### 코드 비율 조절

```yaml
# 코드 거의 없이 (순수 서사)
code_block_ratio: 0.02

# 약간의 코드 포함
code_block_ratio: 0.1
```

---

## 💡 즉시 사용 가능한 프롬프트

복사해서 바로 사용하세요:

### 1. 버그 해결 스토리
```
"어제 겪은 production 버그를 해결한 이야기를 영화처럼 dramatize해서 블로그 포스트로 작성해주세요. 새벽에 일어난 일이고, 결국 해결했지만 과정이 험난했습니다."
```

### 2. 학습 여정
```
"JavaScript에서 TypeScript로 마이그레이션한 경험을 성장 스토리처럼 작성해주세요. 처음엔 타입 에러로 고생했지만 결국 깨달음을 얻었습니다."
```

### 3. 팀워크 에피소드
```
"팀원들과 함께 마감일을 지키기 위해 밤을 새운 이야기를 감동적으로 작성해주세요. 갈등도 있었지만 결국 하나가 되었습니다."
```

---

## ⚡ 트러블슈팅

### 문제: 스타일이 적용되지 않음
```bash
# 해결법 1: 경로 확인
ls writing-styles/novel.md

# 해결법 2: 환경변수 확인
echo $WRITING_STYLE_FILE

# 해결법 3: 캐시 클리어
rm -rf .cache && npm restart
```

### 문제: 여전히 기술적인 톤
```javascript
// 프롬프트에 명시적으로 요청
"소설처럼, 감정적으로, 드라마틱하게 작성해주세요"
```

---

## 📊 품질 측정 도구

```javascript
// 간단한 스타일 검증 스크립트
function validateNovelStyle(content) {
  const checks = {
    hasEmotionalWords: /좌절|기쁨|놀라|두려|희망|절망/.test(content),
    hasDialogue: /".*"/.test(content),
    hasMetaphor: /같았다|처럼|듯이/.test(content),
    hasTimeReference: /새벽|밤|아침|저녁/.test(content),
    codeRatio: (content.match(/```/g) || []).length / content.length
  };

  const score = Object.values(checks).filter(Boolean).length;
  return { score: score * 20, checks };
}
```

---

## 🎯 예상 결과물

소설가 스타일 적용 시:

- **글 길이**: 4000-6000자 (기본 3000-5000자보다 길어짐)
- **코드 비율**: 5% 이하 (기본 20%보다 대폭 감소)
- **감정 표현**: 10+ 곳 (기본 2-3곳)
- **대화/독백**: 3+ 곳 (기본 0곳)
- **품질 점수**: 85+ (기본 70+)

---

## 🚦 바로 시작하기

```bash
# 1. 클론이 안 되어 있다면
git clone [repository-url]
cd mcp-blog-server-ts

# 2. 환경변수 설정
echo "WRITING_STYLE_FILE=writing-styles/novel.md" >> .env

# 3. 서버 시작
npm install && npm start

# 4. 테스트
# MCP 클라이언트에서:
"Hello, create a dramatic blog post about debugging"
```

---

**준비 완료!** 🎭
이제 당신의 기술 블로그가 한 편의 단편소설이 됩니다.

*"Every bug has a story. Every feature has a journey. Let's tell them."*