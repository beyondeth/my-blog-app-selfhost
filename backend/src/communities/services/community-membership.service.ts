import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityBan } from "../entities/community-ban.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CommunityInvite } from "../entities/community-invite.entity";
import {
  CommunityRole,
  MembershipStatus,
  ModAction,
  JoinPolicy,
  ModeratorPermission,
  isModeratorOrAbove,
  isAdminOrAbove,
  FULL_MODERATOR_PERMISSIONS,
  DEFAULT_MODERATOR_PERMISSIONS,
} from "../enums";
import {
  BanMemberDto,
  UpdateMemberRoleDto,
  JoinApplicationDto,
  HandleApplicationDto,
  CreateInviteDto,
} from "../dto";
import { CacheService, CacheTTL } from "../../cache/cache.service";
import {
  PaginationDto,
  PaginationHelper,
} from "../../common/dto/pagination.dto";
import { COMMUNITY_LIMITS } from "../constants";

/**
 * 멤버십 캐시 키 상수
 */
const MembershipCacheKeys = {
  MEMBERSHIP: (communityId: string, userId: string) =>
    `membership:${communityId}:${userId}`,
  MEMBER_LIST: (communityId: string, page: number) =>
    `community:${communityId}:members:page:${page}`,
  BAN_LIST: (communityId: string, page: number) =>
    `community:${communityId}:bans:page:${page}`,
  MOD_LIST: (communityId: string) => `community:${communityId}:mods`,
};

/**
 * 커뮤니티 멤버십 서비스
 *
 * @description 멤버 가입/탈퇴, 역할 관리, 차단 관리 담당
 *
 * **설계 원칙:**
 * - 분산 락으로 동시성 제어 (memberCount 업데이트)
 * - 차단 상태 우선 확인
 * - 모든 모더레이션 액션 로깅
 */
@Injectable()
export class CommunityMembershipService {
  private readonly logger = new Logger(CommunityMembershipService.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityBan)
    private readonly banRepository: Repository<CommunityBan>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    @InjectRepository(CommunityInvite)
    private readonly inviteRepository: Repository<CommunityInvite>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  // =========================================================================
  // 가입/탈퇴
  // =========================================================================

