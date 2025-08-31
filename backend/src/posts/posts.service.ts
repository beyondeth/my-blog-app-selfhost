import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, SelectQueryBuilder, MoreThan } from 'typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { Role } from '../common/enums/role.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { FilesService } from '../files/files.service';
import { formatDate, extractImageUrlsFromContent, extractS3KeyFromUrl, generateSlug } from './utils/post.utils';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly MAX_POST_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB

  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(File)
    private filesRepository: Repository<File>,
    @InjectRepository(Blog)
    private blogsRepository: Repository<Blog>,
    private filesService: FilesService,
    private markdownRenderer: MarkdownRendererService,
  ) {}

  async create(createPostDto: CreatePostDto, user: User): Promise<any> {
    // 사용자의 블로그를 찾음 (한 사용자당 하나의 블로그)
    const blog = await this.blogsRepository.findOne({
      where: { userId: user.id },
    });

    if (!blog) {
      throw new BadRequestException('블로그를 먼저 생성해주세요.');
    }

    // 중복 포스트 생성 방지: 동일한 사용자가 동일한 제목으로 10초 내에 포스트 생성하는 것을 방지
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    const existingPost = await this.postsRepository.findOne({
      where: {
        title: createPostDto.title,
        author: { id: user.id },
        createdAt: MoreThan(tenSecondsAgo),
      },
    });

    if (existingPost) {
      throw new BadRequestException('동일한 제목의 게시글을 너무 빠르게 생성할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }

    // 하이브리드 저장 시스템: 마크다운과 HTML 모두 저장
    let processedContent = createPostDto.content;
    let markdownContent = null;
    let contentType: 'markdown' | 'html' = 'html';
    
    // 마크다운 콘텐츠인지 확인 (MCP에서 오는 경우)
    if (createPostDto.content_markdown) {
      // MCP에서 content_markdown만 보낸 경우
      markdownContent = createPostDto.content_markdown;
      processedContent = this.markdownRenderer.convertToHtml(markdownContent);
      contentType = 'markdown';
    } else if (createPostDto.content && this.isMarkdownContent(createPostDto.content)) {
      // content가 마크다운인 경우
      markdownContent = createPostDto.content;
      processedContent = this.markdownRenderer.convertToHtml(markdownContent);
      contentType = 'markdown';
    } else if (!createPostDto.content && !createPostDto.content_markdown) {
      // content와 content_markdown 둘 다 없는 경우
      throw new BadRequestException('게시글 내용이 필요합니다.');
    }

    const post = this.postsRepository.create({
      ...createPostDto,
      content: processedContent, // HTML 버전 (디스플레이용)
      content_markdown: markdownContent, // 마크다운 원본 (편집용)
      content_type: contentType,
      content_rendered_at: contentType === 'markdown' ? new Date() : null,
      author: user,
      blog: blog,
      blogId: blog.id,
      isPublished: true, // Multi-user blog system - all posts are published
      publishedAt: new Date(),
    });

    // Entity의 @BeforeInsert에서 UUID로 고유 slug 생성됨
    await this.postsRepository.save(post);

    let attachedFiles: File[] = [];
    if (createPostDto.attachedFileIds?.length) {
      attachedFiles = await this.filesRepository.find({
        where: { id: In(createPostDto.attachedFileIds), userId: user.id },
      });
      
      // 포스트당 총 파일 용량 검증
      await this.validatePostTotalSize(attachedFiles);
      
      post.attachedFiles = attachedFiles;
      await this.postsRepository.save(post);
    }

    await this.linkFilesFromContent(post);

    // DB 재조회 없이 메모리에서 조합
    return {
      ...post,
      author: user,
      blog: blog, // 블로그 정보 포함
      attachedFiles: post.attachedFiles || attachedFiles,
    };
  }

  private async findPostById(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'attachedFiles', 'blog'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findAll(
    page: number = 1, 
    limit: number = 10, 
    search?: string, 
    blogSlug?: string,
    user?: User,
    isPublished?: boolean
  ): Promise<{ posts: any[]; total: number; page: number; totalPages: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'files')
      .leftJoinAndSelect('post.blog', 'blog');

    // Admin can see all posts, regular users only see published posts
    if (user?.role === Role.ADMIN) {
      // Admin: filter by isPublished only if explicitly requested
      if (isPublished !== undefined) {
        query.where('post.isPublished = :isPublished', { isPublished });
      }
    } else {
      // Regular users: always show only published posts
      query.where('post.isPublished = :isPublished', { isPublished: true });
    }

    if (blogSlug) {
      query.andWhere('blog.slug = :blogSlug', { blogSlug });
    }

    if (search) {
      query.andWhere('(post.title LIKE :search OR post.content LIKE :search OR post.tags LIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 날짜를 YYYY-MM-DD로 변환
    const postsWithFormattedDates = posts.map(post => ({
      ...post,
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
      // 첨부된 이미지 파일들
      images: post.attachedFiles?.filter(file => file.fileType === 'image') || [],
      commentCount: post.commentCount || 0,
    }));

    const totalPages = Math.ceil(total / limit);

    return { 
      posts: postsWithFormattedDates, 
      total,
      page,
      totalPages 
    };
  }

  async findOne(id: string, user?: User): Promise<any> {
    this.logger.log(`Finding post by ID: ${id}`);
    // QueryBuilder로 필요한 컬럼만 select, 사용자 좋아요 상태도 포함
    const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.likedBy', 'likedBy')
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.commentCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'author.id', 'author.username', 'author.profileImage', 'author.role', 'author.bio',
        'file.id', 'file.fileUrl', 'file.fileType',
        'blog.id', 'blog.slug', 'blog.name', 'blog.isPublic', 'blog.userId',
        'likedBy.id',
      ])
      .where('post.id = :id', { id });
    const post = await qb.getOne();
    if (!post) {
      this.logger.warn(`Post not found for ID: ${id}`);
      throw new NotFoundException('Post not found');
    }
    
    // 블로그가 비공개인 경우, 소유자가 아니면 특별한 응답 반환
    if (!post.blog.isPublic) {
      this.logger.log(`Private blog check - User ID: ${user?.id}, Blog userId: ${post.blog.userId}, Post Author ID: ${post.author?.id}`);
      // 블로그 소유자 또는 포스트 작성자인 경우 접근 허용
      const isOwner = user && (String(user.id) === String(post.blog.userId) || String(user.id) === String(post.author?.id));
      if (!isOwner) {
        this.logger.log(`Access denied to private blog for user ${user?.id}`);
        return {
          isPrivate: true,
          message: '비공개 블로그입니다'
        };
      }
      this.logger.log(`Access granted to private blog for owner/author ${user?.id}`);
    }
    
    // 사용자 좋아요 상태 확인
    const liked = user ? post.likedBy?.some(likedUser => likedUser.id === user.id) || false : false;
    
    // 날짜 포맷 등 기존 가공 유지
    const result = {
      ...post,
      liked, // 사용자 좋아요 상태 추가
      likedBy: undefined, // 민감한 정보 제거
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
    };
    this.logger.log(`Returning post data with ${result.attachedFiles?.length || 0} attached files`);
    return result;
  }

  async findBySlug(slug: string, user?: User): Promise<any> {
    // QueryBuilder로 필요한 컬럼만 select, 사용자 좋아요 상태도 포함
    const qb = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.attachedFiles', 'file')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.likedBy', 'likedBy')
      .select([
        'post.id', 'post.title', 'post.slug', 'post.content', 'post.thumbnail',
        'post.isPublished', 'post.viewCount', 'post.likeCount', 'post.commentCount', 'post.tags', 'post.category',
        'post.publishedAt', 'post.createdAt', 'post.updatedAt',
        'author.id', 'author.username', 'author.profileImage', 'author.role', 'author.bio',
        'file.id', 'file.fileUrl', 'file.fileType',
        'blog.id', 'blog.slug', 'blog.name', 'blog.isPublic', 'blog.userId',
        'likedBy.id',
      ])
      .where('post.slug = :slug', { slug })
      .andWhere('post.isPublished = :isPublished', { isPublished: true });
    const post = await qb.getOne();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    
    // 블로그가 비공개인 경우, 소유자가 아니면 특별한 응답 반환
    if (!post.blog.isPublic) {
      this.logger.log(`Private blog check - User ID: ${user?.id}, Blog userId: ${post.blog.userId}, Post Author ID: ${post.author?.id}`);
      // 블로그 소유자 또는 포스트 작성자인 경우 접근 허용
      const isOwner = user && (String(user.id) === String(post.blog.userId) || String(user.id) === String(post.author?.id));
      if (!isOwner) {
        this.logger.log(`Access denied to private blog for user ${user?.id}`);
        return {
          isPrivate: true,
          message: '비공개 블로그입니다'
        };
      }
      this.logger.log(`Access granted to private blog for owner/author ${user?.id}`);
    }
    
    // 조회수 증가 (모든 사용자)
    await this.incrementViewCountForAll(post.id);
    
    // 사용자 좋아요 상태 확인
    const liked = user ? post.likedBy?.some(likedUser => likedUser.id === user.id) || false : false;
    
    // 날짜 포맷 등 기존 가공 유지
    const result = {
      ...post,
      liked, // 사용자 좋아요 상태 추가
      likedBy: undefined, // 민감한 정보 제거
      publishedAt: formatDate(post.publishedAt),
      createdAt: formatDate(post.createdAt),
      updatedAt: formatDate(post.updatedAt),
      viewCount: post.viewCount + 1, // 증가된 조회수 반영
    };
    this.logger.log(`Returning post data with ${result.attachedFiles?.length || 0} attached files`);
    return result;
  }

  async update(id: string, updatePostDto: any, user: User): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'attachedFiles'],
    });

    if (!post) throw new NotFoundException('Post not found');
    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own posts');
    }

    // 하이브리드 저장 시스템: 마크다운 업데이트 처리
    let processedContent = updatePostDto.content;
    let markdownContent = updatePostDto.content_markdown;
    
    // 마크다운이 업데이트된 경우
    if (updatePostDto.content_markdown && updatePostDto.content_markdown !== post.content_markdown) {
      markdownContent = updatePostDto.content_markdown;
      processedContent = this.markdownRenderer.convertToHtml(markdownContent);
      post.content_type = 'markdown';
      post.content_rendered_at = new Date();
    }
    // HTML이 직접 업데이트된 경우
    else if (updatePostDto.content && updatePostDto.content !== post.content) {
      processedContent = updatePostDto.content;
      // 마크다운 원본이 없고 HTML이 변경된 경우, content_type을 html로 설정
      if (!post.content_markdown) {
        post.content_type = 'html';
      }
    }

    if (processedContent && processedContent !== post.content) {
      await this.cleanupUnusedImages(post.id, post.content, processedContent, user.id);
    }

    // 업데이트 적용
    Object.assign(post, {
      ...updatePostDto,
      content: processedContent,
      content_markdown: markdownContent,
    });

    // Title 변경 시 slug는 변경하지 않음 (이미 고유한 UUID 포함)
    // SEO를 위해 기존 slug 유지가 더 좋음
    if (processedContent) {
      post.thumbnail = this.extractThumbnailFromContent(processedContent);
    }

    await this.postsRepository.save(post);

    if (updatePostDto.attachedFileIds !== undefined) {
      const files = await this.filesRepository.find({
        where: { id: In(updatePostDto.attachedFileIds), userId: user.id },
      });
      post.attachedFiles = files;
      await this.postsRepository.save(post);
    }

    await this.linkFilesFromContent(post);

    // DB 재조회 없이 메모리에서 조합
    return {
      ...post,
      author: post.author,
      attachedFiles: post.attachedFiles,
    };
  }

  async remove(id: string, user: User): Promise<void> {
    const post = await this.findPostById(id);

    if (post.author.id !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postsRepository.remove(post);
  }

  // 관리자용 메소드들
  async findAllForAdmin(page: number = 1, limit: number = 10, search?: string): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author');

    if (search) {
      query.where('(post.title LIKE :search OR post.content LIKE :search OR post.tags LIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [posts, total] = await query
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  async publish(id: string): Promise<Post> {
    const post = await this.findPostById(id);
    post.isPublished = true;
    post.publishedAt = new Date();
    return this.postsRepository.save(post);
  }

  async unpublish(id: string): Promise<Post> {
    const post = await this.findPostById(id);
    post.isPublished = false;
    post.publishedAt = null;
    return this.postsRepository.save(post);
  }

  async getStats(): Promise<any> {
    const totalPosts = await this.postsRepository.count();
    const publishedPosts = await this.postsRepository.count({ where: { isPublished: true } });
    const draftPosts = totalPosts - publishedPosts;

    const topCategories = await this.postsRepository
      .createQueryBuilder('post')
      .select('post.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category IS NOT NULL')
      .groupBy('post.category')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      topCategories,
    };
  }

  private async attachFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const files = await this.filesRepository.find({
      where: { id: In(fileIds), userId: userId },
    });
    await this.postsRepository.update(postId, { attachedFiles: files });
  }

  private async updateAttachedFiles(postId: string, fileIds: string[], userId: string): Promise<void> {
    const files = fileIds && fileIds.length > 0
      ? await this.filesRepository.find({ where: { id: In(fileIds), userId: userId } })
      : [];
    await this.postsRepository.update(postId, { attachedFiles: files });
  }

  private async linkFilesFromContent(post: Post): Promise<void> {
    try {
      const imageUrls = this.extractImageUrlsFromContent(post.content);
      if (imageUrls.length === 0) return;
      const s3Keys = imageUrls.map(url => this.extractS3KeyFromUrl(url)).filter(Boolean) as string[];
      if (s3Keys.length === 0) return;
      const files = await this.filesRepository.find({ where: { fileKey: In(s3Keys), userId: post.author.id } });
      if (files.length > 0) {
        const existingFileIds = post.attachedFiles?.map(f => f.id) || [];
        const newFiles = files.filter(f => !existingFileIds.includes(f.id));
        if (newFiles.length > 0) {
          post.attachedFiles = [...(post.attachedFiles || []), ...newFiles];
          await this.postsRepository.save(post);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to link files from content for post ${post.id}:`, error.message);
    }
  }

  // UUID 기반 S3 키 추출 개선
  private extractS3KeyFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      // 이미 S3 키인 경우 (uploads/로 시작)
      if (url.startsWith('uploads/')) {
        return url;
      }
      
      // 프록시 URL인 경우 (/api/v1/files/proxy/ 포함)
      if (url.includes('/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0]; // 쿼리 파라미터 제거
          this.logger.log(`Extracted S3 key from proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      // S3 직접 URL인 경우 (UUID 파일명 포함)
      const s3Pattern = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
      const match = url.match(s3Pattern);
      if (match) {
        const s3Key = match[1].split('?')[0]; // 쿼리 파라미터 제거 (presigned URL의 경우)
        this.logger.log(`Extracted S3 key from S3 URL: ${url} -> ${s3Key}`);
        return s3Key;
      }
      
      // localhost 프록시 URL 처리 (개발 환경)
      if (url.includes('localhost:3000/api/v1/files/proxy/')) {
        const proxyMatch = url.match(/localhost:3000\/api\/v1\/files\/proxy\/(.+)/);
        if (proxyMatch) {
          const s3Key = proxyMatch[1].split('?')[0];
          this.logger.log(`Extracted S3 key from localhost proxy URL: ${url} -> ${s3Key}`);
          return s3Key;
        }
      }
      
      this.logger.warn(`Could not extract S3 key from URL: ${url}`);
      return null;
    } catch (error) {
      this.logger.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  // 좋아요 토글 (최적화된 원자적 업데이트)
  async toggleLike(id: string, user: User | null): Promise<{ liked: boolean }> {
    if (!user?.id) throw new ForbiddenException('로그인한 유저만 좋아요를 누를 수 있습니다.');
    
    // 1. 현재 좋아요 상태 확인 (트랜잭션 없이)
    const existingLike = await this.postsRepository.manager
      .query(
        'SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
        [id, user.id]
      );

    const isLiked = existingLike.length > 0;

    // 2. 한 번의 트랜잭션으로 원자적 처리
    await this.postsRepository.manager.transaction(async manager => {
      if (isLiked) {
        // 좋아요 취소
        await manager.query(
          'DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2',
          [id, user.id]
        );
        await manager.query(
          'UPDATE posts SET "likeCount" = GREATEST(0, "likeCount" - 1), version = version + 1 WHERE id = $1',
          [id]
        );
      } else {
        // 좋아요 추가 (ON CONFLICT로 중복 방지)
        const insertResult = await manager.query(
          'INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2) ON CONFLICT ("postId", "userId") DO NOTHING RETURNING *',
          [id, user.id]
        );
        
        // 실제로 삽입되었을 때만 카운트 증가
        if (insertResult.length > 0) {
          await manager.query(
            'UPDATE posts SET "likeCount" = "likeCount" + 1, version = version + 1 WHERE id = $1',
            [id]
          );
        }
      }
    });

    return { liked: !isLiked };
  }

  // 조회수 증가 (로그인 유저만)
  private async incrementViewCountForUser(post: Post, user: User) {
    if (!user?.id) return;
    post.viewCount = (post.viewCount || 0) + 1;
    await this.postsRepository.save(post);
  }

  // 조회수 증가 (모든 사용자)
  private async incrementViewCountForAll(postId: string): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'viewCount', 1);
  }

  // 공개 API: 조회수 증가 (모든 사용자)
  async incrementViewCount(postId: string): Promise<void> {
    const post = await this.postsRepository.findOne({
      where: { id: postId, isPublished: true }
    });
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    
    await this.incrementViewCountForAll(postId);
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.postsRepository
      .createQueryBuilder('post')
      .select('DISTINCT post.category', 'category')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category IS NOT NULL')
      .getRawMany();

    return categories.map(cat => cat.category);
  }

  async getPostsByCategory(category: string, page: number = 1, limit: number = 10): Promise<{ posts: Post[]; total: number }> {
    const query = this.postsRepository.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category = :category', { category });

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  // 댓글 수 증가
  async incrementCommentCount(postId: string): Promise<void> {
    await this.postsRepository.increment({ id: postId }, 'commentCount', 1);
  }

  // 댓글 수 감소
  async decrementCommentCount(postId: string): Promise<void> {
    await this.postsRepository.decrement({ id: postId }, 'commentCount', 1);
  }

  // ❌ DEPRECATED: Entity의 @BeforeInsert에서 UUID로 고유성 보장
  // 이 메소드는 더 이상 사용되지 않음 (DB 부하 방지)
  // private async ensureUniqueSlug(post: Post): Promise<void> {}

  async generateMissingSlugs(): Promise<void> {
    const postsWithoutSlugs = await this.postsRepository.find({
      where: { slug: null },
    });

    for (const post of postsWithoutSlugs) {
      const baseSlug = post.title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
      
      // 날짜 추가로 고유성 보장 (생성일 기준)
      const date = post.createdAt.toISOString().split('T')[0];
      const slug = `${date}-${baseSlug}`;
      
      // 중복 체크
      let finalSlug = slug;
      let counter = 1;
      while (await this.postsRepository.findOne({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      
      post.slug = finalSlug;
      await this.postsRepository.save(post);
    }
  }

  // 포스트 ID로 블로그 정보 가져오기
  async getBlogByPostId(postId: string): Promise<any> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['blog'],
    });
    
    if (!post || !post.blog) {
      throw new NotFoundException('Post or blog not found');
    }
    
    return post.blog;
  }

  // 기존 게시글들의 파일 연결 재처리 (UUID 기반)
  async relinkContentFiles(): Promise<void> {
    const posts = await this.postsRepository.find({
      relations: ['author'],
    });

    this.logger.log(`Starting to relink content files for ${posts.length} posts`);

    for (const post of posts) {
      try {
        await this.linkFilesFromContent(post);
        this.logger.log(`✅ Relinked files for post: ${post.title}`);
      } catch (error) {
        this.logger.error(`❌ Failed to relink files for post ${post.id}:`, error.message);
      }
    }

    this.logger.log('Finished relinking content files');
  }

  // 사용되지 않는 이미지 파일 정리 (S3 + DB)
  // @deprecated 자동 삭제 비활성화 - 사용자가 수동으로 관리하도록 변경
  private async cleanupUnusedImages(postId: string, oldContent: string, newContent: string, userId: string): Promise<void> {
    // 자동 이미지 삭제 비활성화
    // 이유: 사용자가 나중에 재사용할 수 있는 이미지를 보존하기 위함
    // 추후 사용자 대시보드에서 수동 관리 기능 제공 예정
    this.logger.log('[Image Cleanup] Auto-cleanup disabled - preserving all uploaded images');
    
    // 분석용 로깅만 수행 (실제 삭제는 하지 않음)
    try {
      const oldImageUrls = this.extractImageUrlsFromContent(oldContent);
      const newImageUrls = this.extractImageUrlsFromContent(newContent);
      const removedImageUrls = oldImageUrls.filter(url => !newImageUrls.includes(url));
      
      if (removedImageUrls.length > 0) {
        this.logger.log(`[Image Cleanup] ${removedImageUrls.length} images removed from post ${postId} (not deleted):`, removedImageUrls);
      }
    } catch (error) {
      this.logger.error('[Image Cleanup] Analysis failed:', error.message);
    }
    
    return;
  }

  // 콘텐츠에서 이미지 URL 추출 (img 태그의 src 속성)
  private extractImageUrlsFromContent(content: string): string[] {
    if (!content) return [];

    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const urls: string[] = [];
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      if (match[1]) {
        // 쿼리 파라미터 제거
        const cleanUrl = match[1].split('?')[0];
        urls.push(cleanUrl);
      }
    }

    return urls;
  }

  // 콘텐츠에서 썸네일 URL 추출
  private extractThumbnailFromContent(content: string): string | null {
    if (!content) return null;

    // HTML에서 첫 번째 img 태그의 src 추출
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * 포스트당 총 파일 용량 검증
   * @param files 업로드할 파일들
   * @param existingPostId 기존 포스트 ID (수정 시)
   */
  async validatePostTotalSize(files: File[], existingPostId?: string): Promise<void> {
    let totalSize = 0;

    // 신규 파일들의 총 크기 계산
    for (const file of files) {
      totalSize += file.fileSize || 0;
    }

    // 기존 포스트 수정인 경우, 이미 업로드된 파일들의 크기도 포함
    if (existingPostId) {
      // Post와 연관된 파일들을 찾기 위해 FileContext를 통해 조회
      const existingPost = await this.postsRepository.findOne({
        where: { id: existingPostId },
        relations: ['attachedFiles'],
      });
      
      if (existingPost?.attachedFiles) {
        for (const existingFile of existingPost.attachedFiles) {
          // 새로 추가되는 파일과 중복되지 않는 경우만 계산
          if (!files.some(f => f.id === existingFile.id)) {
            totalSize += existingFile.fileSize || 0;
          }
        }
      }
    }

    // 30MB 제한 체크
    if (totalSize > this.MAX_POST_TOTAL_SIZE) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const limitMB = (this.MAX_POST_TOTAL_SIZE / (1024 * 1024)).toFixed(0);
      
      throw new BadRequestException({
        error: 'POST_SIZE_LIMIT_EXCEEDED',
        message: `포스트당 최대 ${limitMB}MB까지 업로드 가능합니다. 현재 크기: ${totalSizeMB}MB`,
        current: totalSize,
        limit: this.MAX_POST_TOTAL_SIZE,
      });
    }
  }

  /**
   * 신규 파일 업로드 시 포스트 용량 체크
   */
  async validateNewFileForPost(postId: string, newFileSize: number): Promise<void> {
    // Post와 연관된 파일들을 찾기
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingFiles = post.attachedFiles || [];
    const totalSize = existingFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0);

    if (totalSize + newFileSize > this.MAX_POST_TOTAL_SIZE) {
      const currentSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const newSizeMB = (newFileSize / (1024 * 1024)).toFixed(2);
      const limitMB = (this.MAX_POST_TOTAL_SIZE / (1024 * 1024)).toFixed(0);
      
      throw new BadRequestException({
        error: 'POST_SIZE_LIMIT_EXCEEDED',
        message: `포스트당 최대 ${limitMB}MB까지 업로드 가능합니다. 현재: ${currentSizeMB}MB, 추가하려는 파일: ${newSizeMB}MB`,
        current: totalSize,
        limit: this.MAX_POST_TOTAL_SIZE,
        requested: newFileSize,
      });
    }
  }

  // 마크다운 콘텐츠인지 확인하는 헬퍼 메소드
  private isMarkdownContent(content: string): boolean {
    if (!content) return false;
    
    // 마크다운 패턴 검사
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 헤딩
      /\*\*.*\*\*/, // 굵은 글씨
      /\*.*\*/, // 기울임
      /^\s*[-*+]\s+/m, // 리스트
      /^\s*\d+\.\s+/m, // 번호 리스트
      /```[\s\S]*?```/, // 코드 블록
      /`[^`]+`/, // 인라인 코드
      /\[.*?\]\(.*?\)/, // 링크
      /!\[.*?\]\(.*?\)/, // 이미지
      /^---$/m, // 수평선
      /^>\s+/m, // 인용문
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }

  // 마크다운 재렌더링 (필요시 호출)
  async rerenderMarkdown(postId: string): Promise<void> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post || !post.content_markdown) {
      throw new NotFoundException('Post with markdown content not found');
    }
    
    post.content = this.markdownRenderer.convertToHtml(post.content_markdown);
    post.content_rendered_at = new Date();
    post.thumbnail = this.extractThumbnailFromContent(post.content);
    
    await this.postsRepository.save(post);
  }

} 