import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { CommunityPost } from "./community-post.entity";
import { CommunityRemovalReason } from "./community-removal-reason.entity";
import { CommunityCommentLike } from "./community-comment-like.entity";

/**
 * CommunityComment 엔티티
 *
 * @description 커뮤니티 게시물의 댓글 정보를 저장합니다.
 * 트리 구조(대댓글)를 지원합니다.
 *
 * **설계 원칙:**
 * - 자기 참조 관계: parentCommentId로 대댓글 지원
 * - 소프트 삭제: isDeleted 플래그로 삭제 표시 (대댓글 보존)
 * - 좋아요/답글 수 비정규화: 성능 최적화
 */
import { Community } from "./community.entity";

@Entity("community_comments")
@Index(["postId", "createdAt"])
@Index(["communityId", "createdAt"])
@Index(["communityId", "isDeleted"])
@Index(["authorId"])
@Index(["parentCommentId"])
export class CommunityComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 댓글 내용
   */
  @Column("text")
  content: string;

  /**
   * 게시물 ID
   */
  @Column({ type: "uuid" })
  postId: string;

  /**
   * 커뮤니티 ID (비정규화)
   * - 성능 최적화: 조인 없이 커뮤니티 단위 집계 가능
   */
  @Column({ type: "uuid", nullable: true }) // Migration 후 NOT NULL 변경 예정
  communityId: string;

  /**
   * 작성자 ID
   */
  @Column({ type: "uuid" })
  authorId: string;

  /**
   * 부모 댓글 ID (대댓글인 경우)
   */
  @Column({ type: "uuid", nullable: true })
  parentCommentId: string;

  /**
   * 좋아요 수 (비정규화)
   */
  @Column({ default: 0 })
  likeCount: number;

  /**
   * 싫어요 수 (비정규화)
   * - Reddit 스타일 업보트/다운보트 지원
   */
  @Column({ default: 0 })
  dislikeCount: number;

  /**
   * 답글 수 (비정규화)
   */
  @Column({ default: 0 })
  replyCount: number;

  /**
   * 삭제 여부 (소프트 삭제)
   * - true일 때: "삭제된 댓글입니다" 표시, 대댓글은 유지
   */
  @Column({ default: false })
  isDeleted: boolean;

  /**
   * 삭제 사유 (직접 입력)
   */
  @Column("text", { nullable: true })
  removalReason?: string;

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

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => CommunityPost, (post) => post.comments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "postId" })
  post: CommunityPost;

  @ManyToOne(() => Community, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  /**
   * 부모 댓글 (대댓글인 경우)
   */
  @ManyToOne(() => CommunityComment, (comment) => comment.replies, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parentCommentId" })
  parentComment: CommunityComment;

  /**
   * 답글 목록
   */
  @OneToMany(() => CommunityComment, (comment) => comment.parentComment)
  replies: CommunityComment[];

  @OneToMany(() => CommunityCommentLike, (like) => like.comment)
  commentLikes: CommunityCommentLike[];

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
   * 최상위 댓글 여부 확인
   */
  isRootComment(): boolean {
    return !this.parentCommentId;
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      content: this.isDeleted ? null : this.content,
      postId: this.postId,
      authorId: this.authorId,
      author: this.isDeleted
        ? null
        : this.author
          ? {
              id: this.author.id,
              username: this.author.username,
              profileImage: (this.author as any).profile?.profileImage || null,
            }
          : null,
      parentCommentId: this.parentCommentId,
      likeCount: this.likeCount,
      dislikeCount: this.dislikeCount,
      replyCount: this.replyCount,
      isDeleted: this.isDeleted,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
