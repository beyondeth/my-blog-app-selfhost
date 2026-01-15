import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { Post } from "../../posts/entities/post.entity";

export type BlogImageFit = "cover" | "contain";

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
@Entity("blogs")
export class Blog {
  /**
   * 기본 키
   * - UUID v7 (시간 순서 정렬 지원)
   * - 블로그 생성 순서 보장
   */
  @PrimaryGeneratedColumn("uuid")
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

  @Column({ nullable: true, name: "thumbnailUrl" })
  thumbnailUrl: string; // 블로그 썸네일

  @Column({ default: true, name: "isPublic" })
  isPublic: boolean; // 블로그 공개 여부

  @Column({ default: true, name: "allowComments" })
  allowComments: boolean; // 댓글 허용 여부

  // =====================================
  // 브랜딩 필드 (개인 블로그 커스터마이징)
  // =====================================

  /**
   * 블로그 로고 URL
   * - 블로그 헤더에 표시
   * - 권장 사이즈: 200x60px
   */
  @Column({ nullable: true, name: "logoUrl", length: 500 })
  logoUrl: string;

  /**
   * 로고 표시 방식 (object-fit)
   * - cover: 가득 채우기
   * - contain: 원본 비율 유지
   */
  @Column({
    type: "varchar",
    length: 20,
    name: "logoImageFit",
    default: "contain",
  })
  logoImageFit: BlogImageFit;

  /**
   * 블로그 아이콘 URL
   * - 파비콘 및 목록 썸네일에 사용
   * - 권장 사이즈: 64x64px (정사각형)
   */
  @Column({ nullable: true, name: "iconUrl", length: 500 })
  iconUrl: string;

  /**
   * 아이콘 표시 방식 (object-fit)
   */
  @Column({
    type: "varchar",
    length: 20,
    name: "iconImageFit",
    default: "contain",
  })
  iconImageFit: BlogImageFit;

  /**
   * 아이콘 배치 방식
   * - inline: 제목 영역 옆에 표시
   * - badge: 커버 하단 배지 형태
   */
  @Column({
    type: "varchar",
    length: 20,
    name: "iconPlacement",
    default: "inline",
  })
  iconPlacement: "inline" | "badge";

  /**
   * 아이콘 텍스트 노출 여부
   * - true: 텍스트와 함께 표시
   * - false: 아이콘 이미지 단독 표시
   */
  @Column({
    type: "boolean",
    name: "iconTextEnabled",
    default: true,
  })
  iconTextEnabled: boolean;

  /**
   * 아이콘 영역의 배지/라벨 텍스트
   */
  @Column({ nullable: true, length: 120, name: "iconLabel" })
  iconLabel: string;

  @Column({
    type: "boolean",
    name: "iconLabelEnabled",
    default: true,
  })
  iconLabelEnabled: boolean;

  /**
   * 아이콘 영역의 서브 텍스트 (핸들, 설명 등)
   */
  @Column({ nullable: true, length: 160, name: "iconSubtitle" })
  iconSubtitle: string;

  @Column({
    type: "boolean",
    name: "iconSubtitleEnabled",
    default: true,
  })
  iconSubtitleEnabled: boolean;

  /**
   * 커버 이미지 URL
   * - 블로그 홈페이지 헤더 배경
   * - 권장 사이즈: 1200x400px
   */
  @Column({ nullable: true, name: "coverImageUrl", length: 500 })
  coverImageUrl: string;

  /**
   * 커버 이미지 표시 방식 (object-fit)
   */
  @Column({
    type: "varchar",
    length: 20,
    name: "coverImageFit",
    default: "cover",
  })
  coverImageFit: BlogImageFit;

  /**
   * 브랜드 색상 (HEX 코드)
   * - 블로그 테마 색상
   * - 형식: #RRGGBB (예: #FF5722)
   */
  @Column({ nullable: true, name: "brandColor", length: 7 })
  brandColor: string;

  @Column({ type: "uuid", nullable: true, unique: true, name: "userId" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  owner: User;

  @OneToMany(() => Post, (post) => post.blog)
  posts: Post[];

  @CreateDateColumn({ name: "createdAt" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt" })
  updatedAt: Date;
}
