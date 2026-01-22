import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { CommunityPost } from "./community-post.entity";

/**
 * 커뮤니티 북마크 엔티티
 * CommunityPost에 대한 북마크 저장
 */
@Entity("community_bookmarks")
@Unique(["userId", "postId"])
@Index("idx_community_bookmark_user_created", ["userId", "createdAt"])
@Index("idx_community_bookmark_post", ["postId"])
export class CommunityBookmark {
  @PrimaryColumn({ type: "uuid", name: "user_id" })
  userId: string;

  @PrimaryColumn({ type: "uuid", name: "post_id" })
  postId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => CommunityPost, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: CommunityPost;
}
