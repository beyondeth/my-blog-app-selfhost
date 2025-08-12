import { IsString, IsOptional, Matches, Length } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: '블로그 주소는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.'
  })
  slug: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}