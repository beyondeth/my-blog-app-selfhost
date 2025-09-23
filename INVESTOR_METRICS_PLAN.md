# 📊 투자자 지표 및 사용자 분석 시스템 구축 계획

## 🎯 목표
블로그 SaaS 플랫폼의 투자 유치를 위한 핵심 지표 측정 및 분석 시스템 구축

## 📈 핵심 지표 (Key Metrics)

### 1. **사용자 획득 지표 (User Acquisition)**
- **MAU/DAU/WAU** (월간/일간/주간 활성 사용자)
- **신규 가입자 수** (일/주/월별)
- **가입 소스 분석** (organic, referral, social 등)
- **사용자 획득 비용** (CAC - Customer Acquisition Cost)

### 2. **참여도 지표 (Engagement)**
- **세션 시간** (평균 체류 시간)
- **페이지뷰/사용자**
- **바운스율**
- **콘텐츠 생성률** (포스트 작성 빈도)
- **상호작용률** (좋아요, 댓글, 공유)
- **리텐션 곡선** (1일, 7일, 30일 리텐션)

### 3. **전환율 지표 (Conversion)**
- **방문자 → 회원가입 전환율**
- **무료 → 유료 전환율** (향후)
- **이메일 인증 완료율**
- **블로그 생성 완료율**
- **첫 포스트 작성률**

### 4. **수익 지표 (Revenue - 향후)**
- **MRR/ARR** (월간/연간 반복 수익)
- **ARPU** (사용자당 평균 수익)
- **LTV** (고객 생애 가치)
- **Churn Rate** (이탈률)
- **Net Revenue Retention**

### 5. **성장 지표 (Growth)**
- **Viral Coefficient** (바이럴 계수)
- **NPS** (순추천지수)
- **성장률** (MoM, YoY)
- **코호트 분석**

## 🛠️ 기술 스택 및 도구

### 1. **이벤트 트래킹 시스템**
```typescript
// backend/src/analytics/entities/user-event.entity.ts
@Entity('user_events')
export class UserEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  eventType: string; // 'page_view', 'post_created', 'comment_added' 등

  @Column('jsonb')
  properties: Record<string, any>;

  @Column()
  sessionId: string;

  @Column()
  timestamp: Date;

  @Column({ nullable: true })
  referrer: string;

  @Column({ nullable: true })
  userAgent: string;
}
```

### 2. **분석 도구 통합**
- **Google Analytics 4** - 웹 분석
- **Mixpanel/Amplitude** - 제품 분석
- **Hotjar/FullStory** - 사용자 행동 기록
- **Segment** - 데이터 파이프라인
- **Metabase/Redash** - 내부 대시보드

### 3. **실시간 대시보드 구축**
```typescript
// backend/src/analytics/services/analytics.service.ts
export class AnalyticsService {
  // 실시간 지표 계산
  async getRealtimeMetrics() {
    return {
      activeUsers: await this.getActiveUsers(),
      todaySignups: await this.getTodaySignups(),
      conversionRate: await this.getConversionRate(),
      avgSessionDuration: await this.getAvgSessionDuration(),
    };
  }

  // 코호트 분석
  async getCohortAnalysis(cohortDate: Date) {
    // 특정 기간 가입자들의 리텐션 분석
  }

  // 퍼널 분석
  async getFunnelAnalysis() {
    return {
      visited: 1000,
      signedUp: 150,  // 15% 전환율
      createdBlog: 120,  // 80% 전환율
      wrotePost: 90,  // 75% 전환율
      becameActive: 45,  // 50% 전환율
    };
  }
}
```

### 4. **A/B 테스트 프레임워크**
```typescript
// backend/src/experiments/entities/experiment.entity.ts
@Entity('experiments')
export class Experiment {
  @Column()
  name: string;

  @Column('jsonb')
  variants: Array<{
    name: string;
    weight: number;
    config: any;
  }>;

  @Column()
  status: 'draft' | 'running' | 'completed';

  @Column('jsonb')
  metrics: {
    primaryMetric: string;
    secondaryMetrics: string[];
  };
}
```

## 📊 대시보드 구현

### 1. **관리자 대시보드 페이지**
```typescript
// frontend/src/app/admin/analytics/page.tsx
- 실시간 지표 카드
- 시계열 그래프 (Chart.js/Recharts)
- 코호트 히트맵
- 퍼널 시각화
- 사용자 세그먼트 분석
```

### 2. **주요 차트 및 시각화**
- **성장 차트**: MAU/DAU 추이
- **리텐션 차트**: 코호트별 리텐션 커브
- **퍼널 차트**: 전환 단계별 이탈률
- **지리적 분포**: 사용자 위치 히트맵
- **디바이스/브라우저 분석**: 파이 차트

## 🔄 데이터 파이프라인

### 1. **데이터 수집**
```typescript
// 클라이언트 이벤트 트래킹
analytics.track('post_created', {
  postId: post.id,
  wordCount: post.wordCount,
  hasImages: post.images.length > 0,
  category: post.category,
});
```

### 2. **데이터 처리**
- **실시간 처리**: Redis + WebSocket
- **배치 처리**: 일별 집계 (Cron Job)
- **데이터 웨어하우스**: PostgreSQL → BigQuery (향후)

### 3. **데이터 저장 구조**
```sql
-- 일별 집계 테이블
CREATE TABLE daily_metrics (
  date DATE PRIMARY KEY,
  dau INTEGER,
  new_users INTEGER,
  posts_created INTEGER,
  comments_created INTEGER,
  avg_session_duration INTERVAL,
  bounce_rate DECIMAL(5,2)
);

-- 사용자 세그먼트 테이블
CREATE TABLE user_segments (
  user_id UUID,
  segment VARCHAR(50),
  assigned_at TIMESTAMP,
  properties JSONB
);
```

## 📋 구현 우선순위

### Phase 1 (1주차) - 기본 트래킹
1. 이벤트 트래킹 시스템 구축
2. Google Analytics 통합
3. 기본 지표 수집 (DAU, 가입수, 포스트 수)

### Phase 2 (2주차) - 대시보드
1. 관리자 대시보드 UI 구축
2. 실시간 지표 API 개발
3. 기본 차트 구현

### Phase 3 (3주차) - 고급 분석
1. 코호트 분석 구현
2. 퍼널 분석 구현
3. A/B 테스트 프레임워크

### Phase 4 (4주차) - 최적화
1. 성능 최적화 (캐싱, 인덱싱)
2. 알림 시스템 (지표 임계값 도달 시)
3. 보고서 자동 생성

## 🎯 성공 지표

### 투자자가 주목하는 핵심 지표
1. **MAU 성장률** > 20% MoM
2. **Day 1 리텐션** > 40%
3. **Day 7 리텐션** > 20%
4. **Day 30 리텐션** > 10%
5. **활성 콘텐츠 생성자 비율** > 30%
6. **평균 세션 시간** > 5분
7. **Viral Coefficient** > 0.5

## 🔐 개인정보 보호
- GDPR/CCPA 준수
- 익명화된 데이터 수집
- 사용자 동의 관리
- 데이터 보존 정책

## 💰 예상 ROI
- **투자 유치 가능성**: 데이터 기반 의사결정으로 신뢰도 향상
- **제품 개선**: 사용자 행동 이해를 통한 기능 최적화
- **마케팅 효율**: CAC/LTV 분석을 통한 마케팅 ROI 개선
- **이탈 방지**: 조기 경고 시스템으로 이탈 위험 사용자 관리