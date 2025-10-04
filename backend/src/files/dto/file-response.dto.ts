import { Exclude, Expose } from 'class-transformer';

/**
 * File 응답 DTO
 *
 * @description
 * File 엔티티의 필드를 프론트엔드에 노출하기 위한 DTO
 * PostResponseDto의 attachedFiles 타입으로 사용됨
 */
@Exclude()
export class FileResponseDto {
  @Expose()
  id: string;

  @Expose()
  fileName: string;

  @Expose()
  originalName: string;

  @Expose()
  fileUrl: string;

  @Expose()
  fileKey: string;

  @Expose()
  fileSize: number;

  @Expose()
  mimeType: string;

  @Expose()
  fileType: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
