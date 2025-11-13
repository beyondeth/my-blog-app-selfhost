import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blog } from '../../blogs/entities/blog.entity';
import { OldAlias } from '../../blogs/entities/old-alias.entity';
import { CacheService, CacheTTL, CacheKeys } from '../../cache/cache.service';

/**
 * 블로그 식별자 해결 서비스
 *
 * 순환 의존성을 피하기 위해 블로그 식별자(alias/slug)를 blogId로 변환하는
 * 공통 로직을 별도 서비스로 분리
 */
@Injectable()
export class BlogResolverService {
  private readonly logger = new Logger(BlogResolverService.name);

  constructor(
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(OldAlias)
    private readonly oldAliasRepository: Repository<OldAlias>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 식별자로 블로그 조회 (캐시 포함)
   * @param identifier 블로그 식별자 (alias 또는 slug)
   * @returns 블로그 정보 또는 null
   */
  async resolveBlogByIdentifier(identifier: string): Promise<Blog | null> {
    if (!identifier) {
      return null;
    }

    // @ 기호 제거 (alias는 @ 없이 저장됨)
    const cleanIdentifier = identifier.startsWith('@') ? identifier.substring(1) : identifier;

    // 캐시 키 생성 (CacheKeys.IDENTIFIER_TO_BLOG 사용 - BlogsService와 통합)
    const cacheKey = CacheKeys.IDENTIFIER_TO_BLOG(cleanIdentifier);

    // 캐시 확인
    const cached = await this.cacheService.get<Blog>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache HIT for blog resolver: ${cleanIdentifier}`);
      return cached;
    }

    this.logger.debug(`Cache MISS for blog resolver: ${cleanIdentifier}`);

    // 1. alias 조회 (우선순위 1)
    let blog = await this.blogRepository.findOne({
      where: { alias: cleanIdentifier },
      relations: ['owner', 'owner.profile'],
    });

    // 2. old_aliases 조회 (우선순위 2)
    if (!blog) {
      const oldAlias = await this.oldAliasRepository.findOne({
        where: { oldAlias: cleanIdentifier },
        relations: ['blog', 'blog.owner', 'blog.owner.profile'],
      });

      if (oldAlias) {
        blog = oldAlias.blog;
      }
    }

    // 3. slug 조회 (우선순위 3 - 폴백)
    if (!blog) {
      blog = await this.blogRepository.findOne({
        where: { slug: cleanIdentifier },
        relations: ['owner', 'owner.profile'],
      });
    }

    // 결과 캐싱
    if (blog) {
      await this.cacheService.set(cacheKey, blog, CacheTTL.MEDIUM);
      this.logger.debug(`Cached blog resolver result: ${cleanIdentifier} -> ${blog.id}`);
    }

    return blog || null;
  }

  /**
   * 여러 식별자를 한 번에 조회
   * @param identifiers 식별자 배열
   * @returns 식별자-블로그 매핑
   */
  async resolveManyBlogsByIdentifiers(identifiers: string[]): Promise<Map<string, Blog | null>> {
    const results = new Map<string, Blog | null>();
    const uncachedIdentifiers: string[] = [];

    // 캐시된 것들 먼저 확인
    for (const identifier of identifiers) {
      // @ 기호 제거
      const cleanIdentifier = identifier.startsWith('@') ? identifier.substring(1) : identifier;
      const cacheKey = CacheKeys.IDENTIFIER_TO_BLOG(cleanIdentifier);  // 통합된 캐시 키 사용
      const cached = await this.cacheService.get<Blog>(cacheKey);

      if (cached) {
        results.set(identifier, cached);
      } else {
        uncachedIdentifiers.push(identifier);
      }
    }

    // 캐시되지 않은 것들 DB 조회
    if (uncachedIdentifiers.length > 0) {
      // 병렬 조회를 위해 Promise.all 사용
      const dbResults = await Promise.all(
        uncachedIdentifiers.map(async (identifier) => {
          const blog = await this.resolveBlogByIdentifier(identifier);
          return { identifier, blog };
        })
      );

      // 결과 매핑
      dbResults.forEach(({ identifier, blog }) => {
        results.set(identifier, blog);
      });
    }

    return results;
  }

  /**
   * blogId로 블로그 조회 (관계 포함)
   * @param blogId 블로그 ID
   * @returns 블로그 정보
   */
  async findBlogById(blogId: string): Promise<Blog | null> {
    const cacheKey = CacheKeys.BLOG_BY_ID(blogId);  // 통합된 캐시 키 사용

    const cached = await this.cacheService.get<Blog>(cacheKey);
    if (cached) {
      return cached;
    }

    const blog = await this.blogRepository.findOne({
      where: { id: blogId },
      relations: ['owner', 'owner.profile'],
    });

    if (blog) {
      await this.cacheService.set(cacheKey, blog, CacheTTL.LONG);
    }

    return blog;
  }

  /**
   * 사용자 ID로 블로그 조회
   * @param userId 사용자 ID
   * @returns 블로그 정보
   */
  async findBlogByUserId(userId: string): Promise<Blog | null> {
    const cacheKey = CacheKeys.BLOG_BY_USER(userId);  // 통합된 캐시 키 사용

    const cached = await this.cacheService.get<Blog>(cacheKey);
    if (cached) {
      return cached;
    }

    const blog = await this.blogRepository.findOne({
      where: { userId },
      relations: ['owner', 'owner.profile'],
    });

    if (blog) {
      await this.cacheService.set(cacheKey, blog, CacheTTL.LONG);
    }

    return blog;
  }

  /**
   * 블로그 캐시 무효화 (개선된 버전)
   * @param blogId 블로그 ID
   * @param alias 블로그 별칭 (있을 경우)
   * @param slug 블로그 슬러그 (있을 경우)
   * @param oldAliases 이전 별칭 목록 (있을 경우)
   */
  async invalidateBlogCache(
    blogId: string,
    alias?: string,
    slug?: string,
    oldAliases?: string[]
  ): Promise<void> {
    const keysToDelete = [
      CacheKeys.BLOG_BY_ID(blogId),  // blog:id:${blogId}
    ];

    // alias 관련 캐시 무효화
    if (alias) {
      keysToDelete.push(CacheKeys.IDENTIFIER_TO_BLOG(alias));  // blog:identifier:${alias}
      keysToDelete.push(CacheKeys.ALIAS_MAPPING(alias));       // alias:map:${alias}
    }

    // slug 관련 캐시 무효화
    if (slug) {
      keysToDelete.push(CacheKeys.IDENTIFIER_TO_BLOG(slug));  // blog:identifier:${slug}
      keysToDelete.push(CacheKeys.BLOG_BY_SLUG(slug));         // blog:slug:${slug}
    }

    // old_aliases 관련 캐시 무효화
    if (oldAliases && oldAliases.length > 0) {
      for (const oldAlias of oldAliases) {
        keysToDelete.push(CacheKeys.IDENTIFIER_TO_BLOG(oldAlias));  // blog:identifier:${oldAlias}
        keysToDelete.push(CacheKeys.ALIAS_MAPPING(oldAlias));       // alias:map:${oldAlias}
      }
    }

    // 캐시 삭제 (병렬 처리)
    await Promise.all(
      keysToDelete.map(key => this.cacheService.delete(key))
    );

    this.logger.debug(`Invalidated blog cache: ${keysToDelete.length} keys for blogId: ${blogId}`);
  }
}