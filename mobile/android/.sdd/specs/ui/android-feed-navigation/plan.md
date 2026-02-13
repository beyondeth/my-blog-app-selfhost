---
feature: android-feed-navigation
created: 2026-02-13
status: draft
---

# 구현 계획: Android 피드/네비게이션

> iOS 정보 구조 동등성 + Android 네이티브 탐색 최적화

---

## 개요

피드/네비게이션은 iOS의 탭 구조와 핵심 사용자 여정을 유지하되, Android의 back stack 및 제스처 규칙에 맞춰 구현한다.

---

## 기술 결정

### 결정 1: Bottom Navigation + Nested NavHost + LazyColumn(SHALL)

- 하단 탭은 Feed/Community/Profile/Compose 중심으로 구성한다.
- 탭별 back stack을 분리해 상태 보존성을 확보한다.

**근거:** iOS NavigationStack + tab shell 구조와 의미를 맞추면서 Android UX 관습 준수.

### 결정 2: UI 상태 머신 도입(SHALL)

- `Loading`, `Ready`, `Empty`, `Error`, `Offline` 상태를 명시적으로 분리한다.
- 피드 페이지네이션은 cursor 기반으로 구현한다.

---

## 구현 단계

### Phase 1: 라우팅 구조

- 탭 라우팅/딥링크/백스택 정책 정의.
- 피드 루트 화면 스켈레톤 및 pull-to-refresh 기본 동작 적용.

**산출물:**
- [ ] 탭 라우팅 정의
- [ ] 상태 보존 정책
- [ ] 접근성 라벨 기본셋

### Phase 2: 피드 상호작용

- 커서 페이지네이션 및 더보기/끝 상태 구현.
- 좋아요/댓글/공유 액션 핸들러 분리.

**산출물:**
- [ ] 피드 목록/상세 흐름
- [ ] pull-to-refresh
- [ ] 페이지 끝/오류 상태

### Phase 3: 오류/오프라인/성능

- 네트워크 단절 시 배너 및 재시도 UX 제공.
- 이미지 캐시/스크롤 프레임 드랍 점검.

**산출물:**
- [ ] offline banner
- [ ] 오류 복구 UI
- [ ] 성능 점검 로그

---

## 디자인 정합 시나리오

### Scenario: iOS 대비 화면 동등성

- **GIVEN** Android Feed/Navigation 구현 완료
- **WHEN** iOS 디자인 문서와 parity 체크리스트를 수행함
- **THEN** 정보 구조와 상태 피드백 의미가 동일해야 함

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 탭 상태 유실 | 중간 | 탭별 back stack 분리 |
| 리스트 성능 저하 | 높음 | item key 고정, 이미지 캐시, 프리페치 |
| 접근성 누락 | 중간 | 스크린리더 라벨/순서 테스트 필수화 |

## 다음 단계

1. 탭 구조를 iOS 기준으로 매핑한 parity 문서를 작성.
2. Feed 상태 머신과 API pagination 연결.
3. 다크모드/폰트 스케일 접근성 QA 체크 수행.
