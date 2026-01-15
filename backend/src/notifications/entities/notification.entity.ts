import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Post } from "../../posts/entities/post.entity";
import { Comment } from "../../comments/entities/comment.entity";

export const NotificationType = {
  FOLLOW: "FOLLOW",
  POST_LIKE: "POST_LIKE",
  COMMENT: "COMMENT",
  COMMENT_REPLY: "COMMENT_REPLY",
  BLOG_POST: "BLOG_POST",
  MENTION: "MENTION",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

@Entity("notifications")
@Index(["recipientId", "read"])
@Index(["recipientId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "recipient_id" })
  recipientId: string;

  @Column({ type: "uuid", name: "actor_id" })
  issuerId: string;

  @Column({ type: "uuid", nullable: true })
  postId?: string;

  @Column({ type: "uuid", nullable: true })
  commentId?: string;

  @Column({ type: "uuid", nullable: true })
  blogId?: string;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ default: false })
  read: boolean;

  @Column({ type: "text", nullable: true })
  message?: string;

  @ManyToOne(() => User, (user) => user.receivedNotifications, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "recipient_id" })
  recipient: User;

  @ManyToOne(() => User, (user) => user.issuedNotifications, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actor_id" })
  issuer: User;

  @ManyToOne(() => Post, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "postId" })
  post?: Post;

  @ManyToOne(() => Comment, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "commentId" })
  comment?: Comment;

  @CreateDateColumn()
  createdAt: Date;
}
