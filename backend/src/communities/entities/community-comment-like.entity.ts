import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { CommunityComment } from "./community-comment.entity";

/**
 * 댓글 좋아요/싫어요 타입 상수
 *
 * @description 블로그 댓글 시스템(comment-like.entity.ts)과 동일한 패턴
 */
export const CommentLikeType = {
  LIKE: "like",
  DISLIKE: "dislike",
} as const;

export type CommentLikeType =
  (typeof CommentLikeType)[keyof typeof CommentLikeType];

/**
 * CommunityCommentLike 엔티티
 *
 * @description 커뮤니티 댓글에 대한 사용자 좋아요/싫어요 정보를 저장합니다.
 * Reddit 스타일의 업보트/다운보트 시스템을 지원합니다.
 *
 * **설계 원칙:**
 * - (commentId, userId) 유니크 제약: 사용자당 하나의 좋아요/싫어요만 허용
 * - 상호배타 로직: like와 dislike는 동시에 존재할 수 없음
 * - 토글 방식: 같은 타입 클릭 시 취소, 다른 타입 클릭 시 변경
 *
 * **참고:**
 * - 블로그 댓글 시스템: backend/src/comments/entities/comment-like.entity.ts
 * - 커뮤니티 게시물 좋아요: backend/src/communities/entities/community-post-like.entity.ts
 */
@Entity("community_comment_likes")
@Unique(["commentId", "userId"])
@Index(["userId"])
@Index(["commentId"])
export class CommunityCommentLike {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 댓글 ID
   */
  @Column({ type: "uuid" })
  commentId: string;

  /**
   * 사용자 ID
   */
  @Column({ type: "uuid" })
  userId: string;

  /**
   * 좋아요/싫어요 타입
   * - like: 좋아요 (업보트)
   * - dislike: 싫어요 (다운보트)
   */
  @Column({
    type: "enum",
    enum: CommentLikeType,
    enumName: "community_comment_like_type_enum",
  })
  type: CommentLikeType;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => CommunityComment, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "commentId" })
  comment: CommunityComment;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
