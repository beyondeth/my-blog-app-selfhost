import { Entity, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

/**
 * 북마크 엔티티 - 사용자와 포스트의 다대다 관계
 * 동시성 처리를 위해 복합 PK와 유니크 제약 사용
 */
@Entity('bookmarks')
@Unique(['userId', 'postId'])  // 중복 북마크 방지
@Index('idx_bookmark_user_created', ['userId', 'createdAt'])  // 사용자별 최신순 조회 최적화
@Index('idx_bookmark_post', ['postId'])  // 포스트별 북마크 조회 최적화
export class Bookmark {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'uuid', name: 'post_id' })
  postId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 관계 설정
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Post, post => post.bookmarks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;
}