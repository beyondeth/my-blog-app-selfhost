
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
  JoinColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { File } from '../../files/entities/file.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { Bookmark } from '../../bookmarks/entities/bookmark.entity';
import { PostStats } from './post-stats.entity';
import { PostMetadata } from './post-metadata.entity';
import { PostLike } from './post-like.entity';

/**
 * Post 엔티티 (슬림화 버전)
 *
 * **설계 원칙 (체크포인트 1):**
 * - 핵심 콘텐츠 정보만 보유 (38 → 14 columns)
 * - Single Responsibility: 포스트 콘텐츠 관리
 * - 통계, 메타데이터 정보는 별도 테이블로 분리 (1:1 관계)
 *
 * **분리된 테이블:**
 * - PostStats: 통계 정보 (viewCount, likeCount, commentCount, qualityScore)
 * - PostMetadata: 메타정보 (excerpt, tagList, category, SEO, 검색)
 *
 * **장점:**
 * - 테이블 락 최소화 (통계 업데이트 시 콘텐츠 락 불필요)
 * - 명확한 책임 분리 (SOLID 원칙)
 * - 확장성 향상 (각 테이블 독립적 확장)
 * - 쿼리 성능 향상 (필요한 데이터만 조회)
 */
@Entity('posts')
@Index(['isPublished'])
@Index(['authorId'])
@Index(['blogId'])
@Index(['isDeleted'])
@Index(['status'])
export class Post {
  /**
   * 기본 키
   * - UUID v7 (시간 순서 정렬 지원)
   * - K-정렬 가능: 포스트 목록 시 정렬 성능 향상
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * UUID v7 및 Slug 생성 (BeforeInsert 훅)
   * - 시간 기반 UUID 생성으로 포스트 순서 보장
   * - 최신 포스트 우선 조회 시 인덱스 성능 향상
   * - Slug 자동 생성
   */
  @BeforeInsert()
  generateUuidAndSlug() {
    // UUID 생성
    if (!this.id) {
      this.id = uuidv7();
    }

    // Slug 생성
    if (this.title && !this.slug) {
      // SEO를 위해 제목을 슬러그로 변환
      const baseSlug = this.title
        .trim() // 앞뒤 공백 제거
        .toLowerCase()
        .replace(/[^a-zA-Z0-9가-힣\s]/g, '') // 특수문자 제거 (공백과 한글,영문,숫자 유지)
        .replace(/\s+/g, '-') // 공백을 하이픈으로 변환
        .replace(/-+/g, '-') // 중복 하이픈 제거
        .replace(/^-|-$/g, '') // 시작/끝 하이픈 제거
        .substring(0, 50); // UUID를 위한 공간 확보

      // UUID를 사용하여 완벽한 고유성 보장
      const uniqueId = uuidv7().split('-')[0]; // UUID의 첫 부분만 사용 (8자)

      // baseSlug가 비어있는 경우를 대비한 fallback
      const finalBaseSlug = baseSlug || 'post';
      this.slug = `${finalBaseSlug}-${uniqueId}`;

      // Debug 로깅 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Slug Generation]', {
          title: this.title,
          baseSlug,
          finalBaseSlug,
          uniqueId,
          finalSlug: this.slug,
        });
      }
    }
  }

  /**
   * 제목
   * - 포스트 메인 타이틀
   * - slug 생성 기준
   */
  @Column()
  title: string;

  /**
   * URL 슬러그 (고유)
   * - SEO 친화적 URL: /blog/username/posts/my-post-title-abc123
   * - 자동 생성: title + UUID 8자 (고유성 보장)
   * - unique 제약조건
   */
  @Column({ unique: true, nullable: true })
  slug: string;

  /**
   * 콘텐츠 (HTML)
   * - TipTap 에디터 렌더링 결과
   * - 실제 화면에 표시되는 HTML
   * - text 타입 (무제한)
   */
  @Column('text')
  content: string;

  /**
   * 콘텐츠 (마크다운 원본)
   * - 마크다운 에디터 사용 시 원본 저장
   * - 편집 시 사용
   * - nullable: HTML 에디터는 null
   */
  @Column('text', { nullable: true })
  content_markdown: string;

  /**
   * 콘텐츠 타입
   * - html: HTML 에디터 (기본값)
   * - markdown: 마크다운 에디터
   */
  @Column({ name: 'content_type', default: 'html' })
  content_type: string;

  
  /**
   * 썸네일 이미지 ID (File 참조)
   * - S3 업로드 이미지 참조
   * - files 테이블의 UUID
   * - nullable: 썸네일 없는 포스트
   */
  @Column({ name: 'thumbnail_image_id', type: 'uuid', nullable: true })
  thumbnailImageId: string;

  /**
   * 발행 상태
   * - true: 공개 (모두 볼 수 있음)
   * - false: 비공개 (draft, 작성자만 볼 수 있음)
   */
  @Column({ default: false })
  isPublished: boolean;

  /**
   * 소프트 삭제 플래그
   * - true: 삭제됨 (UI에서 숨김, 법적 보존)
   * - false: 정상
   * - 180일 후 물리적 삭제
   */
  @Column({ default: false })
  @Index()
  isDeleted: boolean;

  /**
   * 소프트 삭제 시간
   * - isDeleted가 true로 변경된 시점
   * - 180일 후 자동 물리 삭제 기준
   */
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  /**
   * 작성자 ID (User 참조)
   */
  @Column({ type: 'uuid' })
  authorId: string;

  /**
   * 블로그 ID (Blog 참조)
   * - nullable: 블로그 없이 직접 작성 가능 (향후 확장)
   */
  @Column({ type: 'uuid', nullable: true })
  blogId: string;

  /**
   * 포스트 처리 상태
   * - draft: 임시 저장
   * - processing: 백그라운드 처리 중 (Fast Path 직후)
   * - published: 발행 완료 (Worker 처리 완료)
   * - failed: 처리 실패
   *
   * Fast Path + Queue 최적화용
   */
  @Column({ type: 'varchar', default: 'published' })
  @Index()
  status: 'draft' | 'processing' | 'published' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =====================================
  // 관계 (Relationships)
  // =====================================

  /**
   * PostStats 관계 (1:1)
   * - 통계 정보 (viewCount, likeCount, commentCount, qualityScore)
   * - cascade 제거: 무한 재귀 호출 방지를 위해 명시적으로 저장
   * - eager: false → 명시적으로 join 필요 (성능 최적화)
   */
  @OneToOne(() => PostStats, (stats) => stats.post, {
    eager: false,
  })
  stats?: PostStats;

  /**
   * PostMetadata 관계 (1:1)
   * - 메타정보 (excerpt, tagList, category, SEO, 검색)
   * - cascade 제거: 무한 재귀 호출 방지를 위해 명시적으로 저장
   */
  @OneToOne(() => PostMetadata, (metadata) => metadata.post, {
    eager: false,
  })
  metadata?: PostMetadata;

  /**
   * User 관계 (작성자)
   * - onDelete: 'CASCADE' → User 삭제 시 Post도 삭제
   */
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author?: User;

  /**
   * Blog 관계
   * - nullable: true
   */
  @ManyToOne(() => Blog, (blog) => blog.posts, { nullable: true })
  @JoinColumn({ name: 'blogId' })
  blog?: Blog;

  /**
   * File 관계 (썸네일)
   * - onDelete: 'SET NULL' → File 삭제 시 thumbnailImageId만 null 처리
   */
  @ManyToOne(() => File, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'thumbnail_image_id' })
  thumbnailImage?: File;

  /**
   * Comment 관계 (1:N)
   */
  @OneToMany(() => Comment, (comment) => comment.post)
  comments?: Comment[];

  /**
   * Like 관계 (M:N)
   * - post_likes 조인 테이블
   */
  @ManyToMany(() => User)
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  likedBy?: User[];

  /**
   * File 관계 (첨부 파일)
   * - post_files 조인 테이블
   */
  @ManyToMany(() => File, (file) => file.posts)
  @JoinTable({
    name: 'post_files',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'fileId', referencedColumnName: 'id' },
  })
  attachedFiles?: File[];

  /**
   * PostLike 관계 (1:N)
   */
  @OneToMany(() => PostLike, (postLike) => postLike.post)
  postLikes?: PostLike[];

  /**
   * Bookmark 관계 (1:N)
   */
  @OneToMany(() => Bookmark, (bookmark) => bookmark.post)
  bookmarks?: Bookmark[];

  // =====================================
  // 메서드 (Methods)
  // =====================================

  /**
   * Slug 업데이트 (BeforeUpdate 훅)
   * - 제목 변경 시 슬러그 업데이트 (선택적)
   */
  @BeforeUpdate()
  generateSlug() {
    // 썸네일 자동 추출 로직 제거 - 사용자가 직접 선택하도록 변경
  }

  /**
   * Helper method to get ordered images
   * - 기존 코드 호환성 유지
   */
  getOrderedImages?: () => Promise<(File & { imageOrder?: number })[]>;

  // =====================================
  // 기존 posts 테이블 컬럼 (Phase 1 마이그레이션 전 호환성 유지)
  // =====================================
  /**
   * Phase 1 리팩토링 계획:
   * - 현재는 posts 테이블에 직접 저장됨
   * - 향후 post_stats, post_metadata 테이블로 점진적 마이그레이션 예정
   * - 지금은 호환성을 위해 posts 테이블 컬럼으로 유지
   */

  // 통계 정보는 PostStats 엔티티로 이동 완료
  // @Column({ default: 0 })
  // viewCount: number; // PostStats.viewCount 사용

  // @Column({ default: 0 })
  // likeCount: number; // PostStats.likeCount 사용

  // @Column({ default: 0 })
  // commentCount: number; // PostStats.commentCount 사용

  @Column({ nullable: true })
  qualityScore: number;

  @Column({ default: 1 })
  version: number;

  // 메타데이터 정보 (향후 post_metadata로 이동 예정)
  @Column('text', { nullable: true })
  excerpt: string;

  @Column({
    name: 'tags',
    type: 'jsonb',
    default: '[]'
  })
  tags: string[];

  @Column({ default: '기타' })
  category: string;

  @Column({ default: false })
  isEditorPick: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editorPickedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({ type: 'tsvector', nullable: true, select: false })
  search_vector: any; // PostgreSQL tsvector 타입

  @Column({ name: 'indexed_at', type: 'timestamp', nullable: true })
  indexedAt: Date;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError: string;

  @Column({ name: 'processing_completed_at', type: 'timestamp', nullable: true })
  processingCompletedAt: Date;

  // Transient 필드 (별도 테이블, @Column() 없음)
  // post_metadata에만 존재하는 필드들
  isEditorsPick?: boolean; // post_metadata.isEditorsPick (복수형)
  codeBlockCount?: number;
  imageCount?: number;
  isBackgroundProcessed?: boolean;

  /**
   * 공개 JSON 변환
   * - API 응답용
   * - join된 stats, metadata 포함
   */
  toPublicJSON() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      content: this.content,
      content_markdown: this.content_markdown,
      isPublished: this.isPublished,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,

      // Author 데이터
      authorId: this.authorId,
      author: this.author ? {
        id: this.author.id,
        username: this.author.username,
        profileImage: this.author.profile?.profileImage || null,
      } : null,

      // Blog 데이터
      blogId: this.blogId,
      blogSlug: this.blog?.slug || null,

      // 썸네일 데이터 (thumbnailImage 관계를 통해)
      thumbnailImageId: this.thumbnailImageId,
      thumbnailUrl: this.thumbnailImage?.fileUrl || null,

      // PostStats 데이터 (join 시에만 포함)
      viewCount: this.stats?.viewCount || 0,
      likeCount: this.stats?.likeCount || 0,
      commentCount: this.stats?.commentCount || 0,
      qualityScore: this.stats?.qualityScore || null,
      isPopular: this.stats?.isPopular() || false,
      isTrending: this.stats?.isTrending() || false,

      // PostMetadata 데이터 (join 시에만 포함)
      excerpt: this.metadata?.excerpt || null,
      tags: this.tags || this.metadata?.tags || [], // Post 엔티티의 tags를 우선적으로 사용
      category: this.category || this.metadata?.category || '기타', // category도 동일하게 처리
      content_type: this.metadata?.content_type || 'html',
      publishedAt: this.metadata?.publishedAt || null,
      isEditorPick: this.metadata?.isEditorPick || false,
      editorPickedAt: this.metadata?.editorPickedAt || null,
    };
  }
}
