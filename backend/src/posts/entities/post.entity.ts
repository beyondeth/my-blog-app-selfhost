import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, JoinTable, BeforeInsert, BeforeUpdate, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { File } from '../../files/entities/file.entity';
import { Blog } from '../../blogs/entities/blog.entity';

@Entity('posts')
@Index(['isPublished'])
@Index(['authorId'])
@Index(['category'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true, nullable: true })
  slug: string;

  @Column('text')
  content: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  likeCount: number;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'uuid', nullable: true })
  blogId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  publishedAt: Date;

  @ManyToOne(() => User, user => user.posts)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @ManyToOne(() => Blog, blog => blog.posts, { nullable: true })
  @JoinColumn({ name: 'blogId' })
  blog: Blog;

  @OneToMany(() => Comment, comment => comment.post)
  comments: Comment[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'post_likes',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  likedBy: User[];

  @ManyToMany(() => File, file => file.posts)
  @JoinTable({
    name: 'post_files',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'fileId', referencedColumnName: 'id' },
  })
  attachedFiles: File[];

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (this.title && !this.slug) {
      const baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80); // 길이를 줄여서 timestamp 공간 확보
      
      // 날짜와 시간 추가로 고유성 보장
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const timestamp = now.getTime().toString().slice(-6); // 마지막 6자리
      this.slug = `${date}-${baseSlug}-${timestamp}`;
    }

    // 콘텐츠가 있을 때마다 썸네일 재생성 (이미지가 추가/제거될 수 있으므로)
    if (this.content) {
      this.extractThumbnailFromContent();
    }
  }

  // 콘텐츠에서 썸네일 추출
  private extractThumbnailFromContent() {
    // HTML에서 첫 번째 img 태그 찾기
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = this.content.match(imgRegex);
    
    if (match && match[1]) {
      let imageUrl = match[1];
      
      // S3 URL을 프록시 URL로 변환
      if (imageUrl.includes('amazonaws.com') || imageUrl.startsWith('uploads/')) {
        // S3 키 추출
        let s3Key = imageUrl;
        if (imageUrl.includes('amazonaws.com')) {
          const urlParts = imageUrl.split('/');
          const uploadsIndex = urlParts.findIndex(part => part === 'uploads');
          if (uploadsIndex !== -1) {
            s3Key = urlParts.slice(uploadsIndex).join('/');
          }
        }
        
        // 프록시 URL로 변환
        imageUrl = `http://localhost:3001/api/v1/files/proxy/${s3Key}`;
      }
      
      this.thumbnail = imageUrl;
    } else {
      // 콘텐츠에 이미지가 없으면 썸네일 제거
      this.thumbnail = null;
    }
  }
} 