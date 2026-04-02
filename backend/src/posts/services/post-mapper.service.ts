import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { plainToInstance } from "class-transformer";
import { Repository } from "typeorm";
import { Post } from "../entities/post.entity";
import { User } from "../../users/entities/user.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { File } from "../../files/entities/file.entity";
import { Video } from "../../files/entities/video.entity";
import { PostResponseDto } from "../dto/post-response.dto";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { BlogResponseDto } from "../../blogs/dto/blog-response.dto";
import { FilesService } from "../../files/files.service";
import { CdnService } from "../../files/services/cdn.service";
import { R2Service } from "../../files/services/r2.service";
import { VoteType } from "../enums/vote-type.enum";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";
import { PostAccessPolicyService } from "./post-access-policy.service";

/**
 * Post 관련 DTO 변환을 담당하는 서비스
 *
 * 책임:
 * - Entity를 DTO로 변환
 * - 사용자, 블로그 정보를 DTO로 변환
 * - 썸네일 URL CDN 최적화
 * - 파일 목록 변환 및 처리
 */
@Injectable()
export class PostMapperService {
  private readonly logger = new Logger(PostMapperService.name);

  constructor(
    @InjectRepository(File)
    private readonly filesRepository: Repository<File>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly postAccessPolicyService: PostAccessPolicyService,
    private readonly filesService: FilesService,
    private readonly cdnService: CdnService,
    private readonly r2Service: R2Service,
  ) {}

