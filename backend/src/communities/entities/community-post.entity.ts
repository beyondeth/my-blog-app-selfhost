import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { File } from "../../files/entities/file.entity";
import { Community } from "./community.entity";
import { CommunityFlair } from "./community-flair.entity";
import { CommunityComment } from "./community-comment.entity";
import { CommunityPostLike } from "./community-post-like.entity";
import { CommunityRemovalReason } from "./community-removal-reason.entity";
import { CommunityPostStatus } from "../enums";
import { generateShortId } from "../../posts/utils/post.utils";

/**
 * CommunityPost 엔티티
 *
 * @description 커뮤니티 게시물 정보를 저장합니다.
 * 기존 Post 엔티티와 완전 분리되어 독립적으로 운영됩니다.
 *
 * **설계 원칙:**
 * - UUID v7 사용: 시간 순서 정렬 지원
 * - slug 고유성: URL 식별자 (자동 생성: title + UUID 8자)
 * - 좋아요/댓글 수 비정규화: 성능 최적화
 * - 소프트 삭제: deletedAt으로 복구 가능
 *
 * **참고:**
 * - Post 엔티티의 slug 생성 패턴을 그대로 활용
 * - 향후 투표 시스템(upvote/downvote) 확장 고려
 */
@Entity("community_posts")
@Index(["slug"], { unique: true })
@Index(["communityId", "status", "createdAt"])
@Index(["authorId"])
@Index(["communityId", "isPinned", "createdAt"])
@Index(["communityId", "likeCount", "commentCount"])
export class CommunityPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * UUID v7 및 Slug 자동 생성
   *
   * @description
   * - UUID v7: 시간 순서 정렬 지원
   * - Slug: 8자리 16진수 short ID (URL 간결화)
   *   - 예: /c/{communitySlug}/comments/{shortId}
   *   - 약 40억 개 조합 가능 (충돌 확률 극히 낮음)
   */
  @BeforeInsert()
  generateUuidAndSlug() {
    // UUID 생성
    if (!this.id) {
      this.id = uuidv7();
    }

    // Slug 생성: 8자리 16진수 short ID
    if (!this.slug) {
      this.slug = generateShortId();
    }
  }

  /**
   * 게시물 제목
   */
  @Column({ length: 300 })
  title: string;

  /**
   * URL 슬러그 (고유)
   */
  @Column({ unique: true, length: 100 })
  slug: string;

  /**
   * 콘텐츠 (HTML)
   */
  @Column("text")
  content: string;

  /**
   * 콘텐츠 (마크다운 원본)
   */
  @Column("text", { nullable: true })
  content_markdown: string;

  /**
   * 커뮤니티 ID
   */
  @Column({ type: "uuid" })
  communityId: string;

  /**
   * 작성자 ID
   */
  @Column({ type: "uuid" })
  authorId: string;

  /**
   * 게시물 플레어 ID
   */
  @Column({ type: "uuid", nullable: true })
  flairId: string;

  /**
   * 썸네일 이미지 ID
   */
  @Column({ type: "uuid", nullable: true })
  thumbnailImageId: string;

  /**
   * 상단 고정 여부
   */
  @Column({ default: false })
  isPinned: boolean;

  /**
   * 댓글 잠금 여부
   */
  @Column({ default: false })
  isLocked: boolean;

  /**
   * NSFW 여부
   */
  @Column({ default: false })
  isNsfw: boolean;

  /**
   * 스포일러 여부
   */
  @Column({ default: false })
  isSpoiler: boolean;

  /**
   * 좋아요 수 (레거시, 비정규화)
   * @deprecated upvoteCount로 대체됨. 하위 호환성을 위해 유지.
   */
  @Column({ default: 0 })
  likeCount: number;

  /**
   * 업보트 수 (비정규화)
   * - community_post_likes 테이블에서 집계
   */
  @Column({ default: 0 })
  upvoteCount: number;

  /**
   * 다운보트 수 (비정규화)
   * - community_post_likes 테이블에서 집계
   */
  @Column({ default: 0 })
  downvoteCount: number;

  /**
   * 인기 점수 (Generated Column)
   * - 공식: upvoteCount - downvoteCount
   * - 용도: HOT 정렬 시 Index Scan 활용
   */
  @Column({
    type: "integer",
    default: 0,
  })
  @Index(["communityId", "hotScore", "createdAt"]) // HOT 정렬 최적화 인덱스
  hotScore: number;

  /**
   * 댓글 수 (비정규화)
   */
  @Column({ default: 0 })
  commentCount: number;

  /**
   * 조회 수
   */
  @Column({ default: 0 })
  viewCount: number;

  /**
   * 태그 목록
   */
  @Column("jsonb", { default: "[]" })
  tags: string[];

  /**
   * 게시물 상태
   */
  @Column({
    type: "enum",
    enum: CommunityPostStatus,
    default: CommunityPostStatus.PUBLISHED,
  })
  status: CommunityPostStatus;

  /**
   * 삭제 사유 (모더레이터 삭제 시) - 직접 입력 또는 템플릿 사용
   */
  @Column("text", { nullable: true })
  removalReason: string;

  /**
   * 삭제 사유 템플릿 ID (CommunityRemovalReason 참조)
   */
  @Column({ type: "uuid", nullable: true })
  removalReasonId?: string;

  /**
   * 삭제한 모더레이터 ID
   */
  @Column({ type: "uuid", nullable: true })
  removedById?: string;

  /**
   * 삭제 시간 (소프트 삭제 시점)
   */
  @Column({ type: "timestamp", nullable: true })
  removedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, (community) => community.posts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @ManyToOne(() => CommunityFlair, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "flairId" })
  flair: CommunityFlair;

  @ManyToOne(() => File, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "thumbnailImageId" })
  thumbnailImage: File;

  @OneToMany(() => CommunityComment, (comment) => comment.post)
  comments: CommunityComment[];

  @OneToMany(() => CommunityPostLike, (like) => like.post)
  likes: CommunityPostLike[];

  @ManyToOne(() => CommunityRemovalReason, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "removalReasonId" })
  removalReasonTemplate?: CommunityRemovalReason;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "removedById" })
  removedBy?: User;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 공개 상태 확인
   */
  isPublished(): boolean {
    return this.status === CommunityPostStatus.PUBLISHED;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      content: this.content,
      content_markdown: this.content_markdown,
      communityId: this.communityId,
      communitySlug: this.community?.slug || null,
      communityName: this.community?.name || null,
      authorId: this.authorId,
      author: this.author
        ? {
            id: this.author.id,
            username: this.author.username,
            profileImage: this.author.profile?.profileImage || null,
          }
        : null,
      flair: this.flair
        ? {
            id: this.flair.id,
            name: this.flair.name,
            backgroundColor: this.flair.backgroundColor,
            textColor: this.flair.textColor,
          }
        : null,
      thumbnailUrl: this.thumbnailImage?.fileUrl || null,
      isPinned: this.isPinned,
      isLocked: this.isLocked,
      isNsfw: this.isNsfw,
      isSpoiler: this.isSpoiler,
      likeCount: this.likeCount, // 하위 호환성
      upvoteCount: this.upvoteCount,
      downvoteCount: this.downvoteCount,
      score: this.upvoteCount - this.downvoteCount,
      commentCount: this.commentCount,
      viewCount: this.viewCount,
      tags: this.tags,
      status: this.status,
      createdAt:
        this.createdAt instanceof Date
          ? this.createdAt.toISOString()
          : this.createdAt,
      updatedAt:
        this.updatedAt instanceof Date
          ? this.updatedAt.toISOString()
          : this.updatedAt,
    };
  }
}