  /**
   * 커뮤니티 가입
   */
  async join(communityId: string, userId: string): Promise<CommunityMember> {
    // 1. 커뮤니티 확인
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "joinPolicy", "slug"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // 2. 차단 여부 확인
    const ban = await this.banRepository.findOne({
      where: { communityId, userId, isActive: true },
      select: ["id", "expiresAt"],
    });

    if (ban && (!ban.expiresAt || new Date() < ban.expiresAt)) {
      throw new ForbiddenException(
        "이 커뮤니티에서 차단되어 가입할 수 없습니다",
      );
    }

    // 3. 사용자 가입 커뮤니티 수 제한 확인
    const userCommunityCount = await this.memberRepository.count({
      where: { userId, status: MembershipStatus.ACTIVE },
    });

    if (userCommunityCount >= COMMUNITY_LIMITS.MAX_COMMUNITIES_PER_USER) {
      throw new ForbiddenException(
        `최대 ${COMMUNITY_LIMITS.MAX_COMMUNITIES_PER_USER}개의 커뮤니티에만 가입할 수 있습니다`,
      );
    }

    // 4. 기존 멤버십 확인
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId },
      select: ["id", "status"],
    });

    if (existing) {
      if (existing.status === MembershipStatus.ACTIVE) {
        throw new ConflictException("이미 가입된 커뮤니티입니다");
      }
      if (existing.status === MembershipStatus.PENDING) {
        throw new ConflictException("가입 승인 대기 중입니다");
      }
    }

    // 5. 가입 정책에 따른 처리
    const status =
      community.joinPolicy === JoinPolicy.OPEN
        ? MembershipStatus.ACTIVE
        : MembershipStatus.PENDING;

    // 6. 트랜잭션으로 멤버 추가 + 카운트 업데이트
    return await this.dataSource.transaction(async (manager) => {
      let member: CommunityMember;

      if (existing) {
        // 기존 멤버십 재활성화
        existing.status = status;
        existing.role = CommunityRole.MEMBER;
        member = await manager.save(CommunityMember, existing);
      } else {
        // 새 멤버십 생성
        member = manager.create(CommunityMember, {
          communityId,
          userId,
          role: CommunityRole.MEMBER,
          status,
        });
        member = await manager.save(CommunityMember, member);
      }

      // 활성 상태인 경우에만 카운트 증가
      if (status === MembershipStatus.ACTIVE) {
        await manager.increment(
          Community,
          { id: communityId },
          "memberCount",
          1,
        );
      }

      // 캐시 무효화
      await this.invalidateMembershipCache(communityId, userId);

      this.logger.log(
        `멤버 가입: community=${communityId}, user=${userId}, status=${status}`,
      );

      return member;
    });
  }

  /**
   * 커뮤니티 탈퇴 (Reddit 스타일 Top-Mod 승계 로직 포함)
   *
   * **승계 규칙:**
   * - Top-Mod(moderatorOrder=1)가 탈퇴 시 다음 순서 운영진에게 자동 승계
   * - 승계 시 ALL 권한 자동 부여
   * - 운영진 순서 재정렬
   */
  async leave(communityId: string, userId: string): Promise<void> {
    // 멤버십 확인 (권한 정보 포함)
    const membership = await this.memberRepository.findOne({
      where: { communityId, userId },
      select: ["id", "role", "status", "moderatorOrder", "permissions"],
    });

    if (!membership) {
      throw new NotFoundException("가입되지 않은 커뮤니티입니다");
    }

    // OWNER는 탈퇴 불가 (소유권 이전 필요)
    if (membership.role === CommunityRole.OWNER) {
      throw new ForbiddenException(
        "커뮤니티 소유자는 탈퇴할 수 없습니다. 먼저 소유권을 이전해주세요.",
      );
    }

    // Top-Mod(moderatorOrder=1)인 경우 승계 처리
    const isTopMod = membership.moderatorOrder === 1;

    // 트랜잭션으로 멤버 삭제 + 카운트 감소 + 승계 처리
    await this.dataSource.transaction(async (manager) => {
      // Top-Mod 승계 처리
      if (isTopMod) {
        await this.handleTopModSuccession(communityId, manager);
      } else if (membership.moderatorOrder !== null) {
        // 일반 운영진 탈퇴 시 순서 재정렬
        await this.reorderModeratorsAfterLeave(
          communityId,
          membership.moderatorOrder,
          manager,
        );
      }

      await manager.remove(CommunityMember, membership);

      // 활성 상태였던 경우에만 카운트 감소
      if (membership.status === MembershipStatus.ACTIVE) {
        await manager
          .createQueryBuilder()
          .update(Community)
          .set({ memberCount: () => 'GREATEST(0, "memberCount" - 1)' })
          .where("id = :id", { id: communityId })
          .execute();
      }
    });

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, userId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    this.logger.log(
      `멤버 탈퇴: community=${communityId}, user=${userId}, isTopMod=${isTopMod}`,
    );
  }

  /**
   * Top-Mod 승계 처리 (내부 메서드)
   *
   * @description Top-Mod 탈퇴 시 다음 순서 운영진에게 자동으로 권한 승계
   */
  private async handleTopModSuccession(
    communityId: string,
    manager: any,
  ): Promise<void> {
    // 다음 순서 운영진 찾기 (moderatorOrder = 2)
    const nextMod = await manager.findOne(CommunityMember, {
      where: {
        communityId,
        moderatorOrder: 2,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (nextMod) {
      // 다음 운영진에게 ALL 권한 부여 + Top-Mod 승격
      nextMod.permissions = FULL_MODERATOR_PERMISSIONS;
      nextMod.moderatorOrder = 1;
      nextMod.role = CommunityRole.OWNER; // 기존 역할 시스템과 호환
      await manager.save(CommunityMember, nextMod);

      // 커뮤니티 creatorId 업데이트
      await manager.update(
        Community,
        { id: communityId },
        { creatorId: nextMod.userId },
      );

      this.logger.log(
        `Top-Mod 승계: community=${communityId}, newTopMod=${nextMod.userId}`,
      );

      // 나머지 운영진 순서 1씩 감소
      await manager
        .createQueryBuilder()
        .update(CommunityMember)
        .set({ moderatorOrder: () => '"moderatorOrder" - 1' })
        .where("communityId = :communityId", { communityId })
        .andWhere("moderatorOrder > 2")
        .execute();
    } else {
      this.logger.warn(
        `Top-Mod 승계 실패: community=${communityId}, 다음 운영진 없음`,
      );
    }
  }

  /**
   * 운영진 탈퇴 후 순서 재정렬 (내부 메서드)
   */
  private async reorderModeratorsAfterLeave(
    communityId: string,
    leavingOrder: number,
    manager: any,
  ): Promise<void> {
    // 탈퇴하는 운영진보다 아래 순서의 운영진 순서를 1씩 감소
    await manager
      .createQueryBuilder()
      .update(CommunityMember)
      .set({ moderatorOrder: () => '"moderatorOrder" - 1' })
      .where("communityId = :communityId", { communityId })
      .andWhere("moderatorOrder > :leavingOrder", { leavingOrder })
      .execute();
  }

  // =========================================================================
  // 멤버 조회
  // =========================================================================

  /**
   * 멤버 목록 조회
   */
  async getMembers(
    communityId: string,
    query: PaginationDto,
    role?: CommunityRole,
  ): Promise<{
    items: CommunityMember[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = PaginationHelper.getSafePage(query.page);
    const limit = PaginationHelper.getSafeLimit(query.limit);
    const offset = PaginationHelper.getOffset(page, limit);

    const where: any = { communityId, status: MembershipStatus.ACTIVE };
    if (role) {
      where.role = role;
    }

    const [items, total] = await this.memberRepository.findAndCount({
      where,
      relations: ["user", "user.profile"], // profile도 함께 로드하여 profileImage 접근 가능
      order: { joinedAt: "DESC" },
      skip: offset,
      take: limit,
    });

    const totalPages = PaginationHelper.getTotalPages(total, limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      // 프론트엔드 PaginatedCommunityResponse 타입과 일치하도록 추가
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 모더레이터 목록 조회 (OWNER, ADMIN, MODERATOR 포함)
   */
  async getModerators(communityId: string): Promise<CommunityMember[]> {
    const cacheKey = MembershipCacheKeys.MOD_LIST(communityId);
    const cached = await this.cacheService.get<CommunityMember[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const roles = [
      CommunityRole.OWNER,
      CommunityRole.ADMIN,
      CommunityRole.MODERATOR,
    ];

    const mods = await this.memberRepository
      .createQueryBuilder("member")
      .leftJoinAndSelect("member.user", "user")
      .leftJoinAndSelect("user.profile", "profile")
      .leftJoinAndSelect("user.blog", "blog")
      .where("member.communityId = :communityId", { communityId })
      .andWhere("member.status = :status", { status: MembershipStatus.ACTIVE })
      .andWhere("member.role IN (:...roles)", { roles })
      .orderBy("member.role", "ASC")
      .addOrderBy("member.joinedAt", "ASC")
      .getMany();

    await this.cacheService.set(cacheKey, mods, CacheTTL.MEDIUM);

    return mods;
  }

  /**
   * 사용자 멤버십 조회
   */
  async getMembership(
    communityId: string,
    userId: string,
  ): Promise<CommunityMember | null> {
    const cacheKey = MembershipCacheKeys.MEMBERSHIP(communityId, userId);
    const cached = await this.cacheService.get<CommunityMember>(cacheKey);

    if (cached) {
      return cached;
    }

    const membership = await this.memberRepository.findOne({
      where: { communityId, userId },
    });

    if (membership) {
      await this.cacheService.set(cacheKey, membership, CacheTTL.SHORT);
    }

    return membership;
  }

  // =========================================================================
  // 역할 관리
  // =========================================================================

  /**
   * 멤버 역할 변경
   */
  async updateRole(
    communityId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    moderatorId: string,
  ): Promise<CommunityMember> {
    // 대상 멤버십 확인
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException("해당 멤버를 찾을 수 없습니다");
    }

    // 자기 자신 역할 변경 불가
    if (targetUserId === moderatorId) {
      throw new ForbiddenException("자신의 역할은 변경할 수 없습니다");
    }

    // DTO에서 OWNER 역할은 제외되어 있으므로 추가 검증 불필요
    // (별도 소유권 이전 API: transferOwnership 사용)

    const oldRole = targetMember.role;
    targetMember.role = dto.role;

    const updated = await this.memberRepository.save(targetMember);

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, targetUserId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    // 모드 로그 - 역할 승격/강등에 따른 액션 결정
    let action: ModAction;
    if (
      dto.role === CommunityRole.ADMIN ||
      dto.role === CommunityRole.MODERATOR
    ) {
      action = ModAction.ADD_MODERATOR;
    } else {
      action = ModAction.REMOVE_MODERATOR;
    }

    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action,
      targetUserId,
      metadata: { oldRole, newRole: dto.role },
    });

    this.logger.log(
      `역할 변경: community=${communityId}, user=${targetUserId}, ${oldRole} -> ${dto.role}`,
    );

    return updated;
  }

  /**
   * 소유권 이전 (Reddit 스타일 Top-Mod 시스템과 통합)
   *
   * **동작:**
   * - 새 소유자에게 Top-Mod(moderatorOrder=1) + ALL 권한 부여
   * - 기존 소유자는 다음 순서로 밀림 (moderatorOrder=2)
   */
  async transferOwnership(
    communityId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ): Promise<void> {
    // 새 소유자 멤버십 확인
    const newOwnerMember = await this.memberRepository.findOne({
      where: {
        communityId,
        userId: newOwnerId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!newOwnerMember) {
      throw new NotFoundException(
        "새 소유자는 커뮤니티의 활성 멤버여야 합니다",
      );
    }

    // 자기 자신에게 이전 불가
    if (newOwnerId === currentOwnerId) {
      throw new BadRequestException("자신에게 소유권을 이전할 수 없습니다");
    }

    // 현재 소유자 멤버십 확인
    const currentOwnerMember = await this.memberRepository.findOne({
      where: { communityId, userId: currentOwnerId },
    });

    // 트랜잭션으로 소유권 교환
    await this.dataSource.transaction(async (manager) => {
      // 기존 Top-Mod의 순서 저장
      const oldTopModOrder = currentOwnerMember?.moderatorOrder || 1;
      const newOwnerOldOrder = newOwnerMember.moderatorOrder;

      // 새 소유자가 이미 운영진인 경우: 순서 교환
      if (newOwnerOldOrder !== null && newOwnerOldOrder > 1) {
        // 새 소유자 -> Top-Mod
        await manager.update(
          CommunityMember,
          { communityId, userId: newOwnerId },
          {
            role: CommunityRole.OWNER,
            permissions: FULL_MODERATOR_PERMISSIONS,
            moderatorOrder: 1,
          },
        );

        // 현재 소유자 -> 새 소유자의 이전 순서로
        await manager.update(
          CommunityMember,
          { communityId, userId: currentOwnerId },
          {
            role: CommunityRole.ADMIN,
            permissions: FULL_MODERATOR_PERMISSIONS,
            moderatorOrder: newOwnerOldOrder,
          },
        );
      } else {
        // 새 소유자가 일반 멤버인 경우: 모든 운영진 순서 1씩 밀기
        await manager
          .createQueryBuilder()
          .update(CommunityMember)
          .set({ moderatorOrder: () => '"moderatorOrder" + 1' })
          .where("communityId = :communityId", { communityId })
          .andWhere("moderatorOrder IS NOT NULL")
          .execute();

        // 새 소유자 -> Top-Mod
        await manager.update(
          CommunityMember,
          { communityId, userId: newOwnerId },
          {
            role: CommunityRole.OWNER,
            permissions: FULL_MODERATOR_PERMISSIONS,
            moderatorOrder: 1,
            promotedAt: new Date(),
          },
        );

        // 현재 소유자 role 변경 (순서는 이미 밀림)
        await manager.update(
          CommunityMember,
          { communityId, userId: currentOwnerId },
          { role: CommunityRole.ADMIN },
        );
      }

      // 커뮤니티 creatorId 업데이트
      await manager.update(
        Community,
        { id: communityId },
        { creatorId: newOwnerId },
      );
    });

    // 캐시 무효화
    await Promise.all([
      this.invalidateMembershipCache(communityId, currentOwnerId),
      this.invalidateMembershipCache(communityId, newOwnerId),
      this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId)),
      this.cacheService.deletePattern(`community:*:${communityId}*`),
    ]);

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId: currentOwnerId,
      action: ModAction.TRANSFER_OWNERSHIP,
      targetUserId: newOwnerId,
    });

    this.logger.log(
      `소유권 이전: community=${communityId}, ${currentOwnerId} -> ${newOwnerId}`,
    );
  }

  // =========================================================================
  // 운영진 관리 (Reddit 스타일)
  // =========================================================================

  /**
   * 운영진 추가 (Reddit 스타일)
   *
   * @param communityId 커뮤니티 ID
   * @param targetUserId 승격할 사용자 ID
   * @param permissions 부여할 권한 목록
   * @param actorId 액션 수행자 ID
   */
  async addModerator(
    communityId: string,
    targetUserId: string,
    permissions: ModeratorPermission[],
    actorId: string,
  ): Promise<CommunityMember> {
    // 자기 자신 승격 불가
    if (targetUserId === actorId) {
      throw new ForbiddenException("자신을 운영진으로 승격할 수 없습니다");
    }

    // 대상 멤버십 확인
    const targetMember = await this.memberRepository.findOne({
      where: {
        communityId,
        userId: targetUserId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!targetMember) {
      throw new NotFoundException("해당 멤버를 찾을 수 없습니다");
    }

    // 이미 운영진인 경우
    if (targetMember.moderatorOrder !== null) {
      throw new ConflictException("이미 운영진인 멤버입니다");
    }

    // 액션 수행자 권한 확인
    const actor = await this.memberRepository.findOne({
      where: { communityId, userId: actorId },
    });

    if (!actor || !actor.permissions?.includes(ModeratorPermission.ALL)) {
      throw new ForbiddenException("운영진 추가 권한이 없습니다");
    }

    // 다음 순서 계산
    const maxOrder = await this.memberRepository
      .createQueryBuilder("member")
      .select("MAX(member.moderatorOrder)", "maxOrder")
      .where("member.communityId = :communityId", { communityId })
      .getRawOne();

    const newOrder = (maxOrder?.maxOrder || 0) + 1;

    // 운영진 승격
    targetMember.role = CommunityRole.MODERATOR;
    targetMember.permissions =
      permissions.length > 0 ? permissions : DEFAULT_MODERATOR_PERMISSIONS;
    targetMember.moderatorOrder = newOrder;
    targetMember.promotedAt = new Date();

    const updated = await this.memberRepository.save(targetMember);

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, targetUserId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId: actorId,
      action: ModAction.ADD_MODERATOR,
      targetUserId,
      metadata: { permissions, order: newOrder },
    });

    this.logger.log(
      `운영진 추가: community=${communityId}, user=${targetUserId}, order=${newOrder}`,
    );

    return updated;
  }

  /**
   * 운영진 제거 (Reddit 스타일)
   *
   * @param communityId 커뮤니티 ID
   * @param targetUserId 강등할 사용자 ID
   * @param actorId 액션 수행자 ID
   */
  async removeModerator(
    communityId: string,
    targetUserId: string,
    actorId: string,
  ): Promise<void> {
    // 자기 자신 강등 불가
    if (targetUserId === actorId) {
      throw new ForbiddenException("자신을 운영진에서 제거할 수 없습니다");
    }

    // 대상 멤버십 확인
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException("해당 멤버를 찾을 수 없습니다");
    }

    if (targetMember.moderatorOrder === null) {
      throw new BadRequestException("운영진이 아닌 멤버입니다");
    }

    // Top-Mod는 제거 불가 (소유권 이전 필요)
    if (targetMember.moderatorOrder === 1) {
      throw new ForbiddenException(
        "Top-Mod는 제거할 수 없습니다. 소유권 이전을 사용해주세요.",
      );
    }

    // 액션 수행자 권한 확인 (순서 기반)
    const actor = await this.memberRepository.findOne({
      where: { communityId, userId: actorId },
    });

    if (!actor || !actor.permissions?.includes(ModeratorPermission.ALL)) {
      throw new ForbiddenException("운영진 제거 권한이 없습니다");
    }

    // 자신보다 아래 순서만 제거 가능
    if (
      actor.moderatorOrder === null ||
      actor.moderatorOrder >= targetMember.moderatorOrder
    ) {
      throw new ForbiddenException(
        "자신보다 상위 또는 동등한 운영진은 제거할 수 없습니다",
      );
    }

    const removedOrder = targetMember.moderatorOrder;

    // 트랜잭션으로 강등 + 순서 재정렬
    await this.dataSource.transaction(async (manager) => {
      // 대상 운영진 강등
      targetMember.role = CommunityRole.MEMBER;
      targetMember.permissions = null;
      targetMember.moderatorOrder = null;
      targetMember.promotedAt = null;
      await manager.save(CommunityMember, targetMember);

      // 순서 재정렬
      await this.reorderModeratorsAfterLeave(
        communityId,
        removedOrder,
        manager,
      );
    });

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, targetUserId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId: actorId,
      action: ModAction.REMOVE_MODERATOR,
      targetUserId,
    });

    this.logger.log(
      `운영진 제거: community=${communityId}, user=${targetUserId}`,
    );
  }

  /**
   * 사이트 Admin을 위한 강제 운영진 제거
   */
  async forceRemoveModerator(
    communityId: string,
    targetUserId: string,
    operatorId: string,
    reason?: string,
  ): Promise<void> {
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (!targetMember || targetMember.moderatorOrder === null) {
      return;
    }

    const removedOrder = targetMember.moderatorOrder;

    await this.dataSource.transaction(async (manager) => {
      targetMember.role = CommunityRole.MEMBER;
      targetMember.permissions = null;
      targetMember.moderatorOrder = null;
      targetMember.promotedAt = null;
      await manager.save(CommunityMember, targetMember);

      await this.reorderModeratorsAfterLeave(
        communityId,
        removedOrder,
        manager,
      );
    });

    await this.invalidateMembershipCache(communityId, targetUserId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    await this.modLogRepository.save({
      communityId,
      moderatorId: operatorId,
      action: ModAction.REMOVE_MODERATOR,
      targetUserId,
      reason,
    });

    this.logger.warn(
      `운영진 강제 제거(Admin): community=${communityId}, user=${targetUserId}`,
    );
  }

  /**
   * 운영진 권한 수정
   *
   * @param communityId 커뮤니티 ID
   * @param targetUserId 대상 사용자 ID
   * @param permissions 새로운 권한 목록
   * @param actorId 액션 수행자 ID
   */
  async updateModeratorPermissions(
    communityId: string,
    targetUserId: string,
    permissions: ModeratorPermission[],
    actorId: string,
  ): Promise<CommunityMember> {
    // 대상 멤버십 확인
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException("해당 멤버를 찾을 수 없습니다");
    }

    if (targetMember.moderatorOrder === null) {
      throw new BadRequestException("운영진이 아닌 멤버입니다");
    }

    // 액션 수행자 권한 확인
    const actor = await this.memberRepository.findOne({
      where: { communityId, userId: actorId },
    });

    if (!actor || !actor.permissions?.includes(ModeratorPermission.ALL)) {
      throw new ForbiddenException("운영진 권한 수정 권한이 없습니다");
    }

    // 자신보다 아래 순서만 수정 가능 (자기 자신은 제외)
    if (targetUserId !== actorId) {
      if (
        actor.moderatorOrder === null ||
        actor.moderatorOrder >= targetMember.moderatorOrder
      ) {
        throw new ForbiddenException(
          "자신보다 상위 또는 동등한 운영진의 권한은 수정할 수 없습니다",
        );
      }
    }

    const oldPermissions = targetMember.permissions;
    targetMember.permissions = permissions;

    const updated = await this.memberRepository.save(targetMember);

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, targetUserId);
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId: actorId,
      action: ModAction.UPDATE_MODERATOR,
      targetUserId,
      metadata: { oldPermissions, newPermissions: permissions },
    });

    this.logger.log(
      `운영진 권한 수정: community=${communityId}, user=${targetUserId}`,
    );

    return updated;
  }

  /**
   * 운영진 순서 변경 (드래그앤드롭 등)
   *
   * @param communityId 커뮤니티 ID
   * @param targetUserId 대상 운영진 ID
   * @param newOrder 새로운 순서
   * @param actorId 액션 수행자 ID
   */
  async changeModeratorOrder(
    communityId: string,
    targetUserId: string,
    newOrder: number,
    actorId: string,
  ): Promise<void> {
    // Top-Mod 순서(1)는 변경 불가
    if (newOrder < 1) {
      throw new BadRequestException("순서는 1 이상이어야 합니다");
    }

    // 대상 멤버십 확인
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (!targetMember || targetMember.moderatorOrder === null) {
      throw new NotFoundException("해당 운영진을 찾을 수 없습니다");
    }

    // Top-Mod 순서 변경 불가
    if (targetMember.moderatorOrder === 1) {
      throw new ForbiddenException("Top-Mod의 순서는 변경할 수 없습니다");
    }

    // 액션 수행자 권한 확인
    const actor = await this.memberRepository.findOne({
      where: { communityId, userId: actorId },
    });

    if (!actor || !actor.permissions?.includes(ModeratorPermission.ALL)) {
      throw new ForbiddenException("운영진 순서 변경 권한이 없습니다");
    }

    // 자신보다 아래 순서만 이동 가능
    if (
      actor.moderatorOrder === null ||
      actor.moderatorOrder >= targetMember.moderatorOrder
    ) {
      throw new ForbiddenException(
        "자신보다 상위 또는 동등한 운영진의 순서는 변경할 수 없습니다",
      );
    }

    // 1은 Top-Mod 전용
    if (newOrder === 1) {
      throw new ForbiddenException(
        "순서 1은 Top-Mod 전용입니다. 소유권 이전을 사용해주세요.",
      );
    }

    const oldOrder = targetMember.moderatorOrder;

    if (oldOrder === newOrder) {
      return; // 변경 없음
    }

    // 트랜잭션으로 순서 변경
    await this.dataSource.transaction(async (manager) => {
      if (oldOrder < newOrder) {
        // 아래로 이동: 사이의 운영진들 순서 1씩 감소
        await manager
          .createQueryBuilder()
          .update(CommunityMember)
          .set({ moderatorOrder: () => '"moderatorOrder" - 1' })
          .where("communityId = :communityId", { communityId })
          .andWhere("moderatorOrder > :oldOrder", { oldOrder })
          .andWhere("moderatorOrder <= :newOrder", { newOrder })
          .execute();
      } else {
        // 위로 이동: 사이의 운영진들 순서 1씩 증가
        await manager
          .createQueryBuilder()
          .update(CommunityMember)
          .set({ moderatorOrder: () => '"moderatorOrder" + 1' })
          .where("communityId = :communityId", { communityId })
          .andWhere("moderatorOrder >= :newOrder", { newOrder })
          .andWhere("moderatorOrder < :oldOrder", { oldOrder })
          .execute();
      }

      // 대상 운영진 순서 설정
      targetMember.moderatorOrder = newOrder;
      await manager.save(CommunityMember, targetMember);
    });

    // 캐시 무효화
    await this.cacheService.del(MembershipCacheKeys.MOD_LIST(communityId));

    this.logger.log(
      `운영진 순서 변경: community=${communityId}, user=${targetUserId}, ${oldOrder} -> ${newOrder}`,
    );
  }

  // =========================================================================
  // 차단 관리
  // =========================================================================

  /**
   * 멤버 차단
   */
  async banMember(
    communityId: string,
    targetUserId: string,
    dto: BanMemberDto,
    moderatorId: string,
  ): Promise<CommunityBan> {
    // 자기 자신 차단 불가
    if (targetUserId === moderatorId) {
      throw new ForbiddenException("자신을 차단할 수 없습니다");
    }

    // 대상 멤버십 확인 (모더레이터 이상은 차단 불가)
    const targetMember = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (targetMember && isModeratorOrAbove(targetMember.role)) {
      throw new ForbiddenException(
        "모더레이터 이상의 멤버는 차단할 수 없습니다",
      );
    }

    // 이미 차단된 경우
    const existingBan = await this.banRepository.findOne({
      where: { communityId, userId: targetUserId, isActive: true },
    });

    if (existingBan) {
      throw new ConflictException("이미 차단된 사용자입니다");
    }

    // 만료 시간 계산
    let expiresAt: Date | null = null;
    if (dto.durationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.durationDays);
    }

    // 트랜잭션으로 차단 + 멤버십 처리
    return await this.dataSource.transaction(async (manager) => {
      // 차단 레코드 생성
      const ban = manager.create(CommunityBan, {
        communityId,
        userId: targetUserId,
        bannedById: moderatorId,
        reason: dto.reason,
        expiresAt,
        isActive: true,
      });

      const savedBan = await manager.save(CommunityBan, ban);

      // 멤버십이 있으면 상태 변경
      if (targetMember) {
        const wasActive = targetMember.status === MembershipStatus.ACTIVE;
        targetMember.status = MembershipStatus.BANNED;
        await manager.save(CommunityMember, targetMember);

        // 활성 멤버였으면 카운트 감소
        if (wasActive) {
          await manager
            .createQueryBuilder()
            .update(Community)
            .set({ memberCount: () => 'GREATEST(0, "memberCount" - 1)' })
            .where("id = :id", { id: communityId })
            .execute();
        }
      }

      // 모드 로그
      await manager.save(CommunityModLog, {
        communityId,
        moderatorId,
        action: ModAction.BAN_USER,
        targetUserId,
        reason: dto.reason,
        metadata: { durationDays: dto.durationDays, expiresAt },
      });

      return savedBan;
    });
  }

  /**
   * 차단 해제
   */
  async unbanMember(
    communityId: string,
    targetUserId: string,
    moderatorId: string,
  ): Promise<void> {
    const ban = await this.banRepository.findOne({
      where: { communityId, userId: targetUserId, isActive: true },
    });

    if (!ban) {
      throw new NotFoundException("차단 기록을 찾을 수 없습니다");
    }

    // 차단 비활성화
    ban.isActive = false;
    await this.banRepository.save(ban);

    // 멤버십 상태 복구 (있는 경우)
    const membership = await this.memberRepository.findOne({
      where: { communityId, userId: targetUserId },
    });

    if (membership && membership.status === MembershipStatus.BANNED) {
      membership.status = MembershipStatus.ACTIVE;
      await this.memberRepository.save(membership);

      // 카운트 증가
      await this.communityRepository.increment(
        { id: communityId },
        "memberCount",
        1,
      );
    }

    // 캐시 무효화
    await this.invalidateMembershipCache(communityId, targetUserId);

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.UNBAN_USER,
      targetUserId,
    });

    this.logger.log(
      `차단 해제: community=${communityId}, user=${targetUserId}`,
    );
  }

  /**
   * 차단 목록 조회
   */
  async getBans(
    communityId: string,
    query: PaginationDto,
  ): Promise<{
    items: CommunityBan[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = PaginationHelper.getSafePage(query.page);
    const limit = PaginationHelper.getSafeLimit(query.limit);
    const offset = PaginationHelper.getOffset(page, limit);

    const [items, total] = await this.banRepository.findAndCount({
      where: { communityId, isActive: true },
      relations: ["user", "user.profile", "bannedBy"], // profile도 함께 로드하여 profileImage 접근 가능
      order: { createdAt: "DESC" },
      skip: offset,
      take: limit,
    });

    const totalPages = PaginationHelper.getTotalPages(total, limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      // 프론트엔드 PaginatedCommunityResponse 타입과 일치하도록 추가
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  // =========================================================================
  // 가입 승인 관리 (RESTRICTED 커뮤니티)
  // =========================================================================

  /**
   * 가입 신청 (with application message)
   *
   * @description RESTRICTED 커뮤니티에 가입 신청서와 함께 신청
   */
  async applyToJoin(
    communityId: string,
    userId: string,
    dto: JoinApplicationDto,
  ): Promise<CommunityMember> {
    // 1. 커뮤니티 확인
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "joinPolicy", "slug"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // OPEN 커뮤니티는 바로 가입
    if (community.joinPolicy === JoinPolicy.OPEN) {
      return this.join(communityId, userId);
    }

    // PRIVATE 커뮤니티는 초대만 가능
    if (community.joinPolicy === JoinPolicy.PRIVATE) {
      throw new ForbiddenException(
        "이 커뮤니티는 초대를 통해서만 가입할 수 있습니다",
      );
    }

    // 2. 차단 여부 확인
    const ban = await this.banRepository.findOne({
      where: { communityId, userId, isActive: true },
      select: ["id", "expiresAt"],
    });

    if (ban && (!ban.expiresAt || new Date() < ban.expiresAt)) {
      throw new ForbiddenException(
        "이 커뮤니티에서 차단되어 가입할 수 없습니다",
      );
    }

    // 3. 기존 멤버십 확인
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId },
      select: ["id", "status"],
    });

    if (existing) {
      if (existing.status === MembershipStatus.ACTIVE) {
        throw new ConflictException("이미 가입된 커뮤니티입니다");
      }
      if (existing.status === MembershipStatus.PENDING) {
        throw new ConflictException("가입 승인 대기 중입니다");
      }
    }

    // 4. 가입 신청 생성
    return await this.dataSource.transaction(async (manager) => {
      let member: CommunityMember;

      if (existing) {
        existing.status = MembershipStatus.PENDING;
        existing.role = CommunityRole.MEMBER;
        existing.applicationMessage = dto.message || null;
        member = await manager.save(CommunityMember, existing);
      } else {
        member = manager.create(CommunityMember, {
          communityId,
          userId,
          role: CommunityRole.MEMBER,
          status: MembershipStatus.PENDING,
          applicationMessage: dto.message || null,
        });
        member = await manager.save(CommunityMember, member);
      }

      this.logger.log(`가입 신청: community=${communityId}, user=${userId}`);

      return member;
    });
  }

  /**
   * 대기 중인 가입 신청 목록 조회
   */
  async getPendingApplications(
    communityId: string,
    query: PaginationDto,
  ): Promise<{
    items: CommunityMember[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = PaginationHelper.getSafePage(query.page);
    const limit = PaginationHelper.getSafeLimit(query.limit);
    const offset = PaginationHelper.getOffset(page, limit);

    const [items, total] = await this.memberRepository.findAndCount({
      where: { communityId, status: MembershipStatus.PENDING },
      relations: ["user", "user.profile"],
      order: { joinedAt: "ASC" }, // 먼저 신청한 순서
      skip: offset,
      take: limit,
    });

    const totalPages = PaginationHelper.getTotalPages(total, limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 가입 신청 승인
   */
  async approveApplication(
    communityId: string,
    targetUserId: string,
    moderatorId: string,
  ): Promise<CommunityMember> {
    // 대상 멤버십 확인
    const membership = await this.memberRepository.findOne({
      where: {
        communityId,
        userId: targetUserId,
        status: MembershipStatus.PENDING,
      },
    });

    if (!membership) {
      throw new NotFoundException("대기 중인 가입 신청을 찾을 수 없습니다");
    }

    // 트랜잭션으로 승인 처리
    return await this.dataSource.transaction(async (manager) => {
      membership.status = MembershipStatus.ACTIVE;
      membership.approvedById = moderatorId;
      membership.approvedAt = new Date();

      const updated = await manager.save(CommunityMember, membership);

      // 멤버 카운트 증가
      await manager.increment(Community, { id: communityId }, "memberCount", 1);

      // 모드 로그
      await manager.save(CommunityModLog, {
        communityId,
        moderatorId,
        action: ModAction.APPROVE_MEMBER,
        targetUserId,
      });

      this.logger.log(
        `가입 승인: community=${communityId}, user=${targetUserId}`,
      );

      return updated;
    });
  }

  /**
   * 가입 신청 거부
   */
  async rejectApplication(
    communityId: string,
    targetUserId: string,
    moderatorId: string,
    dto?: HandleApplicationDto,
  ): Promise<void> {
    // 대상 멤버십 확인
    const membership = await this.memberRepository.findOne({
      where: {
        communityId,
        userId: targetUserId,
        status: MembershipStatus.PENDING,
      },
    });

    if (!membership) {
      throw new NotFoundException("대기 중인 가입 신청을 찾을 수 없습니다");
    }

    // 트랜잭션으로 거부 처리 (멤버십 삭제)
    await this.dataSource.transaction(async (manager) => {
      await manager.remove(CommunityMember, membership);

      // 모드 로그
      await manager.save(CommunityModLog, {
        communityId,
        moderatorId,
        action: ModAction.REJECT_MEMBER,
        targetUserId,
        reason: dto?.reason,
      });

      this.logger.log(
        `가입 거부: community=${communityId}, user=${targetUserId}`,
      );
    });
  }

  // =========================================================================
  // 초대 링크 관리 (PRIVATE/RESTRICTED 커뮤니티)
  // =========================================================================

  /**
   * 초대 링크 생성
   */
  async createInvite(
    communityId: string,
    creatorId: string,
    dto: CreateInviteDto,
  ): Promise<CommunityInvite> {
    // 커뮤니티 확인
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "joinPolicy"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // OPEN 커뮤니티는 초대 불필요
    if (community.joinPolicy === JoinPolicy.OPEN) {
      throw new BadRequestException(
        "공개 커뮤니티는 초대 링크가 필요하지 않습니다",
      );
    }

    // 만료 시간 계산
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (dto.expiresInHours || 168));

    // 토큰 생성 (64자 랜덤 문자열)
    const token = this.generateInviteToken();

    const invite = this.inviteRepository.create({
      communityId,
      createdById: creatorId,
      token,
      maxUses: dto.maxUses || 0,
      expiresAt,
    });

    const saved = await this.inviteRepository.save(invite);

    this.logger.log(`초대 생성: community=${communityId}`);

    return saved;
  }

  /**
   * 초대 링크 목록 조회
   */
  async getInvites(
    communityId: string,
    query: PaginationDto,
  ): Promise<{
    items: CommunityInvite[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = PaginationHelper.getSafePage(query.page);
    const limit = PaginationHelper.getSafeLimit(query.limit);
    const offset = PaginationHelper.getOffset(page, limit);

    const [items, total] = await this.inviteRepository.findAndCount({
      where: { communityId, isActive: true },
      relations: ["createdBy"],
      order: { createdAt: "DESC" },
      skip: offset,
      take: limit,
    });

    const totalPages = PaginationHelper.getTotalPages(total, limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 초대 토큰으로 초대 정보 조회
   */
  async getInviteByToken(token: string): Promise<CommunityInvite | null> {
    return this.inviteRepository.findOne({
      where: { token, isActive: true },
      relations: ["community", "createdBy"],
    });
  }

  /**
   * 초대 링크로 가입
   */
  async joinByInvite(token: string, userId: string): Promise<CommunityMember> {
    // 초대 확인
    const invite = await this.inviteRepository.findOne({
      where: { token, isActive: true },
      relations: ["community"],
    });

    if (!invite) {
      throw new NotFoundException("유효하지 않은 초대 링크입니다");
    }

    // 유효성 검사
    if (!invite.isValid()) {
      if (invite.isExpired()) {
        throw new BadRequestException("만료된 초대 링크입니다");
      }
      if (invite.isMaxUsesReached()) {
        throw new BadRequestException("초대 링크 사용 횟수를 초과했습니다");
      }
      throw new BadRequestException("유효하지 않은 초대 링크입니다");
    }

    const communityId = invite.communityId;

    // 차단 여부 확인
    const ban = await this.banRepository.findOne({
      where: { communityId, userId, isActive: true },
      select: ["id", "expiresAt"],
    });

    if (ban && (!ban.expiresAt || new Date() < ban.expiresAt)) {
      throw new ForbiddenException(
        "이 커뮤니티에서 차단되어 가입할 수 없습니다",
      );
    }

    // 기존 멤버십 확인
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId },
      select: ["id", "status"],
    });

    if (existing) {
      if (existing.status === MembershipStatus.ACTIVE) {
        throw new ConflictException("이미 가입된 커뮤니티입니다");
      }
    }

    // 트랜잭션으로 가입 + 초대 사용 횟수 증가
    return await this.dataSource.transaction(async (manager) => {
      let member: CommunityMember;

      if (existing) {
        existing.status = MembershipStatus.ACTIVE;
        existing.role = CommunityRole.MEMBER;
        existing.inviteId = invite.id;
        member = await manager.save(CommunityMember, existing);
      } else {
        member = manager.create(CommunityMember, {
          communityId,
          userId,
          role: CommunityRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          inviteId: invite.id,
        });
        member = await manager.save(CommunityMember, member);
      }

      // 멤버 카운트 증가
      await manager.increment(Community, { id: communityId }, "memberCount", 1);

      // 초대 사용 횟수 증가
      invite.useCount += 1;
      await manager.save(CommunityInvite, invite);

      // 캐시 무효화
      await this.invalidateMembershipCache(communityId, userId);

      this.logger.log(
        `초대로 가입: community=${communityId}, user=${userId}, invite=${invite.id}`,
      );

      return member;
    });
  }

  /**
   * 초대 링크 비활성화 (삭제)
   */
  async revokeInvite(
    communityId: string,
    inviteId: string,
    moderatorId: string,
  ): Promise<void> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, communityId, isActive: true },
    });

    if (!invite) {
      throw new NotFoundException("초대 링크를 찾을 수 없습니다");
    }

    invite.isActive = false;
    await this.inviteRepository.save(invite);

    this.logger.log(`초대 삭제: community=${communityId}, invite=${inviteId}`);
  }

  /**
   * 초대 토큰 생성 (64자 랜덤 문자열)
   */
  private generateInviteToken(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // =========================================================================
  // 캐시 유틸리티
  // =========================================================================

  /**
   * 멤버십 캐시 무효화
   */
  private async invalidateMembershipCache(
    communityId: string,
    userId: string,
  ): Promise<void> {
    await Promise.all([
      this.cacheService.del(
        MembershipCacheKeys.MEMBERSHIP(communityId, userId),
      ),
      this.cacheService.deletePattern(`community:${communityId}:members:*`),
    ]);
  }
}
