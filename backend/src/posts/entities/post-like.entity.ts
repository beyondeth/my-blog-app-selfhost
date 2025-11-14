import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, Unique, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from './post.entity';

export enum LikeType {
  LIKE = 'like',
  DISLIKE = 'dislike',
}

@Entity('post_likes')
@Unique(['userId', 'postId', 'type'])
export class PostLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @PrimaryColumn({ type: 'uuid', name: 'userId' })
  userId: string;

  @PrimaryColumn({ type: 'uuid', name: 'postId' })
  postId: string;

  @Column({
    type: 'enum',
    enum: LikeType,
    default: LikeType.LIKE,
  })
  type: LikeType;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.postLikes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Post, (post) => post.postLikes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;
}