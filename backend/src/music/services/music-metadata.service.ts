import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as mm from "music-metadata";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { S3Service } from "../../files/services/s3.service";

import { SyncedLyricLine } from "../entities/music.entity";

/**
 * 추출된 음악 메타데이터 인터페이스
 */
export interface ExtractedMusicMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  trackNumber?: string;
  duration?: number;
  coverImageKey?: string;
  lyrics?: string; // 일반 텍스트 가사 (USLT)
  syncedLyrics?: SyncedLyricLine[]; // 동기화된 가사 (LRC 파싱)
}

/**
 * 음악 메타데이터 추출 서비스
 * MP3 ID3 태그, OGG Vorbis 코멘트 등 다양한 포맷 지원
 * music-metadata 라이브러리 사용
 * S3Service를 통해 OCI Object Storage와 통신
 */
@Injectable()
export class MusicMetadataService {
  private readonly logger = new Logger(MusicMetadataService.name);
  private readonly cdnBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    // CDN_DOMAIN에서 CDN 베이스 URL 구성 (CdnService와 동일한 패턴)
    const cdnDomain = this.configService.get("CDN_DOMAIN", "");
    this.cdnBaseUrl = cdnDomain ? `https://${cdnDomain}` : "";
  }

  /**
   * S3에서 음악 파일을 스트리밍으로 읽어 메타데이터 추출
   * 전체 파일을 다운로드하지 않고 메타데이터 부분만 파싱
   */
  async extractMetadata(fileKey: string): Promise<ExtractedMusicMetadata> {
    this.logger.debug(`Extracting metadata from: ${fileKey}`);

    try {
      // S3Service를 통해 파일 스트림 가져오기
      const { stream, contentType, contentLength } =
        await this.s3Service.getObjectStream(fileKey);

      // music-metadata로 파싱
      const metadata = await mm.parseStream(stream as Readable, {
        mimeType: contentType,
        size: contentLength,
      });

      this.logger.debug(
        `Metadata extracted: ${JSON.stringify(metadata.common)}`,
      );

      // 앨범 커버 추출 및 S3 업로드
      let coverImageKey: string | undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        coverImageKey = await this.extractAndSaveCover(
          metadata.common.picture[0],
          fileKey,
        );
      }

      // 가사 추출 (USLT - Unsynchronized Lyrics)
      let lyrics: string | undefined;
      let syncedLyrics: SyncedLyricLine[] | undefined;

      if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
        // lyrics는 ILyricsTag[] 형태 - text 속성에서 실제 가사 추출
        const lyricsTag = metadata.common.lyrics[0];
        // ILyricsTag는 문자열이거나 { text: string } 객체일 수 있음
        const rawLyrics =
          typeof lyricsTag === "string" ? lyricsTag : lyricsTag.text;

        if (rawLyrics) {
          this.logger.debug(`Found lyrics: ${rawLyrics.substring(0, 100)}...`);

          // LRC 포맷인지 확인 ([mm:ss.xx] 또는 [mm:ss] 패턴)
          if (this.isLrcFormat(rawLyrics)) {
            // LRC 포맷이면 파싱하여 동기화 가사로 변환
            syncedLyrics = this.parseLrcLyrics(rawLyrics);
            // 일반 가사도 텍스트만 추출하여 저장
            lyrics = syncedLyrics.map((line) => line.text).join("\n");
            this.logger.debug(
              `Parsed ${syncedLyrics.length} synced lyrics lines`,
            );
          } else {
            // 일반 텍스트 가사
            lyrics = rawLyrics;
          }
        }
      }

      return {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        year: metadata.common.year,
        genre: metadata.common.genre?.[0],
        trackNumber: metadata.common.track?.no?.toString(),
        duration: metadata.format.duration,
        coverImageKey,
        lyrics,
        syncedLyrics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to extract metadata: ${error.message}`,
        error.stack,
      );
      // 메타데이터 추출 실패 시 빈 객체 반환 (파일 자체는 유효)
      return {};
    }
  }

  /**
   * 앨범 커버 이미지를 추출하여 S3에 저장
   */
  private async extractAndSaveCover(
    picture: mm.IPicture,
    originalFileKey: string,
  ): Promise<string | undefined> {
    try {
      // 지원하는 이미지 포맷만 저장
      const supportedFormats = ["image/jpeg", "image/png", "image/webp"];
      if (!supportedFormats.includes(picture.format)) {
        this.logger.debug(`Unsupported cover format: ${picture.format}`);
        return undefined;
      }

      // 확장자 결정
      const extMap: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      const ext = extMap[picture.format] || ".jpg";

      // 커버 이미지 S3 키 생성
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const coverKey = `uploads/music/covers/${year}/${month}/${uuidv4()}${ext}`;

      // S3Service를 통해 업로드 (Uint8Array를 Buffer로 변환)
      await this.s3Service.uploadBuffer(
        coverKey,
        Buffer.from(picture.data),
        picture.format,
        { "cache-control": "public, max-age=31536000" }, // 1년 캐싱 메타데이터
      );
      this.logger.debug(`Cover image saved: ${coverKey}`);

      return coverKey;
    } catch (error) {
      this.logger.error(`Failed to save cover image: ${error.message}`);
      return undefined;
    }
  }

  /**
   * CDN URL 생성
   */
  getCdnUrl(fileKey: string): string {
    return `${this.cdnBaseUrl}/${fileKey}`;
  }

  // ============================================
  // 가사 파싱 헬퍼 메서드
  // ============================================

  /**
   * LRC 포맷인지 확인
   * LRC 포맷 예: [00:12.34]가사 텍스트 또는 [00:12]가사 텍스트
   */
  private isLrcFormat(lyrics: string): boolean {
    // LRC 타임스탬프 패턴: [mm:ss.xx] 또는 [mm:ss]
    const lrcPattern = /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/;
    return lrcPattern.test(lyrics);
  }

  /**
   * LRC 포맷 가사를 파싱하여 동기화 가사 배열로 변환
   *
   * LRC 포맷 예시:
   * [00:12.34]첫 번째 가사
   * [00:15.67]두 번째 가사
   * [00:18.00][00:20.00]반복되는 가사 (다중 타임스탬프)
   *
   * @param lyrics LRC 포맷 가사 문자열
   * @returns 시간순 정렬된 동기화 가사 배열
   */
  private parseLrcLyrics(lyrics: string): SyncedLyricLine[] {
    const lines = lyrics.split("\n");
    const result: SyncedLyricLine[] = [];

    // LRC 타임스탬프 패턴: [mm:ss.xx] 또는 [mm:ss]
    const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const line of lines) {
      // 메타데이터 태그 스킵 ([ti:제목], [ar:아티스트], [al:앨범] 등)
      if (/^\[(ti|ar|al|au|length|by|offset|re|ve):/i.test(line)) {
        continue;
      }

      // 빈 줄 스킵
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 타임스탬프 추출
      const timestamps: number[] = [];
      let match: RegExpExecArray | null;
      let lastIndex = 0;

      while ((match = timePattern.exec(trimmedLine)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        // 밀리초가 없거나 1-2자리면 적절히 변환
        let milliseconds = 0;
        if (match[3]) {
          const msStr = match[3];
          if (msStr.length === 1) {
            milliseconds = parseInt(msStr, 10) * 100;
          } else if (msStr.length === 2) {
            milliseconds = parseInt(msStr, 10) * 10;
          } else {
            milliseconds = parseInt(msStr, 10);
          }
        }

        // 밀리초 단위로 변환
        const timeMs = (minutes * 60 + seconds) * 1000 + milliseconds;
        timestamps.push(timeMs);
        lastIndex = match.index + match[0].length;
      }

      // 타임스탬프가 없는 줄은 스킵
      if (timestamps.length === 0) continue;

      // 타임스탬프 이후의 텍스트 추출
      const text = trimmedLine.substring(lastIndex).trim();

      // 빈 텍스트는 간주 (간주 구간) - 빈 문자열로 저장
      // 각 타임스탬프에 대해 항목 생성 (다중 타임스탬프 지원)
      for (const time of timestamps) {
        result.push({ time, text });
      }

      // 다음 매칭을 위해 lastIndex 리셋
      timePattern.lastIndex = 0;
    }

    // 시간순 정렬
    result.sort((a, b) => a.time - b.time);

    return result;
  }
}
