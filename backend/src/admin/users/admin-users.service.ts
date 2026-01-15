import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Between, FindOptionsWhere, Not } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Profile } from "../../users/entities/profile.entity";
import { DateUtils } from "../../common/utils/date.utils";
import { Post } from "../../posts/entities/post.entity";
import { Comment } from "../../comments/entities/comment.entity";
import { Role } from "../../common/enums/role.enum";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { UsersService } from "../../users/users.service";

export interface UserFilters {
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  accountAge: number; // in days
  lastActivity: Date | null;
}

export interface UpdateUserDto {
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private auditService: AuditService,
    private usersService: UsersService,
  ) {}

  /**
   * Get all users with filters and pagination
   */
  async findAll(
    filters: UserFilters,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder: "ASC" | "DESC" = "DESC",
  ) {
    // Use QueryBuilder for complex queries with OR conditions
    let query = this.userRepository.createQueryBuilder("user");

    // Apply filters
    if (filters.role) {
      query = query.andWhere("user.role = :role", { role: filters.role });
    }

    if (filters.isActive !== undefined) {
      query = query.andWhere("user.isActive = :isActive", {
        isActive: filters.isActive,
      });
    }

    if (filters.isEmailVerified !== undefined) {
      query = query.andWhere("user.isEmailVerified = :isEmailVerified", {
        isEmailVerified: filters.isEmailVerified,
      });
    }

    if (filters.search) {
      // Search in both email and username using OR
      query = query.andWhere(
        "(user.email LIKE :search OR user.username LIKE :search)",
        { search: `%${filters.search}%` },
      );
    }

    if (filters.startDate && filters.endDate) {
      query = query.andWhere("user.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    // Apply sorting and pagination
    query = query
      .orderBy(`user.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await query.getManyAndCount();

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return { ...user, stats };
      }),
    );

    return {
      data: usersWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get detailed user information
   */
  async findOne(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const stats = await this.getUserStats(userId);
    const recentActivity = await this.getUserRecentActivity(userId);

    return {
      ...user,
      stats,
      recentActivity,
    };
  }

  /**
   * Update user details
   */
  async update(
    userId: string,
    updateDto: UpdateUserDto,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Prevent self-demotion for admins
    if (userId === adminId && updateDto.role && updateDto.role !== Role.ADMIN) {
      throw new ForbiddenException("Cannot change your own admin role");
    }

    // Prevent disabling the last admin
    if (updateDto.isActive === false && user.role === Role.ADMIN) {
      const activeAdminCount = await this.userRepository.count({
        where: { role: Role.ADMIN, isActive: true, id: Not(userId) },
      });

      if (activeAdminCount === 0) {
        throw new BadRequestException("Cannot disable the last active admin");
      }
    }

    const previousData = {
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };

    // Update user
    Object.assign(user, updateDto);
    const updatedUser = await this.userRepository.save(user);

    // Log the action
    await this.auditService.logUserAction(
      this.getAuditAction(updateDto),
      userId,
      { previous: previousData, new: updateDto },
      { userId: adminId, ...context },
    );

    return updatedUser;
  }

  /**
   * Suspend a user
   */
  async suspend(
    userId: string,
    duration: number, // in days
    reason: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException("Cannot suspend an admin");
    }

    const now = new Date();
    const suspensionUntil = new Date(
      now.getTime() + duration * 24 * 60 * 60 * 1000,
    );

    user.isActive = false;
    user.suspensionUntil = suspensionUntil;
    user.suspensionReason = reason;
    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = null;

    await this.userRepository.save(user);

    await this.auditService.logUserAction(
      AuditAction.USER_SUSPENDED,
      userId,
      {
        previous: { isActive: true },
        new: {
          isActive: false,
          suspensionDuration: duration,
          suspensionUntil,
          reason,
        },
      },
      { userId: adminId, ...context },
    );

    return {
      message: `User suspended for ${duration} days`,
      user,
    };
  }

  /**
   * Ban a user permanently
   */
  async ban(
    userId: string,
    reason: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN) {
      throw new ForbiddenException("Cannot ban an admin");
    }

    user.isActive = false;
    user.isBanned = true;
    user.bannedAt = new Date();
    user.banReason = reason;
    user.suspensionUntil = null;
    user.suspensionReason = null;

    await this.userRepository.save(user);

    // Also unpublish all their content
    await this.postRepository.update(
      { authorId: userId },
      { isPublished: false },
    );

    await this.auditService.logUserAction(
      AuditAction.USER_BANNED,
      userId,
      {
        previous: { isActive: true },
        new: {
          isActive: false,
          banned: true,
          reason,
          bannedAt: user.bannedAt,
        },
      },
      { userId: adminId, ...context },
    );

    return {
      message: "User permanently banned",
      user,
    };
  }

  /**
   * Activate a user
   */
  async activate(
    userId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.isActive = true;
    user.suspensionUntil = null;
    user.suspensionReason = null;
    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = null;
    await this.userRepository.save(user);

    await this.auditService.logUserAction(
      AuditAction.USER_ACTIVATED,
      userId,
      {
        previous: { isActive: false },
        new: { isActive: true },
      },
      { userId: adminId, ...context },
    );

    return user;
  }

  /**
   * Delete a user (soft delete)
   */
  async delete(
    userId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException("Cannot delete the last admin");
      }
    }

    // Soft delete by marking as inactive and anonymizing data
    user.isActive = false;
    user.email = `deleted_${userId}@deleted.com`;
    user.username = `deleted_${userId}`;
    user.password = null;

    await this.userRepository.save(user);

    // Phase 1-2-3: profiles 테이블의 데이터도 익명화
    await this.profileRepository.update(
      { userId },
      { profileImage: null, bio: null },
    );

    await this.auditService.logUserAction(
      AuditAction.USER_DELETED,
      userId,
      {
        previous: { email: user.email },
        new: { deleted: true },
      },
      { userId: adminId, ...context },
    );

    return { message: "User deleted successfully" };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole,
      usersByProvider,
      recentSignups,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isEmailVerified: true } }),
      this.getUsersByRole(),
      this.getUsersByProvider(),
      this.getRecentSignups(),
    ]);

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole,
      usersByProvider,
      recentSignups,
    };
  }

  /**
   * Export users data (for compliance)
   */
  async exportUsers(format: "json" | "csv" = "json") {
    const users = await this.userRepository.find({
      select: [
        "id",
        "email",
        "username",
        "role",
        "isActive",
        "isEmailVerified",
        "authProvider",
        "createdAt",
      ],
    });

    if (format === "json") {
      return users;
    }

    // CSV export
    const headers = [
      "ID",
      "Email",
      "Username",
      "Role",
      "Active",
      "Verified",
      "Provider",
      "Created",
    ];
    const rows = users.map((u) => [
      u.id,
      u.email,
      u.username || "",
      u.role,
      u.isActive ? "Yes" : "No",
      u.isEmailVerified ? "Yes" : "No",
      u.authProvider,
      u.createdAt.toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return csv;
  }

  // Private helper methods

  private async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const [totalPosts, totalComments, totalLikes] = await Promise.all([
      this.postRepository.count({
        where: { authorId: userId, isDeleted: false },
      }),
      this.commentRepository.count({ where: { authorId: userId } }),
      this.postRepository
        .createQueryBuilder("post")
        .leftJoin("post.stats", "stats")
        .select("SUM(stats.likeCount)", "total")
        .where("post.authorId = :userId", { userId })
        .andWhere("post.isDeleted = :isDeleted", { isDeleted: false })
        .getRawOne()
        .then((r) => parseInt(r?.total || "0")),
    ]);

    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      totalPosts,
      totalComments,
      totalLikes,
      accountAge,
      lastActivity: user.lastLoginAt,
    };
  }

  private async getUserRecentActivity(userId: string, limit = 10) {
    const [recentPosts, recentComments] = await Promise.all([
      this.postRepository.find({
        where: { authorId: userId, isDeleted: false },
        order: { createdAt: "DESC" },
        take: limit / 2,
        select: ["id", "title", "createdAt"],
      }),
      this.commentRepository.find({
        where: { authorId: userId },
        order: { createdAt: "DESC" },
        take: limit / 2,
        select: ["id", "content", "createdAt"],
      }),
    ]);

    const activities = [
      ...recentPosts.map((p) => ({
        type: "post" as const,
        id: p.id,
        title: p.title,
        timestamp: p.createdAt,
      })),
      ...recentComments.map((c) => ({
        type: "comment" as const,
        id: c.id,
        content: c.content.substring(0, 100),
        timestamp: c.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private async getUsersByRole() {
    const result = await this.userRepository
      .createQueryBuilder("user")
      .select("user.role", "role")
      .addSelect("COUNT(*)", "count")
      .groupBy("user.role")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.role] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getUsersByProvider() {
    const result = await this.userRepository
      .createQueryBuilder("user")
      .select("user.authProvider", "provider")
      .addSelect("COUNT(*)", "count")
      .groupBy("user.authProvider")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.provider] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getRecentSignups(days = 7) {
    // DateUtils를 사용한 일수 기반 계산
    const since = DateUtils.fromNowSubtractDays(days);

    return await this.userRepository.count({
      where: {
        createdAt: Between(since, new Date()),
      },
    });
  }

  private getAuditAction(updateDto: UpdateUserDto): AuditAction {
    if (updateDto.role) return AuditAction.USER_ROLE_CHANGED;
    if (updateDto.isActive === false) return AuditAction.USER_SUSPENDED;
    if (updateDto.isActive === true) return AuditAction.USER_ACTIVATED;
    return AuditAction.USER_UPDATED;
  }

  /**
   * 삭제된 사용자 목록 조회 (관리자 전용)
   * - isDeleted = true인 사용자만 조회
   * - 삭제일, 예정 삭제일 표시
   * - 검색: audit_logs의 원본 데이터에서 이메일/사용자명 검색
   */
  async findDeletedUsers(
    page = 1,
    limit = 20,
    sortBy = "deletedAt",
    sortOrder: "ASC" | "DESC" = "DESC",
    searchQuery?: string,
  ) {
    const query = this.userRepository
      .createQueryBuilder("user")
      .where("user.isDeleted = :isDeleted", { isDeleted: true });

    // 검색어가 있으면 audit_logs에서 원본 데이터 검색
    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.toLowerCase().trim();

      // audit_logs에서 삭제된 사용자 감사 로그 조회 (최대 1000개)
      const auditLogs = await this.auditService.findAll(
        {
          action: AuditAction.USER_DELETED,
          entityType: "user",
        },
        1,
        1000,
      );

      // previousData에서 원본 이메일/username 검색하여 userId 추출
      const matchingUserIds = auditLogs.data
        .filter((log) => {
          const email = log.previousData?.email?.toLowerCase() || "";
          const username = log.previousData?.username?.toLowerCase() || "";
          return email.includes(search) || username.includes(search);
        })
        .map((log) => log.entityId)
        .filter((id) => id); // null/undefined 제거

      // 매칭되는 사용자가 없으면 빈 결과 반환
      if (matchingUserIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      // 매칭된 userId로 필터링
      query.andWhere("user.id IN (:...userIds)", { userIds: matchingUserIds });
    }

    // 정렬 및 페이지네이션 적용
    query
      .orderBy(`user.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await query.getManyAndCount();

    // 각 사용자의 남은 삭제 대기 시간 계산
    const usersWithDaysRemaining = users.map((user) => {
      const now = new Date();
      const scheduledDeletionAt = user.scheduledDeletionAt;
      let daysRemaining = null;

      if (scheduledDeletionAt) {
        const diffTime = scheduledDeletionAt.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        ...user,
        daysRemaining, // 남은 일수 (음수면 이미 삭제 예정 시간 지남)
      };
    });

    return {
      data: usersWithDaysRemaining,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 사용자 즉시 영구 삭제 (관리자 전용)
   * - DB에서 완전히 제거
   * - CASCADE로 관련 데이터 모두 삭제
   * - 복구 불가능
   */
  async permanentDeleteUser(
    userId: string,
    adminId: string,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // 감사 로그 먼저 기록 (삭제 후에는 기록 불가)
    await this.auditService.logUserAction(
      AuditAction.USER_DELETED,
      userId,
      {
        previous: { email: user.email, isDeleted: user.isDeleted },
        new: { permanentlyDeleted: true, deletedBy: adminId },
      },
      { userId: adminId, ...context },
    );

    // 영구 삭제 실행
    await this.usersService.permanentDelete(userId);

    return {
      message:
        "User permanently deleted from database. This action cannot be undone.",
    };
  }

  /**
   * 법적 조회: 삭제된 사용자의 포스트 목록 조회
   * - isDeleted = true인 포스트만 조회
   * - 법적 요구 시 증거 자료로 제공
   */
  async getDeletedPostsByUserId(userId: string): Promise<Post[]> {
    return await this.postRepository.find({
      where: {
        authorId: userId,
        isDeleted: true,
      },
      relations: ["stats"],
      select: [
        "id",
        "title",
        "slug",
        "content", // 법적 조회 시 가장 중요한 증거
        "category",
        "excerpt",
        "createdAt",
        "publishedAt",
      ],
      order: {
        createdAt: "DESC",
      },
      take: 100, // 최대 100개 (법적 조회용)
    });
  }

  /**
   * 법적 조회: 삭제된 사용자의 댓글 목록 조회
   * - isDeleted = true인 댓글만 조회
   * - 법적 요구 시 증거 자료로 제공
   */
  async getDeletedCommentsByUserId(userId: string): Promise<Comment[]> {
    return await this.commentRepository.find({
      where: {
        authorId: userId,
        isDeleted: true,
      },
      select: ["id", "content", "postId", "likesCount", "createdAt"],
      order: {
        createdAt: "DESC",
      },
      take: 100, // 최대 100개 (법적 조회용)
    });
  }
}
