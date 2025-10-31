import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Post } from './post.entity';

/**
 * PostMetadata 엔티티
 *
 * **설계 원칙 (체크포인트 1):**
 * - Post 테이블에서 메타데이터, SEO, 검색, 부가 기능 관련 정보만 분리
 * - Single Responsibility: 포스트 메타정보 및 검색 최적화 관리
 * - 1:1 관계로 Post와 연결
 * - UUID v7 사용으로 시간순 정렬 및 메타데이터 변경 이력 추적 용이
 *
 * **SEO 최적화:**
 * - excerpt: 검색 결과 스니펫용 요약
 * - tagList: 콘텐츠 분류 및 관련 포스트 추천
 * - category: 카테고리별 필터링
 * - searchVector: PostgreSQL 전문 검색 (tsvector)
 *
 * **백그라운드 처리:**
 * - content_rendered_at: 콘텐츠 렌더링 시점
 * - processingError: 비동기 처리 실패 시 에러 메시지
 * - processingCompletedAt: 백그라운드 작업 완료 시간
 * - indexedAt: 검색 인덱스 생성 시간
 */
@Entity('post_metadata')
@Index(['postId'], { unique: true }) // 1:1 관계 보장
@Index(['category']) // 카테고리별 필터링 최적화
@Index(['isEditorPick', 'editorPickedAt']) // 에디터픽 조회 최적화
@Index(['indexedAt']) // 검색 인덱싱 배치 작업용
export class PostMetadata {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬로 메타데이터 생성 순서 파악 용이
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * Post 관계 (1:1)
   * - onDelete: 'CASCADE' → Post 삭제 시 PostMetadata도 자동 삭제
   * - nullable: false → Post 없이 PostMetadata 존재 불가
   */
  @OneToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'uuid', nullable: false })
  postId: string;

  /**
   * 포스트 요약 (최대 200자)
   * - 목록 표시용
   * - 검색 결과 스니펫
   * - SNS 공유 시 미리보기
   * - null: 자동 생성 안 됨
   */
  @Column({ type: 'text', nullable: true })
  excerpt: string;

  /**
   * 태그 목록 (JSONB)
   * - 콘텐츠 분류 및 검색
   * - 관련 포스트 추천 알고리즘에 활용
   * - 최대 10개까지 권장
   * - 예: ["TypeScript", "NestJS", "PostgreSQL"]
   */
  @Column('jsonb', { default: [] })
  tagList: string[];

  /**
   * 카테고리
   * - 메인 분류 (1개만 허용)
   * - 카테고리별 필터링에 사용
   * - 기본값: '기타'
   *
   * **주요 카테고리:**
   * - 개발: Frontend, Backend, DevOps, Mobile
   * - 데이터: Database, AI/ML, Data Engineering
   * - 기타: Essay, Review, Tutorial
   */
  @Column({ default: '기타' })
  category: string;

  /**
   * 콘텐츠 타입
   * - 'html': TipTap 에디터 (기본)
   * - 'markdown': 마크다운 에디터
   * - 향후 확장: 'video', 'podcast' 등
   */
  @Column({ type: 'varchar', default: 'html', nullable: true })
  content_type: string;

  /**
   * 콘텐츠 렌더링 시점
   * - 마크다운 → HTML 변환 시간
   * - 캐시 무효화 기준
   * - null: 렌더링 안 됨 (draft 상태)
   */
  @Column({ type: 'timestamp', nullable: true })
  content_rendered_at: Date;

  /**
   * 발행 시각
   * - isPublished=true로 변경된 시점
   * - 최신 포스트 정렬 기준
   * - null: 미발행 (draft)
   */
  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  /**
   * 에디터픽 여부
   * - 관리자가 선정한 추천 포스트
   * - 홈 피드 최상단 노출
   * - 기본값: false
   */
  @Column({ default: false })
  isEditorPick: boolean;

  /**
   * 에디터픽 선정 시각
   * - 에디터픽 포스트를 최신순 정렬
   * - 관리자 로그 (누가 언제 선정했는지)
   * - null: 에디터픽 아님
   */
  @Column({ type: 'timestamp', nullable: true })
  editorPickedAt: Date;

  /**
   * 백그라운드 처리 에러 메시지
   * - 이미지 최적화 실패
   * - 검색 인덱싱 실패
   * - 썸네일 생성 실패 등
   * - 관리자 대시보드에서 확인
   */
  @Column({ type: 'text', nullable: true })
  processingError: string;

  /**
   * 백그라운드 처리 완료 시간
   * - Fast Path 직후 비동기 작업 완료 시점
   * - 모니터링: 처리 시간 추적
   * - null: 처리 중 또는 실패
   */
  @Column({ type: 'timestamp', nullable: true })
  processingCompletedAt: Date;

  /**
   * 전문 검색 벡터 (PostgreSQL tsvector)
   * - title + content + tagList의 텍스트를 벡터화
   * - GIN 인덱스 적용으로 빠른 전문 검색
   * - select: false → 기본 조회에서 제외 (성능 최적화)
   *
   * **업데이트 시점:**
   * - Post 생성/수정 시 트리거로 자동 업데이트
   * - 또는 배치 작업으로 주기적 재인덱싱
   */
  @Column({
    type: 'tsvector',
    nullable: true,
    select: false,
  })
  searchVector: string;

  /**
   * 검색 인덱싱 완료 시간
   * - searchVector 생성 시점
   * - 배치 작업: indexedAt이 null인 포스트만 인덱싱
   * - null: 미인덱싱 상태
   */
  @Column({ type: 'timestamp', nullable: true })
  indexedAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

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
   * 에디터픽 설정
   * - 관리자 API에서 호출
   * - 현재 시각을 editorPickedAt에 기록
   */
  setAsEditorPick(): void {
    this.isEditorPick = true;
    this.editorPickedAt = new Date();
  }

  /**
   * 에디터픽 해제
   */
  removeEditorPick(): void {
    this.isEditorPick = false;
    this.editorPickedAt = null;
  }

  /**
   * 검색 인덱싱 완료 표시
   * - 배치 작업에서 호출
   */
  markAsIndexed(): void {
    this.indexedAt = new Date();
  }

  /**
   * 백그라운드 처리 완료 표시
   */
  markProcessingComplete(): void {
    this.processingCompletedAt = new Date();
    this.processingError = null;
  }

  /**
   * 백그라운드 처리 실패 기록
   */
  markProcessingFailed(error: string): void {
    this.processingError = error;
    this.processingCompletedAt = null;
  }

  /**
   * 발행 시각 설정
   * - Post.isPublished = true로 변경 시 호출
   */
  setPublishedAt(): void {
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  }

  /**
   * 태그 추가
   * - 중복 방지
   * - 최대 10개까지만 허용
   */
  addTag(tag: string): boolean {
    if (this.tagList.length >= 10) return false;
    if (this.tagList.includes(tag)) return false;
    this.tagList.push(tag);
    return true;
  }

  /**
   * 태그 제거
   */
  removeTag(tag: string): boolean {
    const index = this.tagList.indexOf(tag);
    if (index === -1) return false;
    this.tagList.splice(index, 1);
    return true;
  }

  /**
   * 검색 인덱싱 필요 여부
   * - indexedAt이 null이거나
   * - updatedAt이 indexedAt보다 최신인 경우
   */
  needsReindexing(): boolean {
    if (!this.indexedAt) return true;
    return this.updatedAt > this.indexedAt;
  }

  /**
   * 백그라운드 처리 완료 여부
   */
  isProcessingComplete(): boolean {
    return !!this.processingCompletedAt && !this.processingError;
  }

  /**
   * 백그라운드 처리 실패 여부
   */
  hasProcessingError(): boolean {
    return !!this.processingError;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      excerpt: this.excerpt,
      tagList: this.tagList,
      category: this.category,
      content_type: this.content_type,
      publishedAt: this.publishedAt,
      isEditorPick: this.isEditorPick,
      editorPickedAt: this.editorPickedAt,
      isProcessingComplete: this.isProcessingComplete(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
