import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  NotFoundException,
  Logger,
  UseInterceptors,
  ClassSerializerInterceptor,
  Query,
  Optional,
} from "@nestjs/common";
import { BlogsService } from "./blogs.service";
import { CreateBlogDto } from "./dto/create-blog.dto";
import { UpdateBlogDto } from "./dto/update-blog.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { BlogStatsService } from "../common/services/blog-stats.service";
import { BlogResolverService } from "../common/services/blog-resolver.service";
import { Role } from "../common/enums/role.enum";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { BlogResponseDto } from "./dto/blog-response.dto";
import { KnowledgePublicReadService } from "../knowledge/services/knowledge-public-read.service";

@ApiTags("blogs")
@Controller("blogs")
export class BlogsController {
  private readonly logger = new Logger(BlogsController.name);

  constructor(
    private readonly blogsService: BlogsService,
    private readonly blogStatsService: BlogStatsService,
    private readonly blogResolverService: BlogResolverService,
    @Optional()
    private readonly knowledgePublicReadService?: KnowledgePublicReadService,
  ) {}

  @Post()
  async create(
    @Body() createBlogDto: CreateBlogDto,
    @CurrentUser() user: User,
  ) {
    return await this.blogsService.create(createBlogDto, user);
  }

  @Get("check-slug/:slug")
  @Public()
  async checkSlug(@Param("slug") slug: string) {
    const available = await this.blogsService.checkSlugAvailability(slug);
    return { available };
  }

  @Get("my-blogs")
  @UseGuards(JwtAuthGuard)
  async getMyBlogs(@CurrentUser() user: User) {
    this.logger.debug(
      `[BlogsController] getMyBlogs - Request from user: ${user.email} (ID: ${user.id.substring(0, 8)}...)`,
    );
    const blog = await this.blogsService.findBlogByUserId(user.id);
    if (!blog) {
      this.logger.debug(
        `[BlogsController] getMyBlogs - No blog found for user: ${user.email}`,
      );
      return null;
    }
    this.logger.debug(
      `[BlogsController] getMyBlogs - Returning blog: ${blog.slug} for user: ${user.email}`,
    );
    return blog;
  }

