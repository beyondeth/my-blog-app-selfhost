import { ConflictException } from '@nestjs/common';

/**
 * 낙관적 잠금 충돌 예외
 *
 * @description
 * TypeORM의 OptimisticLockVersionMismatchError를 래핑하여
 * 애플리케이션 레벨에서 재시도 로직 구현 가능
 *
 * @동작원리
 * 1. 엔티티 읽기 시 version 컬럼 값 저장 (예: version=5)
 * 2. 업데이트 시 WHERE version=5 조건 추가
 * 3. version이 5가 아니면 (다른 트랜잭션이 변경) 업데이트 실패
 * 4. OptimisticLockException 발생 → 재시도 또는 사용자에게 알림
 *
 * @사용예시
 * ```typescript
 * try {
 *   const stats = await this.findOne(postId);
 *   stats.incrementLikeCount();
 *   await this.save(stats);  // version 체크 자동 수행
 * } catch (error) {
 *   if (error instanceof OptimisticLockException) {
 *     // 재시도 로직
 *     this.logger.warn('Optimistic lock conflict, retrying...');
 *     await this.retryUpdate(postId);
 *   }
 * }
 * ```
 *
 * @언제_발생하나
 * - 동시에 같은 레코드를 수정하려는 경우
 * - 예: 100명이 동시에 같은 포스트에 좋아요 클릭
 *
 * @처리방법
 * 1. 자동 재시도 (최대 3회, 지수 백오프)
 * 2. 사용자에게 "다시 시도해주세요" 메시지
 * 3. 로깅 후 무시 (조회수 같은 중요도 낮은 경우)
 */
export class OptimisticLockException extends ConflictException {
  constructor(
    /**
     * 엔티티 이름 (예: 'PostStats', 'Post')
     */
    public readonly entityName: string,
    /**
     * 엔티티 ID
     */
    public readonly entityId: string,
    /**
     * 예상했던 version 값 (읽었을 때의 version)
     */
    public readonly expectedVersion: number,
    /**
     * 실제 version 값 (다른 트랜잭션이 변경한 version)
     */
    public readonly actualVersion: number,
  ) {
    super({
      message: `낙관적 잠금 충돌: ${entityName}(${entityId})의 version이 변경되었습니다.`,
      detail: `예상 version: ${expectedVersion}, 실제 version: ${actualVersion}`,
      expectedVersion,
      actualVersion,
      retryable: true, // 클라이언트가 재시도 가능함을 명시
      code: 'OPTIMISTIC_LOCK_ERROR',
    });

    // 에러 이름 설정 (디버깅 시 유용)
    this.name = 'OptimisticLockException';
  }

  /**
   * 로깅용 메시지 포맷
   * 예: "OptimisticLockException: PostStats(abc123) version mismatch (expected: 5, actual: 7)"
   */
  toString(): string {
    return `${this.name}: ${this.entityName}(${this.entityId}) version mismatch (expected: ${this.expectedVersion}, actual: ${this.actualVersion})`;
  }
}
