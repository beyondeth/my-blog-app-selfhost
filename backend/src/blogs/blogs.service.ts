import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Blog } from "./entities/blog.entity";
import { OldAlias } from "./entities/old-alias.entity";
import { CreateBlogDto } from "./dto/create-blog.dto";
import { UpdateBlogDto } from "./dto/update-blog.dto";
import { User } from "../users/entities/user.entity";
import { Follow } from "../follows/entities/follow.entity";
import { RedisLockService } from "../redis/redis-lock.service";
import { CacheService, CacheKeys, CacheTTL } from "../cache/cache.service";
import { CdnService } from "../files/services/cdn.service";

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  /**
   * 예약어 목록
   * - alias로 사용 불가능한 단어들
   * - 시스템 경로와 충돌 방지
   */
  private readonly RESERVED_ALIASES = [
    // 시스템 경로
    "admin",
    "api",
    "auth",
    "login",
    "register",
    "settings",
    "blog",
    "blogs",
    "post",
    "posts",
    "user",
    "users",
    "search",
    "about",
    "terms",
    "privacy",
    "contact",
    "help",
    "support",
    "docs",
    "documentation",
    "legal",
    "sitemap",
    "robots",
    "feed",
    "rss",
    "atom",

    // HTTP 메서드 및 상태
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "200",
    "201",
    "301",
    "302",
    "400",
    "401",
    "403",
    "404",
    "500",

    // 기술 용어
    "www",
    "mail",
    "ftp",
    "ssh",
    "ssl",
    "tls",
    "http",
    "https",
    "cdn",
    "assets",
    "static",
    "media",
    "img",
    "css",
    "js",
    "node",
    "npm",
    "yarn",
    "git",
    "ssh",
    "docker",
    "k8s",

    // 비즈니스 용어
    "pricing",
    "payment",
    "billing",
    "invoice",
    "receipt",
    "subscription",
    "plan",
    "free",
    "pro",
    "premium",
    "enterprise",
    "dashboard",
    "analytics",
    "metrics",
    "stats",
    "report",

    // 소셜 관련
    "profile",
    "account",
    "edit",
    "update",
    "delete",
    "create",
    "follow",
    "unfollow",
    "like",
    "unlike",
    "share",
    "comment",
    "message",
    "chat",
    "notification",
    "alert",

    // NSFW 및 부적절한 단어 (기본 목록)
    "sex",
    "porn",
    "xxx",
    "adult",
    "drugs",
    "gambling",
    "casino",
    "viagra",
    "cialis",
    "lottery",
    "bitcoin",
    "crypto",
    "scam",

    // 공격적인 단어 (기본 목록)
    "fuck",
    "shit",
    "damn",
    "hell",
    "bitch",
    "bastard",
    "idiot",
    "stupid",
    "dumb",
    "loser",
    "hate",
    "kill",
  ];

  constructor(
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
    @InjectRepository(OldAlias)
    private oldAliasRepository: Repository<OldAlias>,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    private redisLockService: RedisLockService,
    private cacheService: CacheService,
    private cdnService: CdnService,
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
            where: { userId: user.id },
          });

          if (userBlog) {
            throw new ConflictException(
              "이미 블로그를 보유하고 있습니다. 한 계정당 하나의 블로그만 생성할 수 있습니다.",
            );
          }

          // slug 중복 확인
          const existingBlog = await this.blogRepository.findOne({
            where: { slug: createBlogDto.slug },
          });

          if (existingBlog) {
            throw new ConflictException("이미 사용 중인 블로그 주소입니다.");
          }

          const blog = this.blogRepository.create({
            ...createBlogDto,
            userId: user.id,
          });

          const savedBlog = await this.blogRepository.save(blog);
          this.logger.log(
            `Blog created successfully for user ${user.id} with slug ${createBlogDto.slug}`,
          );

          return savedBlog;
        },
      );
    } catch (error) {
      if (error.message?.includes("Failed to acquire lock")) {
        throw new ConflictException(
          "블로그 생성 중입니다. 잠시 후 다시 시도해주세요.",
        );
      }
      throw error;
    }
  }

  async findOne(id: string): Promise<Blog> {
    const blog = await this.blogRepository.findOne({
      where: { id },
      relations: ["owner"],
    });

    if (!blog) {
      throw new NotFoundException("블로그를 찾을 수 없습니다.");
    }

    return blog;
  }

  async findOneBySlug(slug: string, user?: any): Promise<Blog> {
    console.log(
      `[BlogsService] findOneBySlug - slug: ${slug}, user: ${user?.id || "none"}`,
    );

    const blog = await this.blogRepository.findOne({
      where: { slug },
      relations: ["owner"],
    });

    if (!blog) {
      throw new NotFoundException("블로그를 찾을 수 없습니다.");
    }

    console.log(
      `[BlogsService] Blog found - id: ${blog.id}, userId: ${blog.userId}, isPublic: ${blog.isPublic}`,
    );
    console.log(
      `[BlogsService] User check - user.id: ${user?.id}, blog.userId: ${blog.userId}, match: ${user?.id === blog.userId}`,
    );

    // 비공개 블로그인 경우, 소유자가 아니면 특별한 응답 반환
    // userId와 user.id 타입을 명시적으로 비교
    const isOwner = user && String(user.id) === String(blog.userId);

    if (!blog.isPublic && !isOwner) {
      console.log(
        `[BlogsService] Private blog, not owner - returning limited info`,
      );
      return {
        id: blog.id,
        slug: blog.slug,
        isPrivate: true,
        message: "비공개 블로그입니다",
      } as any;
    }

    console.log(`[BlogsService] Returning full blog info - owner: ${isOwner}`);
    return blog;
  }

  async findByUserId(userId: string): Promise<Blog[]> {
    this.logger.debug(
      `[BlogsService] findByUserId - Looking for blogs for user ID: ${userId.substring(0, 8)}...`,
    );

    const blogs = await this.blogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    this.logger.debug(
      `[BlogsService] findByUserId - Found ${blogs.length} blogs for user ID: ${userId.substring(0, 8)}...`,
    );

    if (blogs.length > 0) {
      blogs.forEach((blog, index) => {
        this.logger.debug(
          `[BlogsService] Blog ${index + 1}: ID=${blog.id.substring(0, 8)}..., slug=${blog.slug}, userId=${blog.userId.substring(0, 8)}...`,
        );
      });
    }

    return blogs;
  }

  /**
   * 사용자 ID로 블로그 조회 (단일 블로그 반환)
   *
   * @description
   * 시스템은 사용자당 하나의 블로그만 허용하므로,
   * 배열 대신 단일 Blog 객체를 반환합니다.
   *
   * @param userId 사용자 ID
   * @returns Blog 객체 또는 null
   */
  async findBlogByUserId(userId: string): Promise<Blog | null> {
    const blogs = await this.findByUserId(userId);
    return blogs.length > 0 ? blogs[0] : null;
  }

  async checkSlugAvailability(slug: string): Promise<boolean> {
    const count = await this.blogRepository.count({
      where: { slug },
    });
    return count === 0;
  }

  async update(id: string, updateBlogDto: UpdateBlogDto): Promise<Blog> {
    const blog = await this.findOne(id);

    // isPublic과 allowComments 필드가 없는 경우 기본값 설정
    // 데이터베이스에 필드가 아직 없을 수 있으므로 임시로 처리
    const updatedBlog = {
      ...blog,
      ...updateBlogDto,
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
  async getAllPublicBlogsForSitemap(): Promise<
    Array<{ slug: string; updatedAt: Date }>
  > {
    const blogs = await this.blogRepository
      .createQueryBuilder("blog")
      .select(["blog.slug", "blog.updatedAt"])
      .where("blog.isPublic = :isPublic", { isPublic: true })
      .orderBy("blog.updatedAt", "DESC")
      .getMany();

    this.logger.debug(`[Sitemap] Found ${blogs.length} public blogs`);

    return blogs.map((blog) => ({
      slug: blog.slug,
      updatedAt: blog.updatedAt,
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
  async findOneByIdentifier(
    identifier: string,
    user?: any,
  ): Promise<Blog | any> {
    this.logger.debug(`[Alias System] Looking up identifier: ${identifier}`);

    // @ 제거 (프론트엔드에서 @park로 보낼 수 있음)
    const cleanIdentifier = identifier.replace("@", "");

    // 1. 캐시에서 먼저 확인
    const cacheKey = CacheKeys.IDENTIFIER_TO_BLOG(cleanIdentifier);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      this.logger.debug(`[Alias Cache] Cache hit for: ${cleanIdentifier}`);

      // 캐시된 데이터에 follow 정보가 없는 경우에만 추가 조회
      const blog = cached as Blog;
      const isOwner = user && String(user.id) === String(blog.userId);

      // Follow 정보 추가 (팔로워 수 표시용) - 캐시에는 없는 경우
      if (blog?.owner?.id && user && !isOwner && !(blog as any).followInfo) {
        const [followersCount, followingCount] = await Promise.all([
          this.followRepository.count({
            where: { followingId: blog.owner.id },
          }),
          this.followRepository.count({
            where: { followerId: blog.owner.id },
          }),
        ]);

        const isFollowing = await this.followRepository.findOne({
          where: {
            followerId: user.id,
            followingId: blog.owner.id,
          },
        });

        (blog as any).followInfo = {
          followersCount,
          followingCount,
          isFollowedByUser: !!isFollowing,
        };

        // 캐시 업데이트 (follow 정보 포함)
        await this.cacheService.set(cacheKey, blog, CacheTTL.SHORT);
      }

      if (blog?.owner?.profile) {
        blog.owner.socialLinks = blog.owner.profile.socialLinks;
      }

      // 캐시에서 가져온 데이터도 프로필 평탄화 필요 (캐시되기 전에 평탄화되었을 수 있음)
      if (blog?.owner?.profile && !blog.owner.profileImage) {
        blog.owner.name = blog.owner.profile.name;
        blog.owner.profileImage = blog.owner.profile.profileImage;
        blog.owner.bio = blog.owner.profile.bio;
        blog.owner.jobTitle = blog.owner.profile.jobTitle;
        blog.owner.socialLinks = blog.owner.profile.socialLinks;
        blog.owner.lastLoginProvider = blog.owner.profile.lastLoginProvider;

        // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
        if (blog.owner.profileImage) {
          if (
            blog.owner.profileImage.startsWith("v2/") ||
            blog.owner.profileImage.startsWith("uploads/")
          ) {
            // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
            blog.owner.profileImage = this.cdnService.generateCdnUrlFromKey(
              blog.owner.profileImage,
            );
            this.logger.debug(
              `Blog owner profile image CDN URL (from cache): ${blog.owner.profileImage}`,
            );
          }
        }
      }

      return this.checkBlogAccessAndReturn(blog, user);
    }

    // 2. alias로 조회 시도 (QueryBuilder로 최적화)
    const blogQueryBuilder = this.blogRepository
      .createQueryBuilder("blog")
      .leftJoinAndSelect("blog.owner", "owner")
      .leftJoinAndSelect("owner.profile", "profile")
      .where("blog.alias = :alias", { alias: cleanIdentifier });

    let blog = await blogQueryBuilder.getOne();

    if (blog) {
      // Follow 정보 추가 (팔로워 수 표시용)
      if (blog?.owner?.id && user && String(user.id) !== String(blog.userId)) {
        const [followersCount, followingCount] = await Promise.all([
          this.followRepository.count({
            where: { followingId: blog.owner.id },
          }),
          this.followRepository.count({
            where: { followerId: blog.owner.id },
          }),
        ]);

        const isFollowing = await this.followRepository.findOne({
          where: {
            followerId: user.id,
            followingId: blog.owner.id,
          },
        });

        (blog as any).followInfo = {
          followersCount,
          followingCount,
          isFollowedByUser: !!isFollowing,
        };
      }

      // 블로그 소유자 프로필 정보 평탄화 (users.service.ts와 동일한 패턴)
      if (blog?.owner?.profile) {
        blog.owner.name = blog.owner.profile.name;
        blog.owner.profileImage = blog.owner.profile.profileImage;
        blog.owner.bio = blog.owner.profile.bio;
        blog.owner.jobTitle = blog.owner.profile.jobTitle;
        blog.owner.socialLinks = blog.owner.profile.socialLinks;
        blog.owner.lastLoginProvider = blog.owner.profile.lastLoginProvider;

        // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
        if (blog.owner.profileImage) {
          if (
            blog.owner.profileImage.startsWith("v2/") ||
            blog.owner.profileImage.startsWith("uploads/")
          ) {
            // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
            blog.owner.profileImage = this.cdnService.generateCdnUrlFromKey(
              blog.owner.profileImage,
            );
            this.logger.debug(
              `Blog owner profile image CDN URL: ${blog.owner.profileImage}`,
            );
          }
        }
      }

      // 캐시에 저장
      await this.cacheService.set(cacheKey, blog, CacheTTL.SHORT);
      this.logger.debug(
        `[Alias Cache] Cached blog for alias: ${cleanIdentifier}`,
      );

      return this.checkBlogAccessAndReturn(blog, user);
    }

    // 3. old_aliases 테이블에서 조회 (SEO 보호)
    const oldAlias = await this.oldAliasRepository
      .createQueryBuilder("oldAlias")
      .leftJoinAndSelect("oldAlias.blog", "blog")
      .leftJoinAndSelect("blog.owner", "owner")
      .leftJoinAndSelect("owner.profile", "profile")
      .where("oldAlias.oldAlias = :oldAlias", { oldAlias: cleanIdentifier })
      .getOne();

    if (oldAlias && oldAlias.blog) {
      this.logger.log(
        `[Alias System] 301 Redirect: ${cleanIdentifier} → ${oldAlias.blog.alias || oldAlias.blog.slug}`,
      );

      blog = oldAlias.blog;

      // Follow 정보 추가 (팔로워 수 표시용)
      if (blog?.owner?.id && user && String(user.id) !== String(blog.userId)) {
        const [followersCount, followingCount] = await Promise.all([
          this.followRepository.count({
            where: { followingId: blog.owner.id },
          }),
          this.followRepository.count({
            where: { followerId: blog.owner.id },
          }),
        ]);

        const isFollowing = await this.followRepository.findOne({
          where: {
            followerId: user.id,
            followingId: blog.owner.id,
          },
        });

        (blog as any).followInfo = {
          followersCount,
          followingCount,
          isFollowedByUser: !!isFollowing,
        };
      }

      // 블로그 소유자 프로필 정보 평탄화 (users.service.ts와 동일한 패턴)
      if (blog?.owner?.profile) {
        blog.owner.name = blog.owner.profile.name;
        blog.owner.profileImage = blog.owner.profile.profileImage;
        blog.owner.bio = blog.owner.profile.bio;
        blog.owner.jobTitle = blog.owner.profile.jobTitle;
        blog.owner.socialLinks = blog.owner.profile.socialLinks;
        blog.owner.lastLoginProvider = blog.owner.profile.lastLoginProvider;

        // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
        if (blog.owner.profileImage) {
          if (
            blog.owner.profileImage.startsWith("v2/") ||
            blog.owner.profileImage.startsWith("uploads/")
          ) {
            // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
            blog.owner.profileImage = this.cdnService.generateCdnUrlFromKey(
              blog.owner.profileImage,
            );
            this.logger.debug(
              `Blog owner profile image CDN URL (from old alias): ${blog.owner.profileImage}`,
            );
          }
        }
      }

      // 301 리다이렉트 정보와 함께 반환
      const blogWithAccess = this.checkBlogAccessAndReturn(blog, user);

      return {
        ...blogWithAccess,
        shouldRedirect: true,
        redirectTo: oldAlias.blog.alias
          ? `@${oldAlias.blog.alias}`
          : oldAlias.blog.slug,
        redirectType: "301", // Permanent redirect (SEO 보호)
      };
    }

    // 4. slug로 폴백 (기존 시스템 호환성)
    blog = await this.blogRepository
      .createQueryBuilder("blog")
      .leftJoinAndSelect("blog.owner", "owner")
      .leftJoinAndSelect("owner.profile", "profile")
      .where("blog.slug = :slug", { slug: cleanIdentifier })
      .getOne();

    if (blog) {
      // Follow 정보 추가 (팔로워 수 표시용)
      if (blog?.owner?.id && user && String(user.id) !== String(blog.userId)) {
        const [followersCount, followingCount] = await Promise.all([
          this.followRepository.count({
            where: { followingId: blog.owner.id },
          }),
          this.followRepository.count({
            where: { followerId: blog.owner.id },
          }),
        ]);

        const isFollowing = await this.followRepository.findOne({
          where: {
            followerId: user.id,
            followingId: blog.owner.id,
          },
        });

        (blog as any).followInfo = {
          followersCount,
          followingCount,
          isFollowedByUser: !!isFollowing,
        };
      }

      // 캐시에 저장
      await this.cacheService.set(cacheKey, blog, CacheTTL.SHORT);
      this.logger.debug(
        `[Alias Cache] Cached blog for slug: ${cleanIdentifier}`,
      );

      // FIX: slug로 찾았더라도, alias가 존재하면 항상 리다이렉트 (URL 정규화)
      if (blog.alias) {
        // slug나 @없는 alias로 접속했을 때 항상 @alias로 리다이렉트
        if (cleanIdentifier !== blog.alias) {
          this.logger.log(
            `[Alias System] URL normalization: ${cleanIdentifier} → ${blog.alias}`,
          );
          const blogWithAccess = this.checkBlogAccessAndReturn(blog, user);
          return {
            ...blogWithAccess,
            shouldRedirect: true,
            redirectTo: `@${blog.alias}`,
            redirectType: "301",
          };
        }
      }

      this.logger.debug(
        `[Alias System] Found by slug (fallback): ${cleanIdentifier}`,
      );
      return this.checkBlogAccessAndReturn(blog, user);
    }

    // 모든 방법으로 찾지 못함
    throw new NotFoundException("블로그를 찾을 수 없습니다.");
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
        message: "비공개 블로그입니다",
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
        "Alias 형식이 올바르지 않습니다. 3~30자의 영문, 숫자, 하이픈, 언더스코어만 사용 가능합니다.",
      );
    }

    // 2. 예약어 체크
    if (this.RESERVED_ALIASES.includes(alias.toLowerCase())) {
      throw new ConflictException("해당 주소는 시스템에서 사용 중입니다.");
    }

    // 3. 현재 사용 중인 alias 체크
    const existingBlog = await this.blogRepository.findOne({
      where: { alias },
    });

    if (existingBlog) {
      throw new ConflictException("이미 사용 중인 주소입니다.");
    }

    // 4. 이전에 사용된 alias 체크 (재사용 방지)
    const oldAlias = await this.oldAliasRepository.findOne({
      where: { oldAlias: alias },
    });

    if (oldAlias) {
      throw new ConflictException(
        "이전에 다른 사용자가 사용한 주소입니다. SEO 보호를 위해 재사용이 불가능합니다.",
      );
    }

    return true;
  }

  /**
   * Alias 형식 검증 (강화 버전)
   *
   * @param alias - 검증할 alias
   * @returns 유효한 형식인지 여부
   */
  private validateAliasFormat(alias: string): boolean {
    // 1. 기본 길이 검증 (3~30자)
    if (alias.length < 3 || alias.length > 30) {
      return false;
    }

    // 2. 형식 검증 (영문/숫자/하이픈/언더스코어만 허용)
    const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!aliasRegex.test(alias)) {
      return false;
    }

    // 3. 연속된 하이픈/언더스코어 방지
    if (
      alias.includes("--") ||
      alias.includes("__") ||
      alias.includes("-_") ||
      alias.includes("_-")
    ) {
      return false;
    }

    // 4. 시작/끝 하이픈/언더스코어 방지
    if (
      alias.startsWith("-") ||
      alias.startsWith("_") ||
      alias.endsWith("-") ||
      alias.endsWith("_")
    ) {
      return false;
    }

    // 5. 숫자만으로 구성된 alias 방지
    if (/^\d+$/.test(alias)) {
      return false;
    }

    // 6. 소문자로 정규화 (대소문자 구분 없이 처리)
    const normalizedAlias = alias.toLowerCase();

    // 7. 예약어 검사 (대소문자 구분 없이)
    if (this.RESERVED_ALIASES.includes(normalizedAlias)) {
      return false;
    }

    // 8. 유니코드 및 특수문자 검사
    // - 허용되지 않는 유니코드 문자 감지
    const hasInvalidUnicode = /[\u{10000}-\u{10FFFF}]/u.test(alias);
    if (hasInvalidUnicode) {
      return false;
    }

    // 9. 동일 문자 반복 제한 (최대 2개)
    if (/(.)\1{2,}/.test(alias)) {
      return false;
    }

    // 10. IP 주소 형식 방지
    const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(alias)) {
      return false;
    }

    // 11. 도메인 형식 방지
    const domainPattern = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    if (domainPattern.test(alias)) {
      return false;
    }

    // 12. 한국어/일본어/중국어 등 CJK 문자 방지 (영문만 허용)
    const hasCJK =
      /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af]/.test(alias);
    if (hasCJK) {
      return false;
    }

    return true;
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
  async updateAlias(
    blogId: string,
    newAlias: string,
    userId: string,
  ): Promise<Blog> {
    // @ 제거
    const cleanAlias = newAlias.replace("@", "");

    // 트랜잭션으로 원자성 보장
    const queryRunner =
      this.blogRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 블로그 조회 및 소유자 확인 (트랜잭션 내에서 FOR UPDATE 사용)
      const blog = await queryRunner.manager.findOne(Blog, {
        where: { id: blogId },
        lock: { mode: "pessimistic_write" }, // 비관적 락으로 동시 수정 방지
      });

      if (!blog) {
        throw new NotFoundException("블로그를 찾을 수 없습니다.");
      }

      if (String(blog.userId) !== String(userId)) {
        throw new ForbiddenException("본인의 블로그만 수정할 수 있습니다.");
      }

      // 2. 새 alias 사용 가능 여부 확인 (트랜잭션 내에서)
      const existingBlog = await queryRunner.manager.findOne(Blog, {
        where: { alias: cleanAlias },
      });

      if (existingBlog && existingBlog.id !== blogId) {
        throw new ConflictException(
          `별칭 '${cleanAlias}'은(는) 이미 사용 중입니다.`,
        );
      }

      const oldAlias = blog.alias;

      // 3. 기존 alias를 old_aliases로 이동 (있는 경우에만)
      if (oldAlias) {
        // 먼저 이 블로그의 모든 old_aliases가 최신 alias를 가리키도록 업데이트
        await queryRunner.manager.update(
          OldAlias,
          { blogId: blog.id },
          {
            redirectTo: cleanAlias, // 리다이렉트 대상을 최신 alias로 업데이트
            changedAt: new Date(), // 변경 시간 갱신
          },
        );

        // 그 후 현재 alias를 old_aliases에 추가
        const oldAliasEntity = this.oldAliasRepository.create({
          blogId: blog.id,
          oldAlias: oldAlias,
          redirectTo: cleanAlias, // 현재 alias로 리다이렉트 명시
          changedAt: new Date(),
        });

        await queryRunner.manager.save(oldAliasEntity);
        this.logger.log(
          `[Alias System] Saved old alias: ${oldAlias} → ${cleanAlias}`,
        );
        this.logger.log(
          `[Alias System] Updated all old aliases to redirect to: ${cleanAlias}`,
        );
      }

      // 4. 새 alias 저장
      blog.alias = cleanAlias;
      await queryRunner.manager.save(blog);

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      this.logger.log(
        `[Alias System] Alias updated for blog ${blogId}: ${cleanAlias}`,
      );

      // 5. Redis 캐시 무횠화 (트랜잭션 성공 후)
      try {
        // 통합된 캐시 무횠화 사용
        await this.cacheService.invalidateAliasCache(
          oldAlias,
          cleanAlias,
          blog.id,
        );

        this.logger.log(
          `[Cache] Invalidated cache for alias change: ${oldAlias} → ${cleanAlias}`,
        );
      } catch (cacheError) {
        this.logger.warn(
          `[Cache] Failed to invalidate cache for alias change:`,
          cacheError,
        );
      }

      return blog;
    } catch (error) {
      // 에러 발생 시 롤백
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Alias System] Failed to update alias for blog ${blogId}:`,
        error,
      );
      throw error;
    } finally {
      // 항상 QueryRunner 해제
      await queryRunner.release();
    }
  }

  // =========================================================================
  // 통계 컨트롤러용 최소 조회 메서드 (소유자 권한 확인용)
  // =========================================================================

  /**
   * ID로 블로그 최소 정보 조회 (소유자 확인용)
   * @param id 블로그 UUID
   * @returns 블로그 ID, userId만 포함
   */
  async findByIdMinimal(
    id: string,
  ): Promise<{ id: string; userId: string } | null> {
    const blog = await this.blogRepository.findOne({
      where: { id },
      select: ["id", "userId"],
    });
    return blog ? { id: blog.id, userId: blog.userId } : null;
  }

  /**
   * Slug 또는 Alias로 블로그 최소 정보 조회 (소유자 확인용)
   * @param slugOrAlias 블로그 slug 또는 alias
   * @returns 블로그 ID, userId만 포함
   */
  async findBySlugOrAliasMinimal(
    slugOrAlias: string,
  ): Promise<{ id: string; userId: string } | null> {
    // @ 제거
    const cleanIdentifier = slugOrAlias.replace("@", "");

    // 1. alias로 조회
    let blog = await this.blogRepository.findOne({
      where: { alias: cleanIdentifier },
      select: ["id", "userId"],
    });

    if (blog) {
      return { id: blog.id, userId: blog.userId };
    }

    // 2. slug로 폴백
    blog = await this.blogRepository.findOne({
      where: { slug: cleanIdentifier },
      select: ["id", "userId"],
    });

    return blog ? { id: blog.id, userId: blog.userId } : null;
  }
}

