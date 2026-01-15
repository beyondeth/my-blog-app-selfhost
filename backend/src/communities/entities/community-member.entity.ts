import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../users/entities/user.entity";
import { Community } from "./community.entity";
import { CommunityFlair } from "./community-flair.entity";
import { CommunityInvite } from "./community-invite.entity";
import { CommunityRole, MembershipStatus, ModeratorPermission } from "../enums";

/**
 * CommunityMember 엔티티
 *
 * @description 커뮤니티 멤버십 정보를 저장합니다.
 * User와 Community 간의 N:N 관계를 관리하며, 역할과 상태 정보를 포함합니다.
 *
 * **설계 원칙:**
 * - (communityId, userId) 유니크 제약: 중복 가입 방지
 * - 역할 기반 권한: owner > moderator > member
 * - 상태 기반 접근 제어: active, pending, banned
 */
@Entity("community_members")
@Unique(["communityId", "userId"])
@Index(["userId"])
@Index(["communityId", "role"])
@Index(["communityId", "status"])
export class CommunityMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 커뮤니티 ID
   */
  @Column({ type: "uuid" })
  communityId: string;

  /**
   * 사용자 ID
   */
  @Column({ type: "uuid" })
  userId: string;

  /**
   * 멤버 역할 (4단계 시스템)
   * - owner: 커뮤니티 생성자 (최고 권한)
   * - admin: 부방장 (설정 변경, 모더레이터 관리)
   * - moderator: 모더레이터 (콘텐츠 관리)
   * - member: 일반 멤버 (읽기/쓰기)
   */
  @Column({
    type: "enum",
    enum: CommunityRole,
    default: CommunityRole.MEMBER,
  })
  role: CommunityRole;

  /**
   * 멤버십 상태
   * - active: 활성 멤버
   * - pending: 승인 대기 (restricted 커뮤니티)
   * - banned: 차단됨
   */
  @Column({
    type: "enum",
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  /**
   * 사용자 플레어 ID
   * - 커뮤니티 내 사용자 배지/태그
   */
  @Column({ type: "uuid", nullable: true })
  userFlairId: string;

  /**
   * 알림 활성화 여부
   * - 커뮤니티 알림 수신 여부
   */
  @Column({ default: true })
  notificationsEnabled: boolean;

  /**
   * 운영진 권한 배열 (Reddit 스타일)
   * - 운영진만 값이 있음 (일반 멤버는 null)
   * - ['all']: 전체 관리 권한
   * - ['posts', 'members']: 개별 권한 조합
   */
  @Column("simple-array", { nullable: true })
  permissions: ModeratorPermission[] | null;

  /**
   * 운영진 순서 (Reddit 스타일 Top-Mod 시스템)
   * - 1: Top-Mod (최고 권한, 보통 Creator)
   * - 2~N: 순서대로 권한 계층
   * - null: 일반 멤버 (운영진 아님)
   *
   * 순서 규칙:
   * - 'all' 권한 보유자만 자신보다 아래 순서의 운영진 관리 가능
   * - Top-Mod 탈퇴 시 다음 순서가 자동 승계
   */
  @Column({ type: "int", nullable: true })
  @Index()
  moderatorOrder: number | null;

  /**
   * 운영진 승격 시간
   * - 운영진으로 처음 임명된 시간
   * - 순서 변경 시에도 유지됨
   */
  @Column({ type: "timestamp", nullable: true })
  promotedAt: Date | null;

  /**
   * 가입 시간
   */
  @CreateDateColumn()
  joinedAt: Date;

  /**
   * 마지막 활동 시간
   * - 방문, 글 작성, 댓글, 투표 등 활동 시 업데이트
   * - 30일 활성 멤버(MAU) 계산용
   */
  @Column({ type: "timestamp", nullable: true })
  @Index()
  lastActivityAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =====================================================
  // 승인/초대 관련 필드
  // =====================================================

  /**
   * 가입 신청서 (RESTRICTED 커뮤니티용)
   * - 가입 승인 요청 시 작성하는 메시지
   */
  @Column({ type: "text", nullable: true })
  applicationMessage: string | null;

  /**
   * 초대 ID (초대를 통한 가입인 경우)
   * - 어떤 초대 링크를 통해 가입했는지 추적
   */
  @Column({ type: "uuid", nullable: true })
  inviteId: string | null;

  /**
   * 가입 승인한 모더레이터 ID
   * - RESTRICTED 커뮤니티에서 승인한 사람 추적
   */
  @Column({ type: "uuid", nullable: true })
  approvedById: string | null;

  /**
   * 가입 승인 시간
   */
  @Column({ type: "timestamp", nullable: true })
  approvedAt: Date | null;

  // =====================================================
  // 관계 (Relations)
  // =====================================================

  @ManyToOne(() => Community, (community) => community.members, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "communityId" })
  community: Community;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => CommunityFlair, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "userFlairId" })
  userFlair: CommunityFlair;

  /**
   * 초대 링크 (초대를 통한 가입인 경우)
   */
  @ManyToOne(() => CommunityInvite, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "inviteId" })
  invite: CommunityInvite | null;

  /**
   * 가입 승인한 모더레이터
   */
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approvedById" })
  approvedBy: User | null;

  // =====================================================
  // 헬퍼 메서드
  // =====================================================

  /**
   * 활성 멤버 여부 확인
   */
  isActive(): boolean {
    return this.status === MembershipStatus.ACTIVE;
  }

  /**
   * 모더레이터 이상 권한 확인 (MODERATOR, ADMIN, OWNER)
   */
  isModerator(): boolean {
    return (
      this.role === CommunityRole.MODERATOR ||
      this.role === CommunityRole.ADMIN ||
      this.role === CommunityRole.OWNER
    );
  }

  /**
   * ADMIN 이상 권한 확인 (ADMIN, OWNER)
   */
  isAdmin(): boolean {
    return (
      this.role === CommunityRole.ADMIN || this.role === CommunityRole.OWNER
    );
  }

  /**
   * 오너 권한 확인
   */
  isOwner(): boolean {
    return this.role === CommunityRole.OWNER;
  }

  /**
   * 운영진 여부 확인 (새로운 권한 시스템)
   * - moderatorOrder가 있으면 운영진
   */
  isStaff(): boolean {
    return this.moderatorOrder !== null && this.moderatorOrder > 0;
  }

  /**
   * Top-Mod 여부 확인
   * - moderatorOrder가 1이면 Top-Mod
   */
  isTopMod(): boolean {
    return this.moderatorOrder === 1;
  }

  /**
   * 특정 권한 보유 여부 확인
   * @param permission 확인할 권한
   * @returns 해당 권한이 있으면 true
   */
  hasPermission(permission: ModeratorPermission): boolean {
    if (!this.permissions || this.permissions.length === 0) return false;
    if (this.permissions.includes(ModeratorPermission.ALL)) return true;
    return this.permissions.includes(permission);
  }

  /**
   * 다른 운영진 관리 가능 여부 확인
   * @param target 대상 멤버
   * @returns 관리 가능하면 true
   */
  canManage(target: CommunityMember): boolean {
    // ALL 권한이 없으면 관리 불가
    if (!this.hasPermission(ModeratorPermission.ALL)) return false;
    // 대상이 운영진이 아니면 관리 가능
    if (!target.isStaff()) return true;
    // 자신보다 아래 순서만 관리 가능
    return (
      this.moderatorOrder !== null &&
      target.moderatorOrder !== null &&
      this.moderatorOrder < target.moderatorOrder
    );
  }

  /**
   * 공개 JSON 변환
   */
  toPublicJSON() {
    return {
      id: this.id,
      communityId: this.communityId,
      userId: this.userId,
      role: this.role,
      status: this.status,
      permissions: this.permissions,
      moderatorOrder: this.moderatorOrder,
      promotedAt: this.promotedAt,
      joinedAt: this.joinedAt,
      user: this.user
        ? {
            id: this.user.id,
            username: this.user.username,
            profileImage: (this.user as any).profile?.profileImage || null,
          }
        : null,
      userFlair: this.userFlair
        ? {
            id: this.userFlair.id,
            name: this.userFlair.name,
            backgroundColor: this.userFlair.backgroundColor,
            textColor: this.userFlair.textColor,
          }
        : null,
    };
  }
}