  /**
   * 블로그 조회 (alias/slug 통합) - 체크포인트 2
   *
   * @description
   * alias, old_alias, slug 모두 지원하는 통합 조회 엔드포인트입니다.
   * 우선순위: alias > old_alias (301 리다이렉트) > slug (폴백)
   *
   * @param slug - identifier (alias 또는 slug, @ 없이)
   * @param user - 현재 로그인한 사용자 (OptionalJwtAuthGuard)
   * @returns 블로그 정보 또는 리다이렉트 정보
   *
   * @example
   * GET /blogs/slug/park - alias로 조회
   * GET /blogs/slug/oldname - 301 리다이렉트 정보 반환
   * GET /blogs/slug/luticek - slug로 폴백
   */
  @Get("slug/:slug")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: "블로그 조회 (alias/slug 통합)" })
  async findOneBySlug(@Param("slug") slug: string, @CurrentUser() user?: User) {
    // findOneByIdentifier()를 사용하여 alias > old_alias > slug 순서로 조회
    const blog = await this.blogsService.findOneByIdentifier(slug, user);

    // DTO 변환: owner 필드의 민감정보 자동 제외
    return plainToInstance(BlogResponseDto, blog, {
      excludeExtraneousValues: false,
      enableImplicitConversion: true,
    });
  }

  @Get(":id")
  @Public()
  @UseInterceptors(ClassSerializerInterceptor)
  async findOne(@Param("id") id: string) {
    const blog = await this.blogsService.findOne(id);

    // DTO 변환: owner 필드의 민감정보 자동 제외
    return plainToInstance(BlogResponseDto, blog, {
      excludeExtraneousValues: false,
      enableImplicitConversion: true,
    });
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @CurrentUser() user: User,
  ) {
    // 블로그 소유자 확인
    const blog = await this.blogsService.findOne(id);
    if (blog.userId !== user.id) {
      throw new UnauthorizedException("블로그를 수정할 권한이 없습니다.");
    }
    return await this.blogsService.update(id, updateBlogDto);
  }

  /**
   * 특정 블로그의 카테고리별 포스트 개수 조회
   *
   * @description
   * 블로그의 카테고리별 포스트 개수를 반환합니다.
   * 내 블로그 페이지에서 카테고리별 현황을 표시하는 데 사용됩니다.
   *
   * @param slug - 블로그 슬러그
   * @returns 카테고리별 포스트 개수 (내림차순)
   */
  @Get("slug/:slug/categories")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그의 카테고리별 포스트 개수 조회" })
  @ApiResponse({
    status: 200,
    description: "카테고리별 포스트 개수 (커서 페이지네이션)",
  })
  async getBlogCategories(
    @Param("slug") slug: string,
    @CurrentUser() user?: User,
    @Query("limit") limitQuery?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{
    items: Array<{ category: string; count: number }>;
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    // BlogResolverService를 사용하여 식별자 우선순위(alias > old_alias > slug) 적용
    this.logger.debug(`📡 [CATEGORIES API] Looking up blog with slug: ${slug}`);
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      // 블로그를 찾지 못하면 빈 배열 반환
      this.logger.warn(`📡 [CATEGORIES API] Blog not found for slug: ${slug}`);
      return {
        items: [],
        total: 0,
        hasMore: false,
        nextCursor: null,
      };
    }

    this.logger.debug(
      `📡 [CATEGORIES API] Found blog: ${blog.id} (${blog.slug}, alias: ${blog.alias})`,
    );

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    const canReadPrivateBlog = isOwner || isAdmin;

    if (!blog.isPublic && !canReadPrivateBlog) {
      this.logger.warn(
        `📡 [CATEGORIES API] Private blog access denied for slug: ${slug}`,
      );
      return {
        items: [],
        total: 0,
        hasMore: false,
        nextCursor: null,
      };
    }

    // blogId로 카테고리 조회 (안정적인 blogId 기반)
    const result = await this.blogStatsService.getBlogCategoriesWithCountById(
      blog.id,
      { includePrivate: canReadPrivateBlog },
    );

    const limit = this.parseLimit(limitQuery);
    const { items, hasMore, nextCursor } = this.paginateCategoryResults(
      result,
      limit,
      cursor,
    );

    this.logger.debug(
      `📡 [CATEGORIES API] Paginated categories: ${items.length}/${result.length} (hasMore=${hasMore})`,
    );

    return {
      items,
      total: result.length,
      hasMore,
      nextCursor,
    };
  }

  @Get("slug/:slug/knowledge-tree")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그 공개 Knowledge 트리 조회" })
  async getBlogKnowledgeTree(
    @Param("slug") slug: string,
    @CurrentUser() user?: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      return {
        tree: [],
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    if (!blog.isPublic && !isOwner && !isAdmin) {
      return {
        tree: [],
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    if (!this.knowledgePublicReadService) {
      throw new NotFoundException("Knowledge 서비스를 사용할 수 없습니다.");
    }
    return this.knowledgePublicReadService.getBlogKnowledgeTree(blog, user);
  }

  @Get("slug/:slug/knowledge-map")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그 공개 Knowledge 맵 조회" })
  async getBlogKnowledgeMap(
    @Param("slug") slug: string,
    @Query("focus") focus?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      return {
        focusNode: null,
        nodes: [],
        edges: [],
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    if (!blog.isPublic && !isOwner && !isAdmin) {
      return {
        focusNode: null,
        nodes: [],
        edges: [],
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 12;
    if (!this.knowledgePublicReadService) {
      throw new NotFoundException("Knowledge 서비스를 사용할 수 없습니다.");
    }
    return this.knowledgePublicReadService.getBlogKnowledgeMap(
      blog,
      user,
      focus,
      parsedLimit,
    );
  }

  @Get("slug/:slug/knowledge-canvas")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그 공개 Knowledge 캔버스 조회" })
  async getBlogKnowledgeCanvas(
    @Param("slug") slug: string,
    @Query("focus") focus?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      return {
        requestedFocusSlug: focus ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focus ? false : true,
        rootNode: null,
        focusNode: null,
        pathFromRoot: [],
        nodes: [],
        treeEdges: [],
        factEdges: [],
        provenance: {
          nodes: {},
          edges: [],
        },
        insights: null,
        viewerCanSeeInsights: false,
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    if (!blog.isPublic && !isOwner && !isAdmin) {
      return {
        requestedFocusSlug: focus ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focus ? false : true,
        rootNode: null,
        focusNode: null,
        pathFromRoot: [],
        nodes: [],
        treeEdges: [],
        factEdges: [],
        provenance: {
          nodes: {},
          edges: [],
        },
        insights: null,
        viewerCanSeeInsights: false,
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 36;
    if (!this.knowledgePublicReadService) {
      throw new NotFoundException("Knowledge 서비스를 사용할 수 없습니다.");
    }
    return this.knowledgePublicReadService.getBlogKnowledgeCanvas(
      blog,
      user,
      focus,
      parsedLimit,
    );
  }

  @Get("slug/:slug/knowledge-flow-board")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그 공개 Knowledge Flow Board 조회" })
  async getBlogKnowledgeFlowBoard(
    @Param("slug") slug: string,
    @Query("focus") focus?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      return {
        requestedFocusSlug: focus ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focus ? false : true,
        rootPath: [],
        focus: null,
        primaryFlow: null,
        detailPanels: [],
        outputs: {
          title: "관련 포스트",
          posts: [],
        },
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    if (!blog.isPublic && !isOwner && !isAdmin) {
      return {
        requestedFocusSlug: focus ?? null,
        resolvedFocusSlug: null,
        requestedFocusFound: focus ? false : true,
        rootPath: [],
        focus: null,
        primaryFlow: null,
        detailPanels: [],
        outputs: {
          title: "관련 포스트",
          posts: [],
        },
        hotNodes: [],
        nodeCount: 0,
        lastUpdatedAt: null,
      };
    }

    const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 24;
    if (!this.knowledgePublicReadService) {
      throw new NotFoundException("Knowledge 서비스를 사용할 수 없습니다.");
    }
    return this.knowledgePublicReadService.getBlogKnowledgeFlowBoard(
      blog,
      user,
      focus,
      parsedLimit,
    );
  }

  @Get("slug/:slug/knowledge/nodes/:nodeSlug")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "블로그 공개 Knowledge 노드 상세 조회" })
  async getBlogKnowledgeNodeDetail(
    @Param("slug") slug: string,
    @Param("nodeSlug") nodeSlug: string,
    @CurrentUser() user?: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);

    if (!blog) {
      throw new NotFoundException("블로그를 찾을 수 없습니다.");
    }

    const isOwner = !!user && String(user.id) === String(blog.userId);
    const isAdmin = user?.role === Role.ADMIN;
    if (!blog.isPublic && !isOwner && !isAdmin) {
      throw new NotFoundException("블로그를 조회할 수 없습니다.");
    }

    if (!this.knowledgePublicReadService) {
      throw new NotFoundException("Knowledge 서비스를 사용할 수 없습니다.");
    }
    return this.knowledgePublicReadService.readBlogNodeDetail(
      blog,
      nodeSlug,
      user,
    );
  }

  /**
   * Sitemap 생성을 위한 모든 공개 블로그 조회
   *
   * @description
   * SEO 최적화를 위해 sitemap.xml 생성 시 사용되는 엔드포인트입니다.
   * - 인증 불필요 (@Public)
   * - 공개 블로그만 반환 (isPublic = true)
   * - 최소 데이터만 반환 (slug, updatedAt)
   * - 페이지네이션 없이 전체 데이터 반환
   * - 성능 최적화를 위해 최소 필드만 SELECT
   *
   * @returns 공개 블로그의 slug와 updatedAt 배열
   */
  @Get("sitemap/all")
  @Public()
  @ApiOperation({ summary: "Sitemap용 모든 공개 블로그 조회" })
  @ApiResponse({
    status: 200,
    description: "공개 블로그 목록 (slug, updatedAt)",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string", example: "john-blog" },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2025-01-20T12:00:00.000Z",
          },
        },
      },
    },
  })
  async getAllBlogsForSitemap(): Promise<
    Array<{ slug: string; updatedAt: Date }>
  > {
    return this.blogsService.getAllPublicBlogsForSitemap();
  }

  // =====================================
  // Alias 시스템 API (체크포인트 2)
  // =====================================

  /**
   * Alias 사용 가능 여부 확인
   *
   * **체크포인트 2: Alias 중복 확인 API**
   *
   * @description
   * 사용자가 Settings에서 alias를 변경하기 전에 사용 가능한지 확인합니다.
   * - 형식 검증: 3~30자, 영문/숫자/하이픈/언더스코어만
   * - 예약어 체크
   * - blogs 테이블 중복 확인
   * - old_aliases 테이블 재사용 방지
   *
   * @param alias - 확인할 alias (@ 없이)
   * @returns { available: true } 또는 ConflictException
   *
   * @example
   * GET /blogs/check-alias/park → { available: true }
   * GET /blogs/check-alias/admin → ConflictException (예약어)
   */
  @Get("check-alias/:alias")
  @Public()
  @ApiOperation({ summary: "Alias 사용 가능 여부 확인" })
  @ApiResponse({
    status: 200,
    description: "Alias 사용 가능",
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean", example: true },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "Alias 사용 불가 (중복, 예약어, 형식 오류)",
  })
  async checkAlias(@Param("alias") alias: string) {
    const available = await this.blogsService.checkAliasAvailability(alias);
    return { available };
  }

  /**
   * 블로그 Alias 변경
   *
   * **체크포인트 2: Alias 변경 API**
   *
   * @description
   * 사용자가 Settings에서 블로그 주소(alias)를 변경합니다.
   * - 본인 블로그만 변경 가능 (JWT 인증)
   * - 기존 alias는 old_aliases로 이동 (SEO 보호)
   * - 새 alias 저장
   * - Redis 캐시 무효화
   *
   * @param body - { alias: string }
   * @param user - 현재 로그인한 사용자
   * @returns 업데이트된 블로그 정보
   *
   * @example
   * PATCH /blogs/my-blog/alias
   * Body: { "alias": "newname" }
   * Response: { id, slug, alias: "newname", ... }
   */
  @Patch("my-blog/alias")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "내 블로그 Alias 변경" })
  @ApiResponse({
    status: 200,
    description: "Alias 변경 성공",
  })
  @ApiResponse({
    status: 403,
    description: "권한 없음 (본인 블로그가 아님)",
  })
  @ApiResponse({
    status: 409,
    description: "Alias 사용 불가 (중복, 예약어 등)",
  })
  async updateMyBlogAlias(
    @Body("alias") alias: string,
    @CurrentUser() user: User,
  ) {
    // 사용자의 블로그 ID 조회
    const blogs = await this.blogsService.findByUserId(user.id);

    if (!blogs || blogs.length === 0) {
      throw new UnauthorizedException("블로그가 없습니다.");
    }

    const blog = blogs[0]; // 한 사용자당 하나의 블로그

    // Alias 업데이트
    return await this.blogsService.updateAlias(blog.id, alias, user.id);
  }

  private parseLimit(limitQuery?: string): number {
    const defaultLimit = 20;
    if (!limitQuery) return defaultLimit;

    const parsed = Number(limitQuery);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return defaultLimit;
    }

    return Math.min(Math.floor(parsed), 100);
  }

  private paginateCategoryResults(
    categories: Array<{ category: string; count: number }>,
    limit: number,
    cursor?: string,
  ): {
    items: Array<{ category: string; count: number }>;
    hasMore: boolean;
    nextCursor: string | null;
  } {
    let startIndex = 0;

    if (cursor) {
      const decoded = this.decodeCategoryCursor(cursor);
      if (decoded) {
        const cursorIndex = categories.findIndex(
          (item) =>
            item.category === decoded.category && item.count === decoded.count,
        );
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      }
    }

    const items = categories.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + items.length < categories.length;
    const nextCursor =
      hasMore && items.length > 0
        ? this.encodeCategoryCursor(items[items.length - 1])
        : null;

    return { items, hasMore, nextCursor };
  }

  private encodeCategoryCursor(item: {
    category: string;
    count: number;
  }): string {
    const payload = JSON.stringify({
      category: item.category ?? "",
      count: item.count ?? 0,
    });
    return Buffer.from(payload).toString("base64");
  }

  private decodeCategoryCursor(
    cursor: string,
  ): { category: string; count: number } | null {
    try {
      const decoded = Buffer.from(cursor, "base64").toString();
      const payload = JSON.parse(decoded);
      if (
        typeof payload === "object" &&
        payload !== null &&
        typeof payload.category === "string" &&
        typeof payload.count === "number"
      ) {
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }
}
