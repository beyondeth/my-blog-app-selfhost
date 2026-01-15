import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Post } from "./post.entity";
import { VoteType } from "../enums/vote-type.enum";

/**
 * @deprecated LikeType은 VoteType으로 대체되었습니다.
 * 하위 호환성을 위해 유지되지만, 새 코드에서는 VoteType을 사용하세요.
 */
export enum LikeType {
  LIKE = "like",
  DISLIKE = "dislike",
}

/**
 * PostLike 엔티티
 *
 * @description 포스트에 대한 사용자 투표 정보를 저장합니다.
 * Reddit 스타일의 업보트/다운보트 시스템을 지원합니다.
 *
 * **제약 조건:**
 * - (userId, postId) 유니크: 사용자당 하나의 투표만 허용
 * - 같은 포스트에 upvote와 downvote 동시 불가
 */
@Entity("post_likes")
@Unique(["userId", "postId"]) // 사용자당 1투표만 허용
export class PostLike {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @PrimaryColumn({ type: "uuid", name: "userId" })
  userId: string;

  @PrimaryColumn({ type: "uuid", name: "postId" })
  postId: string;

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

  @CreateDateColumn({ name: "createdAt" })
  createdAt: Date;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.postLikes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Post, (post) => post.postLikes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: Post;
}
