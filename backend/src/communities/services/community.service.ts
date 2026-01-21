import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, ILike, In, Brackets } from "typeorm";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityRule } from "../entities/community-rule.entity";
import { CommunityFlair } from "../entities/community-flair.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CommunityPost } from "../entities/community-post.entity";
import {
  CommunityRole,
  MembershipStatus,
  ModAction,
  JoinPolicy,
  FlairType,
} from "../enums";
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateCommunityRuleDto,
  UpdateCommunityRuleDto,
  CreateCommunityFlairDto,
  UpdateCommunityFlairDto,
  GetCommunitiesQueryDto,
  CommunitySortBy,
} from "../dto";
import { CacheService, CacheTTL } from "../../cache/cache.service";
import {
  CursorPaginationHelper,
  CursorPaginationResponse,
} from "../../common/dto/pagination.dto";

/**
 * 커뮤니티 캐시 키 상수
 */
const CommunityCacheKeys = {
  COMMUNITY_BY_SLUG: (slug: string) => `community:slug:${slug}`,
  COMMUNITY_BY_ID: (id: string) => `community:id:${id}`,
  COMMUNITY_LIST: (page: number, sortBy: string) =>
    `community:list:${sortBy}:page:${page}`,
  COMMUNITY_RULES: (communityId: string) => `community:${communityId}:rules`,
  COMMUNITY_FLAIRS: (communityId: string, type?: string) =>
    type
      ? `community:${communityId}:flairs:${type}`
      : `community:${communityId}:flairs`,
};

/**
 * 커뮤니티 서비스
 *
 * @description 커뮤니티 CRUD 및 관련 기능 담당
 *
 * **설계 원칙:**
 * - 생성자는 자동으로 OWNER가 됨
 * - 규칙/플레어 관리는 OWNER/MODERATOR만 가능
 * - 모든 주요 액션은 ModLog에 기록
 */
