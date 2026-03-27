import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ApiKeyGuard } from "../guards/api-key.guard";
import { PostsService } from "../../posts/posts.service";
import { CreatePostDto } from "../../posts/dto/create-post.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { ExternalImageDownloadService } from "../../files/services/external-image-download.service";
import { Public } from "../../common/decorators/public.decorator";
import { UsageService } from "../../usage/usage.service";
import { FilesService } from "../../files/files.service";
import { CreateUploadUrlDto } from "../../files/dto/create-upload-url.dto";
import { UploadCompleteDto } from "../../files/dto/upload-complete.dto";
import { appendMcpAiDisclosureFooter } from "../utils/ai-disclosure-footer.util";

/**
 * MCP Proxy 컨트롤러
 * MCP 서버가 API Key를 사용하여 블로그에 포스트를 생성할 수 있도록 하는 프록시 엔드포인트
 * 보안을 위해 오직 포스트 생성만 허용하며, 다른 작업은 모두 차단됨
 *
 * Rate Limit: 분당 20회, 시간당 30회, 하루 50회 (ThrottlerGuard 사용)
 * 인증: API Key (X-API-Key 헤더)
 */
@ApiTags("MCP")
@Controller("mcp")
@Public() // JWT 가드를 우회
@UseGuards(ThrottlerGuard) // Rate Limit 적용 (분당 20회, 시간당 30회, 하루 50회)
@ApiBearerAuth()
export class McpProxyController {
  private readonly logger = new Logger(McpProxyController.name);

  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    private readonly usageService: UsageService,
    private readonly externalImageDownloadService: ExternalImageDownloadService,
    private readonly filesService: FilesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * MCP 헬스체크 엔드포인트
   * 연결 상태 확인용
   */
  @Post("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "MCP 헬스체크",
    description: "MCP 서버와의 연결 상태를 확인합니다.",
  })
  @ApiResponse({ status: 200, description: "정상 작동 중" })
  health() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "MCP 서버가 정상 작동 중입니다.",
    };
  }

  @Get("posts")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "MCP 발행글 목록/검색",
    description:
      "API Key에 연결된 사용자의 발행 완료 글만 조회합니다. 검색/카테고리/태그/기간 필터를 지원합니다.",
  })
  @ApiResponse({ status: 200, description: "발행글 목록 반환" })
  async listPublishedPosts(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("tag") tag?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    const { userId } = req.apiKey;
    const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1);
    const limitNumber = Math.min(
      50,
      Math.max(1, Number.parseInt(limit || "20", 10) || 20),
    );

    return this.postsService.findMyPublishedPostsForMcp(userId, {
      page: pageNumber,
      limit: limitNumber,
      search,
      category,
      tag,
      dateFrom,
      dateTo,
    });
  }

  @Get("posts/:postId")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "MCP 발행글 단건 읽기",
    description:
      "API Key에 연결된 사용자의 발행 완료 글 1건을 상세 조회합니다.",
  })
  @ApiResponse({ status: 200, description: "발행글 상세 반환" })
  async readPublishedPost(@Req() req: any, @Param("postId") postId: string) {
    const { userId } = req.apiKey;
    return this.postsService.findMyPublishedPostForMcp(userId, postId);
  }

  /**
   * MCP를 통한 포스트 생성
   * API Key로 인증된 블로그에만 포스트 생성 가능
   */
  @Post("posts")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "MCP 포스트 생성 (Fast Path)",
    description:
      "MCP 클라이언트가 API Key 인증을 통해 블로그에 포스트를 생성합니다. Fast Path 방식으로 즉시 응답하고 백그라운드에서 처리합니다.",
  })
  @ApiResponse({
    status: 202,
    description: "포스트 생성 요청 접수 (백그라운드 처리 중)",
  })
  @ApiResponse({ status: 401, description: "인증 실패" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async createPost(@Req() req: any, @Body() createPostDto: CreatePostDto) {
    // API Key 정보 추출 (ApiKeyGuard에서 설정)
    const { userId, blogId } = req.apiKey;

    // MCP에서 오는 content_markdown은 원본 마크다운 (base64 인코딩 없음)
    // PostsService.create는 user를 통해 blogId를 자동으로 찾으므로
    // 여기서는 CreatePostDto의 필드만 전달하면 됨

    // Debug: MCP 요청 데이터 로깅
    this.logger.debug(`[MCP Request Data]`, {
      title: createPostDto.title,
      hasContent_markdown: !!createPostDto.content_markdown,
      contentLength: createPostDto.content_markdown?.length || 0,
      tags: createPostDto.tags,
      category: createPostDto.category,
      qualityScore: createPostDto.qualityScore,
      visibility: createPostDto.visibility,
      thumbnail: null, // thumbnail field removed - using thumbnailImageId only
      hasContent: !!createPostDto.content,
      thumbnailImageId: createPostDto.thumbnailImageId,
    });

    // MCP 요청 필드 유효성 검사
    if (!createPostDto.title) {
      throw new BadRequestException("제목은 필수 항목입니다");
    }

    if (!createPostDto.content_markdown && !createPostDto.content) {
      throw new BadRequestException(
        "콘텐츠는 필수 항목입니다 (content 또는 content_markdown)",
      );
    }

    if (!createPostDto.category) {
      throw new BadRequestException("카테고리는 필수 항목입니다");
    }

    let defaultVisibility: "public" | "private" = "private";
    try {
      const blog = await this.blogRepository.findOne({
        where: { id: blogId },
        select: ["id", "isPublic", "userId"],
      });

      if (blog?.userId === userId) {
        defaultVisibility = blog.isPublic ? "public" : "private";
      }
    } catch (error) {
      this.logger.warn(
        `[MCP Visibility] Failed to load blog visibility, fallback to private: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const resolvedVisibility: "public" | "private" =
      createPostDto.visibility === "private"
        ? "private"
        : createPostDto.visibility === "public"
          ? "public"
          : defaultVisibility;

    const postData: CreatePostDto = {
      title: createPostDto.title,
      content_markdown: createPostDto.content_markdown, // 원본 마크다운 콘텐츠 그대로 전달
      tags: createPostDto.tags, // 태그는 그대로 전달 (PostCreationService에서 처리)
      category: createPostDto.category,
      qualityScore: createPostDto.qualityScore, // AI 품질 점수
      visibility: resolvedVisibility,
      // 마켓플레이스 판매 상품 필드
      postType: createPostDto.postType || "blog",
      // thumbnail field removed - using thumbnailImageId only
      ...(createPostDto.thumbnailImageId && {
        thumbnailImageId: createPostDto.thumbnailImageId,
      }),
    };

    // Debug: MCP 요청 데이터 태그 상세 확인
    this.logger.debug(`[MCP Tags Analysis]`, {
      title: createPostDto.title,
      rawTags: createPostDto.tags,
      tagsType: typeof createPostDto.tags,
      isArray: Array.isArray(createPostDto.tags),
      tagsLength: createPostDto.tags?.length,
      tagsContent: createPostDto.tags,
      finalPostDataTags: postData.tags,
    });

    try {
      // 1. 포스트 크기 검증 (글자수 + 바이트 크기)
      if (createPostDto.content_markdown) {
        // 글자수 체크 (200,000자 제한)
        const contentLength = createPostDto.content_markdown.length;
        if (contentLength > 200000) {
          throw new BadRequestException(
            `포스트 내용은 최대 200,000자까지 가능합니다 (현재: ${contentLength.toLocaleString()}자)`,
          );
        }

        // 바이트 크기 체크 (1MB 제한)
        const contentSize = Buffer.byteLength(
          createPostDto.content_markdown,
          "utf8",
        );
        const maxSizeMB = 1;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (contentSize > maxSizeBytes) {
          const sizeMB = (contentSize / (1024 * 1024)).toFixed(2);
          throw new BadRequestException(
            `포스트 크기는 최대 ${maxSizeMB}MB까지 가능합니다 (현재: ${sizeMB}MB)`,
          );
        }

        this.logger.log(
          `[MCP Post Size Check] Length: ${contentLength.toLocaleString()} chars, Size: ${(contentSize / 1024).toFixed(2)} KB`,
        );
      }

      // 2. MCP 포스트 제한 체크 (월간 제한 확인)
      const limitCheck = await this.usageService.checkMcpPostLimit(userId);
      if (!limitCheck.canPost) {
        this.logger.warn(
          `[MCP Post Limit] User ${userId} exceeded limit: ${limitCheck.reason}`,
        );
        throw new ForbiddenException(limitCheck.reason);
      }

      // 3. User 객체 조회 (PostsService가 User를 필요로 함)
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException("사용자를 찾을 수 없습니다");
      }

      // 4. 외부 이미지 처리 (Gemini 등 외부 URL에서 이미지 다운로드)
      let processedContent = postData.content_markdown;
      let firstDownloadedImageId: string | undefined;
      let downloadedFileIds: string[] = []; // 다운로드한 모든 이미지 ID 수집 (post_files 연결용)

      if (postData.content_markdown) {
        try {
          this.logger.log(
            `[External Images] Starting to process external images...`,
          );

          // 콘텐츠에서 외부 이미지 URL 추출
          const externalImageUrls =
            this.externalImageDownloadService.extractExternalImageUrls(
              postData.content_markdown,
            );

          if (externalImageUrls.length > 0) {
            this.logger.log(
              `[External Images] Found ${externalImageUrls.length} external image(s):`,
              externalImageUrls,
            );

            // 외부 이미지 다운로드 및 S3 업로드 (상세 결과 반환)
            const downloadResults =
              await this.externalImageDownloadService.downloadExternalImages(
                externalImageUrls,
                userId,
              );

            // 성공/실패 분리
            const successfulDownloads = downloadResults.filter(
              (r) => r.success,
            );
            const failedDownloads = downloadResults.filter((r) => !r.success);

            // 성공한 이미지 처리
            if (successfulDownloads.length > 0) {
              this.logger.log(
                `[External Images] Successfully downloaded ${successfulDownloads.length}/${externalImageUrls.length} image(s)`,
              );

              // URL 매핑 생성 (원본 URL 기반으로 정확하게 매핑)
              const urlMapping = new Map<string, string>();

              // 다운로드한 모든 이미지 ID 수집 (post_files 테이블 연결을 위해)
              downloadedFileIds = successfulDownloads
                .filter((r) => r.file?.id)
                .map((r) => r.file.id);

              this.logger.log(
                `[External Images] Collected ${downloadedFileIds.length} file IDs for post attachment`,
              );

              // 첫 번째 성공한 이미지를 썸네일로 사용 (thumbnailImageId가 없는 경우)
              if (!postData.thumbnailImageId && successfulDownloads[0]?.file) {
                firstDownloadedImageId = successfulDownloads[0].file.id;
                this.logger.log(
                  `[Auto Thumbnail] Setting first downloaded image as thumbnail: ${firstDownloadedImageId}`,
                );
              }

              // 성공한 이미지의 URL 매핑
              successfulDownloads.forEach((result) => {
                if (result.cdnUrl) {
                  urlMapping.set(result.originalUrl, result.cdnUrl);
                  this.logger.debug(
                    `[External Images] URL mapping: ${result.originalUrl} → ${result.cdnUrl}`,
                  );
                }
              });

              // 콘텐츠의 외부 이미지 URL을 CDN URL로 변환
              processedContent =
                this.externalImageDownloadService.replaceImageUrls(
                  postData.content_markdown,
                  urlMapping,
                );

              this.logger.log(
                `[External Images] Content updated with CDN URLs`,
              );
            }

            // 실패한 이미지 처리 (404 등)
            if (failedDownloads.length > 0) {
              this.logger.warn(
                `[External Images] Failed to download ${failedDownloads.length} image(s)`,
              );

              // 실패한 이미지 URL 목록
              const failedUrls = failedDownloads.map((r) => r.originalUrl);

              // 에러 로깅
              failedDownloads.forEach((result) => {
                this.logger.warn(
                  `[External Images] Failed: ${result.originalUrl} - ${result.error}`,
                );
              });

              // 실패한 이미지 태그를 콘텐츠에서 제거
              processedContent =
                this.externalImageDownloadService.removeFailedImages(
                  processedContent,
                  failedUrls,
                );

              this.logger.log(
                `[External Images] Removed ${failedUrls.length} failed image tag(s) from content`,
              );
            }
          } else {
            this.logger.log(
              `[External Images] No external images found in content`,
            );
          }
        } catch (error) {
          this.logger.error(
            `[External Images] Error processing external images:`,
            error.stack,
          );
          // 외부 이미지 처리 실패 시 원본 콘텐츠 사용 (포스트 생성 실패하지 않도록)
          processedContent = postData.content_markdown;
        }
      }

      // 5. 포스트 생성 (처리된 콘텐츠 사용) (Fast Path: 150-200ms 응답, 백그라운드 처리)
      const startTime = Date.now();

      // 처리된 콘텐츠로 postData 업데이트
      // 자동포스팅 시 첫 번째 이미지를 썸네일로 설정 (기존 thumbnailImageId가 없는 경우)
      // 다운로드한 이미지들을 attachedFileIds에 포함 (수동 포스팅과 동일한 동작)
      const finalPostData = {
        ...postData,
        content_markdown:
          typeof processedContent === "string"
            ? appendMcpAiDisclosureFooter(processedContent)
            : processedContent,
        ...(downloadedFileIds.length > 0 && {
          attachedFileIds: downloadedFileIds,
        }),
        ...(firstDownloadedImageId &&
          !postData.thumbnailImageId && {
            thumbnailImageId: firstDownloadedImageId,
          }),
      };

      // 디버그: 최종 포스트 데이터 확인
      this.logger.debug(`[MCP Post Data]`, {
        hasAttachedFileIds: !!finalPostData.attachedFileIds,
        attachedFileIdsCount: finalPostData.attachedFileIds?.length || 0,
        thumbnailImageId: finalPostData.thumbnailImageId,
        contentLength: finalPostData.content_markdown?.length || 0,
      });

      const postDto = await this.postsService.createFast(finalPostData, user);

      // 4.5. 판매 상품인 경우 ProductDetail 레코드 생성
      if (createPostDto.postType === "product" && createPostDto.price) {
        try {
          const { extractPreviewContent } = await import("../../marketplace/utils/preview-extractor");
          const previewContent = extractPreviewContent(
            createPostDto.content_markdown || createPostDto.content,
          );

          const productDetailRepo = this.dataSource.getRepository("product_details");
          await productDetailRepo.save({
            postId: postDto.id,
            price: createPostDto.price,
            currency: "KRW",
            productCategory: createPostDto.productCategory || "others",
            previewContent,
            deliveryType: "content",
            isActive: true,
            commissionRate: 20.0,
          });
          this.logger.log(
            `🏷️ [MCP Product Created] ProductDetail for Post ${postDto.id}, price=${createPostDto.price}`,
          );
        } catch (pdError) {
          // ProductDetail 생성 실패는 포스트 자체를 실패시키지 않음
          this.logger.error(
            `ProductDetail 생성 실패 (포스트는 생성됨): postId=${postDto.id}`,
          );
        }
      }

      // 5. MCP 포스트 사용량 추적 (usage_tracking 테이블에 기록)
      await this.usageService.trackMcpPost(userId);
      this.logger.log(
        `✅ [MCP Usage Tracked] User ${userId} - MCP post count incremented`,
      );

      // 캐시 무효화는 posts.service.ts의 createFast()에서 이벤트 발행을 통해 처리됨
      // CacheInvalidationListener가 'post.created' 이벤트를 받아 자동으로 처리

      this.logger.log(
        `✅ [MCP Post Created - Fast Path] Post ID: ${postDto.id}, Blog: ${postDto.blog?.slug || "undefined"}`,
      );

      // Debug: 생성된 포스트의 태그 정보 확인
      this.logger.debug(`[MCP Post Tags Check]`, {
        postId: postDto.id,
        inputTags: createPostDto.tags,
        postDtoTags: postDto.tags,
        inputTagsType: typeof createPostDto.tags,
        postDtoTagsType: typeof postDto.tags,
        tagsArrayCheck: Array.isArray(postDto.tags),
        tagsMatch:
          JSON.stringify(postDto.tags) === JSON.stringify(createPostDto.tags),
      });

      // MCP 응답 최적화: 최소 필수 정보 반환
      // blog 정보가 없을 경우를 대비한 fallback 처리
      const blogAlias = postDto.blog?.alias || postDto.blog?.slug;
      const url = blogAlias
        ? `/${blogAlias}/${postDto.slug}`
        : `/posts/${postDto.slug}`;

      return {
        id: postDto.id,
        slug: postDto.slug,
        title: postDto.title,
        url: url,
        blog: postDto.blog, // 프론트엔드 캐시 무효화를 위해 blog 정보 포함
        isPublished: postDto.isPublished,
        visibility: postDto.visibility,
        effectiveVisibility: postDto.effectiveVisibility,
        visibilityBlockedByBlogPrivacy:
          postDto.visibilityBlockedByBlogPrivacy,
        _meta: {
          processingTime: Date.now() - startTime,
          status: "created",
        }, // Fast Path 메타데이터 (처리 상태, 예상 완료 시간 등)
      };
    } catch (error) {
      // 에러 로깅 (디버깅을 위해 전체 에러 출력)
      this.logger.error(
        `[MCP Post Creation Error] ${error.message}`,
        error.stack,
      );

      // 에러 처리 - 민감한 정보는 숨기고 일반적인 메시지만 반환
      if (error.message.includes("already exists")) {
        throw new BadRequestException("이미 존재하는 슬러그입니다");
      }
      if (error.message.includes("not found")) {
        throw new BadRequestException("블로그를 찾을 수 없습니다");
      }

      // 원래 에러가 이미 HTTP Exception이면 그대로 던지기
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // 그 외 알 수 없는 에러
      throw new BadRequestException(
        `포스트 생성 실패: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * MCP 파일 업로드용 URL 생성
   * - FilesController.createUploadUrl과 동일하지만 API Key 인증 사용
   */
  @Post("files/upload-url")
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "MCP 파일 업로드 URL 생성" })
  async createUploadUrl(
    @Req() req: any,
    @Body() createUploadUrlDto: CreateUploadUrlDto,
  ) {
    const { userId } = req.apiKey;
    return this.filesService.createUploadUrl(userId, createUploadUrlDto);
  }

  /**
   * MCP 파일 업로드 완료 처리
   * - FilesController.uploadComplete와 동일하지만 API Key 인증 사용
   */
  @Post("files/upload-complete")
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "MCP 파일 업로드 완료 처리" })
  async uploadComplete(
    @Req() req: any,
    @Body() uploadCompleteDto: UploadCompleteDto,
  ) {
    const { userId } = req.apiKey;
    const result = await this.filesService.uploadComplete(
      userId,
      uploadCompleteDto,
    );

    // CDN URL이 없는 경우 fileUrl(S3 Key)을 사용해서 구성
    // (FilesService.uploadComplete가 accessUrl을 반환하긴 함)
    return {
      success: true,
      fileId: result.id,
      // accessUrl이 있으면 쓰고, 없으면 cdn.codebase.blog 형식으로 직접 구성
      cdnUrl:
        (result as any).accessUrl ||
        `https://cdn.codebase.blog/${result.fileKey}`,
    };
  }

  /**
   * MCP 도구를 통한 이미지 업로드 (외부 URL)
   * Phase 1 방식 (URL 다운로드)
   */
  @Post("images/upload")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async uploadImage(@Req() req: any, @Body() body: { imageUrl: string }) {
    const { userId } = req.apiKey;

    if (!body.imageUrl) {
      throw new BadRequestException("Image URL is required");
    }

    try {
      this.logger.log(
        `[MCP Image Upload] Request received for URL: ${body.imageUrl}`,
      );

      const result =
        await this.externalImageDownloadService.downloadAndProcessImage(
          body.imageUrl,
          userId,
        );

      if (!result) {
        throw new BadRequestException("Failed to download image");
      }

      const cdnUrl = `https://cdn.codebase.blog/${result.fileKey}`;

      this.logger.log(`[MCP Image Upload] Success: ${result.id} -> ${cdnUrl}`);

      return {
        success: true,
        fileId: result.id,
        cdnUrl,
      };
    } catch (error) {
      this.logger.error(
        `[MCP Image Upload] Error: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Image upload failed: ${error.message || "Unknown error"}`,
      );
    }
  }
}
