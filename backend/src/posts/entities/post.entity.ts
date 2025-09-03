import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, JoinTable, BeforeInsert, BeforeUpdate, JoinColumn, Index, VersionColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
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

  @Column('text', { nullable: true, name: 'content_markdown' })
  content_markdown: string;  // 마크다운 원본 (편집용)

  @Column({ 
    type: 'varchar',
    default: 'html',
    nullable: true
  })
  content_type: string;

  @Column({ type: 'timestamp', nullable: true })
  content_rendered_at: Date;  // 렌더링 시점

  @Column({ nullable: true, name: 'thumbnail' })
  thumbnail: string;

  // New thumbnail image reference
  @Column({ type: 'uuid', nullable: true, name: 'thumbnail_image_id' })
  thumbnailImageId: string;

  @ManyToOne(() => File, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'thumbnail_image_id' })
  thumbnailImage: File;

  @Column({ default: false, name: 'isPublished' })
  isPublished: boolean;

  @Column({ default: 0, name: 'viewCount' })
  viewCount: number;

  @Column({ default: 0, name: 'likeCount' })
  likeCount: number;

  @Column({ default: 0, name: 'commentCount' })
  commentCount: number;

  @Column('simple-array', { nullable: true, name: 'tags' })
  tags: string[];

  @Column({ nullable: true, name: 'category' })
  category: string;

  @Column({ type: 'uuid', name: 'authorId' })
  authorId: string;

  @Column({ type: 'uuid', nullable: true, name: 'blogId' })
  blogId: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ nullable: true, name: 'publishedAt' })
  publishedAt: Date;

  @VersionColumn({ name: 'version' })
  version: number;

  @ManyToOne(() => User, user => user.posts, { onDelete: 'CASCADE' })
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

  // Helper method to get ordered images
  getOrderedImages?: () => Promise<(File & { imageOrder?: number })[]>;

  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (this.title && !this.slug) {
      const baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50); // UUID를 위한 공간 확보
      
      // UUID를 사용하여 완벽한 고유성 보장
      const uniqueId = uuidv4().split('-')[0]; // UUID의 첫 부분만 사용 (8자)
      this.slug = `${baseSlug}-${uniqueId}`;
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