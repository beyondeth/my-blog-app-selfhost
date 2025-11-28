import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

import { Music } from '../entities/music.entity';
import { MusicMetadataService } from './music-metadata.service';
import {
  CreateMusicUploadUrlDto,
  MusicUploadCompleteDto,
  UpdateMusicDto,
  ReorderMusicDto,
  PlaylistTrackDto,
  AdminMusicDto,
  MusicUploadUrlResponseDto,
} from '../dto';
import { CacheService } from '../../cache/cache.service';
import { S3Service } from '../../files/services/s3.service';
import {
  MUSIC_CACHE_KEYS,
  MUSIC_CACHE_TTL,
} from '../constants';

/**
 * 음악 서비스
 * 음악 파일 업로드, 메타데이터 관리, 플레이리스트 제공
 */
@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);
  private readonly cdnBaseUrl: string;

  constructor(
    @InjectRepository(Music)
    private readonly musicRepository: Repository<Music>,
    private readonly metadataService: MusicMetadataService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    // CDN_DOMAIN에서 CDN 베이스 URL 구성 (CdnService와 동일한 패턴)
    const cdnDomain = this.configService.get('CDN_DOMAIN', '');
    this.cdnBaseUrl = cdnDomain ? `https://${cdnDomain}` : '';
  }

  // ============================================
  // 공개 API
  // ============================================

  /**
   * 활성화된 플레이리스트 조회 (장르 필터 지원)
   * Redis 캐싱 적용 (5분 TTL)
   *
   * @param genre - 장르 필터 (선택). null/undefined면 전체 조회
   */
  async getPlaylist(genre?: string | null): Promise<PlaylistTrackDto[]> {
    // 장르별 캐시 키 결정
    const cacheKey = genre
      ? MUSIC_CACHE_KEYS.PLAYLIST_BY_GENRE(genre)
      : MUSIC_CACHE_KEYS.PLAYLIST_ALL;

    // 캐시 확인
    const cached = await this.cacheService.get<PlaylistTrackDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Playlist served from cache: ${cacheKey}`);
      return cached;
    }

    // DB 조회 조건 구성 (displayGenre로 필터링 - 관리자 지정 장르)
    const whereCondition: { isActive: boolean; displayGenre?: string } = {
      isActive: true,
    };
    if (genre) {
      whereCondition.displayGenre = genre;
    }

    // DB 조회
    const musics = await this.musicRepository.find({
      where: whereCondition,
      order: { order: 'ASC', createdAt: 'DESC' },
    });

    // DTO 변환
    const playlist = musics.map((music) =>
      PlaylistTrackDto.fromEntity(music, this.cdnBaseUrl),
    );

    // 캐시 저장
    await this.cacheService.set(cacheKey, playlist, MUSIC_CACHE_TTL.PLAYLIST);

    return playlist;
  }

  /**
   * 사용 가능한 장르 목록 조회
   * 기본 장르 + DB에 저장된 커스텀 장르를 합쳐서 반환
   * Redis 캐싱 적용 (10분 TTL)
   */
  async getAvailableGenres(): Promise<string[]> {
    // 캐시 확인
    const cached = await this.cacheService.get<string[]>(
      MUSIC_CACHE_KEYS.GENRES_LIST,
    );
    if (cached) {
      this.logger.debug('Genres list served from cache');
      return cached;
    }

    // DB에서 실제 사용 중인 장르만 조회 (관리자 지정 displayGenre, 활성화된 음악만)
    // 기본 장르 없음 - 관리자가 직접 지정한 장르만 표시
    const result = await this.musicRepository
      .createQueryBuilder('music')
      .select('DISTINCT music.display_genre', 'genre')
      .where('music.is_active = :isActive', { isActive: true })
      .andWhere('music.display_genre IS NOT NULL')
      .andWhere("music.display_genre != ''")
      .getRawMany();

    const dbGenres = result.map((r) => r.genre as string);

    // 캐시 저장
    await this.cacheService.set(
      MUSIC_CACHE_KEYS.GENRES_LIST,
      dbGenres,
      MUSIC_CACHE_TTL.GENRES,
    );

    return dbGenres;
  }

  // ============================================
  // 관리자 API
  // ============================================

  /**
   * Presigned URL 생성 (관리자용)
   */
  async createUploadUrl(
    dto: CreateMusicUploadUrlDto,
  ): Promise<MusicUploadUrlResponseDto> {
    // MIME 타입 검증
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/flac',
      'audio/m4a',
      'audio/aac',
    ];

    if (!allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `지원하지 않는 파일 형식입니다. 지원 형식: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // S3 키 생성
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = this.getExtensionFromMimeType(dto.mimeType);
    const fileKey = `uploads/music/${year}/${month}/${uuidv4()}${ext}`;

    // S3Service를 통해 Presigned URL 생성
    const result = await this.s3Service.generatePresignedUploadUrl(
      fileKey,
      dto.mimeType,
      dto.fileSize,
      'audio', // fileType
    );

    return {
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * 업로드 완료 처리
   * S3 업로드 후 메타데이터 추출 및 DB 저장
   */
  async uploadComplete(
    adminId: string,
    dto: MusicUploadCompleteDto,
  ): Promise<AdminMusicDto> {
    // 메타데이터 추출
    const metadata = await this.metadataService.extractMetadata(dto.fileKey);

    // 현재 최대 순서 조회
    const maxOrder = await this.musicRepository
      .createQueryBuilder('music')
      .select('MAX(music.order)', 'max')
      .getRawOne();

    const nextOrder = (maxOrder?.max ?? -1) + 1;

    // 엔티티 생성 및 저장
    const music = this.musicRepository.create({
      originalName: dto.fileName,
      fileKey: dto.fileKey,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      duration: metadata.duration,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      year: metadata.year,
      genre: metadata.genre,
      trackNumber: metadata.trackNumber,
      coverImageKey: metadata.coverImageKey,
      lyrics: metadata.lyrics, // 일반 텍스트 가사
      syncedLyrics: metadata.syncedLyrics, // 동기화된 가사
      order: nextOrder,
      isActive: true,
      uploadedById: adminId,
    });

    const savedMusic = await this.musicRepository.save(music);

    // 캐시 무효화
    await this.invalidatePlaylistCache();

    this.logger.log(`Music uploaded: ${savedMusic.id} by admin ${adminId}`);

    return AdminMusicDto.fromEntity(savedMusic, this.cdnBaseUrl);
  }

  /**
   * 전체 음악 목록 조회 (관리자용)
   */
  async findAll(): Promise<AdminMusicDto[]> {
    const musics = await this.musicRepository.find({
      order: { order: 'ASC', createdAt: 'DESC' },
    });

    return musics.map((music) =>
      AdminMusicDto.fromEntity(music, this.cdnBaseUrl),
    );
  }

  /**
   * 음악 상세 조회
   */
  async findOne(id: string): Promise<AdminMusicDto> {
    const music = await this.musicRepository.findOne({ where: { id } });

    if (!music) {
      throw new NotFoundException('음악을 찾을 수 없습니다.');
    }

    return AdminMusicDto.fromEntity(music, this.cdnBaseUrl);
  }

  /**
   * 음악 정보 수정
   */
  async update(id: string, dto: UpdateMusicDto): Promise<AdminMusicDto> {
    const music = await this.musicRepository.findOne({ where: { id } });

    if (!music) {
      throw new NotFoundException('음악을 찾을 수 없습니다.');
    }

    // 변경 사항 적용
    if (dto.displayTitle !== undefined) {
      music.displayTitle = dto.displayTitle;
    }
    if (dto.displayArtist !== undefined) {
      music.displayArtist = dto.displayArtist;
    }
    if (dto.isActive !== undefined) {
      music.isActive = dto.isActive;
    }
    if (dto.order !== undefined) {
      music.order = dto.order;
    }
    if (dto.displayGenre !== undefined) {
      music.displayGenre = dto.displayGenre;
    }

    const updated = await this.musicRepository.save(music);

    // 캐시 무효화
    await this.invalidatePlaylistCache();

    return AdminMusicDto.fromEntity(updated, this.cdnBaseUrl);
  }

  /**
   * 재생 순서 변경
   */
  async reorder(dto: ReorderMusicDto): Promise<void> {
    // 트랜잭션으로 일괄 업데이트
    await this.musicRepository.manager.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager.update(Music, { id: item.id }, { order: item.order });
      }
    });

    // 캐시 무효화
    await this.invalidatePlaylistCache();

    this.logger.log(`Music reordered: ${dto.items.length} items`);
  }

  /**
   * 음악 삭제
   */
  async remove(id: string): Promise<void> {
    const music = await this.musicRepository.findOne({ where: { id } });

    if (!music) {
      throw new NotFoundException('음악을 찾을 수 없습니다.');
    }

    // S3에서 파일 삭제
    try {
      await this.deleteFromS3(music.fileKey);
      if (music.coverImageKey) {
        await this.deleteFromS3(music.coverImageKey);
      }
    } catch (error) {
      this.logger.error(`Failed to delete S3 files: ${error.message}`);
      // S3 삭제 실패해도 DB에서는 삭제 진행
    }

    // DB에서 삭제
    await this.musicRepository.remove(music);

    // 캐시 무효화
    await this.invalidatePlaylistCache();

    this.logger.log(`Music deleted: ${id}`);
  }

  /**
   * 활성화/비활성화 토글
   */
  async toggleActive(id: string): Promise<AdminMusicDto> {
    const music = await this.musicRepository.findOne({ where: { id } });

    if (!music) {
      throw new NotFoundException('음악을 찾을 수 없습니다.');
    }

    music.isActive = !music.isActive;
    const updated = await this.musicRepository.save(music);

    // 캐시 무효화
    await this.invalidatePlaylistCache();

    return AdminMusicDto.fromEntity(updated, this.cdnBaseUrl);
  }

  // ============================================
  // 내부 메서드
  // ============================================

  /**
   * 플레이리스트 관련 캐시 무효화
   * 전체 플레이리스트, 장르별 플레이리스트, 장르 목록 캐시 모두 삭제
   */
  private async invalidatePlaylistCache(): Promise<void> {
    // 전체 플레이리스트 캐시 삭제
    await this.cacheService.del(MUSIC_CACHE_KEYS.PLAYLIST_ALL);

    // 장르 목록 캐시 삭제
    await this.cacheService.del(MUSIC_CACHE_KEYS.GENRES_LIST);

    // DB에서 현재 사용 중인 모든 장르 조회하여 해당 캐시 삭제
    // displayGenre 기준으로 조회 (관리자 지정 장르)
    const result = await this.musicRepository
      .createQueryBuilder('music')
      .select('DISTINCT music.display_genre', 'genre')
      .where('music.display_genre IS NOT NULL')
      .andWhere("music.display_genre != ''")
      .getRawMany();

    for (const row of result) {
      if (row.genre) {
        await this.cacheService.del(MUSIC_CACHE_KEYS.PLAYLIST_BY_GENRE(row.genre));
      }
    }

    this.logger.debug('All playlist caches invalidated');
  }

  /**
   * S3에서 파일 삭제
   */
  private async deleteFromS3(fileKey: string): Promise<void> {
    await this.s3Service.deleteFile(fileKey);
  }

  /**
   * MIME 타입에서 확장자 추출
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/flac': '.flac',
      'audio/m4a': '.m4a',
      'audio/aac': '.aac',
    };

    return mimeToExt[mimeType] || '.mp3';
  }
}
