import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from './comment.entity';

export const LikeType = {
  LIKE: 'like',
  DISLIKE: 'dislike'
} as const;

export type LikeType = typeof LikeType[keyof typeof LikeType];

@Entity('comment_likes')
@Unique(['userId', 'commentId'])
export class CommentLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'userId' })
  userId: string;

  @Column({ type: 'uuid', name: 'commentId' })
  commentId: string;

  @Column({
    type: 'enum',
    enum: LikeType,
  })
  type: LikeType;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.commentLikes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Comment, comment => comment.commentLikes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment: Comment;
}