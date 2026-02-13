# SDD Workflow Guide

> **android** - AI 에이전트 워크플로우 지침서

---

## 필수 형식 규칙

### RFC 2119 키워드

- **SHALL/MUST**: 절대 필수
- **SHOULD**: 권장
- **MAY**: 선택
- **SHALL NOT**: 절대 금지

### GIVEN-WHEN-THEN 형식

모든 핵심 요구사항은 시나리오를 포함해야 한다.

```markdown
### Scenario: [시나리오명]

- **GIVEN** [전제 조건]
- **WHEN** [행동/트리거]
- **THEN** [예상 결과]
```

---

## Android 작업 원칙

- Android 구현은 `mobile/android/**`에서만 수행한다(SHALL).
- 공용 계약은 `mobile/contracts/**`만 사용한다(SHALL).
- `mobile/ios/**`, `frontend/**`, `backend/**` 변경 필요 시 즉시 중단하고 사용자 승인 후 진행한다(SHALL).
- iOS 디자인 구조(정보 구조, 상태 피드백 의미)는 Android에서도 동등하게 유지한다(SHALL).

---

## 워크플로우

1. `/sdd.new <feature>`
2. `/sdd.plan`
3. `/sdd.tasks`
4. 구현 및 검증
5. `/sdd.validate`

검증:

```bash
sdd validate --strict
```
