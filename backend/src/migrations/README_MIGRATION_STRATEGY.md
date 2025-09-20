# 마이그레이션 최적화 전략

## 🎯 문제: 순차 실행의 비효율성

기존 마이그레이션을 순서대로 실행하면:
1. 불필요한 인덱스 생성 → 삭제
2. 테이블 구조 변경 → 재변경
3. 임시 컬럼 추가 → 제거

이런 비효율적인 과정을 거칩니다.

## 💡 해결 방법

### 방법 1: Squash Migration (권장)
특정 시점의 마이그레이션들을 하나로 통합

**장점:**
- 새 환경에서 빠른 셋업
- 최종 상태만 생성
- 중간 단계 생략

**단점:**
- 히스토리 추적 어려움
- 롤백 단위가 커짐

### 방법 2: Initial Dump
현재 DB 상태를 하나의 초기 마이그레이션으로

```typescript
// 1758400000000-InitialDump.ts
export class InitialDump1758400000000 {
  async up(queryRunner) {
    // 현재 최종 스키마만 생성
    // 모든 최적화가 적용된 상태
  }
}
```

### 방법 3: Conditional Migration
환경에 따라 조건부 실행

```typescript
export class OptimizeMigration {
  async up(queryRunner) {
    const isNewInstall = await this.checkIfNewInstall(queryRunner);

    if (isNewInstall) {
      // 최적화된 버전 바로 생성
      await this.createOptimizedSchema(queryRunner);
    } else {
      // 기존 DB는 업그레이드만
      await this.upgradeExistingSchema(queryRunner);
    }
  }
}
```

## 📋 실행 계획

### Phase 1: 현재 상태 유지 (단기)
- 모든 마이그레이션 파일 보존
- 프로덕션 안정성 우선

### Phase 2: Squash 준비 (중기)
1. 안정적인 체크포인트 선정 (예: v1.0 릴리즈)
2. 해당 시점까지 마이그레이션 통합
3. 테스트 환경에서 검증

### Phase 3: 새 전략 적용 (장기)
- 새 프로젝트: InitialDump 사용
- 기존 프로젝트: 점진적 Squash
- 문서화 강화

## ⚠️ 주의사항

1. **프로덕션 DB는 절대 수정 금지**
   - 이미 실행된 마이그레이션 변경 X
   - migrations 테이블 직접 수정 X

2. **Squash 전 백업 필수**
   ```bash
   pg_dump -U postgres -h localhost -p 5432 blog-db > backup_before_squash.sql
   ```

3. **팀 동기화**
   - Squash 작업 전 팀 공지
   - 모든 환경 동시 업데이트

## 🔧 도구

### TypeORM Squash 스크립트 (커스텀)
```bash
# scripts/squash-migrations.js
const fs = require('fs');
const path = require('path');

async function squashMigrations(upToTimestamp) {
  // 1. 지정 시점까지 마이그레이션 읽기
  // 2. up() 메서드들 분석
  // 3. 최종 상태만 추출
  // 4. 새 통합 마이그레이션 생성
}
```

## 📊 예상 효과

### Before (15개 마이그레이션)
- 새 DB 셋업: ~45초
- 불필요한 작업: 30%

### After (3개 통합 마이그레이션)
- 새 DB 셋업: ~10초
- 불필요한 작업: 0%

## 🎯 추천 전략

**신규 개발자/환경:**
1. InitialDump 마이그레이션 사용
2. 이후 증분 마이그레이션만 실행

**기존 환경:**
1. 현재 마이그레이션 유지
2. 다음 메이저 릴리즈 시 Squash

**CI/CD:**
1. 테스트 환경: InitialDump 사용
2. 프로덕션: 전체 마이그레이션 유지