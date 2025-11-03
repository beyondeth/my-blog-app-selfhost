import { Exclude, Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { BlogResponseDto } from '../../blogs/dto/blog-response.dto';
import { FileResponseDto } from '../../files/dto/file-response.dto';

/**
 * Post 응답 DTO
 *
 * @description
 * Entity의 spread operator 사용을 방지하고 필요한 필드만 명시적으로 노출
 * ManyToMany 관계(likedBy, attachedFiles)는 lazy loading 방지를 위해 제외
 *
 * @클린아키텍처
 * - Entity와 Response 계층 분리
 * - lazy loading으로 인한 UUID IN 절 쿼리 완전 차단
 * - 프론트엔드에 필요한 필드만 선택적 노출
 */
@Exclude() // 기본적으로 모든 필드 제외
export class PostResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  slug: string;

  @Expose()
  excerpt: string;

  @Expose()
  content: string;

  @Expose()
  content_markdown: string;

  @Expose()
  content_type: string;

  @Expose()
  content_rendered_at: Date;

  @Expose()
  thumbnail: string;

  @Expose()
  thumbnail_image_id: string;

  @Expose()
  isPublished: boolean;

  @Expose()
  viewCount: number;

  @Expose()
  likeCount: number;

  @Expose()
  commentCount: number;

  @Expose()
  qualityScore: number | null;

  @Expose()
  tags: string[];

  @Expose()
  category: string;

  @Expose()
  authorId: string;

  @Expose()
  blogId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  publishedAt: Date;

  @Expose()
  version: number;

  // 관계 필드 - Type 데코레이터로 중첩 DTO 적용
  @Expose()
  @Type(() => UserResponseDto)
  author?: UserResponseDto;

  @Expose()
  @Type(() => BlogResponseDto)
  blog?: BlogResponseDto;

  // 프론트엔드 호환성을 위한 추가 필드
  @Expose()
  liked?: boolean; // 사용자 좋아요 상태

  @Expose()
  bookmarked?: boolean; // 사용자 북마크 상태

  @Expose()
  isEditorPick?: boolean; // Editor's Pick 여부

  @Expose()
  editorPickedAt?: Date; // Editor's Pick 선정 시간

  // 첨부 파일 - 프론트엔드에서 필요하므로 노출
  @Expose()
  @Type(() => FileResponseDto)
  attachedFiles?: FileResponseDto[];

  // ManyToMany 관계는 명시적으로 제외 (lazy loading 방지)
  @Exclude()
  likedBy: any;

  // TypeORM 메타데이터 제외
  @Exclude()
  __entity?: any;

  @Exclude()
  __proto__?: any;
}