import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
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
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { File } from '../../files/entities/file.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { Bookmark } from '../../bookmarks/entities/bookmark.entity';
import { PostStats } from './post-stats.entity';
import { PostMetadata } from './post-metadata.entity';

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
   * - UUID v4 (기존 포스트 호환성)
   * - 신규 포스트는 애플리케이션 레벨에서 UUID v7 생성 가능 (향후 마이그레이션)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
   * 썸네일 이미지 URL
   * - 목록 표시용
   * - YouTube 썸네일 또는 콘텐츠 첫 이미지 자동 추출
   * - nullable: 이미지 없는 포스트
   */
  @Column({ nullable: true })
  thumbnail: string;

  /**
   * 썸네일 이미지 ID (File 참조)
   * - S3 업로드 이미지 참조
   * - files 테이블의 UUID
   * - nullable: 외부 URL 사용 시
   */
  @Column({ type: 'uuid', nullable: true })
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
   * - cascade: true → Post 저장 시 PostStats도 함께 저장
   * - eager: false → 명시적으로 join 필요 (성능 최적화)
   */
  @OneToOne(() => PostStats, (stats) => stats.post, {
    cascade: true,
    eager: false,
  })
  stats?: PostStats;

  /**
   * PostMetadata 관계 (1:1)
   * - 메타정보 (excerpt, tagList, category, SEO, 검색)
   */
  @OneToOne(() => PostMetadata, (metadata) => metadata.post, {
    cascade: true,
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
   * Bookmark 관계 (1:N)
   */
  @OneToMany(() => Bookmark, (bookmark) => bookmark.post)
  bookmarks?: Bookmark[];

  // =====================================
  // 메서드 (Methods)
  // =====================================

  /**
   * Slug 자동 생성
   * - title 기반으로 SEO 친화적 URL 생성
   * - UUID 8자 추가로 고유성 보장
   * - 썸네일 자동 추출 (YouTube 또는 첫 이미지)
   */
  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    // Slug 생성
    if (this.title && !this.slug) {
      const baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50); // UUID를 위한 공간 확보

      // UUID를 사용하여 완벽한 고유성 보장
      const uniqueId = uuidv4().split('-')[0]; // UUID의 첫 부분만 사용 (8자)
      this.slug = `${baseSlug}-${uniqueId}`;
    }

    // 썸네일 자동 추출
    // thumbnail이 명시적으로 설정되지 않은 경우에만 content에서 추출
    // YouTube 썸네일 등 외부 URL이 설정된 경우 유지
    if (this.content && !this.thumbnail) {
      this.extractThumbnailFromContent();
    }
  }

  /**
   * 콘텐츠에서 썸네일 추출
   * - 우선순위 1: YouTube 비디오 → YouTube 썸네일
   * - 우선순위 2: HTML img 태그 → S3 프록시 URL
   * - 없으면 null
   */
  private extractThumbnailFromContent() {
    // 1. YouTube 비디오 확인
    const youtubeRegex = /<iframe[^>]+class="youtube-video"[^>]+src="[^"]*\/embed\/([a-zA-Z0-9_-]+)/i;
    const youtubeMatch = this.content.match(youtubeRegex);

    if (youtubeMatch && youtubeMatch[1]) {
      const videoId = youtubeMatch[1];
      const youtubeUrlPattern = process.env.YOUTUBE_THUMBNAIL_URL || 'https://img.youtube.com/vi/{id}/maxresdefault.jpg';
      this.thumbnail = youtubeUrlPattern.replace('{id}', videoId);
      return;
    }

    // 2. HTML img 태그 확인
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = this.content.match(imgRegex);

    if (match && match[1]) {
      let imageUrl = match[1];

      // S3 URL을 프록시 URL로 변환
      if (imageUrl.includes('amazonaws.com') || imageUrl.startsWith('uploads/')) {
        // S3 키 추출
        let s3Key = imageUrl;
        if (imageUrl.includes('amazonaws.com')) {
          const urlParts = imageUrl.split('/');
          const uploadsIndex = urlParts.findIndex((part) => part === 'uploads');
          if (uploadsIndex !== -1) {
            s3Key = urlParts.slice(uploadsIndex).join('/');
          }
        }

        // 프록시 URL로 변환
        imageUrl = `http://localhost:3001/api/v1/files/proxy/${s3Key}`;
      }

      this.thumbnail = imageUrl;
    } else {
      // 콘텐츠에 이미지가 없으면 썸네일 제거
      this.thumbnail = null;
    }
  }

  /**
   * Helper method to get ordered images
   * - 기존 코드 호환성 유지
   */
  getOrderedImages?: () => Promise<(File & { imageOrder?: number })[]>;

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
      thumbnail: this.thumbnail,
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

      // PostStats 데이터 (join 시에만 포함)
      viewCount: this.stats?.viewCount || 0,
      likeCount: this.stats?.likeCount || 0,
      commentCount: this.stats?.commentCount || 0,
      qualityScore: this.stats?.qualityScore || null,
      isPopular: this.stats?.isPopular() || false,
      isTrending: this.stats?.isTrending() || false,

      // PostMetadata 데이터 (join 시에만 포함)
      excerpt: this.metadata?.excerpt || null,
      tagList: this.metadata?.tagList || [],
      category: this.metadata?.category || '기타',
      content_type: this.metadata?.content_type || 'html',
      publishedAt: this.metadata?.publishedAt || null,
      isEditorPick: this.metadata?.isEditorPick || false,
      editorPickedAt: this.metadata?.editorPickedAt || null,
    };
  }
}
