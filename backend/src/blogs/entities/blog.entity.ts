import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, BeforeInsert } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

/**
 * Blog 엔티티
 *
 * **체크포인트 2: Alias 시스템**
 * - slug: 이메일 기반 자동 생성 (변경 불가, 기존 시스템)
 * - alias: 사용자 지정 주소 (변경 가능, @username 형식)
 *
 * **주소 시스템:**
 * - 회원가입 시: slug 자동 생성 (예: luticek)
 * - Settings: 사용자가 alias 변경 (예: @park)
 * - URL 우선순위: alias > slug (fallback)
 * - SEO 보호: old_aliases 테이블로 301 리다이렉트
 */
@Entity('blogs')
export class Blog {
  /**
   * 기본 키
   * - UUID v7 (시간 순서 정렬 지원)
   * - 블로그 생성 순서 보장
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * UUID v7 생성 (BeforeInsert 훅)
   * - 시간 기반 UUID 생성
   * - 블로그 순서 정렬 시 성능 향상
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * Slug (기존 이메일 기반 주소)
   * - 회원가입 시 이메일 앞부분에서 자동 생성
   * - 중복 시 랜덤 4자 추가 (예: luticek-abcd)
   * - 변경 불가 (기존 시스템 호환성)
   * - unique 제약조건
   *
   * **역할:**
   * - Fallback URL (alias 없을 때)
   * - 기존 API 호환성 유지
   */
  @Column({ unique: true, nullable: true })
  slug: string;

  /**
   * Alias (사용자 지정 주소) - 새로운 기능
   * - 사용자가 Settings에서 변경 가능
   * - @ 없이 저장 (예: 'park', '@park'로 표시)
   * - unique 제약조건
   * - nullable: 초기에는 null (slug만 사용)
   *
   * **규칙:**
   * - 3~30자
   * - 영문, 숫자, 하이픈, 언더스코어만 허용
   * - 예약어 금지 (admin, api, settings 등)
   *
   * **우선순위:**
   * - alias가 있으면 alias 사용
   * - alias가 없으면 slug 사용 (기존 동작)
   */
  @Column({ unique: true, nullable: true })
  alias: string;

  @Column({ nullable: true })
  name: string; // 블로그 이름

  @Column({ nullable: true })
  description: string; // 블로그 설명

  @Column({ nullable: true, name: 'thumbnailUrl' })
  thumbnailUrl: string; // 블로그 썸네일

  @Column({ default: true, name: 'isPublic' })
  isPublic: boolean; // 블로그 공개 여부

  @Column({ default: true, name: 'allowComments' })
  allowComments: boolean; // 댓글 허용 여부

  @Column({ type: 'uuid', nullable: true, unique: true, name: 'userId' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner: User;

  @OneToMany(() => Post, post => post.blog)
  posts: Post[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}