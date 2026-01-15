## 경기도 기후 플랫폼 – 해커톤 바이브코딩 PRD

### 0. 목표 개요
- 경기 기후 플랫폼 API 106종 중 핵심 레이어를 활용해 **실시간 임계값 감시 → 자동포스팅 → Slack 전파**까지 연결하는 서비스 구축.
- “경기도 기후 플랫폼” 전용 블로그를 별도 앱으로 만들어 Codebase.blog 종속성을 제거.
- 해커톤 당일 AI 페어프로그래밍이 바로 가능한 **스크립트형 작업지시서**를 마련해 단계별 완료 체크.

---

### 1. 리포 구조 & 초기 셋업 (CheckPoint 1 완료 후 다음 단계 진행)
1. `repo/`
   - `frontend/` : Next.js 15 대시보드 (센서 모니터 + 테스트 패널)
   - `backend/` : NestJS (센서 API 폴링, 임계값 계산, 자동포스팅 트리거)
   - `platform/` : Next.js App Router 블로그 + Supabase Auth/DB
   - `scripts/` : GeoTIFF 렌더링, 이미지 업로드, mock 데이터 스크립트
   - `docs/` : API 요약, 체크리스트, 발표 자료
2. 공통 `.tool-versions` or `.nvmrc`, `.npmrc`, `.editorconfig` 생성.
3. `pnpm` 워크스페이스 구성 (`pnpm-workspace.yaml`).

**CheckPoint 1**
- 리포 구조, pnpm 워크스페이스 동작 확인.
- Supabase 프로젝트 생성 및 키 .env 템플릿에 반영.

---

### 2. 경기도 기후 플랫폼 API 핸드쉐이크 (CheckPoint 2)
1. 사전 준비
   - 대회 등록 후 받은 `apiKey` 를 `.env.local` / Supabase secrets에 저장.
   - 106개 레이어 중 사용 후보 선정:
     - 극한호우 취약시설
     - 극한호우 홍수위험도 (위험도 지수/순위)
     - 산사태 위험등급 + 발생이력
     - 산사태 안전시설 (사방댐/임시거주시설)
     - 폭염 열쾌적성 평가
2. **WFS 테스트 스크립트** (`scripts/api-smoke.ts`)
   - GET 예제:
     ```
     GET https://climate.gg.go.kr/ols/api/geoserver/wfs?
     apiKey=...&service=WFS&version=1.1.0&request=GetFeature&
     typeName=spggcee:{레이어명}&outputFormat=application/json
     ```
   - 응답 파싱 → geometry, 속성, timestamp 저장.
3. **WMTS 테스트** (tile preview)
   - URL 패턴:  
     `https://climate.gg.go.kr/ols/api/geoserver/wmts?apiKey=...&url=/rest/{레이어명}/EPSG:3857/{z}/{y}/{x}`
   - Leaflet/MapLibre dev page로 타일 확인.

**CheckPoint 2**
- 선택한 레이어 최소 3개에서 JSON/타일 확보 성공.
- 응답 구조 문서화 (`docs/api-layer-notes.md`).

---

### 3. “경기도 기후 플랫폼” 블로그 (platform/) (CheckPoint 3)
1. **기능 요약**
   - Supabase Auth (email OTP or magic link) + Role 기반 (admin/operator).
   - CRUD: 포스트 작성/수정/삭제, 이미지 업로드(Supabase Storage).
   - 홈 피드: 카드형 목록 (대표 이미지 + 요약 + 태그 + 위험도 뱃지).
   - 상세 페이지: 지도 이미지/표/참고 데이터, Slack 공유 버튼.
   - Admin 페이지: API 키 관리, 자동포스팅 로그 조회.
2. **API 엔드포인트**
   - `POST /api/posts` : 자동포스팅용 (MCP 유사). body = { title, markdown, tags, images[] }.
   - `POST /api/uploads` : 사전 업로드 허용 (임시 signed URL).
   - `GET /api/posts/feed` : 대시보드용 최신 글 반환.
3. **Revalidation**
   - Vercel on-demand revalidate (`/api/revalidate`) 연결 → 신규 포스트 즉시 반영.

**CheckPoint 3**
- 블로그 홈/상세/Admin 기본 네비게이션 동작.
- Supabase Auth 로그인/로그아웃 테스트.
- `/api/posts` 호출 → DB 저장 → 페이지 노출 확인.

---

### 4. Backend (Nest) – 임계값 감시 & 자동포스팅 (CheckPoint 4)
1. **모듈 구성**
   - `SensorsModule`: 기후 API 클라이언트 (WFS + WMTS metadata fetcher)
   - `ThresholdModule`: 각 지표별 임계 로직 (예: 위험지수 ≥ 일정 값)
   - `PostingModule`: platform API 호출 + Slack Webhook 호출
   - `MockModule`: 테스트용 임계값 강제 트리거
