import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 동기화된 가사 라인 타입
 * time: 밀리초 단위 타임스탬프
 * text: 해당 시점의 가사 텍스트
 */
export interface SyncedLyricLine {
  time: number;
  text: string;
}

/**
 * Music 엔티티
 * 사이트 전체 BGM으로 사용되는 음악 파일 관리
 * 관리자만 업로드 가능
 */
@Entity('musics')
@Index(['isActive', 'order'])
@Index(['uploadedById'])
export class Music {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 파일 정보
  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'file_key' })
  fileKey: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'duration', type: 'float', nullable: true })
  duration: number; // 재생 시간 (초)

  // ID3 메타데이터 (자동 추출)
  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  artist: string;

  @Column({ nullable: true })
  album: string;

  @Column({ type: 'integer', nullable: true })
  year: number;

  @Column({ nullable: true })
  genre: string;

  @Column({ name: 'track_number', nullable: true })
  trackNumber: string;

  @Column({ name: 'cover_image_key', nullable: true })
  coverImageKey: string; // 앨범 커버 S3 키

  // 가사 데이터
  @Column({ type: 'text', nullable: true })
  lyrics: string; // 일반 텍스트 가사 (USLT)

  @Column({ name: 'synced_lyrics', type: 'jsonb', nullable: true })
  syncedLyrics: SyncedLyricLine[]; // 동기화된 가사 [{time: ms, text: string}]

  // 관리자 수정용 표시 필드
  @Column({ name: 'display_title', nullable: true })
  displayTitle: string;

  @Column({ name: 'display_artist', nullable: true })
  displayArtist: string;

  @Column({ name: 'display_genre', nullable: true })
  displayGenre: string;

  // 재생 관리
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'play_order', type: 'integer', default: 0 })
  order: number;

  // 업로드 정보
  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * 표시용 제목 반환
   * displayTitle이 있으면 사용, 없으면 ID3 title, 그것도 없으면 파일명
   */
  getDisplayTitle(): string {
    return this.displayTitle || this.title || this.originalName;
  }

  /**
   * 표시용 아티스트 반환
   */
  getDisplayArtist(): string {
    return this.displayArtist || this.artist || 'Unknown Artist';
  }

  /**
   * 표시용 장르 반환
   * 관리자가 지정한 displayGenre만 사용 (ID3 genre는 참조용으로만 저장)
   */
  getDisplayGenre(): string | null {
    return this.displayGenre || null;
  }
}