@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityRule)
    private readonly ruleRepository: Repository<CommunityRule>,
    @InjectRepository(CommunityFlair)
    private readonly flairRepository: Repository<CommunityFlair>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  // =========================================================================
  // 커뮤니티 CRUD
  // =========================================================================

  private normalizeVisibilityForCreate(
    dto: CreateCommunityDto,
  ): CreateCommunityDto {
    const joinPolicy = dto.joinPolicy ?? JoinPolicy.OPEN;
    const normalized: CreateCommunityDto = { ...dto };

    if (joinPolicy === JoinPolicy.PRIVATE) {
      normalized.isPublic = false;
      normalized.isPostDiscoverable = false;
      return normalized;
    }

    if (normalized.isPublic === undefined) {
      normalized.isPublic = true;
    }
    if (normalized.isPostDiscoverable === undefined) {
      normalized.isPostDiscoverable = true;
    }

    return normalized;
  }

  private normalizeVisibilityForUpdate(
    dto: UpdateCommunityDto,
    currentJoinPolicy: JoinPolicy,
  ): UpdateCommunityDto {
    const nextJoinPolicy = dto.joinPolicy ?? currentJoinPolicy;
    const normalized: UpdateCommunityDto = { ...dto };

    if (nextJoinPolicy === JoinPolicy.PRIVATE) {
      normalized.isPublic = false;
      normalized.isPostDiscoverable = false;
      return normalized;
    }

    if (
      currentJoinPolicy === JoinPolicy.PRIVATE &&
      dto.joinPolicy &&
      dto.isPublic === undefined &&
      dto.isPostDiscoverable === undefined
    ) {
      normalized.isPublic = true;
      normalized.isPostDiscoverable = true;
    }

    return normalized;
  }

  /**
   * 커뮤니티 생성
   * 생성자는 자동으로 OWNER 멤버가 됨
   */
  async create(userId: string, dto: CreateCommunityDto): Promise<Community> {
    // 1인당 최대 5개 커뮤니티 생성 제한
    const existingCount = await this.communityRepository.count({
      where: { creatorId: userId },
    });

    if (existingCount >= 5) {
      throw new ForbiddenException(
        "커뮤니티는 최대 5개까지만 생성할 수 있습니다.",
      );
    }

    // slug 중복 확인
    const existingBySlug = await this.communityRepository.findOne({
      where: { slug: dto.slug },
      select: ["id"],
    });

    if (existingBySlug) {
      throw new ConflictException("이미 사용 중인 커뮤니티 주소입니다");
    }

    // 트랜잭션으로 커뮤니티 + 멤버 생성
    const normalizedDto = this.normalizeVisibilityForCreate(dto);

    return await this.dataSource.transaction(async (manager) => {
      // 1. 커뮤니티 생성
      const community = manager.create(Community, {
        ...normalizedDto,
        creatorId: userId,
        memberCount: 1, // 생성자 포함
      });

      const savedCommunity = await manager.save(Community, community);

      // 2. 생성자를 OWNER 멤버로 추가
      const ownerMember = manager.create(CommunityMember, {
        communityId: savedCommunity.id,
        userId,
        role: CommunityRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });

      await manager.save(CommunityMember, ownerMember);

      // 3. 모드 로그 기록
      const modLog = manager.create(CommunityModLog, {
        communityId: savedCommunity.id,
        moderatorId: userId,
        action: ModAction.CREATE_COMMUNITY,
        metadata: { name: dto.name, slug: dto.slug },
      });

      await manager.save(CommunityModLog, modLog);

      this.logger.log(`커뮤니티 생성: ${dto.slug} by user ${userId}`);

      return savedCommunity;
    });
  }

  /**
   * 커뮤니티 조회 (slug)
   */
  async findBySlug(
    slug: string,
    userId?: string,
  ): Promise<Community & { userMembership?: any }> {
    // 캐시 확인
    const cacheKey = CommunityCacheKeys.COMMUNITY_BY_SLUG(slug);
    const cached = await this.cacheService.get<Community>(cacheKey);

    let community: Community;

    if (cached) {
      community = cached;
    } else {
      community = await this.communityRepository.findOne({
        where: { slug },
        relations: ["creator", "rules", "flairs"],
      });

      if (!community) {
        throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
      }

      // 캐시 저장
      await this.cacheService.set(cacheKey, community, CacheTTL.MEDIUM);
    }

    // 사용자 멤버십 정보 추가
    const result = community as Community & { userMembership?: any };

    if (userId) {
      const membership = await this.memberRepository.findOne({
        where: { communityId: community.id, userId },
        select: ["id", "role", "status"],
      });

      if (membership) {
        result.userMembership = {
          isMember: true,
          role: membership.role,
          status: membership.status,
        };
      } else {
        result.userMembership = { isMember: false };
      }
    }

    return result;
  }

  /**
   * 커뮤니티 캐시 무효화
   */
  async invalidateCommunityCache(
    community: Pick<Community, "id" | "slug">,
  ): Promise<void> {
    await this.invalidateCommunityCacheInternal(community.id, community.slug);
  }

  /**
   * 커뮤니티 조회 (ID)
   */
  async findById(id: string): Promise<Community> {
    const community = await this.communityRepository.findOne({
      where: { id },
      relations: ["creator", "lockedBy"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    return community;
  }

  /**
   * 커뮤니티 잠금
   */
  async lockCommunity(
    communityId: string,
    operatorId: string,
    reason?: string,
  ) {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "slug", "isLocked"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (community.isLocked) {
      return;
    }

    await this.communityRepository.update(communityId, {
      isLocked: true,
      lockedById: operatorId,
      lockedAt: new Date(),
    });

    await this.modLogRepository.save({
      communityId,
      moderatorId: operatorId,
      action: ModAction.LOCK_COMMUNITY,
      reason,
    });

    await this.invalidateCommunityCache({
      id: communityId,
      slug: community.slug,
    });
    this.logger.warn(`Community locked: ${communityId} by ${operatorId}`);
  }

  /**
   * 커뮤니티 잠금 해제
   */
  async unlockCommunity(
    communityId: string,
    operatorId: string,
    reason?: string,
  ) {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "slug", "isLocked"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (!community.isLocked) {
      return;
    }

    await this.communityRepository.update(communityId, {
      isLocked: false,
      lockedById: null,
      lockedAt: null,
    });

    await this.modLogRepository.save({
      communityId,
      moderatorId: operatorId,
      action: ModAction.UNLOCK_COMMUNITY,
      reason,
    });

    await this.invalidateCommunityCache({
      id: communityId,
      slug: community.slug,
    });
    this.logger.log(`Community unlocked: ${communityId} by ${operatorId}`);
  }

  /**
   * 커뮤니티 잠금 여부 확인
   */
  async ensureCommunityUnlocked(communityId: string) {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: ["id", "isLocked"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (community.isLocked) {
      throw new ForbiddenException(
        "해당 커뮤니티는 관리자에 의해 잠금 처리되었습니다.",
      );
    }
  }

  /**
   * 커서 기반 커뮤니티 목록 조회
   *
   * @description 커서 페이지네이션으로 커뮤니티 목록 조회
   *
   * **커서 페이지네이션 동작 방식:**
   * 1. 첫 요청: cursor 없이 요청 → 첫 페이지 반환
   * 2. 다음 요청: 응답의 nextCursor, nextCursorId 사용 → 다음 페이지 반환
   *
   * **정렬별 커서 타입:**
   * - POPULAR/ACTIVE: memberCount (숫자) + id
   * - NEWEST: createdAt (ISO 문자열) + id
   * - NAME: name (문자열) + id
   *
   * **성능 이점:**
   * - OFFSET 스캔 대신 인덱스 범위 스캔 사용
   * - 데이터가 많아져도 일정한 쿼리 시간
   */
  async findAll(
    query: GetCommunitiesQueryDto,
    userId?: string,
  ): Promise<CursorPaginationResponse<Community>> {
    const limit = CursorPaginationHelper.getSafeLimit(query.limit);
    const sortBy = query.sortBy || CommunitySortBy.POPULAR;

    // 쿼리 빌더
    const qb = this.communityRepository.createQueryBuilder("community");

    // 검색어 필터
    if (query.search) {
      qb.andWhere(
        "(community.name ILIKE :search OR community.description ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    // NSFW 필터: includeNsfw=false인 경우에도 사용자가 가입한 NSFW는 허용
    if (!query.includeNsfw) {
      qb.andWhere(
        new Brackets((qb1) => {
          qb1.where("community.isNsfw = false");
          if (userId) {
            qb1.orWhere("cm.communityId IS NOT NULL");
          }
        }),
      );
    }

    if (userId) {
      // 로그인 사용자의 멤버십을 조인하여 비공개 커뮤니티 노출 제어
      qb.leftJoin(
        "community_members",
        "cm",
        "cm.communityId = community.id AND cm.userId = :userId AND cm.status = :status",
        { userId, status: MembershipStatus.ACTIVE },
      );

      if (query.joinedOnly) {
        // 가입한 커뮤니티 탭인 경우 비공개/공개 구분 없이 멤버십이 있는 커뮤니티만
        qb.andWhere("cm.communityId IS NOT NULL");
      } else {
        // 기본 목록: 공개 커뮤니티 + 내가 가입한 비공개 커뮤니티
        qb.andWhere(
          "((community.isPublic = true AND community.joinPolicy != :privatePolicy) OR cm.communityId IS NOT NULL)",
          { privatePolicy: JoinPolicy.PRIVATE },
        );
      }
    } else {
      // 비로그인 사용자는 공개 커뮤니티만 조회
      qb.andWhere("community.isPublic = true");
      qb.andWhere("community.joinPolicy != :privatePolicy", {
        privatePolicy: JoinPolicy.PRIVATE,
      });
    }

    // 커서 기반 페이지네이션 조건 추가
    if (query.cursor && query.cursorId) {
      this.applyCursorCondition(qb, sortBy, query.cursor, query.cursorId);
    }

    // 정렬 (커서 페이지네이션을 위해 id를 보조 정렬 키로 추가)
    switch (sortBy) {
      case CommunitySortBy.NEWEST:
        qb.orderBy("community.createdAt", "DESC");
        qb.addOrderBy("community.id", "DESC");
        break;
      case CommunitySortBy.POPULAR:
        qb.orderBy("community.memberCount", "DESC");
        qb.addOrderBy("community.id", "DESC");
        break;
      case CommunitySortBy.NAME:
        qb.orderBy("community.name", "ASC");
        qb.addOrderBy("community.id", "ASC");
        break;
      case CommunitySortBy.ACTIVE:
        // 추후 lastPostAt으로 변경
        qb.orderBy("community.memberCount", "DESC");
        qb.addOrderBy("community.id", "DESC");
        break;
      default:
        qb.orderBy("community.memberCount", "DESC");
        qb.addOrderBy("community.id", "DESC");
    }

    // limit + 1로 조회하여 다음 페이지 존재 여부 확인
    qb.take(limit + 1);

    // 실행
    const items = await qb.getMany();

    // 다음 페이지 존재 여부 확인
    const hasNext = items.length > limit;

    // hasNext가 true면 마지막 아이템 제거 (실제 반환은 limit개)
    if (hasNext) {
      items.pop();
    }

    // 다음 커서 생성
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;

    if (hasNext && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursorId = lastItem.id;

      // 정렬 기준에 따른 커서 값
      switch (sortBy) {
        case CommunitySortBy.NEWEST:
          nextCursor = lastItem.createdAt.toISOString();
          break;
        case CommunitySortBy.POPULAR:
        case CommunitySortBy.ACTIVE:
          nextCursor = String(lastItem.memberCount);
          break;
        case CommunitySortBy.NAME:
          nextCursor = lastItem.name;
          break;
        default:
          nextCursor = String(lastItem.memberCount);
      }
    }

    // 사용자 멤버십 정보 추가 (N+1 방지를 위해 일괄 조회)
    type CommunityWithMembership = Community & {
      userMembership?: {
        isMember: boolean;
        role?: CommunityRole;
        status?: MembershipStatus;
      };
    };

    let itemsWithMembership: CommunityWithMembership[] = items;

    if (userId && items.length > 0) {
      const communityIds = items.map((c) => c.id);

      // 한 번의 쿼리로 사용자의 모든 멤버십 조회 (findBySlug와 동일하게 status 조건 제거)
      const memberships = await this.memberRepository.find({
        where: {
          userId,
          communityId: In(communityIds),
        },
        select: ["communityId", "role", "status"],
      });

      // communityId → membership 맵 생성
      const membershipMap = new Map(memberships.map((m) => [m.communityId, m]));

      // 각 커뮤니티에 userMembership 추가
      itemsWithMembership = items.map((community) => {
        const communityWithMembership = community as CommunityWithMembership;
        const membership = membershipMap.get(community.id);

        communityWithMembership.userMembership = membership
          ? {
              isMember: true,
              role: membership.role,
              status: membership.status,
            }
          : { isMember: false };

        return communityWithMembership;
      });
    }

    return {
      items: itemsWithMembership,
      nextCursor,
      nextCursorId,
      hasNext,
    };
  }

  /**
   * 커서 조건을 쿼리 빌더에 적용
   *
   * @description 정렬 기준에 따라 적절한 WHERE 조건 추가
   *
   * **커서 조건 로직:**
   * - 내림차순 (DESC): (sortField < cursor) OR (sortField = cursor AND id < cursorId)
   * - 오름차순 (ASC): (sortField > cursor) OR (sortField = cursor AND id > cursorId)
   */
  private applyCursorCondition(
    qb: ReturnType<typeof this.communityRepository.createQueryBuilder>,
    sortBy: CommunitySortBy,
    cursor: string,
    cursorId: string,
  ): void {
    switch (sortBy) {
      case CommunitySortBy.NEWEST: {
        // createdAt DESC, id DESC
        const cursorDate = CursorPaginationHelper.parseDateCursor(cursor);
        qb.andWhere(
          "(community.createdAt < :cursorDate OR (community.createdAt = :cursorDate AND community.id < :cursorId))",
          { cursorDate, cursorId },
        );
        break;
      }

      case CommunitySortBy.POPULAR:
      case CommunitySortBy.ACTIVE: {
        // memberCount DESC, id DESC
        const cursorCount = CursorPaginationHelper.parseNumericCursor(cursor);
        qb.andWhere(
          "(community.memberCount < :cursorCount OR (community.memberCount = :cursorCount AND community.id < :cursorId))",
          { cursorCount, cursorId },
        );
        break;
      }

      case CommunitySortBy.NAME: {
        // name ASC, id ASC
        qb.andWhere(
          "(community.name > :cursorName OR (community.name = :cursorName AND community.id > :cursorId))",
          { cursorName: cursor, cursorId },
        );
        break;
      }

      default: {
        // 기본: memberCount DESC, id DESC
        const cursorCount = CursorPaginationHelper.parseNumericCursor(cursor);
        qb.andWhere(
          "(community.memberCount < :cursorCount OR (community.memberCount = :cursorCount AND community.id < :cursorId))",
          { cursorCount, cursorId },
        );
      }
    }
  }

  /**
   * 커뮤니티 수정
   */
  async update(
    communityId: string,
    dto: UpdateCommunityDto,
    moderatorId: string,
  ): Promise<Community> {
    const community = await this.findById(communityId);
    const previousVisibility = {
      isPublic: community.isPublic,
      isPostDiscoverable: community.isPostDiscoverable,
      joinPolicy: community.joinPolicy,
    };

    // 변경 사항 적용
    const normalizedDto = this.normalizeVisibilityForUpdate(
      dto,
      community.joinPolicy,
    );
    Object.assign(community, normalizedDto);

    const updated = await this.communityRepository.save(community);

    // 캐시 무효화
    await this.invalidateCommunityCache({
      id: communityId,
      slug: community.slug,
    });
    if (
      previousVisibility.isPublic !== updated.isPublic ||
      previousVisibility.isPostDiscoverable !== updated.isPostDiscoverable ||
      previousVisibility.joinPolicy !== updated.joinPolicy
    ) {
      await this.invalidateCommunityDiscoveryCaches();
    }

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.UPDATE_SETTINGS,
      metadata: normalizedDto,
    });

    this.logger.log(`커뮤니티 수정: ${community.slug}`);

    return updated;
  }

  /**
   * 커뮤니티 삭제
   */
  async delete(communityId: string, ownerId: string): Promise<void> {
    const community = await this.findById(communityId);

    // 소유자만 삭제 가능
    if (community.creatorId !== ownerId) {
      throw new ForbiddenException("커뮤니티 소유자만 삭제할 수 있습니다");
    }

    await this.communityRepository.remove(community);

    // 캐시 무효화
    await this.invalidateCommunityCache({
      id: communityId,
      slug: community.slug,
    });

    this.logger.log(`커뮤니티 삭제: ${community.slug}`);
  }

  // =========================================================================
  // 규칙 관리
  // =========================================================================

  /**
   * 규칙 목록 조회
   */
  async getRules(communityId: string): Promise<CommunityRule[]> {
    const cacheKey = CommunityCacheKeys.COMMUNITY_RULES(communityId);
    const cached = await this.cacheService.get<CommunityRule[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const rules = await this.ruleRepository.find({
      where: { communityId },
      order: { displayOrder: "ASC" },
    });

    await this.cacheService.set(cacheKey, rules, CacheTTL.LONG);

    return rules;
  }

  /**
   * 규칙 생성
   */
  async createRule(
    communityId: string,
    dto: CreateCommunityRuleDto,
    moderatorId: string,
  ): Promise<CommunityRule> {
    // 최대 15개 규칙 제한
    const count = await this.ruleRepository.count({ where: { communityId } });
    if (count >= 15) {
      throw new BadRequestException("규칙은 최대 15개까지 추가할 수 있습니다");
    }

    const rule = this.ruleRepository.create({
      communityId,
      ...dto,
    });

    const saved = await this.ruleRepository.save(rule);

    // 캐시 무효화
    await this.cacheService.del(
      CommunityCacheKeys.COMMUNITY_RULES(communityId),
    );

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.ADD_RULE,
      metadata: { ruleId: saved.id, title: dto.title },
    });

    return saved;
  }

  /**
   * 규칙 수정
   */
  async updateRule(
    communityId: string,
    ruleId: string,
    dto: UpdateCommunityRuleDto,
    moderatorId: string,
  ): Promise<CommunityRule> {
    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, communityId },
    });

    if (!rule) {
      throw new NotFoundException("규칙을 찾을 수 없습니다");
    }

    Object.assign(rule, dto);

    const updated = await this.ruleRepository.save(rule);

    // 캐시 무효화
    await this.cacheService.del(
      CommunityCacheKeys.COMMUNITY_RULES(communityId),
    );

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.UPDATE_RULE,
      metadata: { ruleId, changes: dto },
    });

    return updated;
  }

  /**
   * 규칙 삭제
   */
  async deleteRule(
    communityId: string,
    ruleId: string,
    moderatorId: string,
  ): Promise<void> {
    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, communityId },
    });

    if (!rule) {
      throw new NotFoundException("규칙을 찾을 수 없습니다");
    }

    await this.ruleRepository.remove(rule);

    // 캐시 무효화
    await this.cacheService.del(
      CommunityCacheKeys.COMMUNITY_RULES(communityId),
    );

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.REMOVE_RULE,
      metadata: { ruleId, title: rule.title },
    });
  }

  // =========================================================================
  // 플레어 관리
  // =========================================================================

  /**
   * 플레어 목록 조회
   */
  async getFlairs(
    communityId: string,
    type?: FlairType,
  ): Promise<CommunityFlair[]> {
    const cacheKey = CommunityCacheKeys.COMMUNITY_FLAIRS(communityId, type);
    const cached = await this.cacheService.get<CommunityFlair[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const where: any = { communityId, isEnabled: true };
    if (type) {
      where.type = type;
    }

    const flairs = await this.flairRepository.find({
      where,
      order: { displayOrder: "ASC" },
    });

    await this.cacheService.set(cacheKey, flairs, CacheTTL.LONG);

    return flairs;
  }

  /**
   * 플레어 생성
   */
  async createFlair(
    communityId: string,
    dto: CreateCommunityFlairDto,
    moderatorId: string,
  ): Promise<CommunityFlair> {
    const flair = this.flairRepository.create({
      communityId,
      ...dto,
    });

    const saved = await this.flairRepository.save(flair);

    // 캐시 무효화
    await this.invalidateFlairCache(communityId);

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.ADD_FLAIR,
      metadata: { flairId: saved.id, name: dto.name },
    });

    return saved;
  }

  /**
   * 플레어 수정
   */
  async updateFlair(
    communityId: string,
    flairId: string,
    dto: UpdateCommunityFlairDto,
    moderatorId: string,
  ): Promise<CommunityFlair> {
    const flair = await this.flairRepository.findOne({
      where: { id: flairId, communityId },
    });

    if (!flair) {
      throw new NotFoundException("플레어를 찾을 수 없습니다");
    }

    Object.assign(flair, dto);

    const updated = await this.flairRepository.save(flair);

    // 캐시 무효화
    await this.invalidateFlairCache(communityId);

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.UPDATE_FLAIR,
      metadata: { flairId, changes: dto },
    });

    return updated;
  }

  /**
   * 플레어 삭제
   */
  async deleteFlair(
    communityId: string,
    flairId: string,
    moderatorId: string,
  ): Promise<void> {
    const flair = await this.flairRepository.findOne({
      where: { id: flairId, communityId },
    });

    if (!flair) {
      throw new NotFoundException("플레어를 찾을 수 없습니다");
    }

    await this.flairRepository.remove(flair);

    // 캐시 무효화
    await this.invalidateFlairCache(communityId);

    // 모드 로그
    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action: ModAction.REMOVE_FLAIR,
      metadata: { flairId, name: flair.name },
    });
  }

  // =========================================================================
  // Sitemap
  // =========================================================================

  /**
   * Sitemap용 모든 커뮤니티 포스트 조회
   *
   * @description 공개 커뮤니티의 삭제되지 않은 포스트 목록 반환
   * - SEO sitemap.xml 생성용
   * - 최소 데이터만 반환 (성능 최적화)
   */
  async getAllPostsForSitemap(): Promise<
    Array<{ slug: string; communitySlug: string; updatedAt: Date }>
  > {
    const posts = await this.postRepository
      .createQueryBuilder("post")
      .innerJoin("post.community", "community")
      .select(["post.id", "post.updatedAt", "community.slug"])
      .where("post.deletedAt IS NULL")
      .andWhere("community.isPublic = true")
      .andWhere("community.isPostDiscoverable = true")
      .andWhere("community.joinPolicy != :privatePolicy", {
        privatePolicy: JoinPolicy.PRIVATE,
      })
      .andWhere("community.deletedAt IS NULL")
      .orderBy("post.updatedAt", "DESC")
      .getMany();

    return posts.map((post) => ({
      slug: post.id, // CommunityPost는 UUID를 slug로 사용
      communitySlug: post.community.slug,
      updatedAt: post.updatedAt,
    }));
  }

  // =========================================================================
  // 캐시 유틸리티
  // =========================================================================

  /**
   * 커뮤니티 캐시 무효화
   */
  private async invalidateCommunityCacheInternal(
    communityId?: string,
    slug?: string,
  ): Promise<void> {
    await Promise.all([
      communityId
        ? this.cacheService.del(CommunityCacheKeys.COMMUNITY_BY_ID(communityId))
        : Promise.resolve(),
      slug
        ? this.cacheService.del(CommunityCacheKeys.COMMUNITY_BY_SLUG(slug))
        : Promise.resolve(),
      this.cacheService.deletePattern("community:list:*"),
    ]);
  }

  private async invalidateCommunityDiscoveryCaches(): Promise<void> {
    await this.cacheService.deletePattern("feed:unified:*");
  }

  /**
   * 플레어 캐시 무효화
   */
  private async invalidateFlairCache(communityId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(CommunityCacheKeys.COMMUNITY_FLAIRS(communityId)),
      this.cacheService.del(
        CommunityCacheKeys.COMMUNITY_FLAIRS(communityId, FlairType.POST),
      ),
      this.cacheService.del(
        CommunityCacheKeys.COMMUNITY_FLAIRS(communityId, FlairType.USER),
      ),
    ]);
  }
}
