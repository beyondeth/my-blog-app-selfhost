import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { File } from '../../files/entities/file.entity';
import { PostResponseDto } from '../dto/post-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { BlogResponseDto } from '../../blogs/dto/blog-response.dto';
import { FilesService } from '../../files/files.service';
import { CdnService } from '../../files/services/cdn.service';

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
    private readonly filesService: FilesService,
    private readonly cdnService: CdnService,
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
      user?: User;
      blog?: Blog;
    }
  ): Promise<PostResponseDto> {
    // plainToInstance로 자동 변환 (@Expose 필드만 포함됨)
    const dto = plainToInstance(PostResponseDto, post, {
      excludeExtraneousValues: true, // @Expose가 없는 필드 제외
    });

    // 추가 필드 설정
    if (options) {
      if (options.liked !== undefined) {
        dto.liked = options.liked;
      }
      if (options.bookmarked !== undefined) {
        dto.bookmarked = options.bookmarked;
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
    dto.tags = post.tags ||
                (post.metadata && post.metadata.tags) ||
                [];

    // viewCount, likeCount, commentCount는 PostStats에서 가져오기
    dto.viewCount = post.stats?.viewCount || 0;
    dto.likeCount = post.stats?.likeCount || 0;
    dto.commentCount = post.stats?.commentCount || 0;

    // 썸네일 URL 처리
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[POST_MAPPER] Processing thumbnail for post ${post.id}: thumbnailImageId=${post.thumbnailImageId}`);
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
            if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`  - Extracted fileKey from fileUrl: ${fileKey}`);
          }
          }
        }

        if (!fileKey) {
          this.logger.warn(`[POST_MAPPER] No fileKey available for post ${post.id}, thumbnailImageId: ${post.thumbnailImageId}`);
          dto.thumbnail = null;
        } else {
          const thumbnailUrl = this.cdnService.generateCdnUrlFromKey(
            fileKey,
            post.thumbnailImage.mimeType || 'image/jpeg'
          );

          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`  - Generated CDN URL: ${thumbnailUrl}`);
          }

          // 캐시 버스팅을 위한 타임스탬프 추가
          if (post.updatedAt && thumbnailUrl && !thumbnailUrl.includes('v=')) {
            const timestamp = new Date(post.updatedAt).getTime();
            const separator = thumbnailUrl.includes('?') ? '&' : '?';
            dto.thumbnail = `${thumbnailUrl}${separator}v=${timestamp}`;
          } else {
            dto.thumbnail = thumbnailUrl;
          }

          if (process.env.NODE_ENV === 'development') {
            this.logger.log(`[POST_MAPPER] Generated thumbnail for post ${post.id}: ${dto.thumbnail?.substring(0, 100)}...`);
          }
        }
      } catch (error) {
        this.logger.error(`[POST_MAPPER] Failed to generate thumbnail from thumbnailImageId: ${post.thumbnailImageId}`, error.stack);
        dto.thumbnail = null;
      }
    }
    // thumbnailImageId는 있지만 thumbnailImage 관계가 없는 경우 (로드 실패)
    else if (post.thumbnailImageId && !post.thumbnailImage) {
      this.logger.warn(`[POST_MAPPER] thumbnailImageId exists but thumbnailImage not loaded for post ${post.id}. thumbnailImageId: ${post.thumbnailImageId}`);

      // thumbnailImageId가 있으면 직접 파일을 조회해서 썸네일 URL 생성
      try {
        // Repository를 통해 파일 조회
        const thumbnailFile = await this.filesRepository.findOne({
          where: { id: post.thumbnailImageId }
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
              thumbnailFile.mimeType || 'image/jpeg'
            );

            // 캐시 버스팅을 위한 타임스탬프 추가
            if (post.updatedAt && thumbnailUrl && !thumbnailUrl.includes('v=')) {
              const timestamp = new Date(post.updatedAt).getTime();
              const separator = thumbnailUrl.includes('?') ? '&' : '?';
              dto.thumbnail = `${thumbnailUrl}${separator}v=${timestamp}`;
            } else {
              dto.thumbnail = thumbnailUrl;
            }

            if (process.env.NODE_ENV === 'development') {
              this.logger.log(`[POST_MAPPER] Loaded thumbnail image directly for post ${post.id}: ${dto.thumbnail?.substring(0, 100)}...`);
            }
          } else {
            this.logger.error(`[POST_MAPPER] No fileKey found for thumbnail ${post.thumbnailImageId}`);
            dto.thumbnail = null;
          }
        } else {
          this.logger.error(`[POST_MAPPER] Thumbnail file not found: ${post.thumbnailImageId}`);
          dto.thumbnail = null;
        }
      } catch (error) {
        this.logger.error(`[POST_MAPPER] Failed to load thumbnail image ${post.thumbnailImageId}`, error.stack);
        dto.thumbnail = null;
      }
    }
    // 3. 썸네일이 선택되지 않은 경우에만 첫 번째 이미지를 썸네일로 사용
    else if (post.content) {
      const extractedUrl = this.extractFirstImageFromContent(post.content);
      dto.thumbnail = extractedUrl;
      if (process.env.NODE_ENV === 'development') {
        if (extractedUrl) {
          this.logger.debug(`[POST_MAPPER] No thumbnail selected, using first image from content for post ${post.id}: ${extractedUrl.substring(0, 100)}...`);
        } else {
          this.logger.debug(`[POST_MAPPER] No image found in content for post ${post.id}`);
        }
      }
    }
    // 4. 썸네일이 없는 경우 (콘텐츠도 없는 경우)
    else {
      dto.thumbnail = null;
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`[POST_MAPPER] No thumbnail for post ${post.id} - no content`);
      }
    }

    // 첨부 파일 처리
    if (post.attachedFiles) {
      dto.attachedFiles = post.attachedFiles.map(file => {
        // fileUrl이 CDN URL이 아니면 S3 key로 간주하고 CDN URL 생성
        let cdnFileUrl = file.fileUrl;

        // fileUrl이 이미 full CDN URL이 아니면 CDN URL로 변환
        if (file.fileUrl && !file.fileUrl.startsWith('http')) {
          try {
            cdnFileUrl = this.cdnService.generateCdnUrlFromKey(
              file.fileUrl,
              file.mimeType
            );
            this.logger.debug(`[POST_MAPPER] Converted S3 key to CDN URL: ${file.fileUrl} -> ${cdnFileUrl}`);
          } catch (error) {
            this.logger.warn(`[POST_MAPPER] Failed to convert S3 key to CDN URL: ${file.fileUrl}`, error);
            // 실패 시 원래 URL 사용
            cdnFileUrl = file.fileUrl;
          }
        }

        return {
          id: file.id,
          fileName: file.fileName,
          originalName: file.originalName,
          fileUrl: cdnFileUrl,
          fileKey: file.fileKey,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          fileType: file.fileType,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        };
      });
    }

    // 포스트 내용의 이미지에 data-image-id 속성 추가 (기존 이미지들)
    if (dto.content && post.attachedFiles && post.attachedFiles.length > 0) {
      this.logger.log(`[POST_MAPPER] Processing post ${post.id} with ${post.attachedFiles.length} attached files`);
      this.logger.debug(`[POST_MAPPER] Sample content snippet: ${dto.content.substring(0, 200)}...`);
      const originalContent = dto.content;
      dto.content = this.addImageIdAttributes(dto.content, post.attachedFiles);

      // 변경이 있었는지 확인
      if (originalContent !== dto.content) {
        this.logger.log(`[POST_MAPPER] Updated data-image-id attributes in post content`);
      } else {
        this.logger.warn(`[POST_MAPPER] No changes made to data-image-id attributes`);
        this.logger.debug(`[POST_MAPPER] Content contains data-image-id: ${dto.content.includes('data-image-id')}`);
        this.logger.debug(`[POST_MAPPER] Content contains img tags: ${dto.content.includes('<img')}`);
      }
    } else if (!dto.content) {
      this.logger.debug(`[POST_MAPPER] Post ${post.id} has no content`);
    } else if (!post.attachedFiles || post.attachedFiles.length === 0) {
      this.logger.debug(`[POST_MAPPER] Post ${post.id} has no attached files`);
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
        'image/jpeg'
      );
    }

    return formattedUser;
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
      return url.split('?')[0];
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

    this.logger.debug(`[ADD_IMAGE_ID] Processing content with ${attachedFiles.length} attached files`);
    this.logger.debug(`[CAPTION_DEBUG] Content before processing:`, {
      hasFigure: content.includes('<figure'),
      hasFigcaption: content.includes('<figcaption'),
      figcaptionCount: (content.match(/<figcaption/g) || []).length
    });

    attachedFiles.forEach(file => {
      this.logger.debug(`[ADD_IMAGE_ID] File: ID=${file.id}, URL=${file.fileUrl}`);
    });

    let processedContent = content;

    // 먼저 figure 태그 처리 (Medium 스타일 이미지)
    const figureTagRegex = /<figure([^>]*?)>(.*?)<\/figure>/gis;
    processedContent = processedContent.replace(figureTagRegex, (match, figureAttrs, figureContent) => {
      // figure 내용에서 img 태그 찾기
      const imgMatch = figureContent.match(/<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/i);
      if (!imgMatch) return match; // img 태그가 없으면 그대로 반환

      const [fullImgMatch, beforeSrc, src, afterSrc] = imgMatch;

      // 기존 data-image-id 속성 제거
      const cleanBeforeSrc = beforeSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');
      const cleanAfterSrc = afterSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');

      // URL 정규화 (쿼리 파라미터 제거)
      const normalizedSrc = this.normalizeUrl(src);

      // 첨부 파일에서 URL로 파일 찾기
      const matchedFile = attachedFiles.find(file => {
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
          const srcFilename = srcUrl.pathname.split('/').pop();
          const fileFilename = fileUrl.pathname.split('/').pop();

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
        const updatedImg = figureContent.replace(fullImgMatch,
          `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc} data-image-id="${matchedFile.id}">`);

        // 전체 figure 태그 반환 (figcaption 유지)
        return `<figure${figureAttrs}>${updatedImg}</figure>`;
      }

      // 파일을 찾지 못했으면 기존 data-image-id만 제거하고 반환
      const updatedImg = figureContent.replace(fullImgMatch,
        `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc}>`);

      return `<figure${figureAttrs}>${updatedImg}</figure>`;
    });

    // 일반 img 태그 처리 (figure가 아닌 독립적인 img)
    const imgTagRegex = /<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;

    processedContent = processedContent.replace(imgTagRegex, (match, beforeSrc, src, afterSrc) => {
      // 이미 figure 태그 안에 있는 img는 건너뛰기
      if (match.includes('data-image-id=')) {
        // 이미 data-image-id가 있으면 패스
        return match;
      }

      // 기존 data-image-id 속성 제거
      const cleanBeforeSrc = beforeSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');
      const cleanAfterSrc = afterSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');

      // URL 정규화 (쿼리 파라미터 제거)
      const normalizedSrc = this.normalizeUrl(src);
      this.logger.debug(`[ADD_IMAGE_ID] Processing standalone img: Original src: ${src}, Normalized: ${normalizedSrc}`);

      // 첨부 파일에서 URL로 파일 찾기
      const matchedFile = attachedFiles.find(file => {
        if (!file.fileUrl) return false;

        // 정확한 URL 매칭
        if (file.fileUrl === src) return true;

        // 정규화된 URL 매칭 (쿼리 파라미터 무시)
        const normalizedFileUrl = this.normalizeUrl(file.fileUrl);
        if (normalizedFileUrl === normalizedSrc) {
          this.logger.debug(`[ADD_IMAGE_ID] URL match found: ${normalizedFileUrl} === ${normalizedSrc}`);
          return true;
        }

        // CDN URL 매칭 (파일 이름으로)
        try {
          const srcUrl = new URL(src);
          const fileUrl = new URL(file.fileUrl);
          const srcFilename = srcUrl.pathname.split('/').pop();
          const fileFilename = fileUrl.pathname.split('/').pop();

          if (srcFilename && fileFilename && srcFilename === fileFilename) {
            this.logger.debug(`[ADD_IMAGE_ID] Filename match found: ${srcFilename} === ${fileFilename}`);
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
        this.logger.debug(`[ADD_IMAGE_ID] Matched file ID ${matchedFile.id} for image src: ${src}`);
        return `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc} data-image-id="${matchedFile.id}">`;
      }

      // 파일을 찾지 못했으면 기존 data-image-id만 제거하고 반환
      this.logger.debug(`[ADD_IMAGE_ID] No match found for image src: ${src}`);
      return `<img${cleanBeforeSrc}src="${src}"${cleanAfterSrc}>`;
    });

    this.logger.debug(`[CAPTION_DEBUG] Content after processing:`, {
      hasFigure: processedContent.includes('<figure'),
      hasFigcaption: processedContent.includes('<figcaption'),
      figcaptionCount: (processedContent.match(/<figcaption/g) || []).length
    });

    return processedContent;
  }

  /**
   * 콘텐츠에서 첫 번째 이미지 URL을 추출하여 썸네일로 사용
   *
   * @param content HTML 콘텐츠
   * @returns 첫 번째 이미지 URL 또는 null
   */
  private extractFirstImageFromContent(content: string): string | null {
    if (!content) {
      return null;
    }

    // 정규식으로 img 태그의 src 속성 추출
    // data: URL은 제외
    const imgTagRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    const match = imgTagRegex.exec(content);

    if (match && match[1]) {
      // 이미지 URL을 찾았으면 반환
      const imageUrl = match[1];

      // data: URL이 아닌 실제 URL만 반환
      if (!imageUrl.startsWith('data:')) {
        return imageUrl;
      }
    }

    return null;
  }
}