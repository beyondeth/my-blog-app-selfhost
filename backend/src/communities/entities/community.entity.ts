import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { JoinPolicy } from "../enums";
import { CommunityMember } from "./community-member.entity";
import { CommunityPost } from "./community-post.entity";
import { CommunityRule } from "./community-rule.entity";
import { CommunityFlair } from "./community-flair.entity";
import { CommunitySidebarWidget } from "./community-sidebar-widget.entity";

/**
 * Community 엔티티
 *
 * @description Reddit 스타일 커뮤니티(subreddit)의 기본 정보를 저장합니다.
 *
 * **설계 원칙:**
 * - UUID v7 사용: 시간 순서 정렬 지원
 * - slug 고유성: URL 식별자로 사용 (예: /community/programming)
 * - 멤버 수 비정규화: 성능 최적화 (별도 카운트 쿼리 불필요)
 * - 소프트 삭제: deletedAt으로 복구 가능
 *
 * **가입 정책:**
 * - open: 누구나 즉시 가입
 * - restricted: 승인 필요
 * - private: 초대 전용
 */
@Entity("communities")
@Index(["slug"], { unique: true })
@Index(["creatorId"])
@Index(["isPublic"])
@Index(["memberCount"])
export class Community {
  /**
   * UUID v7 기본 키
   * - 시간 순서 정렬 지원으로 최신 커뮤니티 조회 성능 향상
   */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * UUID v7 생성 (BeforeInsert 훅)
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * URL 슬러그 (고유)
   * - 3-50자, 영문 소문자/숫자/하이픈만 허용
   * - URL: /community/{slug}
   */
  @Column({ unique: true, length: 50 })
  slug: string;

  /**
   * 커뮤니티 표시 이름
   * - 최대 100자
   */
  @Column({ length: 100 })
  name: string;

  /**
   * 커뮤니티 설명
   * - 마크다운 지원 가능
   */
  @Column("text", { nullable: true })
  description: string;

  /**
   * 아이콘 이미지 URL
   * - S3 업로드 URL
   */
  @Column({ nullable: true, length: 500 })
  iconUrl: string;

  @Column({
    name: "iconImageFit",
    type: "varchar",
    length: 20,
    default: "contain",
  })
  iconImageFit: "cover" | "contain";

  /**
   * 배너 이미지 URL
   * - S3 업로드 URL
   */
  @Column({ nullable: true, length: 500 })
  bannerUrl: string;

  @Column({
    name: "bannerImageFit",
    type: "varchar",
    length: 20,
    default: "cover",
  })
  bannerImageFit: "cover" | "contain";

  /**
   * 생성자 ID
   * - 삭제 시 SET NULL (커뮤니티 유지)
   */
  @Column({ type: "uuid", nullable: true })
  creatorId: string;

  /**
   * 공개 여부
   * - true: 검색/탐색에 노출
   * - false: URL 직접 접근만 가능
   */
  @Column({ default: true })
  isPublic: boolean;

  /**
   * 커뮤니티 게시물 노출 여부 (홈피드/검색/트렌딩)
   * - true: 커뮤니티 게시물이 글로벌 피드/검색에 노출
   * - false: 커뮤니티 내부에서만 조회 가능
   */
  @Column({ default: true })
  isPostDiscoverable: boolean;

  /**
   * 가입 정책
   * - open: 누구나 가입
   * - restricted: 승인 필요
   * - private: 초대 전용
   */
  @Column({
    type: "enum",
    enum: JoinPolicy,
    default: JoinPolicy.OPEN,
  })
  joinPolicy: JoinPolicy;

  /**
   * NSFW(성인 콘텐츠) 여부
   */
  @Column({ default: false })
  isNsfw: boolean;

  /**
   * 멤버 수 (비정규화)
   * - 성능 최적화: 별도 COUNT 쿼리 불필요
   * - 가입/탈퇴 시 동기화
   */
  @Column({ default: 0 })
  memberCount: number;

  /**
   * 게시물 수 (비정규화)
   * - 성능 최적화: 별도 COUNT 쿼리 불필요
   */
  @Column({ default: 0 })
  postCount: number;

  /**
   * 커뮤니티 잠금 여부 (폭주 대응용)
   */
  @Column({ name: "is_locked", type: "boolean", default: false })
  isLocked: boolean;

  /**
   * 잠금 시각
   */
  @Column({ name: "locked_at", type: "timestamp", nullable: true })
  lockedAt?: Date | null;

  /**
   * 커뮤니티를 잠근 관리자/오너 ID
   */
  @Column({ name: "locked_by_id", type: "uuid", nullable: true })
  lockedById?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 소프트 삭제 시간
   * - null이 아니면 삭제된 상태
   */
  @DeleteDateColumn()
  deletedAt: Date;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  /**
   * 생성자 (User)
   * - onDelete: SET NULL (생성자 탈퇴해도 커뮤니티 유지)
   */
  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "creatorId" })
  creator: User;

  /**
   * 멤버 목록
   */
  @OneToMany(() => CommunityMember, (member) => member.community)
  members: CommunityMember[];

  /**
   * 게시물 목록
   */
  @OneToMany(() => CommunityPost, (post) => post.community)
  posts: CommunityPost[];

  /**
   * 사이드바 위젯 목록
   */
  @OneToMany(() => CommunitySidebarWidget, (widget) => widget.community, {
    cascade: false,
  })
  sidebarWidgets: CommunitySidebarWidget[];

  /**
   * 규칙 목록
   */
  @OneToMany(() => CommunityRule, (rule) => rule.community)
  rules: CommunityRule[];

  /**
   * 플레어 목록
   */
  @OneToMany(() => CommunityFlair, (flair) => flair.community)
  flairs: CommunityFlair[];

  /**
   * 커뮤니티 잠금을 수행한 관리자
   */
  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "locked_by_id" })
  lockedBy?: User | null;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 공개 JSON 변환 (API 응답용)
   */
  toPublicJSON() {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      description: this.description,
      iconUrl: this.iconUrl,
      bannerUrl: this.bannerUrl,
      isPublic: this.isPublic,
      isPostDiscoverable: this.isPostDiscoverable,
      joinPolicy: this.joinPolicy,
      isNsfw: this.isNsfw,
      memberCount: this.memberCount,
      postCount: this.postCount,
      isLocked: this.isLocked,
      lockedAt: this.lockedAt,
      createdAt: this.createdAt,
      creator: this.creator
        ? {
            id: this.creator.id,
            username: this.creator.username,
          }
        : null,
      lockedBy: this.lockedBy
        ? {
            id: this.lockedBy.id,
            username: this.lockedBy.username,
          }
        : null,
    };
  }
}
