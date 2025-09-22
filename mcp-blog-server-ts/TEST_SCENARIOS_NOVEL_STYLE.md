# 🧪 Novel Style Test Scenarios & Examples

## 📊 스타일 비교: Default vs Novel

### Test Case 1: Redis 캐싱 구현 글

#### 🔵 Default Style (기본 블로그 스타일)

```markdown
---
title: "Redis 캐싱으로 API 성능 개선하기"
tags: ["redis", "caching", "performance", "ai:claude"]
---

# Redis 캐싱으로 API 성능 개선하기

안녕하세요. 오늘은 Redis를 활용한 캐싱 전략에 대해 알아보겠습니다.

## 문제 상황

저희 서비스의 API 응답 시간이 평균 3초를 넘어서고 있었습니다. 사용자들의 불만이 증가하고 있었고, 이를 해결해야 했습니다.

## 해결 방법

Redis를 도입하여 자주 조회되는 데이터를 캐싱하기로 했습니다. 구현 과정은 다음과 같습니다:

1. Redis 서버 구축
2. 캐싱 전략 수립
3. 코드 구현

```javascript
const cache = await redis.get(key);
if (cache) return JSON.parse(cache);
```

## 결과

API 응답 시간이 3초에서 200ms로 단축되었습니다.

## 마무리

Redis 캐싱은 성능 개선의 효과적인 방법입니다. 여러분도 시도해보세요.
```

#### 🎭 Novel Style (소설가 스타일)

```markdown
---
title: "새벽 3시, Redis와의 사투: 3초의 지옥에서 탈출하다"
tags: ["redis", "caching", "developer-story", "ai:claude", "tech-drama"]
---

# 새벽 3시, Redis와의 사투: 3초의 지옥에서 탈출하다

## 🌙 프롤로그: 붉은 경고등

새벽 3시 14분.

모니터의 붉은 그래프가 내 얼굴을 비추고 있었다. APM 대시보드는 마치 심장 박동 모니터처럼 위태롭게 요동쳤다. "평균 응답시간: 3.2초".

커피잔이 식어가는 것도 모른 채, 나는 숫자를 뚫어지게 바라보았다. 3초. 디지털 시대에 3초는 영원과도 같았다. 사용자들은 이미 떠나고 있었다.

"이대로는 안 돼."

내가 중얼거렸을 때, 슬랙 알림이 울렸다.

---

## 🔥 제1막: 균열의 시작

### 금요일의 저주

*"DB 또 죽었어요."*

주니어 개발자의 메시지였다. 금요일 오후, 트래픽이 몰리는 시간. 데이터베이스는 비명을 지르고 있었다.

나는 쿼리 로그를 열었다. 같은 SELECT 문이 초당 수백 번씩 반복되고 있었다. 마치 메아리처럼, 끝없이.

```sql
-- 이 단순한 쿼리가 우리를 죽이고 있었다
SELECT * FROM products WHERE category = 'bestseller'
```

"왜 매번 같은 걸 물어보는 거야?" 나는 모니터에 대고 말했다.

그때였다. 문득 카페에서 본 광경이 떠올랐다.

---

## ⚡ 제2막: 심연으로

### 바리스타의 깨달음

지난주, 나는 단골 카페에서 코딩을 하고 있었다. 바쁜 아침 시간, 바리스타는 미리 만들어둔 콜드브루를 냉장고에서 꺼내 손님들에게 건넸다. 매번 새로 내리지 않았다.

*"그거야!"*

나는 벌떡 일어났다. 빈 사무실에 내 목소리가 메아리쳤다.

우리도 자주 요청되는 데이터를 '미리 만들어 둘' 수 있었다. 메모리에, 빠르게 접근 가능한 곳에.

### 새벽의 결심

Redis.

그 이름이 머릿속에서 빛났다. Remote Dictionary Server. 원격 사전 서버. 마치 주문을 외우듯 나는 중얼거렸다.

하지만 두려움도 있었다.

*"지금 새로운 걸 도입해도 될까? 망하면 어떡하지?"*

창밖을 보니 첫 새가 울고 있었다. 새벽 4시. 월요일까지 시간이 없었다.

---

## 💡 제3막: 깨달음의 순간

### 첫 번째 캐시 히트

```javascript
// 떨리는 손으로 작성한 첫 번째 캐시 코드
const cacheKey = `bestseller:${date}`;
const cached = await redis.get(cacheKey);

if (cached) {
  console.log('🎯 Cache HIT!'); // 이 로그를 보는 순간의 전율
  return JSON.parse(cached);
}
```

배포 버튼을 누르는 순간, 심장이 멈추는 것 같았다.

1초... 2초... 3초...

그리고 마법이 일어났다.

### 그래프의 급락

APM 대시보드의 그래프가 급격히 떨어지기 시작했다. 3200ms → 1800ms → 500ms → 200ms.

마치 열병을 앓던 환자의 체온이 정상으로 돌아오는 것 같았다. 나는 의자에 기대어 깊은 한숨을 쉬었다.

*"해냈다..."*

---

## 🌅 에필로그: 새로운 아침

### 월요일 아침

"어? 앱이 빨라졌네요?"

팀원들이 하나둘 출근하며 놀라워했다. 나는 미소를 지으며 모니터를 가리켰다.

"평균 응답시간: 187ms"

그 순간 깨달았다. Redis는 단순한 캐시 서버가 아니었다. 그것은 시간을 되돌려주는 타임머신이었다. 사용자가 떠나기 전, 그 3초의 지옥에서 우리를 구해준.

### 개발자에게 남기는 말

당신도 3초의 지옥에 갇혀 있다면, 두려워하지 마세요.

때로는 새벽의 고독한 싸움이 가장 아름다운 해결책을 가져다줍니다. 그리고 기억하세요. 모든 위대한 최적화는 작은 깨달음에서 시작됩니다.

바리스타가 콜드브루를 미리 만들어두듯이.

---

*"캐시는 컴퓨터 과학의 두 가지 어려운 문제 중 하나다.
나머지 하나는 이름 짓기와 Off-by-one 에러다."*
- Phil Karlton (약간 각색)
```

