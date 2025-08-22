---
title: "Dashboard 메트릭 데이터 검증: DAU가 0인 이유 찾기"
tags: []
date: 2025-08-22T01:44:37.134910
source: 2025-01-22-dashboard-metrics-validation.md
---

# Dashboard 메트릭 데이터 검증: DAU가 0인 이유 찾기

## 문제 상황

Admin Dashboard에서 이상한 데이터를 발견했습니다:
- DAU (일일 활성 사용자): **0**
- MAU (월간 활성 사용자): **7**
- 평균 포스트/사용자: **9.4**
- 평균 댓글/포스트: **0.6**

"이 데이터가 맞는 건가?" 라는 의문이 들었습니다.

## 조사 과정

### 1. 백엔드 서비스 코드 확인

```typescript
// admin-dashboard.service.ts
private async getDailyActiveUsers(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await this.userRepository.count({
    where: {
      lastLoginAt: MoreThanOrEqual(today),
    },
  });
}

private async getMonthlyActiveUsers(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await this.userRepository.count({
    where: {
      lastLoginAt: MoreThanOrEqual(thirtyDaysAgo),
    },
  });
}
```

### 2. 데이터 계산 로직 검증

```typescript
const avgPostsPerUser = totalUsers > 0 ? totalPosts / totalUsers : 0;
const avgCommentsPerPost = totalPosts > 0 ? totalComments / totalPosts : 0;

// 소수점 둘째 자리까지 반올림
avgPostsPerUser: Math.round(avgPostsPerUser * 100) / 100,
avgCommentsPerPost: Math.round(avgCommentsPerPost * 100) / 100,
```

## 발견한 사실들

### DAU가 0인 이유
**원인**: `lastLoginAt` 필드가 오늘 날짜인 사용자가 없음

**검증 방법**:
1. 데이터베이스 직접 조회
2. 실제 사용자 로그인 시간 확인
3. 오늘 아무도 로그인하지 않았음을 확인

**결론**: 데이터가 정확함. 실제로 오늘 로그인한 사용자가 없었음.

### MAU가 7인 이유
최근 30일 이내에 로그인한 사용자가 7명. 이는 전체 사용자 수와 일치하므로 모든 사용자가 최근에 활동했다는 의미.

### 평균 계산의 정확성
- 전체 포스트: 66개
- 전체 사용자: 7명
- 66 ÷ 7 = 9.43 → 9.4 ✅

- 전체 댓글: 38개
- 전체 포스트: 66개
- 38 ÷ 66 = 0.58 → 0.6 ✅

## 개선 사항

### 1. 사용자 활성도 시각화

```typescript
// DAU/MAU 비율 계산
const userActivityRate = stats && stats.metrics.mau > 0 
  ? (stats.metrics.dau / stats.metrics.mau) * 100 
  : 0;
```

RadialBar 차트로 사용자 활성도를 시각적으로 표현.

### 2. 데이터 표시 개선

```tsx
<div className="mt-4 grid grid-cols-2 gap-4 text-center">
  <div>
    <p className="text-xl font-semibold">{stats?.metrics.mau || 0}</p>
    <p className="text-xs text-gray-500">월간 활성 사용자</p>
  </div>
  <div>
    <p className="text-xl font-semibold">{stats?.metrics.dau || 0}</p>
    <p className="text-xs text-gray-500">일간 활성 사용자</p>
  </div>
</div>
```

## 교훈

### 1. 데이터를 의심하되, 검증은 철저히
처음엔 "DAU가 0이라니 버그 아닌가?" 생각했지만, 코드를 추적해보니 정확한 데이터였습니다.

### 2. 비즈니스 로직 이해의 중요성
- DAU는 "오늘" 로그인한 사용자
- MAU는 "최근 30일" 로그인한 사용자
- 이 차이를 이해해야 데이터를 올바르게 해석할 수 있음

### 3. 0도 의미 있는 데이터
DAU가 0이라는 것은:
- 사용자 참여도가 낮음
- 일일 재방문율 개선 필요
- 푸시 알림이나 이메일 마케팅 고려

### 4. 평균의 함정
평균은 전체적인 경향을 보여주지만:
- 분포를 알 수 없음 (한 명이 60개 포스트 vs 모두가 9개씩)
- 중간값(median)도 함께 보면 좋음
- 히스토그램으로 분포 시각화 고려

## 추가 개선 아이디어

1. **실시간 업데이트**: WebSocket으로 실시간 메트릭
2. **트렌드 분석**: 일별/주별 추이 그래프
3. **코호트 분석**: 가입 시기별 사용자 행동 분석
4. **알림 시스템**: DAU가 특정 수치 이하일 때 알림

## 코드 스니펫

### TypeORM 날짜 비교
```typescript
// 오늘 00:00:00 이후
where: {
  lastLoginAt: MoreThanOrEqual(today)
}

// 특정 기간 사이
where: {
  createdAt: Between(startDate, endDate)
}
```

### 퍼센트 계산 with 안전장치
```typescript
const percentage = denominator > 0 
  ? Math.round((numerator / denominator) * 100) 
  : 0;
```

## 마무리

"이상한 데이터"라고 생각했던 것이 실제로는 정확한 데이터였습니다. 중요한 건 **데이터를 맹신하지도, 무시하지도 않고 검증하는 자세**입니다. 

Dashboard 메트릭은 비즈니스 의사결정의 기초가 되므로, 각 수치가 어떻게 계산되는지 정확히 이해하고 있어야 합니다.

#Dashboard #DataValidation #TypeORM #Metrics #Backend