2. **동작 순서**
   - Cron(또는 Supabase Edge Function Cron) → `SensorsService.fetchLatest()`
   - 재가공 후 Supabase DB/Redis에 캐시 저장
   - `ThresholdService.evaluate()` → 임계 넘으면 `PostingService.trigger()`
3. **자동포스팅 요청**
   - 사전 준비된 템플릿(`docs/templates/default.md`)에 데이터 삽입
   - 이미지 URL 포함 (scripts에서 생성한 PNG → Supabase Storage 업로드)
   - `platform/api/posts` 호출 → 성공 시 Slack Webhook 전송
4. **Slack 연동 단계**
   1. Slack 워크스페이스 생성 → Incoming Webhook 앱 설치
   2. `SLACK_WEBHOOK_URL` 환경 변수 저장
   3. `PostingService`에서 `fetch(SLACK_WEBHOOK_URL, { text: ... })`

**CheckPoint 4**
- Mock 데이터로 임계값 넘기고 자동포스팅 + Slack 알림 확인.

---

### 5. Frontend 대시보드 (CheckPoint 5)
1. **주요 화면**
   - 실시간 센서 모니터: 지도 + 카드(각 레이어 최신 값, 위험도)
   - 수동 트리거 패널: 슬라이더/입력으로 가짜 수치 입력 → backend mock API 호출
   - 포스트 피드 미러링 (platform feed API)
2. **기술**
   - Next.js 15 App Router + Tailwind + shadcn UI
   - MapLibre/Deck.gl 로 WMTS 레이어 시각화
   - Zustand or TanStack Query for state
3. **데모 플로우**
   - 입력값 조작 → mock API 호출 → 임계 이벤트 발생 → 자동포스팅 결과가 피드 & Slack에 즉시 표시

**CheckPoint 5**
- 대시보드에서 mock 임계값 조작 → 자동포스팅/Slack까지 end-to-end 확인.

---

### 6. 스크립트 / 이미지 파이프라인 (CheckPoint 6)
1. `scripts/render-layers.py`
   - WFS/WMTS 가져온 GeoTIFF/GeoJSON → Matplotlib/Plotly로 이미지 생성
   - 범례/타이틀 템플릿 자동화
2. `scripts/upload-image.ts`
   - Supabase Storage(또는 S3) 업로드 후 CDN URL 반환
3. 자동포스팅 템플릿 내 `![지도](CDN_URL)` 삽입

**CheckPoint 6**
- 레이어 하나 이상에서 이미지 생성 + CDN URL 확보 성공.

---

### 7. 임계값 테스트 & Demo 시나리오
1. **Mock 데이터 주입**
   - Supabase SQL 또는 REST로 `sensors_mock` 테이블 업데이트
   - 또는 대시보드에서 “테스트 이벤트” 버튼 → backend mock API
2. **Demo Script**
   1. 센서 카드에서 값 상승 → 경고 레벨 표시
   2. “테스트 폭염 경보” 클릭 → 자동포스팅 및 Slack 메시지 확인
   3. 블로그에서 새 글 열어 지도/표 확인
3. **로깅**
   - Supabase Edge Function or backend에서 모든 이벤트 로그 테이블에 저장 (시간, 레이어, 값, 포스트 ID)

---

### 8. 발표 자료 & 어필 포인트
1. **왜 이렇게 구축했나**
   - 경기 기후 API 1) 센서 기반, 2) 도내 공공 데이터 ⇒ 관리자/주민에게 빠른 전달이 필요.
   - 단순 지도앱이 아니라 **자동 리포팅 + Slack 통합**으로 실제 업무 플로우에 바로 투입 가능.
2. **시연 강조**
   - 임계값 → 이미지/지도 생성 → 블로그 자동 게시 → Slack 전파까지 1분 내 완료.
   - “SNS 카드형” 디자인으로 관리자들이 그대로 공유할 수 있게 함.
3. **자료**
   - `docs/presentation.md`: 과제 정의, 시스템 구조, 데이터 파이프라인, Demo Flow, 향후 확장.
   - `docs/checklist.md`: 모든 CheckPoint 완료 여부와 타임라인.

---

### 9. 당일 작업 지시 요약 (스크립트)
1. `pnpm install` (root) → `pnpm --filter frontend dev`, `pnpm --filter platform dev`, `pnpm --filter backend start:dev`.
2. Supabase 프로젝트 연결 (`supabase link --project-ref ...`), `.env` 동기화.
3. `scripts/api-smoke.ts` 실행 → API 키 유효성 재확인.
4. `frontend` mock 대시보드 작동 여부 체크.
5. Backend `npm run start:dev` → mock trigger API 테스트.
6. `scripts/render-layers.py` 로 즉시 사용할 지도 PNG 생성.
7. Demo 전: DB mock 데이터 초기화, Slack Webhook 테스트 메시지 발송.
8. 발표 리허설 (Demo Flow 문서 참고).

> ⚠️ 모든 단계는 CheckPoint 완료 후에만 다음 단계 진행. GitHub Issue + Projects로 체크박스화해서 실시간 진척 공유.

