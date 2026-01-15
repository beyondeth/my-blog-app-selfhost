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
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Post } from "../../posts/entities/post.entity";
import { CommentLike } from "./comment-like.entity";

import { Blog } from "../../blogs/entities/blog.entity";

@Entity("comments")
@Index(["blogId", "createdAt"])
export class Comment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  content: string;

  /**
   * 작성자 IP 주소 (암호화됨, 보안상 기본 조회 제외)
   */
  @Column({ name: "ip_address", length: 150, nullable: true, select: false })
  ipAddress: string;

  /**
   * 브라우저/기기 정보
   */
  @Column({ name: "user_agent", type: "text", nullable: true, select: false })
  userAgent: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: "int", default: 0 })
  likesCount: number;

  @Column({ type: "int", default: 0 })
  dislikesCount: number;

  @Column({ type: "int", default: 0 })
  repliesCount: number;

  @Column({ type: "uuid", name: "authorId" })
  authorId: string;

  @Column({ type: "uuid", name: "postId" })
  postId: string;

  /**
   * 블로그 ID (비정규화)
   * - 성능 최적화: 조인 없이 블로그 단위 집계 가능
   */
  @Column({ type: "uuid", nullable: true })
  blogId: string;

  @Column({ type: "uuid", nullable: true, name: "parentCommentId" })
  parentCommentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date;

  @ManyToOne(() => User, (user) => user.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: Post;

  @ManyToOne(() => Blog, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "blogId" })
  blog: Blog;

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true })
  @JoinColumn({ name: "parentCommentId" })
  parentComment: Comment;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];

  @OneToMany(() => CommentLike, (commentLike) => commentLike.comment)
  commentLikes: CommentLike[];
}
