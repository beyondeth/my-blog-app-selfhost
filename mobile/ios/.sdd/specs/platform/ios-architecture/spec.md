---
id: ios-architecture
title: "iOS 앱 아키텍처"
status: draft
created: 2026-02-12
domain: platform
depends: null
constitution_version: 1.0.0
---

# iOS 앱 아키텍처

> SwiftUI 중심의 iOS 앱 계층 구조, 의존성 분리, 성능 중심 실행 구조

---

## 개요

iOS 앱은 Presentation, Domain, Data 레이어로 분리한다. 앱 바운더리는 `mobile/ios/app`에 한정하고, 네트워크/토큰/캐시/리포지토리는 테스트 가능한 형태로 분리해 분리 배포/유지보수 비용을 낮춘다.

---

## 요구사항

### REQ-01: 레이어 분리는 기능 단위로 독립 컴파일 가능해야 한다(SHALL).

- Presentation은 View, ViewModel, 화면 라우팅을 담당한다(SHALL).
- Domain은 UseCase/서비스 인터페이스를 담당한다(SHALL).
- Data는 API, 저장소, 영속화 구현을 담당한다(SHALL).

### REQ-02: 앱 초기화는 실패 모드별로 복구 가능해야 한다(SHALL).

- API URL/환경 값 미설정 시 설정 오류 화면을 보여야 한다(SHALL).
- 네트워크 초기 상태에 따라 오프라인 플래그를 반영해야 한다(SHALL).

### REQ-03: 성능은 화면 렌더링 비용 예산을 초과하지 않아야 한다(SHALL).

- 대형 리스트는 lazy rendering으로 처리해야 한다(SHALL).
- 이미지/네트워크 결과는 캐시와 메모이제이션으로 최소화해야 한다(SHALL).
- 첫 렌더는 2초 이내를 목표로 해야 한다(SHOULD).

### REQ-04: 의존성 주입은 테스트 교체 가능 구조여야 한다(SHALL).

- 네트워크 클라이언트와 저장소는 프로토콜(인터페이스) 기반으로 주입되어야 한다(SHALL).
- Mock 레이어 교체 시 UI 상태 검증이 가능해야 한다(SHALL).

---

## 시나리오

### Scenario 1: 앱 최초 실행

- **GIVEN** 앱이 첫 실행된다.
- **WHEN** 환경 구성 체크를 수행한다.
- **THEN** 로그인/메인 진입 지점이 즉시 렌더링되고, 인증 상태에 따라 라우팅한다.

### Scenario 2: 의존성 교체

- **GIVEN** 테스트 환경에서 네트워크 모듈이 교체된다.
- **WHEN** 스냅샷/단위 테스트를 실행한다.
- **THEN** 화면 렌더가 실제 네트워크 없이도 결정론적으로 동작한다.

### Scenario 3: 오프라인 시작

- **GIVEN** 네트워크가 연결되지 않았다.
- **WHEN** 인증/피드/작성 진입 시도가 발생한다.
- **THEN** 로컬 캐시 기반 안내 또는 재시도 UI를 즉시 표시한다.

---

## 비기능 요구사항

### 성능

- 앱 시작에서 인증 체크까지 3초 이내(P95) 이내(SHOULD).
- 스크롤 화면은 60fps 유지를 기본 목표로 한다(SHOULD).

### 유지보수

- 새 기능은 Feature 모듈 단위로 추가할 수 있어야 한다(SHOULD).
- 도메인 계약 변경 시 기존 기능 영향도를 제한해야 한다(SHALL).

## 제약사항

- 웹(`frontend`) 의존성 주입 방식/컴포넌트를 iOS 프로젝트에서 직접 참조하지 않는다(SHALL).
- iOS 앱은 `mobile/contracts`와 직접 링크되지 않는 임시 문서 의존성을 허용하지 않는다(SHALL).

## 용어 정의

| 용어 | 정의 |
|------|------|
| Clean Architecture | Presentation/Domain/Data 분리 아키텍처 |
| bootstrap | 앱 초기 환경 및 의존성 초기화 단계 |
| lazy rendering | 화면 요소를 필요한 시점에 지연 생성해 메모리 사용량을 낮추는 기법 |
