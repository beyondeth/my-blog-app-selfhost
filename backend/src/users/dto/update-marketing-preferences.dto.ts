import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 마케팅 정보 수신 설정 업데이트 DTO
 * 사용자가 설정 페이지에서 마케팅 정보 및 뉴스레터 수신 여부를 변경할 때 사용
 */
export class UpdateMarketingPreferencesDto {
  @ApiProperty({
    description: '마케팅 정보 수신 동의',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  marketingOptIn?: boolean;

  @ApiProperty({
    description: '뉴스레터 수신 동의',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  newsletterOptIn?: boolean;
}
