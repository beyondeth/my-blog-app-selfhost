import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Post } from '../entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
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

    // 썸네일 URL 최적화
    if (dto.thumbnail) {
      // S3 키가 있으면 CDN URL로 변환
      if (post.thumbnailImageId) {
        dto.thumbnail = this.cdnService.generateCdnUrlFromKey(dto.thumbnail, 'image/jpeg');
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
}