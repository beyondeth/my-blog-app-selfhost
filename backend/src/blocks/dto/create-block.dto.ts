import { IsUUID, IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * 사용자 차단 생성 DTO
 */
export class CreateBlockDto {
  /**
   * 차단할 사용자 ID
   */
  @IsUUID()
  blockedId: string;

  /**
   * 차단 사유 (선택사항)
   * 예: "스팸", "괴롭힘", "부적절한 콘텐츠" 등
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
