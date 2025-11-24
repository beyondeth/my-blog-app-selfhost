import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Like, In, DataSource } from 'typeorm';
import { Post } from '../entities/post.entity';
import { PostStats } from '../entities/post-stats.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { Blog } from '../../blogs/entities/blog.entity';
import { PostMapperService } from './post-mapper.service';
import { BookmarksService } from '../../bookmarks/bookmarks.service';
import { MaterializedViewService } from '../../common/services/materialized-view.service';
import { PostInteractionStatusService } from './post-interaction-status.service';
import { GetPostsCursorDto } from '../dto/get-posts-cursor.dto';
import { CursorPaginatedPostsDto } from '../dto/cursor-paginated-posts.dto';

/**
 * 포스트 조회 및 검색 서비스
 *
 * 책임:
 * - 포스트 조회 (단건, 리스트, 커서 기반 페이징)
 * - 검색 (전문 검색, 태그 검색)
 * - 정렬 및 필터링
 * - 인기 포스트 조회
 */
@Injectable()
export class PostReadService {
  private readonly logger = new Logger(PostReadService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    @InjectRepository(Blog)
    private readonly blogsRepository: Repository<Blog>,
    private readonly postMapperService: PostMapperService,
    private readonly bookmarksService: BookmarksService,
    private readonly materializedViewService: MaterializedViewService,
    private readonly postInteractionStatusService: PostInteractionStatusService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 포스트를 ID로 조회
   *
   * @param id 포스트 ID
   * @param relations 로드할 관계 데이터
   * @param user 사용자 정보 (썸네일, 좋아요 상태 확인용)
   * @returns 포스트 응답 DTO
   */
  async findById(id: string, relations: string[] = [], user?: User): Promise<any> {
    // 쿼리 빌더로 최적화 - 필요한 관계만 선택적으로 로드
    let query = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.thumbnailImage', 'thumbnailImage')
      .leftJoinAndSelect('post.attachedFiles', 'attachedFiles')  // 상세 페이지에 필요
      .leftJoinAndSelect('post.stats', 'stats')
      // metadata에서 필요한 컬럼만 선택
      .leftJoin('post.metadata', 'metadata')
      .addSelect([
        'metadata.excerpt',
        'metadata.tags',
        'metadata.category',
        'metadata.content_rendered_at',
        'metadata.isEditorPick',
        'metadata.wordCount',
        'metadata.readingTimeMinutes'
      ])
      .where('post.id = :id', { id });

    // 추가 관계가 있으면 추가 (필요 시에만)
    if (relations.length > 0) {
      relations.forEach(relation => {
        if (!['author', 'author.profile', 'blog', 'thumbnailImage', 'attachedFiles', 'stats', 'metadata'].includes(relation)) {
          query.leftJoinAndSelect(`post.${relation}`, relation);
        }
      });
    }

    const post = await query.getOne();

    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    // 게시글이 비공개인 경우
    if (!post.isPublished) {
      // 작성자 본인 또는 블로그 소유자만 접근 가능
      if (!user || (post.authorId !== user.id && post.blog.userId !== user.id && user.role !== Role.ADMIN)) {
        throw new NotFoundException('포스트를 찾을 수 없습니다.');
      }
    }

    // 사용자 상호작용 상태 확인 (북마크 + 좋아요 한 번에 조회)
    let interactionStatus = { bookmarked: false, liked: false };
    if (user) {
      const interactionStatuses = await this.postInteractionStatusService.getMultipleInteractionStatuses(
        [post.id],
        user.id
      );
      interactionStatus = interactionStatuses.get(post.id) || { bookmarked: false, liked: false };
    }

    // PostMapperService를 사용하여 DTO 변환
    return this.postMapperService.toPostDto(post, {
      user: post.author,
      blog: post.blog,
      bookmarked: interactionStatus.bookmarked,
      liked: interactionStatus.liked,
    });
  }

  /**
   * 포스트를 slug로 조회
   *
   * @param slug 포스트 slug
   * @param user 사용자 정보 (인증 상태 확인용)
   * @returns 포스트 상세 정보
   */
  async findBySlug(slug: string, user?: User): Promise<any> {
    this.logger.log(`[findBySlug] Looking up slug: ${slug}`);

    const post = await this.postsRepository.findOne({
      where: { slug },
      relations: ['author', 'author.profile', 'blog', 'thumbnailImage', 'attachedFiles', 'stats', 'metadata'],
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // 게시글이 비공개인 경우
    if (!post.isPublished) {
      // 작성자 본인 또는 블로그 소유자만 접근 가능
      if (!user || (post.authorId !== user.id && post.blog.userId !== user.id)) {
        throw new NotFoundException('게시글을 찾을 수 없습니다.');
      }
    }

    // 조회수 증가 (공개 게시글만)
    if (post.isPublished) {
      // 비동기적으로 조회수 증가
      this.incrementViewCount(post.id).catch(error => {
        this.logger.error(`Failed to increment view count for post ${post.id}:`, error);
      });
    }

    // 사용자 상호작용 상태 확인 (북마크 + 좋아요 한 번에 조회)
    let interactionStatus = { bookmarked: false, liked: false };
    if (user) {
      const interactionStatuses = await this.postInteractionStatusService.getMultipleInteractionStatuses(
        [post.id],
        user.id
      );
      interactionStatus = interactionStatuses.get(post.id) || { bookmarked: false, liked: false };
    }

    // PostMapperService를 사용하여 DTO 변환
    return this.postMapperService.toPostDto(post, {
      user: post.author,
      blog: post.blog,
      bookmarked: interactionStatus.bookmarked,
      liked: interactionStatus.liked,
    });
  }

  /**
   * 커서 기반 페이징으로 포스트 목록 조회
   *
   * @param dto 조회 조건 DTO
   * @param user 사용자 정보
   * @returns 커서 기반 페이징된 포스트 목록
   */
  async getPostsCursor(dto: GetPostsCursorDto, user?: User): Promise<CursorPaginatedPostsDto> {
    this.logger.debug(`[getPostsCursor] Query: ${JSON.stringify(dto)}`);

    // 최적화된 쿼리 빌더 (필수 관계만 로드)
    let query = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.thumbnailImage', 'thumbnailImage')
      .leftJoinAndSelect('post.stats', 'stats')
      // 성능 최적화: metadata에서 필요한 컬럼만 선택
      .leftJoin('post.metadata', 'metadata')
      .addSelect([
        'metadata.excerpt',
        'metadata.tags',
        'metadata.category',
        'metadata.isEditorPick'
      ])
      // 성능 최적화: attachedFiles는 필요할 때만 별도 조회 (파일 목록은 상세 페이지에서만 필요)

    // where 조건 배열
    const whereConditions: string[] = [];
    const parameters: Record<string, any> = {};

    // 게시된 글만 조회 (인증하지 않은 경우)
    if (!user) {
      whereConditions.push('post.isPublished = :isPublished');
      whereConditions.push('blog.isPublic = :isPublic');
      whereConditions.push('post.isDeleted = :isDeleted');
      parameters.isPublished = true;
      parameters.isPublic = true;
      parameters.isDeleted = false;
    }

    // 특정 블로그 필터 (blogId 우선)
    if (dto.blogId) {
      whereConditions.push('blog.id = :blogId');
      parameters.blogId = dto.blogId;
    } else if (dto.blogSlug) {
      whereConditions.push('blog.slug = :blogSlug');
      parameters.blogSlug = dto.blogSlug;
    }

    // 카테고리 필터
    if (dto.category) {
      whereConditions.push('post.category = :category');
      parameters.category = dto.category;
    }

    // 태그 필터 (JSONB 배열)
    if (dto.tag) {
      whereConditions.push('post.tags @> :tag');
      parameters.tag = JSON.stringify([dto.tag]);
    }

    // 검색 처리
    if (dto.search) {
      const sanitizedSearch = dto.search.trim().slice(0, 100);
      if (sanitizedSearch) {
        // PostgreSQL 정규식을 사용하여 특수문자 제거
        const normalizedSearch = sanitizedSearch
          .replace(/[|&;#$%<>"'`{}\\]/g, '')
          .replace(/\s+/g, ' & ');

        this.logger.debug(`[Search] Original: "${dto.search}", Normalized: "${normalizedSearch}"`);

        try {
          if (normalizedSearch.includes(' ')) {
            // 여러 단어 검색
            query
              .addSelect(
                `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
                'search_rank'
              )
              .andWhere(
                `post.search_vector @@ to_tsquery('simple', :searchQuery)`,
                { searchQuery: normalizedSearch }
              );
          } else {
            // 단일 단어 검색
            query
              .addSelect(
                `ts_rank(post.search_vector, plainto_tsquery('simple', :searchQuery))`,
                'search_rank'
              )
              .andWhere(
                `post.search_vector @@ plainto_tsquery('simple', :searchQuery)`,
                { searchQuery: normalizedSearch }
              );
          }
        } catch (error) {
          this.logger.warn(`[Search] Full-text search failed, falling back to ILIKE: ${error.message}`);
          // 폴백: 간단한 ILIKE 검색
          query
            .andWhere(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(post.tags) as tag WHERE tag ILIKE :searchTerm)`, {
              searchTerm: `${sanitizedSearch}`,
            });
        }
      }
    }

    // 날짜 범위 필터
    if (dto.dateFrom) {
      whereConditions.push('post.publishedAt >= :dateFrom');
      parameters.dateFrom = dto.dateFrom;
    }
    if (dto.dateTo) {
      whereConditions.push('post.publishedAt <= :dateTo');
      parameters.dateTo = dto.dateTo;
    }

    // where 조건 적용
    if (whereConditions.length > 0) {
      query.where(whereConditions.join(' AND '), parameters);
    }

    // 정렬 조건
    switch (dto.sortBy) {
      case 'published':
        query.orderBy('post.publishedAt', dto.sortOrder || 'DESC');
        break;
      case 'views':
        query.orderBy('stats.viewCount', dto.sortOrder || 'DESC');
        break;
      case 'likes':
        query.orderBy('stats.likeCount', dto.sortOrder || 'DESC');
        break;
      case 'comments':
        query.orderBy('stats.commentCount', dto.sortOrder || 'DESC');
        break;
      case 'title':
        query.orderBy('post.title', dto.sortOrder || 'ASC');
        break;
      case 'editorPicks':
        query.orderBy('post.isEditorPick', 'DESC').addOrderBy('post.publishedAt', 'DESC');
        break;
      default:
        if (dto.search) {
          query.orderBy('search_rank', 'DESC').addOrderBy('post.publishedAt', 'DESC');
        } else {
          query.orderBy('post.publishedAt', 'DESC');
        }
    }

    // 커서 페이징
    if (dto.cursor) {
      const cursorDirection = dto.sortOrder === 'ASC' ? '>' : '<';
      const sortField = dto.sortBy === 'editorPicks' ? 'post.isEditorPick' : 'post.publishedAt';

      if (dto.search) {
        query.andWhere(`(search_rank, post.publishedAt) ${cursorDirection} (:searchRank, :cursor)`, {
          searchRank: dto.cursorRank || 0,
          cursor: dto.cursor,
        });
      } else {
        query.andWhere(`${sortField} ${cursorDirection} :cursor`, {
          cursor: dto.cursor,
        });
      }
    }

    // 결과 수 제한
    const limit = Math.min(dto.limit || 20, 100);
    query.limit(limit + 1); // +1 for hasNext check

    // 쿼리 실행
    const posts = await query.getMany();

    // 포스트 ID 목록 추출 (배치 조회용)
    const postIds = posts.map(post => post.id);

    // 한 번의 쿼리로 모든 포스트의 북마크 상태 조회
    const bookmarkStatuses = user
      ? await this.bookmarksService.getMultipleBookmarkStatuses(postIds, user.id)
      : new Map<string, boolean>();

    // 응답 데이터 병렬 변환 (성능 최적화)
    const transformedPosts = await Promise.all(
      posts.map(async (post) => {
        const postDto = await this.postMapperService.toPostDto(post, {
          user: post.author,
          blog: post.blog,
          bookmarked: bookmarkStatuses.get(post.id) || false,
          liked: false, // TODO: 좋아요 상태 확인
        });

        // 검색 랭크 추가 (검색인 경우)
        if (dto.search && (post as any).search_rank) {
          (postDto as any).searchRank = (post as any).search_rank;
        }

        return postDto;
      })
    );

    // hasNext 확인
    const hasNext = posts.length > limit;
    if (hasNext) {
      transformedPosts.pop(); // 제거된 마지막 항목은 다음 페이지 확인용
    }

    // 다음 커서 설정
    let nextCursor = null;
    let nextCursorRank = null;
    if (hasNext && posts.length > 0) {
      const lastPost = posts[posts.length - 1];
      nextCursor = lastPost.publishedAt.toISOString();

      if (dto.search && (lastPost as any).search_rank) {
        nextCursorRank = (lastPost as any).search_rank;
      }
    }

    return {
      posts: transformedPosts,
      nextCursor,
      nextCursorRank,
      hasMore: hasNext,
      count: transformedPosts.length,
    };
  }

  /**
   * 인기 포스트 목록 조회 (Materialized View 사용)
   *
   * @param period 기간 (daily, weekly, monthly, all)
   * @param limit 조회 개수
   * @returns 인기 포스트 목록
   */
  async findPopularPosts(
    period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly',
    limit: number = 10
  ): Promise<Post[]> {
    this.logger.debug(`[findPopularPosts] Period: ${period}, Limit: ${limit}`);

    // Materialized View에서 모든 데이터 조회 (author, blog 정보 포함)
    // 더 이상 재조회 불필요!
    const popularPosts = await this.materializedViewService.getPopularPosts(limit * 2); // 날짜 필터링 고려하여 여유있게 조회

    if (popularPosts.length === 0) {
      return [];
    }

    // 기간 필터링 (메모리에서 처리)
    let filteredPosts = popularPosts;

    if (period !== 'all') {
      const now = new Date();
      let dateFrom: Date;

      switch (period) {
        case 'daily':
          // 오늘 0시 (KST 기준)
          dateFrom = new Date(now);
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          // 7일 전
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          // 30일 전
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // 날짜 필터링
      filteredPosts = popularPosts.filter(post => {
        const publishedAt = new Date(post.publishedAt);
        return publishedAt >= dateFrom;
      });
    }

    // limit 적용
    const limitedPosts = filteredPosts.slice(0, limit);

    // MV 데이터를 Post 엔티티 형식으로 변환
    return limitedPosts.map(mvPost => {
      // Post 엔티티로 매핑
      const post = new Post();
      post.id = mvPost.id;
      post.title = mvPost.title;
      post.slug = mvPost.slug;
      post.excerpt = mvPost.excerpt;
      post.publishedAt = new Date(mvPost.publishedAt);
      post.createdAt = new Date(mvPost.createdAt);

      // 최소 Author 정보 매핑 (username만)
      const user = new User();
      user.id = mvPost.authorId;
      user.username = mvPost.authorUsername;

      post.author = user;

      // 최소 Blog 정보 매핑 (slug만 - URL 생성용)
      if (mvPost.blogId) {
        const blog = {
          id: mvPost.blogId,
          slug: mvPost.blogSlug,
        };
        post.blog = blog as any;
      }

      // Thumbnail 정보 매핑
      if (mvPost.thumbnail) {
        post.thumbnailImage = {
          id: mvPost.thumbnailImageId,
          fileUrl: mvPost.thumbnail,
        } as any;
      }

      // Stats 정보 매핑
      post.stats = {
        viewCount: mvPost.viewCount || 0,
        likeCount: mvPost.likeCount || 0,
        commentCount: mvPost.commentCount || 0,
      } as any;

      return post;
    });
  }

  /**
   * Editor's Pick 포스트 목록 조회
   *
   * @param limit 조회 개수
   * @returns Editor's Pick 포스트 목록
   */
  async getEditorPicks(limit: number = 5): Promise<Post[]> {
    // 쿼리 빌더로 최적화 - 필요한 컬럼만 선택
    let query = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.thumbnailImage', 'thumbnailImage')
      .leftJoinAndSelect('post.stats', 'stats')
      // metadata에서 필요한 컬럼만 선택
      .leftJoin('post.metadata', 'metadata')
      .addSelect([
        'metadata.excerpt',
        'metadata.tags',
        'metadata.category',
        'metadata.isEditorPick',
        'metadata.editorPickedAt'
      ])
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('metadata.isEditorPick = :isEditorPick', { isEditorPick: true })
      .orderBy('metadata.editorPickedAt', 'DESC')
      .addOrderBy('post.publishedAt', 'DESC')
      .take(limit);

    return query.getMany();
  }

  /**
   * 모든 카테고리 목록 조회
   *
   * @returns 카테고리 목록
   */
  async getCategories(): Promise<string[]> {
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('DISTINCT post.category', 'category')
      .where('post.isPublished = true')
      .andWhere('post.category IS NOT NULL')
      .andWhere("post.category != ''")
      .orderBy('category', 'ASC')
      .getRawMany();

    return result.map(row => row.category);
  }

  /**
   * 특정 카테고리의 포스트 목록 조회
   *
   * @param category 카테고리
   * @param page 페이지 번호
   * @param limit 페이지당 개수
   * @returns 포스트 목록과 총 개수
   */
  async getPostsByCategory(
    category: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ posts: Post[]; total: number }> {
    // 쿼리 빌더로 최적화
    let query = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('author.profile', 'profile')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoinAndSelect('post.thumbnailImage', 'thumbnailImage')
      .leftJoinAndSelect('post.stats', 'stats')
      // metadata에서 필요한 컬럼만 선택
      .leftJoin('post.metadata', 'metadata')
      .addSelect([
        'metadata.excerpt',
        'metadata.tags',
        'metadata.category'
      ])
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.category = :category', { category })
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const posts = await query.getMany();

    // 전체 개수는 간단히 카운트
    const total = await this.postsRepository.count({
      where: {
        isPublished: true,
        category,
      },
    });

    return { posts, total };
  }

  /**
   * 인기 태그 조회
   *
   * @param limit 조회 개수
   * @returns 태그와 사용 횟수 목록
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    // PostgreSQL JSONB 배열을 풀어서 집계하는 쿼리
    const result = await this.postsRepository
      .createQueryBuilder('post')
      .select('jsonb_array_elements_text(post.tags) as tag')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = true')
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('jsonb_array_length(post.tags) > 0')
      .groupBy('tag')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    // 결과 포맷팅
    return result.map(row => ({
      tag: row.tag,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * 관리자용 모든 포스트 목록 조회
   *
   * @param page 페이지 번호
   * @param limit 페이지당 개수
   * @param search 검색어
   * @returns 포스트 목록과 총 개수
   */
  async findAllForAdmin(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ posts: Post[]; total: number }> {
    let query = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.blog', 'blog');

    if (search) {
      const searchTerms = search.trim().replace(/\s+/g, ' | ');
      if (searchTerms) {
        query
          .addSelect(
            `ts_rank(post.search_vector, to_tsquery('simple', :searchQuery))`,
            'search_rank'
          )
          .where(`post.search_vector @@ to_tsquery('simple', :searchQuery)`, {
            searchQuery: searchTerms,
          })
          .orderBy('search_rank', 'DESC');
      }
    }

    const [posts, total] = await query
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { posts, total };
  }

  /**
   * 비동기 조회수 증가
   * PostStats 테이블의 viewCount를 직접 업데이트하여 cascade 문제 방지
   *
   * @param postId 포스트 ID
   */
  private async incrementViewCount(postId: string): Promise<void> {
    // PostStats 테이블의 viewCount만 직접 업데이트
    // cascade 및 트리거 재귀 호출 문제 방지
    await this.postStatsRepository
      .createQueryBuilder()
      .update(PostStats)
      .set({
        viewCount: () => "viewCount + 1",
        updatedAt: () => "CURRENT_TIMESTAMP"
      })
      .where("postId = :postId", { postId })
      .execute();
  }
}