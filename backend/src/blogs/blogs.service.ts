import { Injectable, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blog } from './entities/blog.entity';
import { OldAlias } from './entities/old-alias.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { User } from '../users/entities/user.entity';
import { RedisLockService } from '../redis/redis-lock.service';

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  /**
   * 예약어 목록
   * - alias로 사용 불가능한 단어들
   * - 시스템 경로와 충돌 방지
   */
  private readonly RESERVED_ALIASES = [
    'admin',
    'api',
    'auth',
    'login',
    'register',
    'settings',
    'blog',
    'blogs',
    'post',
    'posts',
    'user',
    'users',
    'search',
    'about',
    'terms',
    'privacy',
    'contact',
    'help',
    'support',
    'docs',
    'documentation',
    'legal',
    'sitemap',
    'robots',
    'feed',
    'rss',
    'atom',
  ];

  constructor(
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
    @InjectRepository(OldAlias)
    private oldAliasRepository: Repository<OldAlias>,
    private redisLockService: RedisLockService,
  ) {}

  async create(createBlogDto: CreateBlogDto, user: User): Promise<Blog> {
    // 분산 락을 사용하여 중복 생성 방지
    const lockKey = `blog:create:user:${user.id}`;
    const lockTtl = 10000; // 10초

    try {
      // 분산 락 사용하여 동시성 제어
      return await this.redisLockService.executeWithLock(
        lockKey,
        lockTtl,
        async () => {
          // 사용자가 이미 블로그를 가지고 있는지 확인 (한 사용자당 하나의 블로그만)
          const userBlog = await this.blogRepository.findOne({
            where: { userId: user.id }
          });

          if (userBlog) {
            throw new ConflictException('이미 블로그를 보유하고 있습니다. 한 계정당 하나의 블로그만 생성할 수 있습니다.');
          }

          // slug 중복 확인
          const existingBlog = await this.blogRepository.findOne({
            where: { slug: createBlogDto.slug }
          });

          if (existingBlog) {
            throw new ConflictException('이미 사용 중인 블로그 주소입니다.');
          }

          const blog = this.blogRepository.create({
            ...createBlogDto,
            userId: user.id
          });

          const savedBlog = await this.blogRepository.save(blog);
          this.logger.log(`Blog created successfully for user ${user.id} with slug ${createBlogDto.slug}`);

          return savedBlog;
        }
      );
    } catch (error) {
      if (error.message?.includes('Failed to acquire lock')) {
        throw new ConflictException('블로그 생성 중입니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async findOne(id: string): Promise<Blog> {
    const blog = await this.blogRepository.findOne({
      where: { id },
      relations: ['owner']
    });

    if (!blog) {
      throw new NotFoundException('블로그를 찾을 수 없습니다.');
    }

    return blog;
  }

  async findOneBySlug(slug: string, user?: any): Promise<Blog> {
    console.log(`[BlogsService] findOneBySlug - slug: ${slug}, user: ${user?.id || 'none'}`);
    
    const blog = await this.blogRepository.findOne({
      where: { slug },
      relations: ['owner']
    });

    if (!blog) {
      throw new NotFoundException('블로그를 찾을 수 없습니다.');
    }

    console.log(`[BlogsService] Blog found - id: ${blog.id}, userId: ${blog.userId}, isPublic: ${blog.isPublic}`);
    console.log(`[BlogsService] User check - user.id: ${user?.id}, blog.userId: ${blog.userId}, match: ${user?.id === blog.userId}`);

    // 비공개 블로그인 경우, 소유자가 아니면 특별한 응답 반환
    // userId와 user.id 타입을 명시적으로 비교
    const isOwner = user && String(user.id) === String(blog.userId);
    
    if (!blog.isPublic && !isOwner) {
      console.log(`[BlogsService] Private blog, not owner - returning limited info`);
      return {
        id: blog.id,
        slug: blog.slug,
        isPrivate: true,
        message: '비공개 블로그입니다'
      } as any;
    }

    console.log(`[BlogsService] Returning full blog info - owner: ${isOwner}`);
    return blog;
  }

  async findByUserId(userId: string): Promise<Blog[]> {
    return await this.blogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }

  async checkSlugAvailability(slug: string): Promise<boolean> {
    const count = await this.blogRepository.count({
      where: { slug }
    });
    return count === 0;
  }

  async update(id: string, updateBlogDto: UpdateBlogDto): Promise<Blog> {
    const blog = await this.findOne(id);

    // isPublic과 allowComments 필드가 없는 경우 기본값 설정
    // 데이터베이스에 필드가 아직 없을 수 있으므로 임시로 처리
    const updatedBlog = {
      ...blog,
      ...updateBlogDto
    };

    // isPublic과 allowComments가 undefined인 경우 기본값 설정
    if (updateBlogDto.isPublic !== undefined) {
      updatedBlog.isPublic = updateBlogDto.isPublic;
    }
    if (updateBlogDto.allowComments !== undefined) {
      updatedBlog.allowComments = updateBlogDto.allowComments;
    }

    await this.blogRepository.save(updatedBlog);
    return await this.findOne(id);
  }

  /**
   * Sitemap 생성을 위한 모든 공개 블로그 조회
   *
   * @description
   * SEO 최적화를 위해 sitemap.xml 생성 시 사용됩니다.
   * - 공개 블로그(isPublic = true)만 조회
   * - 성능을 위해 최소 필드만 SELECT (slug, updatedAt)
   * - relations 없이 조회하여 쿼리 최적화
   * - 페이지네이션 없이 전체 데이터 반환
   *
   * @returns 공개 블로그의 slug와 updatedAt 배열
   */
  async getAllPublicBlogsForSitemap(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    const blogs = await this.blogRepository
      .createQueryBuilder('blog')
      .select(['blog.slug', 'blog.updatedAt'])
      .where('blog.isPublic = :isPublic', { isPublic: true })
      .orderBy('blog.updatedAt', 'DESC')
      .getMany();

    this.logger.debug(`[Sitemap] Found ${blogs.length} public blogs`);

    return blogs.map(blog => ({
      slug: blog.slug,
      updatedAt: blog.updatedAt
    }));
  }

  // =====================================
  // Alias 시스템 (체크포인트 2)
  // =====================================

  /**
   * 식별자로 블로그 조회 (alias > old_alias > slug 순서)
   *
   * **체크포인트 2: Alias 시스템 핵심 메서드**
   *
   * @description
   * 블로그를 조회하는 통합 메서드입니다.
   * 다음 우선순위로 조회합니다:
   * 1. alias: 현재 사용자 지정 주소 (예: @park)
   * 2. old_aliases: 이전 주소 → 301 리다이렉트 정보 반환
   * 3. slug: 이메일 기반 기본 주소 (폴백)
   *
   * @param identifier - alias 또는 slug (@ 없이)
   * @param user - 현재 로그인한 사용자 (비공개 블로그 접근 체크용)
   * @returns Blog 엔티티 또는 리다이렉트 정보
   *
   * @example
   * // alias로 조회
   * const blog = await findOneByIdentifier('park', user);
   *
   * // 이전 alias로 조회 (301 리다이렉트)
   * const result = await findOneByIdentifier('oldname', user);
   * // result = { shouldRedirect: true, newAlias: 'park', blog: {...} }
   *
   * // slug로 폴백
   * const blog = await findOneByIdentifier('luticek', user);
   */
  async findOneByIdentifier(identifier: string, user?: any): Promise<Blog | any> {
    this.logger.debug(`[Alias System] Looking up identifier: ${identifier}`);

    // @ 제거 (프론트엔드에서 @park로 보낼 수 있음)
    const cleanIdentifier = identifier.replace('@', '');

    // 1. alias로 조회 시도
    let blog = await this.blogRepository.findOne({
      where: { alias: cleanIdentifier },
      relations: ['owner'],
    });

    if (blog) {
      this.logger.debug(`[Alias System] Found by alias: ${cleanIdentifier}`);
      return this.checkBlogAccessAndReturn(blog, user);
    }

    // 2. old_aliases 테이블에서 조회 (SEO 보호)
    const oldAlias = await this.oldAliasRepository.findOne({
      where: { oldAlias: cleanIdentifier },
      relations: ['blog', 'blog.owner'],
    });

    if (oldAlias && oldAlias.blog) {
      this.logger.log(
        `[Alias System] 301 Redirect: ${cleanIdentifier} → ${oldAlias.blog.alias || oldAlias.blog.slug}`
      );

      blog = oldAlias.blog;

      // 301 리다이렉트 정보와 함께 반환
      const blogWithAccess = this.checkBlogAccessAndReturn(blog, user);

      return {
        ...blogWithAccess,
        shouldRedirect: true,
        redirectTo: oldAlias.blog.alias || oldAlias.blog.slug,
        redirectType: '301', // Permanent redirect (SEO 보호)
      };
    }

    // 3. slug로 폴백 (기존 시스템 호환성)
    blog = await this.blogRepository.findOne({
      where: { slug: cleanIdentifier },
      relations: ['owner'],
    });

    if (blog) {
      this.logger.debug(`[Alias System] Found by slug (fallback): ${cleanIdentifier}`);
      return this.checkBlogAccessAndReturn(blog, user);
    }

    // 모든 방법으로 찾지 못함
    throw new NotFoundException('블로그를 찾을 수 없습니다.');
  }

  /**
   * 블로그 접근 권한 체크 및 반환
   *
   * @description
   * 비공개 블로그인 경우 소유자만 접근 가능하도록 체크합니다.
   * 소유자가 아니면 제한된 정보만 반환합니다.
   *
   * @param blog - 블로그 엔티티
   * @param user - 현재 로그인한 사용자
   * @returns 전체 블로그 정보 또는 제한된 정보
   */
  private checkBlogAccessAndReturn(blog: Blog, user?: any): Blog | any {
    const isOwner = user && String(user.id) === String(blog.userId);

    // 비공개 블로그인데 소유자가 아닌 경우
    if (!blog.isPublic && !isOwner) {
      this.logger.debug(`[Access Control] Private blog, not owner`);
      return {
        id: blog.id,
        slug: blog.slug,
        alias: blog.alias,
        isPrivate: true,
        message: '비공개 블로그입니다',
      };
    }

    return blog;
  }

  /**
   * Alias 사용 가능 여부 확인
   *
   * **체크포인트 2: Alias 유효성 검증**
   *
   * @description
   * 새로운 alias 설정 시 사용 가능한지 확인합니다.
   * 다음 조건을 모두 만족해야 합니다:
   * 1. 형식 검증: 3~30자, 영문/숫자/하이픈/언더스코어만
   * 2. 예약어 아님
   * 3. blogs 테이블의 alias 중복 없음
   * 4. old_aliases 테이블에도 없음 (재사용 방지)
   *
   * @param alias - 확인할 alias (@ 없이)
   * @returns 사용 가능 여부
   *
   * @throws ConflictException - 사용 불가능한 alias
   */
  async checkAliasAvailability(alias: string): Promise<boolean> {
    // 1. 형식 검증
    if (!this.validateAliasFormat(alias)) {
      throw new ConflictException(
        'Alias 형식이 올바르지 않습니다. 3~30자의 영문, 숫자, 하이픈, 언더스코어만 사용 가능합니다.'
      );
    }

    // 2. 예약어 체크
    if (this.RESERVED_ALIASES.includes(alias.toLowerCase())) {
      throw new ConflictException('해당 주소는 시스템에서 사용 중입니다.');
    }

    // 3. 현재 사용 중인 alias 체크
    const existingBlog = await this.blogRepository.findOne({
      where: { alias },
    });

    if (existingBlog) {
      throw new ConflictException('이미 사용 중인 주소입니다.');
    }

    // 4. 이전에 사용된 alias 체크 (재사용 방지)
    const oldAlias = await this.oldAliasRepository.findOne({
      where: { oldAlias: alias },
    });

    if (oldAlias) {
      throw new ConflictException(
        '이전에 다른 사용자가 사용한 주소입니다. SEO 보호를 위해 재사용이 불가능합니다.'
      );
    }

    return true;
  }

  /**
   * Alias 형식 검증
   *
   * @param alias - 검증할 alias
   * @returns 유효한 형식인지 여부
   */
  private validateAliasFormat(alias: string): boolean {
    // 3~30자, 영문/숫자/하이픈/언더스코어만 허용
    const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return aliasRegex.test(alias);
  }

  /**
   * Alias 업데이트
   *
   * **체크포인트 2: Alias 변경 핵심 로직**
   *
   * @description
   * 블로그의 alias를 변경합니다.
   * 변경 시 다음 작업을 수행합니다:
   * 1. 사용 가능 여부 확인
   * 2. 기존 alias를 old_aliases 테이블로 이동 (SEO 보호)
   * 3. 새 alias 저장
   * 4. Redis 캐시 무효화 (TODO: Phase 2-4에서 구현)
   *
   * @param blogId - 블로그 ID
   * @param newAlias - 새로운 alias (@ 없이)
   * @param userId - 요청 사용자 ID (소유자 확인용)
   * @returns 업데이트된 블로그
   *
   * @throws ForbiddenException - 소유자가 아님
   * @throws ConflictException - 사용 불가능한 alias
   *
   * @example
   * await updateAlias('blog-uuid', 'newname', 'user-uuid');
   */
  async updateAlias(blogId: string, newAlias: string, userId: string): Promise<Blog> {
    // @ 제거
    const cleanAlias = newAlias.replace('@', '');

    // 1. 블로그 조회 및 소유자 확인
    const blog = await this.findOne(blogId);

    if (String(blog.userId) !== String(userId)) {
      throw new ForbiddenException('본인의 블로그만 수정할 수 있습니다.');
    }

    // 2. 새 alias 사용 가능 여부 확인
    await this.checkAliasAvailability(cleanAlias);

    // 3. 기존 alias를 old_aliases로 이동 (있는 경우에만)
    if (blog.alias) {
      const oldAlias = this.oldAliasRepository.create({
        blogId: blog.id,
        oldAlias: blog.alias,
        changedAt: new Date(),
      });

      await this.oldAliasRepository.save(oldAlias);
      this.logger.log(`[Alias System] Saved old alias: ${blog.alias} → ${cleanAlias}`);
    }

    // 4. 새 alias 저장
    blog.alias = cleanAlias;
    await this.blogRepository.save(blog);

    this.logger.log(`[Alias System] Alias updated for blog ${blogId}: ${cleanAlias}`);

    // 5. Redis 캐시 무효화 (TODO: Phase 2-4에서 구현)
    // await this.cacheService.invalidateBlogCache(blogId);

    return blog;
  }
}