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
import { CommunityPost } from "./community-post.entity";
import { VoteType } from "../../posts/enums/vote-type.enum";

/**
 * CommunityPostLike 엔티티
 *
 * @description 커뮤니티 게시물에 대한 사용자 투표 정보를 저장합니다.
 * Reddit 스타일의 업보트/다운보트 시스템을 지원합니다.
 *
 * **설계 원칙:**
 * - (postId, userId) 유니크 제약: 사용자당 하나의 투표만 허용
 * - LikeService 패턴 활용: 분산락 + 트랜잭션으로 동시성 제어
 * - VoteType enum으로 upvote/downvote 구분
 */
@Entity("community_post_likes")
@Unique(["postId", "userId"])
@Index(["userId"])
export class CommunityPostLike {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 게시물 ID
   */
  @Column({ type: "uuid" })
  postId: string;

  /**
   * 사용자 ID
   */
  @Column({ type: "uuid" })
  userId: string;

  /**
   * 투표 타입 (upvote/downvote)
   * - upvote: 긍정적 투표
   * - downvote: 부정적 투표
   */
  @Column({
    type: "enum",
    enum: VoteType,
    enumName: "vote_type_enum",
    default: VoteType.UPVOTE,
  })
  type: VoteType;

  @CreateDateColumn()
  createdAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => CommunityPost, (post) => post.likes, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "postId" })
  post: CommunityPost;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
