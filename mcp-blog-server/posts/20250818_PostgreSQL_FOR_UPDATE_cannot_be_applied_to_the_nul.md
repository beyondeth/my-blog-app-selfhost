---
title: "PostgreSQL "FOR UPDATE cannot be applied to the nullable side of an outer join" 에러 완벽 해결 가이드"
tags: ["PostgreSQL", "TypeORM", "동시성", "FOR UPDATE", "데이터베이스", "NestJS", "Performance"]
date: 2025-08-18T02:37:26.483974
---

# PostgreSQL "FOR UPDATE cannot be applied to the nullable side of an outer join" 에러 완벽 해결 가이드

## 목차
1. [문제 상황](#문제-상황)
2. [에러 원인 분석](#에러-원인-분석)
3. [해결 방법](#해결-방법)
4. [실제 구현 코드](#실제-구현-코드)
5. [성능 테스트 결과](#성능-테스트-결과)
6. [핵심 용어 설명](#핵심-용어-설명)
7. [추가 개선 사항](#추가-개선-사항)

## 문제 상황

부하 테스트 중 다음과 같은 에러가 발생했습니다:

```
QueryFailedError: FOR UPDATE cannot be applied to the nullable side of an outer join
```

이 에러는 TypeORM에서 `leftJoinAndSelect`와 `setLock('pessimistic_write')`를 함께 사용할 때 발생합니다. 특히 좋아요 토글 기능처럼 동시에 많은 사용자가 접근하는 기능에서 자주 발생합니다.

### 원본 문제 코드

```typescript
async toggleLike(postId: string, user: User): Promise<{ liked: boolean }> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  
  try {
    // 문제 발생 지점!
    const post = await queryRunner.manager
      .createQueryBuilder(Post, 'post')
      .leftJoinAndSelect('post.likedBy', 'user')  // LEFT JOIN
      .where('post.id = :id', { id: postId })
      .setLock('pessimistic_write')  // FOR UPDATE - 여기서 에러!
      .getOne();
      
    // ... 좋아요 토글 로직
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  }
}
```

## 에러 원인 분석

### PostgreSQL의 제약사항

PostgreSQL에서 `FOR UPDATE`는 **LEFT JOIN의 nullable side**에 적용할 수 없습니다. 이는 PostgreSQL의 기본적인 제약사항입니다.

#### 왜 이런 제약이 있을까?

1. **NULL 값 잠금 불가**: LEFT JOIN의 오른쪽(nullable side)은 매칭되는 행이 없을 때 NULL이 됩니다
2. **잠금 대상 모호성**: NULL 행에 대한 잠금은 의미가 없고 모호합니다
3. **동시성 제어 복잡성**: NULL 값에 대한 동시성 제어는 데이터베이스 레벨에서 처리하기 어렵습니다

### TypeORM의 한계

TypeORM은 이러한 PostgreSQL의 제약을 자동으로 처리하지 못합니다. `leftJoinAndSelect`와 `setLock`을 함께 사용하면 그대로 SQL로 변환되어 에러가 발생합니다.

## 해결 방법

### 1차 시도: 잠금 분리 (부분 해결)

```typescript
// Post 테이블만 잠금
const post = await queryRunner.manager
  .createQueryBuilder(Post, 'post')
  .where('post.id = :id', { id: postId })
  .setLock('pessimistic_write')  // Post만 잠금
  .getOne();

// likedBy는 별도로 로드 (잠금 없이)
const postWithLikes = await queryRunner.manager
  .createQueryBuilder(Post, 'post')
  .leftJoinAndSelect('post.likedBy', 'user')
  .where('post.id = :id', { id: postId })
  .getOne();
```

**결과**: 에러는 해결되었지만 성공률 8%로 매우 낮음

### 2차 시도: 원자적 SQL 작업 (최종 해결)

TypeORM의 복잡한 관계 매핑 대신 직접 SQL을 사용하여 원자적으로 처리:

```typescript
async toggleLike(id: string, user: User | null): Promise<{ liked: boolean }> {
  if (!user?.id) {
    throw new ForbiddenException('로그인한 유저만 좋아요를 누를 수 있습니다.');
  }
  
  // 1. 현재 좋아요 상태 확인 (트랜잭션 없이)
  const existingLike = await this.postsRepository.manager.query(
    'SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
    [id, user.id]
  );

  const isLiked = existingLike.length > 0;

  // 2. 한 번의 트랜잭션으로 원자적 처리
  await this.postsRepository.manager.transaction(async manager => {
    if (isLiked) {
      // 좋아요 취소
      await manager.query(
        'DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
        [id, user.id]
      );
      await manager.query(
        'UPDATE posts SET "likeCount" = GREATEST(0, "likeCount" - 1), version = version + 1 WHERE id = $1',
        [id]
      );
    } else {
      // 좋아요 추가 (ON CONFLICT로 중복 방지)
      const insertResult = await manager.query(
        'INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2) ON CONFLICT ("postId", "userId") DO NOTHING RETURNING *',
        [id, user.id]
      );
      
      // 실제로 삽입되었을 때만 카운트 증가
      if (insertResult.length > 0) {
        await manager.query(
          'UPDATE posts SET "likeCount" = "likeCount" + 1, version = version + 1 WHERE id = $1',
          [id]
        );
      }
    }
  });

  return { liked: !isLiked };
}
```

## 실제 구현 코드

### Post Entity에 Version Column 추가

```typescript
@Entity('posts')
export class Post {
  // ... 다른 필드들

  @VersionColumn()
  version: number;  // Optimistic Locking용

  @Column({ default: 0 })
  likeCount: number;  // 좋아요 수 캐싱

  @ManyToMany(() => User, user => user.likedPosts)
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' }
  })
  likedBy: User[];
}
```

### Migration 파일

```typescript
export class AddVersionToPost implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('posts', 
      new TableColumn({
        name: 'version',
        type: 'int',
        default: 1,
      })
    );

    // post_likes 테이블에 복합 유니크 제약 추가
    await queryRunner.createIndex('post_likes', 
      new TableIndex({
        name: 'UQ_post_likes_postId_userId',
        columnNames: ['postId', 'userId'],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('posts', 'version');
    await queryRunner.dropIndex('post_likes', 'UQ_post_likes_postId_userId');
  }
}
```

## 성능 테스트 결과

### 부하 테스트 스크립트

```javascript
async function testConcurrentLikes() {
  const NUM_CONCURRENT_REQUESTS = 50;
  
  // 50개의 동시 좋아요 요청 생성
  const promises = [];
  for (let i = 0; i < NUM_CONCURRENT_REQUESTS; i++) {
    promises.push(toggleLike(postId));
  }
  
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`성공: ${successful} / 실패: ${failed}`);
}
```

### 개선 전후 비교

| 측정 항목 | 개선 전 | 개선 후 | 개선율 |
|---------|--------|--------|-------|
| 에러 발생 | FOR UPDATE 에러 | 에러 없음 | 100% |
| 동시 요청 성공률 | 8% | 46.67% | 483% 향상 |
| 평균 응답 시간 | 4.5초 | 2.7초 | 40% 개선 |
| DB 쿼리 수/요청 | 5-7회 | 3회 | 50% 감소 |

### 동시 요청 수별 성공률

| 동시 요청 수 | 성공률 | 비고 |
|------------|--------|------|
| 5개 | 100% | 완벽 |
| 20개 | 100% | 안정적 |
| 30개 | 100% | 양호 |
| 50개 | 46.67% | Connection Pool 한계 |

## 핵심 용어 설명

### Pessimistic Locking (비관적 잠금)
- **정의**: 데이터를 읽는 시점에 잠금을 걸어 다른 트랜잭션의 접근을 차단
- **장점**: 충돌이 자주 발생하는 경우 효과적
- **단점**: 성능 저하, 데드락 위험
- **SQL**: `SELECT ... FOR UPDATE`

### Optimistic Locking (낙관적 잠금)
- **정의**: 데이터 수정 시점에 버전을 체크하여 충돌 감지
- **장점**: 성능 우수, 데드락 없음
- **단점**: 충돌 시 재시도 필요
- **구현**: Version Column 사용

### Atomic Operation (원자적 연산)
- **정의**: 더 이상 나눌 수 없는 하나의 연산 단위
- **특징**: 전체가 성공하거나 전체가 실패 (All or Nothing)
- **예시**: `INSERT ... ON CONFLICT DO NOTHING`

### Transaction Isolation Level
- **READ COMMITTED**: PostgreSQL 기본값, 커밋된 데이터만 읽기
- **REPEATABLE READ**: 트랜잭션 내에서 같은 데이터 보장
- **SERIALIZABLE**: 완전한 격리, 성능 저하

### Connection Pool
- **정의**: 데이터베이스 연결을 미리 생성하여 재사용
- **장점**: 연결 생성 비용 절감
- **설정**: `max`, `connectionTimeoutMillis`, `idleTimeoutMillis`

## 추가 개선 사항

### 1. Connection Pool 최적화

```typescript
// database.config.ts
export default registerAs('database', (): TypeOrmModuleOptions => ({
  // ... 다른 설정
  extra: {
    max: 100,  // 동시 연결 수 증가
    connectionTimeoutMillis: 10000,  // 타임아웃 증가
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
  },
}));
```

### 2. Redis 캐싱 도입 (권장)

```typescript
// Redis를 사용한 좋아요 수 캐싱
async getLikeCount(postId: string): Promise<number> {
  const cached = await this.redis.get(`post:${postId}:likes`);
  if (cached) return parseInt(cached);
  
  const count = await this.postsRepository
    .createQueryBuilder('post')
    .where('post.id = :id', { id: postId })
    .select('post.likeCount')
    .getOne();
    
  await this.redis.setex(`post:${postId}:likes`, 3600, count);
  return count;
}
```

### 3. 분산 잠금 구현 (고급)

```typescript
// Redis를 사용한 분산 잠금
async toggleLikeWithRedisLock(postId: string, userId: string) {
  const lockKey = `lock:like:${postId}:${userId}`;
  const lock = await this.redis.set(lockKey, '1', 'NX', 'EX', 5);
  
  if (!lock) {
    throw new ConflictException('이미 처리 중입니다');
  }
  
  try {
    // 좋아요 토글 로직
  } finally {
    await this.redis.del(lockKey);
  }
}
```

## 마무리

PostgreSQL의 FOR UPDATE 제약은 회피하는 것이 아니라 이해하고 적절한 해결책을 찾는 것이 중요합니다. TypeORM의 편리한 기능도 좋지만, 때로는 직접 SQL을 작성하는 것이 더 효율적이고 안전할 수 있습니다.

특히 동시성이 중요한 기능에서는:
1. 원자적 연산 활용
2. 적절한 잠금 전략 선택
3. Connection Pool 최적화
4. 캐싱 전략 수립

이 네 가지를 잘 조합하면 안정적이고 빠른 시스템을 구축할 수 있습니다.