import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  Index,
  VersionColumn,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Post } from './post.entity';

/**
 * PostStats 엔티티
 *
 * **설계 원칙 (체크포인트 1):**
 * - Post 테이블에서 통계 관련 정보만 분리
 * - Single Responsibility: 포스트 조회수, 좋아요, 댓글 수 등 통계 관리
 * - 1:1 관계로 Post와 연결
 * - UUID v7 사용으로 시간순 정렬 및 통계 이력 추적 용이
 *
 * **성능 최적화:**
 * - 통계 데이터는 자주 업데이트됨 (별도 테이블로 분리하여 Post 테이블 락 최소화)
 * - 낙관적 락(Optimistic Locking) 적용 (version 컬럼)
 * - Redis 캐싱으로 읽기 부하 감소
 * - 배치 업데이트로 쓰기 부하 감소
 *
 * **동시성 제어:**
 * - 여러 사용자가 동시에 좋아요/조회 시 데이터 정합성 보장
 * - VersionColumn으로 Lost Update 방지
 */
@Entity('post_stats')
@Index(['postId'], { unique: true }) // 1:1 관계 보장
@Index(['viewCount']) // 인기 포스트 조회 최적화
@Index(['likeCount']) // 좋아요 많은 포스트 조회 최적화
@Index(['qualityScore']) // 품질 기반 추천 최적화
export class PostStats {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬로 통계 생성 순서 파악 용이
   * - B-tree 인덱스 성능 최적화
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * Post 관계 (1:1)
   * - onDelete: 'CASCADE' → Post 삭제 시 PostStats도 자동 삭제
   * - nullable: false → Post 없이 PostStats 존재 불가
   */
  @OneToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'uuid', nullable: false })
  postId: string;

  /**
   * 조회수
   * - 중복 방지: Redis + 쿠키로 24시간 내 동일 사용자 재방문 카운트 안 함
   * - 배치 업데이트: Redis에 임시 저장 후 1분마다 DB 동기화
   * - 기본값: 0
   */
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  /**
   * 좋아요 수
   * - post_likes 조인 테이블로 관리 (중복 방지)
   * - 좋아요 추가/삭제 시 트랜잭션으로 카운트 업데이트
   * - 기본값: 0
   */
  @Column({ type: 'int', default: 0 })
  likeCount: number;

  /**
   * 댓글 수
   * - comments 테이블에서 집계
   * - 댓글 추가/삭제 시 트랜잭션으로 카운트 업데이트
   * - isDeleted=true인 댓글은 제외
   * - 기본값: 0
   */
  @Column({ type: 'int', default: 0 })
  commentCount: number;

  /**
   * AI 품질 점수 (0-100)
   * - 콘텐츠 품질 평가 (가독성, 맞춤법, 구조 등)
   * - 추천 알고리즘에 활용
   * - null: 미평가 상태
   *
   * **계산 요소:**
   * - 콘텐츠 길이 (너무 짧거나 길지 않은가)
   * - 이미지 비율 (적절한 시각 자료 포함)
   * - 맞춤법 검사 (한글/영문)
   * - 링크 품질 (404 링크 없는지)
   * - 사용자 반응 (좋아요, 댓글, 북마크 비율)
   */
  @Column({ type: 'int', nullable: true, default: null })
  qualityScore: number;

  /**
   * 낙관적 락 (Optimistic Locking)
   * - 동시 업데이트 시 충돌 감지
   * - 업데이트 시마다 자동 증가
   * - TypeORM이 자동으로 WHERE version = oldVersion 조건 추가
   *
   * **사용 시나리오:**
   * - 여러 사용자가 동시에 좋아요 클릭
   * - 동시에 여러 댓글 작성
   * - 조회수 배치 업데이트
   */
  @VersionColumn()
  version: number;

  /**
   * 마지막 업데이트 시각
   * - 통계 캐시 무효화에 사용
   * - 업데이트 빈도 모니터링
   */
  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  /**
   * UUID v7 자동 생성
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 조회수 증가
   * - 배치 업데이트용 (Redis → DB 동기화 시 사용)
   * - 단일 증가가 아닌 누적 값으로 업데이트
   */
  incrementViewCount(count: number = 1): void {
    this.viewCount += count;
  }

  /**
   * 좋아요 수 증가
   * - 좋아요 추가 시 호출
   * - 트랜잭션 내에서 실행 필수
   */
  incrementLikeCount(): void {
    this.likeCount += 1;
  }

  /**
   * 좋아요 수 감소
   * - 좋아요 취소 시 호출
   * - 0 미만으로 내려가지 않도록 보호
   */
  decrementLikeCount(): void {
    this.likeCount = Math.max(0, this.likeCount - 1);
  }

  /**
   * 댓글 수 증가
   * - 댓글 추가 시 호출
   * - 트랜잭션 내에서 실행 필수
   */
  incrementCommentCount(): void {
    this.commentCount += 1;
  }

  /**
   * 댓글 수 감소
   * - 댓글 삭제 시 호출 (소프트 삭제 포함)
   * - 0 미만으로 내려가지 않도록 보호
   */
  decrementCommentCount(): void {
    this.commentCount = Math.max(0, this.commentCount - 1);
  }

  /**
   * 품질 점수 업데이트
   * - AI 평가 배치 작업에서 호출
   * - 0-100 범위로 제한
   */
  updateQualityScore(score: number): void {
    this.qualityScore = Math.max(0, Math.min(100, score));
  }

  /**
   * 참여도 점수 계산 (Engagement Score)
   * - 추천 알고리즘에 활용
   * - 가중치: 좋아요(3) > 댓글(2) > 조회(1)
   */
  calculateEngagementScore(): number {
    const likeWeight = 3;
    const commentWeight = 2;
    const viewWeight = 1;

    const rawScore =
      this.likeCount * likeWeight +
      this.commentCount * commentWeight +
      this.viewCount * viewWeight;

    // 로그 스케일로 정규화 (매우 큰 값 방지)
    return Math.log10(rawScore + 1) * 100;
  }

  /**
   * 인기 포스트 여부
   * - 조회수 1000 이상 또는 좋아요 50 이상
   * - 홈 피드 추천에 사용
   */
  isPopular(): boolean {
    return this.viewCount >= 1000 || this.likeCount >= 50;
  }

  /**
   * 트렌딩 포스트 여부
   * - 최근 24시간 내 급증한 조회수 감지
   * - 별도 트렌딩 테이블과 함께 사용 (향후 확장)
   */
  isTrending(): boolean {
    // TODO: 시간별 조회수 증가율 계산 필요
    // 현재는 단순 기준으로 판단
    return this.viewCount >= 500 && this.likeCount >= 20;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      viewCount: this.viewCount,
      likeCount: this.likeCount,
      commentCount: this.commentCount,
      qualityScore: this.qualityScore,
      engagementScore: this.calculateEngagementScore(),
      isPopular: this.isPopular(),
      isTrending: this.isTrending(),
      updatedAt: this.updatedAt,
    };
  }
}