  /**
   * Post 엔티티를 PostResponseDto로 변환
   *
   * @param post Post 엔티티
   * @param options 추가 옵션 (liked 상태, tags 등)
   * @returns PostResponseDto
   */
  async toPostDto(
    post: Post,
    options?: {
      liked?: boolean;
      bookmarked?: boolean;
      userVote?: VoteType | null;
      user?: User;
      viewer?: User;
      blog?: Blog;
      exposeGithubResourceUrl?: boolean;
    },
  ): Promise<PostResponseDto> {
    // plainToInstance로 자동 변환 (@Expose 필드만 포함됨)
    const dto = plainToInstance(PostResponseDto, post, {
      excludeExtraneousValues: true, // @Expose가 없는 필드 제외
    });

    const sanitizeString = (
      value: string | null | undefined,
      maxLength?: number,
    ): string | null | undefined => {
      if (value === null || value === undefined) {
        return value;
      }
      return UrlSanitizerUtil.sanitizeDisplayText(value, maxLength ?? 5000);
    };

    dto.title = sanitizeString(dto.title, 500) ?? "";
    dto.excerpt = sanitizeString(dto.excerpt, 2000) ?? "";
    dto.category = sanitizeString(dto.category, 120) ?? "";
    const githubDescriptionSource =
      post.metadata?.githubDescription ?? (post as any).githubDescription;
    const githubUrlSource = post.metadata?.githubUrl ?? (post as any).githubUrl;
    const hasGithubResourceSource =
      typeof (post as any).hasGithubResource === "boolean"
        ? (post as any).hasGithubResource
        : Boolean(githubUrlSource);

    dto.githubDescription = sanitizeString(githubDescriptionSource, 240) ?? null;
    dto.hasGithubResource = hasGithubResourceSource;
    dto.githubUrl =
      options?.exposeGithubResourceUrl && options.viewer && githubUrlSource
        ? sanitizeString(githubUrlSource, 500) ?? null
        : null;

    // 추가 필드 설정
    if (options) {
      if (options.liked !== undefined) {
        dto.liked = options.liked;
      }
      if (options.bookmarked !== undefined) {
        dto.bookmarked = options.bookmarked;
      }
      if (options.userVote !== undefined) {
        dto.userVote = options.userVote ?? null;
        if (options.liked === undefined) {
          dto.liked = options.userVote === VoteType.UPVOTE;
        }
      }
      // Post 엔티티에 이미 로드된 author가 있으면 사용
      if (post.author) {
        dto.author = this.toUserDto(post.author);
      } else if (options.user) {
        dto.author = this.toUserDto(options.user);
      }
      if (options.blog) {
        dto.blog = this.toBlogDto(options.blog);
      }
    } else {
      // options가 없어도 post에 author가 있으면 변환
      if (post.author) {
        dto.author = this.toUserDto(post.author);
      }
    }

    // 날짜는 TypeORM이 자동으로 ISO 8601 문자열로 직렬화
    // formatDate() 제거 - 시간 정보 보존을 위해 ISO 문자열 그대로 반환

    // 태그 필드 호환성 - Post 엔티티의 tags를 우선적으로 사용 (안전한 fallback)
    const tagSource = post.tags || (post.metadata && post.metadata.tags) || [];
    dto.tags = tagSource
      .map((tag: string) => UrlSanitizerUtil.sanitizeDisplayText(tag, 64))
      .filter((tag) => !!tag);

    // 포스트 유형 + 상품 상세 정보
    dto.postType = post.postType || "blog";
    if (post.productDetail) {
      dto.productDetail = {
        price: post.productDetail.price,
        currency: post.productDetail.currency,
        productCategory: post.productDetail.productCategory,
        salesCount: post.productDetail.salesCount,
        isActive: post.productDetail.isActive,
        deliveryType: post.productDetail.deliveryType,
      };
    }

    // Editor's Pick 정보는 PostMetadata가 단일 소스이므로 명시적으로 덮어씀
    dto.isEditorPick =
      post.metadata?.isEditorPick ?? post.isEditorPick ?? false;
    dto.editorPickedAt =
      post.metadata?.editorPickedAt ?? post.editorPickedAt ?? null;

    // viewCount, like/dislike, commentCount는 PostStats에서 가져오기
    const stats = post.stats;
    const upvoteCount = stats?.upvoteCount ?? stats?.likeCount ?? 0;
    const downvoteCount = stats?.downvoteCount ?? 0;
    dto.viewCount = stats?.viewCount || 0;
    dto.likeCount = stats?.likeCount || upvoteCount;
    dto.upvoteCount = upvoteCount;
    dto.downvoteCount = downvoteCount;
    dto.score = upvoteCount - downvoteCount;
    dto.commentCount = stats?.commentCount || 0;
    if (dto.userVote === undefined) {
      dto.userVote = null;
    }

    // 저장 visibility와 실제 노출 visibility를 분리해 응답한다.
    // (blog 전체 비공개 게이트가 개별 공개를 막는 경우를 프론트에서 명확히 안내하기 위함)
    const sourceBlog = options?.blog || post.blog;
    dto.effectiveVisibility = this.postAccessPolicyService.getEffectiveVisibility(
      post,
      sourceBlog,
    );
    dto.visibilityBlockedByBlogPrivacy =
      this.postAccessPolicyService.isVisibilityBlockedByBlogPrivacy(
        post,
        sourceBlog,
      );

    // 썸네일 URL 처리
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `[POST_MAPPER] Processing thumbnail for post ${post.id}: thumbnailImageId=${post.thumbnailImageId}`,
      );
    }

    // thumbnailImageId가 있으면 동적으로 생성
    if (post.thumbnailImageId && post.thumbnailImage) {
      try {
        // fileKey가 없고 fileUrl이 있는 경우, fileUrl에서 fileKey를 추출 시도
        let fileKey = post.thumbnailImage.fileKey;
        if (!fileKey && post.thumbnailImage.fileUrl) {
          // fileUrl이 S3 URL 형식인 경우 key를 추출
          const s3UrlMatch = post.thumbnailImage.fileUrl.match(/\/([^\/]+)$/);
          if (s3UrlMatch) {
            fileKey = s3UrlMatch[1];
            if (process.env.NODE_ENV === "development") {
              this.logger.debug(
                `  - Extracted fileKey from fileUrl: ${fileKey}`,
              );
            }
          }
        }

        if (!fileKey) {
          this.logger.warn(
            `[POST_MAPPER] No fileKey available for post ${post.id}, thumbnailImageId: ${post.thumbnailImageId}`,
          );
          dto.thumbnail = null;
        } else {
          const thumbnailUrl = this.cdnService.generateCdnUrlFromKey(
            fileKey,
            post.thumbnailImage.mimeType || "image/jpeg",
          );

          if (process.env.NODE_ENV === "development") {
            this.logger.debug(`  - Generated CDN URL: ${thumbnailUrl}`);
          }

          // 캐시 버스팅을 위한 타임스탬프 추가
          if (post.updatedAt && thumbnailUrl && !thumbnailUrl.includes("v=")) {
            const timestamp = new Date(post.updatedAt).getTime();
            const separator = thumbnailUrl.includes("?") ? "&" : "?";
            dto.thumbnail = `${thumbnailUrl}${separator}v=${timestamp}`;
          } else {
            dto.thumbnail = thumbnailUrl;
          }

          if (process.env.NODE_ENV === "development") {
            this.logger.log(
              `[POST_MAPPER] Generated thumbnail for post ${post.id}: ${dto.thumbnail?.substring(0, 100)}...`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `[POST_MAPPER] Failed to generate thumbnail from thumbnailImageId: ${post.thumbnailImageId}`,
          error.stack,
        );
        dto.thumbnail = null;
      }
    }
    // thumbnailImageId는 있지만 thumbnailImage 관계가 없는 경우 (로드 실패)
    else if (post.thumbnailImageId && !post.thumbnailImage) {
      this.logger.warn(
        `[POST_MAPPER] thumbnailImageId exists but thumbnailImage not loaded for post ${post.id}. thumbnailImageId: ${post.thumbnailImageId}`,
      );

      // thumbnailImageId가 있으면 직접 파일을 조회해서 썸네일 URL 생성
      try {
        // Repository를 통해 파일 조회
        const thumbnailFile = await this.filesRepository.findOne({
          where: { id: post.thumbnailImageId },
        });

        if (thumbnailFile) {
          // fileKey 또는 fileUrl로 CDN URL 생성
          let fileKey = thumbnailFile.fileKey;

          // fileKey가 없고 fileUrl이 있는 경우, fileUrl에서 key를 추출 시도
          if (!fileKey && thumbnailFile.fileUrl) {
            const s3UrlMatch = thumbnailFile.fileUrl.match(/\/([^\/]+)$/);
            if (s3UrlMatch) {
              fileKey = s3UrlMatch[1];
            }
          }

          if (fileKey) {
            const thumbnailUrl = this.cdnService.generateCdnUrlFromKey(
              fileKey,
              thumbnailFile.mimeType || "image/jpeg",
            );

            // 캐시 버스팅을 위한 타임스탬프 추가
            if (
              post.updatedAt &&
              thumbnailUrl &&
              !thumbnailUrl.includes("v=")
            ) {
              const timestamp = new Date(post.updatedAt).getTime();
              const separator = thumbnailUrl.includes("?") ? "&" : "?";
              dto.thumbnail = `${thumbnailUrl}${separator}v=${timestamp}`;
            } else {
              dto.thumbnail = thumbnailUrl;
            }

            if (process.env.NODE_ENV === "development") {
              this.logger.log(
                `[POST_MAPPER] Loaded thumbnail image directly for post ${post.id}: ${dto.thumbnail?.substring(0, 100)}...`,
              );
            }
          } else {
            this.logger.error(
              `[POST_MAPPER] No fileKey found for thumbnail ${post.thumbnailImageId}`,
            );
            dto.thumbnail = null;
          }
        } else {
          this.logger.error(
            `[POST_MAPPER] Thumbnail file not found: ${post.thumbnailImageId}`,
          );
          dto.thumbnail = null;
        }
      } catch (error) {
        this.logger.error(
          `[POST_MAPPER] Failed to load thumbnail image ${post.thumbnailImageId}`,
          error.stack,
        );
        dto.thumbnail = null;
      }
    }
    // 3. 썸네일이 선택되지 않은 경우에만 첫 번째 이미지를 썸네일로 사용
    else if (post.content || post.content_markdown) {
      const extractedUrl = this.extractFirstImageFromContent(
        post.content,
        post.content_markdown,
      );
      dto.thumbnail = extractedUrl;
      if (process.env.NODE_ENV === "development") {
        if (extractedUrl) {
          this.logger.debug(
            `[POST_MAPPER] No thumbnail selected, using first image from content for post ${post.id}: ${extractedUrl.substring(0, 100)}...`,
          );
        } else {
          this.logger.debug(
            `[POST_MAPPER] No image found in content for post ${post.id}`,
          );
        }
      }
    }
    // 4. 썸네일이 없는 경우 (콘텐츠도 없는 경우)
    else {
      dto.thumbnail = null;
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(
          `[POST_MAPPER] No thumbnail for post ${post.id} - no content`,
        );
      }
    }

    // 비디오가 있지만 썸네일을 찾지 못한 경우 비디오 썸네일 사용
    if (!dto.thumbnail && post.content) {
      try {
        const videoThumbnail = await this.extractVideoThumbnailFromContent(
          post.content,
        );
        if (videoThumbnail) {
          dto.thumbnail = videoThumbnail;
          if (process.env.NODE_ENV === "development") {
            this.logger.debug(
              `[POST_MAPPER] Using video thumbnail for post ${post.id}: ${videoThumbnail.substring(0, 100)}...`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `[POST_MAPPER] Failed to extract video thumbnail for post ${post.id}`,
          error.stack,
        );
      }
    }

    // 첨부 파일 처리
    if (post.attachedFiles) {
      dto.attachedFiles = post.attachedFiles.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileUrl: this.getCdnUrlForFile(file),
        fileKey: file.fileKey,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        fileType: file.fileType,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      }));
    }

    // 포스트 내용의 이미지에 data-image-id 속성 추가 (기존 이미지들)
    if (dto.content && post.attachedFiles && post.attachedFiles.length > 0) {
      this.logger.log(
        `[POST_MAPPER] Processing post ${post.id} with ${post.attachedFiles.length} attached files`,
      );
      this.logger.debug(
        `[POST_MAPPER] Sample content snippet: ${dto.content.substring(0, 200)}...`,
      );
      const originalContent = dto.content;
      dto.content = this.addImageIdAttributes(dto.content, post.attachedFiles);

      // 변경이 있었는지 확인
      if (originalContent !== dto.content) {
        this.logger.log(
          `[POST_MAPPER] Updated data-image-id attributes in post content`,
        );
      } else {
        this.logger.warn(
          `[POST_MAPPER] No changes made to data-image-id attributes`,
        );
        this.logger.debug(
          `[POST_MAPPER] Content contains data-image-id: ${dto.content.includes("data-image-id")}`,
        );
        this.logger.debug(
          `[POST_MAPPER] Content contains img tags: ${dto.content.includes("<img")}`,
        );
      }
    } else if (!dto.content) {
      this.logger.debug(`[POST_MAPPER] Post ${post.id} has no content`);
    } else if (!post.attachedFiles || post.attachedFiles.length === 0) {
      this.logger.debug(`[POST_MAPPER] Post ${post.id} has no attached files`);
    }

    dto.images = await this.resolvePostImageUrls(post);
    if (
      (!dto.images || dto.images.length === 0) &&
      (post.content || post.content_markdown)
    ) {
      dto.images = this.extractInlineImageUrls(
        post.content,
        post.content_markdown,
      );
    }
    if ((!dto.images || dto.images.length === 0) && dto.thumbnail) {
      dto.images = [dto.thumbnail];
    }

    return dto;
  }

  /**
   * User Entity를 UserResponseDto로 변환
   * @param user - User 엔티티
   * @returns UserResponseDto
   */
  private toUserDto(user: User): UserResponseDto {
    if (!user) return null;

    // 포맷된 author 데이터 사용 (profile 평탄화 및 CDN URL 변환 적용)
    const formattedUser = this.formatAuthorData(user);

    const dto = plainToInstance(UserResponseDto, formattedUser, {
      excludeExtraneousValues: true,
    });

    return dto;
  }

  /**
   * Blog Entity를 BlogResponseDto로 변환
   * @param blog - Blog 엔티티
   * @returns BlogResponseDto
   */
  private toBlogDto(blog: Blog): BlogResponseDto {
    if (!blog) return null;

    const dto = plainToInstance(BlogResponseDto, blog, {
      excludeExtraneousValues: true,
    });

    // Manually assign alias to ensure it's included
    dto.alias = blog.alias;

    return dto;
  }

  /**
   * Author 데이터 포매팅 (profile 평탄화 및 CDN URL 변환)
   * PostsService의 formatAuthorData 로직을 그대로 사용
   */
  private formatAuthorData(user: User): any {
    // profiles 테이블의 데이터를 user 객체에 평탄화
    const formattedUser: any = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // profile이 관계로 로드된 경우
    if (user.profile) {
      formattedUser.profileImage = user.profile.profileImage;
      formattedUser.bio = user.profile.bio;
    } else {
      // profile이 로드되지 않은 경우 기본값 설정
      formattedUser.profileImage = null;
      formattedUser.bio = null;
    }

    // profileImage CDN URL 최적화
    if (formattedUser.profileImage) {
      formattedUser.profileImage = this.cdnService.generateCdnUrlFromKey(
        formattedUser.profileImage,
        "image/jpeg",
      );
    }

    return formattedUser;
  }

  private getCdnUrlForFile(file: File): string | null {
    if (!file) {
      return null;
    }

    if (file.fileUrl && file.fileUrl.startsWith("http")) {
      return file.fileUrl;
    }

    const key = file.fileKey || file.fileUrl;
    if (!key) {
      return file.fileUrl || null;
    }

    try {
      return this.cdnService.generateCdnUrlFromKey(
        key,
        file.mimeType || "image/jpeg",
      );
    } catch (error) {
      this.logger.warn(
        `[POST_MAPPER] Failed to convert file key to CDN URL: ${key}`,
        error,
      );
      return file.fileUrl || null;
    }
  }

  private async resolvePostImageUrls(post: Post): Promise<string[]> {
    if (!post?.id) {
      return [];
    }

    let files: File[] = post.attachedFiles ?? [];

    if (!files.length) {
      files = await this.filesRepository
        .createQueryBuilder("file")
        .innerJoin("post_files", "pf", 'pf."fileId" = file.id')
        .where('pf."postId" = :postId', { postId: post.id })
        .andWhere(
          "(file.mimeType ILIKE :imageMime OR file.fileType = :imageType)",
          {
            imageMime: "image/%",
            imageType: "image",
          },
        )
        .orderBy("file.createdAt", "ASC")
        .getMany();
    }

    const urls = files
      .filter(
        (file) =>
          (file.mimeType && file.mimeType.startsWith("image")) ||
          file.fileType === "image",
      )
      .map((file) => this.getCdnUrlForFile(file))
      .filter((url): url is string => Boolean(url));

    const uniqueFileUrls = Array.from(new Set(urls));
    if (uniqueFileUrls.length > 0) {
      return uniqueFileUrls;
    }

    return this.extractInlineImageUrls(post.content, post.content_markdown);
  }

  /**
   * URL에서 쿼리 파라미터를 제거하여 기본 URL을 추출
   * @param url 원본 URL
   * @returns 쿼리 파라미터가 제거된 URL
   */
  private normalizeUrl(url: string): string {
    if (!url) return url;

    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      // URL 파싱 실패 시 간단한 방식으로 쿼리 파라미터 제거
      return url.split("?")[0];
    }
  }

  /**
   * 포스트 내용의 이미지에 data-image-id 속성 추가
   * 기존 이미지들이 썸네일로 선택될 수 있도록 함
   * figure-figcaption 구조도 지원
   *
   * @param content 포스트 HTML 내용
   * @param attachedFiles 첨부 파일 목록
   * @returns data-image-id 속성이 추가된 HTML 내용
   */
  addImageIdAttributes(content: string, attachedFiles: File[]): string {
    if (!content) {
      return content;
    }

    this.logger.debug(
      `[ADD_IMAGE_ID] Processing content with ${attachedFiles.length} attached files`,
    );
    this.logger.debug(`[CAPTION_DEBUG] Content before processing:`, {
      hasFigure: content.includes("<figure"),
      hasFigcaption: content.includes("<figcaption"),
      figcaptionCount: (content.match(/<figcaption/g) || []).length,
    });

    attachedFiles.forEach((file) => {
      this.logger.debug(
        `[ADD_IMAGE_ID] File: ID=${file.id}, URL=${file.fileUrl}`,
      );
    });

    let processedContent = content;

    // 먼저 figure 태그 처리 (Medium 스타일 이미지)
    const figureTagRegex = /<figure([^>]*?)>(.*?)<\/figure>/gis;
    processedContent = processedContent.replace(
      figureTagRegex,
      (match, figureAttrs, figureContent) => {
        // figure 내용에서 img 태그 찾기
        const imgMatch = figureContent.match(
          /<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/i,
        );
        if (!imgMatch) return match; // img 태그가 없으면 그대로 반환

        const [fullImgMatch, beforeSrc, src, afterSrc] = imgMatch;

        // 기존 data-image-id 속성 제거
        const cleanBeforeSrc = beforeSrc.replace(
          /\s+data-image-id=["'][^"']*["']/g,
          "",
        );
        const cleanAfterSrc = afterSrc.replace(
          /\s+data-image-id=["'][^"']*["']/g,
          "",
        );

        // URL 정규화 (쿼리 파라미터 제거)
        const normalizedSrc = this.normalizeUrl(src);

        // 첨부 파일에서 URL로 파일 찾기
        const matchedFile = attachedFiles.find((file) => {
          if (!file.fileUrl) return false;

          // 정확한 URL 매칭
          if (file.fileUrl === src) return true;

          // 정규화된 URL 매칭 (쿼리 파라미터 무시)
          const normalizedFileUrl = this.normalizeUrl(file.fileUrl);
          if (normalizedFileUrl === normalizedSrc) {
            return true;
          }

          // CDN URL 매칭 (파일 이름으로)
          try {
            const srcUrl = new URL(src);
            const fileUrl = new URL(file.fileUrl);
            const srcFilename = srcUrl.pathname.split("/").pop();
            const fileFilename = fileUrl.pathname.split("/").pop();

            if (srcFilename && fileFilename && srcFilename === fileFilename) {
              return true;
            }
          } catch {
            // URL 파싱 실패 시 문자열 포함 여부 확인
            if (src.includes(file.fileUrl) || file.fileUrl.includes(src)) {
              return true;
            }
          }

          return false;
        });

        // 파일을 찾았으면 data-image-id 추가
        if (matchedFile && matchedFile.id) {
          // img 태그에 data-image-id 추가
          const updatedImg = figureContent.replace(
            fullImgMatch,
            `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc} data-image-id="${matchedFile.id}">`,
          );

          // 전체 figure 태그 반환 (figcaption 유지)
          return `<figure${figureAttrs}>${updatedImg}</figure>`;
        }

        // 파일을 찾지 못했으면 기존 data-image-id만 제거하고 반환
        const updatedImg = figureContent.replace(
          fullImgMatch,
          `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc}>`,
        );

        return `<figure${figureAttrs}>${updatedImg}</figure>`;
      },
    );

    // 일반 img 태그 처리 (figure가 아닌 독립적인 img)
    const imgTagRegex = /<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;

    processedContent = processedContent.replace(
      imgTagRegex,
      (match, beforeSrc, src, afterSrc) => {
        // 이미 figure 태그 안에 있는 img는 건너뛰기
        if (match.includes("data-image-id=")) {
          // 이미 data-image-id가 있으면 패스
          return match;
        }

        // 기존 data-image-id 속성 제거
        const cleanBeforeSrc = beforeSrc.replace(
          /\s+data-image-id=["'][^"']*["']/g,
          "",
        );
        const cleanAfterSrc = afterSrc.replace(
          /\s+data-image-id=["'][^"']*["']/g,
          "",
        );

        // URL 정규화 (쿼리 파라미터 제거)
        const normalizedSrc = this.normalizeUrl(src);
        this.logger.debug(
          `[ADD_IMAGE_ID] Processing standalone img: Original src: ${src}, Normalized: ${normalizedSrc}`,
        );

        // 첨부 파일에서 URL로 파일 찾기
        const matchedFile = attachedFiles.find((file) => {
          if (!file.fileUrl) return false;

          // 정확한 URL 매칭
          if (file.fileUrl === src) return true;

          // 정규화된 URL 매칭 (쿼리 파라미터 무시)
          const normalizedFileUrl = this.normalizeUrl(file.fileUrl);
          if (normalizedFileUrl === normalizedSrc) {
            this.logger.debug(
              `[ADD_IMAGE_ID] URL match found: ${normalizedFileUrl} === ${normalizedSrc}`,
            );
            return true;
          }

          // CDN URL 매칭 (파일 이름으로)
          try {
            const srcUrl = new URL(src);
            const fileUrl = new URL(file.fileUrl);
            const srcFilename = srcUrl.pathname.split("/").pop();
            const fileFilename = fileUrl.pathname.split("/").pop();

            if (srcFilename && fileFilename && srcFilename === fileFilename) {
              this.logger.debug(
                `[ADD_IMAGE_ID] Filename match found: ${srcFilename} === ${fileFilename}`,
              );
              return true;
            }
          } catch {
            // URL 파싱 실패 시 문자열 포함 여부 확인
            if (src.includes(file.fileUrl) || file.fileUrl.includes(src)) {
              this.logger.debug(`[ADD_IMAGE_ID] String match found`);
              return true;
            }
          }

          return false;
        });

        // 파일을 찾았으면 data-image-id 추가
        if (matchedFile && matchedFile.id) {
          this.logger.debug(
            `[ADD_IMAGE_ID] Matched file ID ${matchedFile.id} for image src: ${src}`,
          );
          return `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc} data-image-id="${matchedFile.id}">`;
        }

        // 파일을 찾지 못했으면 기존 data-image-id만 제거하고 반환
        this.logger.debug(
          `[ADD_IMAGE_ID] No match found for image src: ${src}`,
        );
        return `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc}>`;
      },
    );

    this.logger.debug(`[CAPTION_DEBUG] Content after processing:`, {
      hasFigure: processedContent.includes("<figure"),
      hasFigcaption: processedContent.includes("<figcaption"),
      figcaptionCount: (processedContent.match(/<figcaption/g) || []).length,
    });

    return processedContent;
  }

  /**
   * 콘텐츠에서 첫 번째 이미지 URL을 추출하여 썸네일로 사용
   *
   * @param content HTML 콘텐츠
   * @returns 첫 번째 이미지 URL 또는 null
   */
  private extractFirstImageFromContent(
    ...contents: Array<string | undefined | null>
  ): string | null {
    const urls = this.extractInlineImageUrls(...contents);
    return urls.length > 0 ? urls[0] : null;
  }

  private extractInlineImageUrls(
    ...contents: Array<string | undefined | null>
  ): string[] {
    const urls = new Set<string>();
    for (const rawContent of contents) {
      const content = rawContent?.trim();
      if (!content) {
        continue;
      }

      let match: RegExpExecArray | null;
      const htmlRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
      while ((match = htmlRegex.exec(content)) !== null) {
        const url = match[1]?.trim();
        if (url && !url.startsWith("data:") && !url.startsWith("javascript:")) {
          urls.add(url);
        }
      }

      const markdownRegex = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;
      while ((match = markdownRegex.exec(content)) !== null) {
        const rawUrl = match[1]?.trim();
        const url = rawUrl?.replace(/^<|>$/g, "");
        if (url && !url.startsWith("data:") && !url.startsWith("javascript:")) {
          urls.add(url);
        }
      }

      const plainImageUrlRegex =
        /https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s)"']*)?/gi;
      while ((match = plainImageUrlRegex.exec(content)) !== null) {
        const url = match[0]?.trim();
        if (url && !url.startsWith("javascript:")) {
          urls.add(url);
        }
      }
    }

    return Array.from(urls);
  }

  /**
   * 콘텐츠에서 첫 번째 비디오 ID를 추출하고 썸네일 URL 생성
   *
   * @param content HTML 콘텐츠
   * @returns 비디오 썸네일 URL 또는 null
   */
  private async extractVideoThumbnailFromContent(
    content: string,
  ): Promise<string | null> {
    const videoId = this.extractFirstVideoId(content);
    if (!videoId) {
      return null;
    }

    try {
      const video = await this.videoRepository.findOne({
        where: { id: videoId },
      });

      if (!video || !video.thumbnailKey) {
        return null;
      }

      // 우선 R2 Public URL 사용 (CDN은 비디오 썸네일 경로를 알지 못함)
      if (this.r2Service) {
        const publicUrl = this.r2Service.getPublicUrl(video.thumbnailKey);
        if (publicUrl) {
          return publicUrl;
        }

        try {
          // Public URL이 없으면 Presigned URL 생성 (임시 링크)
          return await this.r2Service.generatePresignedDownloadUrl(
            video.thumbnailKey,
            3600,
          );
        } catch (error) {
          this.logger.warn(
            `[POST_MAPPER] Failed to generate presigned URL for video thumbnail ${video.thumbnailKey}`,
            error.stack,
          );
        }
      }

      // R2 구성이 없으면 CDN 기본 URL 시도
      return this.cdnService.generateCdnUrlFromKey(
        video.thumbnailKey,
        "image/jpeg",
      );
    } catch (error) {
      this.logger.error(
        `[POST_MAPPER] Failed to load video thumbnail for video ${videoId}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * 콘텐츠에서 첫 번째 VideoEmbed ID 추출
   *
   * @param content HTML 콘텐츠
   * @returns 비디오 ID 또는 null
   */
  private extractFirstVideoId(content: string): string | null {
    if (!content) {
      return null;
    }

    const match = content.match(/data-video-id=["']([^"']+)["']/i);
    return match?.[1] || null;
  }
}
