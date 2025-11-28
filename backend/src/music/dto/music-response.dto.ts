import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Music, SyncedLyricLine } from '../entities/music.entity';

/**
 * 플레이리스트 트랙 응답 DTO
 * 프론트엔드에서 재생에 필요한 정보만 포함
 */
export class PlaylistTrackDto {
  @ApiProperty({ description: '트랙 ID' })
  id: string;

  @ApiProperty({ description: '표시 제목' })
  title: string;

  @ApiProperty({ description: '표시 아티스트' })
  artist: string;

  @ApiPropertyOptional({ description: '재생 시간 (초)' })
  duration?: number;

  @ApiProperty({ description: '오디오 URL' })
  audioUrl: string;

  @ApiPropertyOptional({ description: '앨범 커버 URL' })
  coverUrl?: string;

  @ApiProperty({ description: '재생 순서' })
  order: number;

  @ApiPropertyOptional({ description: '장르 (관리자 지정)' })
  genre?: string;

  @ApiPropertyOptional({ description: '일반 텍스트 가사' })
  lyrics?: string;

  @ApiPropertyOptional({
    description: '동기화된 가사 배열 [{time: ms, text: string}]',
    type: 'array',
    items: { type: 'object', properties: { time: { type: 'number' }, text: { type: 'string' } } },
  })
  syncedLyrics?: SyncedLyricLine[];

  /**
   * Music 엔티티를 DTO로 변환
   */
  static fromEntity(music: Music, baseUrl: string): PlaylistTrackDto {
    return {
      id: music.id,
      title: music.displayTitle || music.title || music.originalName,
      artist: music.displayArtist || music.artist || 'Unknown Artist',
      duration: music.duration,
      audioUrl: `${baseUrl}/${music.fileKey}`,
      coverUrl: music.coverImageKey ? `${baseUrl}/${music.coverImageKey}` : undefined,
      order: music.order,
      genre: music.displayGenre || undefined,
      lyrics: music.lyrics,
      syncedLyrics: music.syncedLyrics,
    };
  }
}

/**
 * 관리자용 음악 상세 응답 DTO
 */
export class AdminMusicDto {
  @ApiProperty({ description: '음악 ID' })
  id: string;

  @ApiProperty({ description: '원본 파일명' })
  originalName: string;

  @ApiProperty({ description: '파일 크기 (bytes)' })
  fileSize: number;

  @ApiPropertyOptional({ description: '재생 시간 (초)' })
  duration?: number;

  // ID3 메타데이터
  @ApiPropertyOptional({ description: 'ID3 제목' })
  title?: string;

  @ApiPropertyOptional({ description: 'ID3 아티스트' })
  artist?: string;

  @ApiPropertyOptional({ description: 'ID3 앨범' })
  album?: string;

  @ApiPropertyOptional({ description: '발매년도' })
  year?: number;

  @ApiPropertyOptional({ description: '장르' })
  genre?: string;

  // 표시용 필드 (관리자가 지정한 값, ID3 메타데이터 대신 사용)
  @ApiPropertyOptional({ description: '표시 제목 (수정된 경우)' })
  displayTitle?: string;

  @ApiPropertyOptional({ description: '표시 아티스트 (수정된 경우)' })
  displayArtist?: string;

  @ApiPropertyOptional({ description: '표시 장르 (관리자 지정)' })
  displayGenre?: string;

  // 상태
  @ApiProperty({ description: '활성화 상태' })
  isActive: boolean;

  @ApiProperty({ description: '재생 순서' })
  order: number;

  // URL
  @ApiProperty({ description: '오디오 URL' })
  audioUrl: string;

  @ApiPropertyOptional({ description: '앨범 커버 URL' })
  coverUrl?: string;

  // 업로드 정보
  @ApiProperty({ description: '업로드 일시' })
  createdAt: Date;

  // 가사 정보
  @ApiPropertyOptional({ description: '일반 텍스트 가사' })
  lyrics?: string;

  @ApiPropertyOptional({
    description: '동기화된 가사 배열 [{time: ms, text: string}]',
    type: 'array',
    items: { type: 'object', properties: { time: { type: 'number' }, text: { type: 'string' } } },
  })
  syncedLyrics?: SyncedLyricLine[];

  /**
   * Music 엔티티를 관리자 DTO로 변환
   */
  static fromEntity(music: Music, baseUrl: string): AdminMusicDto {
    return {
      id: music.id,
      originalName: music.originalName,
      fileSize: music.fileSize,
      duration: music.duration,
      title: music.title,
      artist: music.artist,
      album: music.album,
      year: music.year,
      genre: music.genre,
      displayTitle: music.displayTitle,
      displayArtist: music.displayArtist,
      displayGenre: music.displayGenre,
      isActive: music.isActive,
      order: music.order,
      audioUrl: `${baseUrl}/${music.fileKey}`,
      coverUrl: music.coverImageKey ? `${baseUrl}/${music.coverImageKey}` : undefined,
      createdAt: music.createdAt,
      lyrics: music.lyrics,
      syncedLyrics: music.syncedLyrics,
    };
  }
}

/**
 * Presigned URL 응답 DTO
 */
export class MusicUploadUrlResponseDto {
  @ApiProperty({ description: 'S3 업로드용 Presigned URL' })
  uploadUrl: string;

  @ApiProperty({ description: 'S3 파일 키' })
  fileKey: string;

  @ApiProperty({ description: 'URL 만료 시간 (초)' })
  expiresIn: number;
}