---

## 🧪 Test Scenario 2: 환경 변수 설정 테스트

### 테스트 절차

1. **환경 변수 설정**
```bash
# .env 파일에 추가
WRITING_STYLE_FILE=writing-styles/novel.md
```

2. **MCP 서버 재시작**
```bash
npm run restart
```

3. **테스트 명령**
```javascript
// AI 어시스턴트에게 요청
"Redis 캐싱 구현 경험에 대한 블로그 포스트를 작성해주세요"
```

4. **결과 확인 포인트**
- ✅ 서사적 도입부가 있는가?
- ✅ 감정 표현이 포함되어 있는가?
- ✅ 은유와 비유가 사용되었는가?
- ✅ 코드 블록이 5% 이하인가?
- ✅ 3막 구조를 따르는가?

---

## 🎯 품질 평가 비교

### Default Style 평가
- Natural Flow: 12/18 points
- Personal Touch: 8/16 points
- Conversational Tone: 10/16 points
- Structure: 18/25 points
- Code Block Ratio: 10/15 points
- Extra Elements: 5/10 points
- **Total: 63/100** ⚠️ (Auto-enhance triggered)

### Novel Style 평가
- Story Arc: 18/20 points
- Character Voice: 14/15 points
- Emotional Journey: 14/15 points
- Literary Techniques: 27/30 points
- Code Block Ratio: 14/15 points
- Extra Elements: 5/5 points
- **Total: 92/100** ✨ (High quality)

---

## 🔄 동적 스타일 전환 테스트

### 런타임 스타일 변경

```javascript
// 테스트 스크립트
async function testStyleSwitching() {
  // 기본 스타일로 생성
  process.env.WRITING_STYLE_FILE = 'writing-styles/default.md';
  const post1 = await createPost({
    topic: "Docker 컨테이너 최적화"
  });

  // 소설가 스타일로 전환
  process.env.WRITING_STYLE_FILE = 'writing-styles/novel.md';
  const post2 = await createPost({
    topic: "Docker 컨테이너 최적화"
  });

  // 비교
  console.log("Default style length:", post1.length);
  console.log("Novel style length:", post2.length);
  console.log("Emotional words in default:", countEmotionalWords(post1));
  console.log("Emotional words in novel:", countEmotionalWords(post2));
}
```

---

## 📝 커스터마이징 추가 예제

### 마케팅 스타일 (marketing.md)

```yaml
style_name: "Persuasive Marketing Copy"
target_length: "1500-2500"
code_block_ratio: 0.02
```

주요 특징:
- 문제-해결-이익 구조
- 강한 CTA
- 통계와 숫자 활용
- 고객 증언 포함

### 학술 스타일 (academic.md)

```yaml
style_name: "Academic Research Style"
target_length: "5000-8000"
code_block_ratio: 0.15
```

주요 특징:
- 초록-서론-방법론-결과-토의 구조
- 인용과 참조
- 객관적 어조
- 데이터 중심

---

## ✅ 최종 체크리스트

### 시스템 동작 확인
- [ ] novel.md 파일이 writing-styles 폴더에 존재
- [ ] 환경 변수 설정 확인
- [ ] MCP 서버 재시작 완료
- [ ] 인증 성공
- [ ] 포스트 생성 성공

### 스타일 적용 확인
- [ ] 서사적 도입부 생성
- [ ] 감정 표현 포함
- [ ] 은유/비유 사용
- [ ] 코드 최소화 (5% 이하)
- [ ] 한국어 작성

### 품질 검증
- [ ] 최소 2500자 이상
- [ ] AI 태그 포함
- [ ] 품질 점수 70점 이상
- [ ] 자동 개선 기능 작동

---

## 🚀 다음 단계

1. **추가 스타일 개발**
   - `podcast.md` - 팟캐스트 대본 스타일
   - `tutorial.md` - 단계별 튜토리얼 스타일
   - `review.md` - 제품 리뷰 스타일

2. **스타일 조합**
   - Novel + Technical 하이브리드
   - Marketing + Academic 혼합

3. **커뮤니티 공유**
   - GitHub에 스타일 템플릿 공유
   - 사용 사례 문서화
   - 피드백 수집

---

## 💬 FAQ

### Q: 스타일 파일이 적용되지 않아요
A: 환경 변수 확인 → MCP 서버 재시작 → 캐시 클리어

### Q: 품질 점수가 낮게 나와요
A: 스타일별 평가 기준이 다름. novel.md는 서사적 요소 중심 평가

### Q: 여러 스타일을 동시에 사용할 수 있나요?
A: 현재는 하나씩만. 향후 멀티 스타일 지원 예정

### Q: 영어로도 작성 가능한가요?
A: language: "english"로 설정 변경

---

*"Every technical blog post is a story waiting to be told."*