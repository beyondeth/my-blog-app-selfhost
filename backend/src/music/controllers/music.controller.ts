import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MusicService } from '../services/music.service';
import { PlaylistTrackDto } from '../dto';

/**
 * 공개 음악 API 컨트롤러
 * 인증 없이 접근 가능 (@Public 데코레이터로 전역 JWT 가드 우회)
 */
@ApiTags('Music')
@Controller('music')
@Public() // 전역 JwtAuthGuard 우회 - 플레이리스트는 인증 없이 접근 가능
export class MusicController {
  private readonly logger = new Logger(MusicController.name);

  constructor(private readonly musicService: MusicService) {}

  /**
   * 활성화된 플레이리스트 조회
   * BGM 플레이어에서 사용하는 공개 엔드포인트
   *
   * @param genre - 장르 필터 (선택). 미지정시 전체 조회
   */
  @Get('playlist')
  @ApiOperation({ summary: 'BGM 플레이리스트 조회 (장르 필터 지원)' })
  @ApiQuery({
    name: 'genre',
    required: false,
    description: '장르 필터 (예: Lo-Fi, Chill, Electronic, Ambient)',
    example: 'Lo-Fi',
  })
  @ApiResponse({
    status: 200,
    description: '활성화된 음악 목록 반환 (장르 필터 적용)',
    type: [PlaylistTrackDto],
  })
  async getPlaylist(
    @Query('genre') genre?: string,
  ): Promise<PlaylistTrackDto[]> {
    // 빈 문자열은 null로 처리
    const genreFilter = genre?.trim() || null;
    return this.musicService.getPlaylist(genreFilter);
  }

  /**
   * 사용 가능한 장르 목록 조회
   * 기본 장르(Lo-Fi, Chill, Electronic, Ambient) + DB에 있는 커스텀 장르
   */
  @Get('genres')
  @ApiOperation({ summary: '사용 가능한 장르 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '장르 목록 (기본 장르 + 커스텀 장르)',
    type: [String],
  })
  async getAvailableGenres(): Promise<string[]> {
    return this.musicService.getAvailableGenres();
  }
}
