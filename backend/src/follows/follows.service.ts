import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, MoreThan } from "typeorm";
import { Follow } from "./entities/follow.entity";
import { User } from "../users/entities/user.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/entities/notification.entity";
import {
  FollowInfoDto,
  PaginatedResponseDto,
  CursorPaginatedResponseDto,
} from "./dto";
import { CdnService } from "../files/services/cdn.service";

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
    private cdnService: CdnService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    // 팔로우 시도 로그 제거 - 너무 빈번함

    // Check if user is trying to follow themselves
    if (followerId === followingId) {
      // 자기 자신 팔로우 시도는 중요한 오류이므로 로그 유지
      this.logger.warn("User tried to follow themselves");
      throw new BadRequestException("You cannot follow yourself");
    }

    // Use transaction for atomic operation
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // Check if both users exist using exist() for better performance
      const [followerExists, followingExists] = await Promise.all([
        manager.exists(User, { where: { id: followerId } }),
        manager.exists(User, { where: { id: followingId } }),
      ]);

      // 사용자 존재 확인 로그 제거 - 너무 빈번함

      if (!followerExists || !followingExists) {
        // 사용자 미발견은 중요한 오류이므로 로그 유지
        this.logger.warn("Follow request failed: user not found");
        throw new NotFoundException("User not found");
      }

      // Check if already following with lock to prevent race conditions
      const existingFollow = await manager.findOne(Follow, {
        where: {
          followerId,
          followingId,
        },
        lock: { mode: "pessimistic_write" },
      });

      // 기존 팔로우 확인 로그 제거 - 너무 빈번함

      if (existingFollow) {
        // 중복 팔로우는 일반적인 상황이므로 로그 제거
        throw new BadRequestException("You are already following this user");
      }

      // Create follow relationship
      const follow = manager.create(Follow, {
        followerId,
        followingId,
      });

      const savedFollow = await manager.save(Follow, follow);

      // 카운트 업데이트 (트랜잭션 내)
      await manager.increment(User, { id: followingId }, "followerCount", 1);
      await manager.increment(User, { id: followerId }, "followingCount", 1);

      // 팔로우 생성 성공 로그 제거 - 너무 빈번함

      // 검증 로그 제거 - 개발 환경에서만 필요
      if (
        process.env.NODE_ENV === "development" &&
        process.env.DEBUG_FOLLOW === "true"
      ) {
        const verifyFollow = await manager.findOne(Follow, {
          where: { id: savedFollow.id },
        });
        this.logger.debug(
          `Follow verification: ${verifyFollow ? "success" : "failed"}`,
        );
      }

      // Create notification within the same transaction
      try {
        await this.notificationsService.createWithTransaction(manager, {
          recipientId: followingId,
          issuerId: followerId,
          type: NotificationType.FOLLOW,
        });
        // 알림 생성 성공 로그 제거 - 너무 빈번함
      } catch (error) {
        // 알림 생성 실패는 중요한 문제이므로 로그 유지
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Error creating notification: ${message}`, stack);
        // Don't throw - notification is not critical for follow operation
      }
    });

    // 팔로우 완료 로그 제거 - 너무 빈번함
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    // 언팔로우 시도 로그 제거 - 너무 빈번함

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const follow = await manager.findOne(Follow, {
        where: {
          followerId,
          followingId,
        },
        lock: { mode: "pessimistic_write" },
      });

      // 팔로우 관계 검색 결과 로그 제거 - 너무 빈번함

      if (!follow) {
        // 팔로우 관계 미발견은 일반적인 상황이므로 로그 제거
        throw new NotFoundException("Follow relationship not found");
      }

      await manager.remove(follow);

      // 카운트 감소 (음수 방지: MoreThan(0) 조건)
      await manager.decrement(
        User,
        { id: followingId, followerCount: MoreThan(0) },
        "followerCount",
        1,
      );
      await manager.decrement(
        User,
        { id: followerId, followingCount: MoreThan(0) },
        "followingCount",
        1,
      );

      // 팔로우 제거 성공 로그 제거 - 너무 빈번함
    });

    // 언팔로우 완료 로그 제거 - 너무 빈번함
  }

  async getFollowers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<User>> {
    const [followers, total] = await this.followRepository.findAndCount({
      where: { followingId: userId },
      relations: ["follower", "follower.profile"],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    // 프로필 정보 복사 및 CDN URL로 변환
    const followersWithCdn = followers.map((f) => {
      const user = f.follower;

      // Phase 1 리팩토링: 분리된 필드들을 User 객체에 flatten (Frontend 호환성)
      // profiles 테이블 필드
      if (user.profile) {
        user.profileImage = user.profile.profileImage;
      }

      // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
      if (user.profileImage) {
        if (
          user.profileImage.startsWith("v2/") ||
          user.profileImage.startsWith("uploads/")
        ) {
          // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
          user.profileImage = this.cdnService.generateCdnUrlFromKey(
            user.profileImage,
          );
          this.logger.debug(
            `Profile image CDN URL for follower ${user.id}: ${user.profileImage}`,
          );
        }
      }

      return user;
    });

    return {
      data: followersWithCdn,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowing(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<User>> {
    const [following, total] = await this.followRepository.findAndCount({
      where: { followerId: userId },
      relations: ["following", "following.profile"],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    // 프로필 정보 복사 및 CDN URL로 변환
    const followingWithCdn = following.map((f) => {
      const user = f.following;

      // Phase 1 리팩토링: 분리된 필드들을 User 객체에 flatten (Frontend 호환성)
      // profiles 테이블 필드
      if (user.profile) {
        user.profileImage = user.profile.profileImage;
      }

      // 프로필 이미지를 CDN URL로 변환 (v2/, uploads/ 모두 처리)
      if (user.profileImage) {
        if (
          user.profileImage.startsWith("v2/") ||
          user.profileImage.startsWith("uploads/")
        ) {
          // CDN 서비스 활성화 - S3 키를 CDN URL로 변환
          user.profileImage = this.cdnService.generateCdnUrlFromKey(
            user.profileImage,
          );
          this.logger.debug(
            `Profile image CDN URL for following ${user.id}: ${user.profileImage}`,
          );
        }
      }

      return user;
    });

    return {
      data: followingWithCdn,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowInfo(
    userId: string,
    currentUserId?: string,
  ): Promise<FollowInfoDto> {
    // 팔로우 정보 조회 로그 제거 - 매 요청마다 출력되어 너무 많음

    // 디버깅용 raw query 제거 - 개발 환경에서만 필요
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DEBUG_FOLLOW === "true"
    ) {
      if (currentUserId && currentUserId !== userId) {
        const rawResult = await this.followRepository.query(
          `SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, userId],
        );
        this.logger.debug(
          `[FollowService] Debug - Raw query result:`,
          rawResult,
        );
      }
    }

    // Phase 1: COUNT 쿼리 대신 캐싱된 값 사용
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "followerCount", "followingCount"],
    });

    const followersCount = user?.followerCount ?? 0;
    const followingCount = user?.followingCount ?? 0;

    // 팔로우 카운트 로그 제거 - 너무 빈번함

    let isFollowedByUser = false;
    if (currentUserId && currentUserId !== userId) {
      // Use more explicit query
      const queryBuilder = this.followRepository
        .createQueryBuilder("follow")
        .where("follow.followerId = :followerId", { followerId: currentUserId })
        .andWhere("follow.followingId = :followingId", { followingId: userId });

      // SQL 로그 제거 - 개발 환경에서만 필요
      if (
        process.env.NODE_ENV === "development" &&
        process.env.DEBUG_FOLLOW === "true"
      ) {
        const sql = queryBuilder.getSql();
        this.logger.debug(`[FollowService] Debug - Query SQL:`, sql);
      }

      const follow = await queryBuilder.getOne();

      isFollowedByUser = !!follow;
      // 팔로우 상태 확인 로그 제거 - 너무 빈번함
    }

    const result = {
      followersCount,
      followingCount,
      isFollowedByUser,
    };

    // 결과 반환 로그 제거 - 너무 빈번함
    return result;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    // 팔로우 확인 로그 제거 - 매 요청마다 출력되어 너무 많음

    const follow = await this.followRepository.findOne({
      where: {
        followerId,
        followingId,
      },
    });

    const result = !!follow;
    // 결과 로그 제거 - 너무 빈번함
    return result;
  }

  /**
   * 커서 기반 팔로워 목록 조회
   * - OFFSET 미사용으로 대규모 데이터 효율적 처리
   */
  async getFollowersCursor(
    userId: string,
    options: { limit?: number; cursor?: string; cursorId?: string },
  ): Promise<CursorPaginatedResponseDto<User>> {
    const { limit = 20, cursor, cursorId } = options;

    const qb = this.followRepository
      .createQueryBuilder("follow")
      .leftJoinAndSelect("follow.follower", "follower")
      .leftJoinAndSelect("follower.profile", "profile")
      .leftJoinAndSelect("follower.blog", "blog")
      .where("follow.followingId = :userId", { userId })
      .orderBy("follow.createdAt", "DESC")
      .addOrderBy("follow.id", "DESC")
      .take(limit + 1);

    // 커서 적용
    if (cursor && cursorId) {
      qb.andWhere(
        "(follow.createdAt < :cursor OR (follow.createdAt = :cursor AND follow.id < :cursorId))",
        { cursor: new Date(cursor), cursorId },
      );
    }

    const [follows, total] = await Promise.all([
      qb.getMany(),
      this.followRepository.count({ where: { followingId: userId } }),
    ]);

    // 다음 페이지 확인
    const hasNext = follows.length > limit;
    const paginatedItems = hasNext ? follows.slice(0, limit) : follows;

    // 다음 커서 계산
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;
    if (hasNext && paginatedItems.length > 0) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      nextCursor = lastItem.createdAt.toISOString();
      nextCursorId = lastItem.id;
    }

    // CDN URL 변환
    const followersWithCdn = paginatedItems.map((f) => {
      const user = f.follower;
      if (user.profile) {
        user.profileImage = user.profile.profileImage;
      }
      if (
        user.profileImage &&
        (user.profileImage.startsWith("v2/") ||
          user.profileImage.startsWith("uploads/"))
      ) {
        user.profileImage = this.cdnService.generateCdnUrlFromKey(
          user.profileImage,
        );
      }
      return user;
    });

    return {
      data: followersWithCdn,
      total,
      hasNext,
      nextCursor,
      nextCursorId,
    };
  }

  /**
   * 커서 기반 팔로잉 목록 조회
   * - OFFSET 미사용으로 대규모 데이터 효율적 처리
   */
  async getFollowingCursor(
    userId: string,
    options: { limit?: number; cursor?: string; cursorId?: string },
  ): Promise<CursorPaginatedResponseDto<User>> {
    const { limit = 20, cursor, cursorId } = options;

    const qb = this.followRepository
      .createQueryBuilder("follow")
      .leftJoinAndSelect("follow.following", "following")
      .leftJoinAndSelect("following.profile", "profile")
      .leftJoinAndSelect("following.blog", "blog")
      .where("follow.followerId = :userId", { userId })
      .orderBy("follow.createdAt", "DESC")
      .addOrderBy("follow.id", "DESC")
      .take(limit + 1);

    // 커서 적용
    if (cursor && cursorId) {
      qb.andWhere(
        "(follow.createdAt < :cursor OR (follow.createdAt = :cursor AND follow.id < :cursorId))",
        { cursor: new Date(cursor), cursorId },
      );
    }

    const [follows, total] = await Promise.all([
      qb.getMany(),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    // 다음 페이지 확인
    const hasNext = follows.length > limit;
    const paginatedItems = hasNext ? follows.slice(0, limit) : follows;

    // 다음 커서 계산
    let nextCursor: string | null = null;
    let nextCursorId: string | null = null;
    if (hasNext && paginatedItems.length > 0) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      nextCursor = lastItem.createdAt.toISOString();
      nextCursorId = lastItem.id;
    }

    // CDN URL 변환
    const followingWithCdn = paginatedItems.map((f) => {
      const user = f.following;
      if (user.profile) {
        user.profileImage = user.profile.profileImage;
      }
      if (
        user.profileImage &&
        (user.profileImage.startsWith("v2/") ||
          user.profileImage.startsWith("uploads/"))
      ) {
        user.profileImage = this.cdnService.generateCdnUrlFromKey(
          user.profileImage,
        );
      }
      return user;
    });

    return {
      data: followingWithCdn,
      total,
      hasNext,
      nextCursor,
      nextCursorId,
    };
  }
}
