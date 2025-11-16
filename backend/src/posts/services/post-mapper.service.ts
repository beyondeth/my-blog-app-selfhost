import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Post } from '../entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { File } from '../../files/entities/file.entity';
import { PostResponseDto } from '../dto/post-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { BlogResponseDto } from '../../blogs/dto/blog-response.dto';
import { FilesService } from '../../files/files.service';
import { CdnService } from '../../files/services/cdn.service';
import { extractImageUrlsFromContent } from '../utils/post.utils';

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

    // 썸네일 URL 처리 - 모든 경우를 명확하게 처리
    if (dto.thumbnail) {
      // 1. 이미 완전한 URL인 경우 (외부 URL, 기존 CDN URL 등)
      if (dto.thumbnail.startsWith('http://') || dto.thumbnail.startsWith('https://')) {
        // 이미 외부 URL이면 그대로 사용
        // 버전 파라미터는 캐시 무효화를 위해 추가
        if (post.updatedAt && !dto.thumbnail.includes('v=')) {
          const timestamp = new Date(post.updatedAt).getTime();
          const separator = dto.thumbnail.includes('?') ? '&' : '?';
          dto.thumbnail = `${dto.thumbnail}${separator}v=${timestamp}`;
        }
      }
      // 2. S3 키인 경우 (relative path)
      else if (post.thumbnailImageId) {
        // thumbnailImageId가 있으면 S3 키로 CDN URL 생성
        try {
          dto.thumbnail = this.cdnService.generateCdnUrlFromKey(dto.thumbnail, 'image/jpeg');

          // 버전 파라미터 추가
          if (post.updatedAt) {
            const timestamp = new Date(post.updatedAt).getTime();
            const separator = dto.thumbnail.includes('?') ? '&' : '?';
            dto.thumbnail = `${dto.thumbnail}${separator}v=${timestamp}`;
          }
        } catch (error) {
          // CDN URL 생성 실패 시 원래 값 유지
          this.logger.warn(`Failed to generate CDN URL for thumbnail: ${dto.thumbnail}`, error);
        }
      }
    }

    // 첨부 파일 처리
    if (post.attachedFiles) {
      dto.attachedFiles = post.attachedFiles.map(file => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileUrl: file.fileUrl,
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
   * 포스트 내용의 이미지에 data-image-id 속성 추가
   * 기존 이미지들이 썸네일로 선택될 수 있도록 함
   *
   * @param content 포스트 HTML 내용
   * @param attachedFiles 첨부 파일 목록
   * @returns data-image-id 속성이 추가된 HTML 내용
   */
  private addImageIdAttributes(content: string, attachedFiles: File[]): string {
    if (!content) {
      return content;
    }

    this.logger.debug(`[ADD_IMAGE_ID] Processing content with ${attachedFiles.length} attached files`);
    attachedFiles.forEach(file => {
      this.logger.debug(`[ADD_IMAGE_ID] File: ID=${file.id}, URL=${file.fileUrl}`);
    });

    let processedContent = content;

    // 기존의 잘못된 data-image-id 속성 제거하고 새로 설정
    // 정규식을 사용하여 img 태그 찾기
    const imgTagRegex = /<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;

    processedContent = processedContent.replace(imgTagRegex, (match, beforeSrc, src, afterSrc) => {
      // 기존 data-image-id 속성 제거
      const cleanBeforeSrc = beforeSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');
      const cleanAfterSrc = afterSrc.replace(/\s+data-image-id=["'][^"']*["']/g, '');

      // 첨부 파일에서 URL로 파일 찾기
      const matchedFile = attachedFiles.find(file => {
        if (!file.fileUrl) return false;

        // 정확한 URL 매칭
        if (file.fileUrl === src) return true;

        // CDN URL 매칭 (파일 이름으로)
        try {
          const srcUrl = new URL(src);
          const fileUrl = new URL(file.fileUrl);
          return srcUrl.pathname.includes(fileUrl.pathname.split('/').pop() || '');
        } catch {
          // URL 파싱 실패 시 문자열 포함 여부 확인
          return src.includes(file.fileUrl) || file.fileUrl.includes(src);
        }
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

    return processedContent;
  }
}