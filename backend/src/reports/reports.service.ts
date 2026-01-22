import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsWhere, Between, In } from "typeorm";
import { Report } from "./entities/report.entity";
import {
  ReportActionLog,
  ReportActionLogStatus,
} from "./entities/report-action.entity";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import {
  ReportType,
  ReportStatus,
  ReportAction,
  ReportReason,
} from "./enums/report.enum";
import { Post } from "../posts/entities/post.entity";
import { Comment } from "../comments/entities/comment.entity";
import { User } from "../users/entities/user.entity";
import { Role } from "../common/enums/role.enum";
import { CommunityPost, CommunityComment } from "../communities/entities";
import { CommunityPostStatus } from "../communities/enums";
import { CommunityService } from "../communities/services/community.service";
import { CommunityMembershipService } from "../communities/services/community-membership.service";
import { CommunityRecoveryService } from "../communities/services/community-recovery.service";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(ReportActionLog)
    private reportActionRepository: Repository<ReportActionLog>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CommunityPost)
    private communityPostRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityComment)
    private communityCommentRepository: Repository<CommunityComment>,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
    private readonly communityRecoveryService: CommunityRecoveryService,
  ) {}

  /**
   * Create a new report
   */
  async create(
    createReportDto: CreateReportDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Report> {
    // Check if target exists based on type
    const resolvedTarget = await this.resolveTargetInfo(
      createReportDto.type,
      createReportDto.targetId,
      createReportDto.communityId,
    );

    // 중복 신고 허용: 같은 사용자가 같은 대상을 여러 번 신고할 수 있음
    // 관리자 패널에서 모든 신고 기록을 확인 가능

    // Calculate priority based on reason
    const priority = this.calculatePriority(createReportDto.reason);

    const metadata = {
      ...(createReportDto.metadata ?? {}),
      reportedAt: new Date().toISOString(),
      browserInfo: userAgent ? this.parseBrowserInfo(userAgent) : null,
    };

    const report = this.reportRepository.create({
      ...createReportDto,
      communityId:
        resolvedTarget.source === "community"
          ? createReportDto.communityId ?? resolvedTarget.communityId ?? null
          : null,
      reportedModeratorId: createReportDto.reportedModeratorId ?? null,
      reportedById: userId,
      priority,
      ipAddress,
      userAgent,
      metadata,
    });

    const savedReport = await this.reportRepository.save(report);

    // Check if content needs immediate action (e.g., multiple reports)
    await this.checkForAutomaticAction(
      createReportDto.type,
      createReportDto.targetId,
    );

    return savedReport;
  }

  /**
   * Get all reports (admin/moderator only)
   */
  async findAll(
    status?: ReportStatus,
    type?: ReportType,
    page = 1,
    limit = parseInt(process.env.DEFAULT_PAGE_LIMIT || "20"),
  ) {
    const where: FindOptionsWhere<Report> = {};

    if (status) where.status = status;
    if (type) where.type = type;

    const [reports, total] = await this.reportRepository.findAndCount({
      where,
      relations: ["reportedBy", "reviewedBy"],
      order: {
        priority: "DESC",
        createdAt: "DESC",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const reportIds = reports.map((report) => report.id);
    const actionLogs = reportIds.length
      ? await this.reportActionRepository.find({
          where: { reportId: In(reportIds) },
          order: { createdAt: "DESC" },
        })
      : [];

    const actionLogMap = actionLogs.reduce<Map<string, ReportActionLog[]>>(
      (acc, log) => {
        const arr = acc.get(log.reportId) ?? [];
        arr.push(log);
        acc.set(log.reportId, arr);
        return acc;
      },
      new Map(),
    );

    // 배치 쿼리로 타입별 타겟 상세 정보 조회 (N+1 → 4 쿼리로 최적화)
    const targetMaps = await this.loadBatchTargetDetails(reports);

    // 동기적 매핑 (비동기 루프 제거)
    const reportsWithTargets = reports.map((report) => {
      const target =
        targetMaps.get(`${report.type}:${report.targetId}`) || null;
      const result: any = { ...report };
      if (report.type === ReportType.POST && target) {
        result.post = target;
      } else if (report.type === ReportType.COMMENT && target) {
        result.comment = target;
      } else if (report.type === ReportType.USER && target) {
        result.targetUser = target;
      }
      result.target = target; // Keep for backward compatibility
      result.actionLogs = actionLogMap.get(report.id) ?? [];
      return result;
    });

    return {
      data: reportsWithTargets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single report
   */
  async findOne(id: string, userId?: string, userRole?: Role) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ["reportedBy", "reviewedBy"],
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    // Check access permission
    if (userId && userRole !== Role.ADMIN && userRole !== Role.MODERATOR) {
      if (report.reportedById !== userId) {
        throw new ForbiddenException("You can only view your own reports");
      }
    }

    const target = await this.loadTargetDetails(report);
    const actionLogs = await this.reportActionRepository.find({
      where: { reportId: report.id },
      order: { createdAt: "DESC" },
    });
    return { ...report, target, actionLogs };
  }

  /**
   * Update report status (moderator/admin only)
   */
  async update(
    id: string,
    updateReportDto: UpdateReportDto,
    reviewerId: string,
  ) {
    const report = await this.reportRepository.findOne({ where: { id } });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const { actionPayload, ...rest } = updateReportDto;

    // Update report
    Object.assign(report, rest);
    if (actionPayload !== undefined) {
      report.actionPayload = actionPayload;
    }
    report.reviewedById = reviewerId;
    report.reviewedAt = new Date();

    const updatedReport = await this.reportRepository.save(report);

    // Execute action if specified
    if (rest.actionTaken && rest.actionTaken !== ReportAction.NO_ACTION) {
      await this.executeAction(
        report,
        rest.actionTaken,
        reviewerId,
        actionPayload || report.actionPayload,
      );
    }

    return updatedReport;
  }

  /**
   * Get reports by user
   */
  async findByUser(userId: string, page = 1, limit = 20) {
    const [reports, total] = await this.reportRepository.findAndCount({
      where: { reportedById: userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get report statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: FindOptionsWhere<Report> = {};

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [
      totalReports,
      pendingReports,
      resolvedReports,
      reportsByType,
      reportsByReason,
      topReporters,
      frequentlyReportedContent,
    ] = await Promise.all([
      this.reportRepository.count({ where }),
      this.reportRepository.count({
        where: { ...where, status: ReportStatus.PENDING },
      }),
      this.reportRepository.count({
        where: { ...where, status: ReportStatus.RESOLVED },
      }),
      this.getReportsByType(where),
      this.getReportsByReason(where),
      this.getTopReporters(where),
      this.getFrequentlyReportedContent(where),
    ]);

    const escalatedReports = await this.reportRepository.count({
      where: { ...where, status: ReportStatus.ESCALATED },
    });
    const dismissedReports = await this.reportRepository.count({
      where: { ...where, status: ReportStatus.DISMISSED },
    });

    return {
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      escalated: escalatedReports,
      dismissed: dismissedReports,
      totalReports,
      pendingReports,
      resolvedReports,
      reportsByType,
      reportsByReason,
      topReporters,
      frequentlyReportedContent,
      averageResolutionTime: await this.getAverageResolutionTime(where),
    };
  }

  /**
   * Batch update reports
   */
  async batchUpdate(
    reportIds: string[],
    updateDto: UpdateReportDto,
    reviewerId: string,
  ) {
    const reports = await this.reportRepository.findByIds(reportIds);

    if (reports.length !== reportIds.length) {
      throw new NotFoundException("Some reports not found");
    }

    const updatedReports = await Promise.all(
      reports.map((report) => this.update(report.id, updateDto, reviewerId)),
    );

    return updatedReports;
  }

  // Private helper methods

  private async resolveTargetInfo(
    type: ReportType,
    targetId: string,
    communityId?: string,
  ): Promise<{ source: "blog" | "community"; communityId?: string | null }> {
    switch (type) {
      case ReportType.POST: {
        const postExists = await this.postRepository.exist({
          where: { id: targetId },
        });
        if (postExists) {
          return { source: "blog" };
        }

        const communityPost = await this.communityPostRepository.findOne({
          where: communityId ? { id: targetId, communityId } : { id: targetId },
          select: ["id", "communityId"],
        });
        if (communityPost) {
          return { source: "community", communityId: communityPost.communityId };
        }
        break;
      }
      case ReportType.COMMENT: {
        const commentExists = await this.commentRepository.exist({
          where: { id: targetId },
        });
        if (commentExists) {
          return { source: "blog" };
        }

        const communityComment = await this.communityCommentRepository.findOne({
          where: communityId ? { id: targetId, communityId } : { id: targetId },
          select: ["id", "communityId"],
        });
        if (communityComment) {
          return {
            source: "community",
            communityId: communityComment.communityId ?? null,
          };
        }
        break;
      }
      case ReportType.USER: {
        const userExists = await this.userRepository.exist({
          where: { id: targetId },
        });
        if (userExists) {
          return { source: "blog" };
        }
        break;
      }
      case ReportType.MESSAGE:
      default:
        break;
    }

    throw new NotFoundException(`${type} not found`);
  }

  private calculatePriority(reason: ReportReason): number {
    const priorityMap = {
      [ReportReason.HATE_SPEECH]: 4,
      [ReportReason.HARASSMENT]: 4,
      [ReportReason.COPYRIGHT_VIOLATION]: 3,
      [ReportReason.MISINFORMATION]: 3,
      [ReportReason.INAPPROPRIATE_CONTENT]: 2,
      [ReportReason.SPAM]: 2,
      [ReportReason.OTHER]: 1,
    };

    return priorityMap[reason] || 1;
  }

  private async checkForAutomaticAction(type: ReportType, targetId: string) {
    const reportCount = await this.reportRepository.count({
      where: {
        type,
        targetId,
        status: In([ReportStatus.PENDING, ReportStatus.UNDER_REVIEW]),
      },
    });

    // Auto-escalate if multiple reports (threshold: 5)
    if (reportCount >= 5) {
      await this.reportRepository.update(
        { type, targetId, status: ReportStatus.PENDING },
        { status: ReportStatus.ESCALATED, priority: 4 },
      );
    }

    // Auto-hide content if critical mass reached (threshold: 10)
    if (reportCount >= 10) {
      await this.autoHideContent(type, targetId);
    }
  }

  private async autoHideContent(type: ReportType, targetId: string) {
    switch (type) {
      case ReportType.POST: {
        const result = await this.postRepository.update(targetId, {
          isPublished: false,
        });
        if (!result.affected) {
          await this.communityPostRepository.update(targetId, {
            status: CommunityPostStatus.SPAM,
            removedAt: new Date(),
          });
        }
        break;
      }
      case ReportType.COMMENT: {
        const result = await this.commentRepository.update(targetId, {
          isDeleted: true,
        });
        if (!result.affected) {
          await this.communityCommentRepository.update(targetId, {
            isDeleted: true,
            removedAt: new Date(),
          });
        }
        break;
      }
      case ReportType.USER:
        // For users, we might want to restrict their actions instead
        await this.userRepository.update(targetId, { isActive: false });
        break;
    }
  }

  private async executeAction(
    report: Report,
    action: ReportAction,
    executorId: string,
    payload?: Record<string, any> | null,
  ) {
    const log = this.reportActionRepository.create({
      reportId: report.id,
      action,
      executorId,
      payload: payload ?? null,
      status: ReportActionLogStatus.PENDING,
    });
    await this.reportActionRepository.save(log);

    try {
      let result: Record<string, any> | undefined;
      switch (action) {
        case ReportAction.CONTENT_REMOVED:
          result = await this.removeContent(report.type, report.targetId);
          break;
        case ReportAction.USER_SUSPENDED:
          result = await this.suspendUser(report, payload);
          break;
        case ReportAction.USER_BANNED:
          result = await this.banUser(report, payload);
          break;
        case ReportAction.USER_RESTORED:
          result = await this.restoreUser(report, payload);
          break;
        case ReportAction.COMMUNITY_LOCKED:
          result = await this.lockCommunityByReport(
            report,
            executorId,
            payload,
          );
          break;
        case ReportAction.COMMUNITY_UNLOCKED:
          result = await this.unlockCommunityByReport(
            report,
            executorId,
            payload,
          );
          break;
        case ReportAction.SNAPSHOT_CAPTURED:
          result = await this.captureSnapshotForReport(
            report,
            executorId,
            payload,
          );
          break;
        case ReportAction.MODERATOR_REMOVED:
          result = await this.removeModeratorForReport(
            report,
            executorId,
            payload,
          );
          break;
        case ReportAction.WARNING_ISSUED:
        case ReportAction.NO_ACTION:
        default:
          result = undefined;
          break;
      }

      log.status = ReportActionLogStatus.SUCCESS;
      log.result = result ?? null;
      await this.reportActionRepository.save(log);
    } catch (error) {
      log.status = ReportActionLogStatus.FAILED;
      log.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.reportActionRepository.save(log);
      throw error;
    }
  }

  private async removeContent(type: ReportType, targetId: string) {
    switch (type) {
      case ReportType.POST: {
        const result = await this.postRepository.update(targetId, {
          isPublished: false,
        });
        if (!result.affected) {
          await this.communityPostRepository.update(targetId, {
            status: CommunityPostStatus.REMOVED,
            removedAt: new Date(),
          });
        }
        break;
      }
      case ReportType.COMMENT: {
        const result = await this.commentRepository.update(targetId, {
          isDeleted: true,
        });
        if (!result.affected) {
          await this.communityCommentRepository.update(targetId, {
            isDeleted: true,
            removedAt: new Date(),
          });
        }
        break;
      }
      case ReportType.USER:
        await this.userRepository.update(targetId, { isActive: false });
        break;
    }

    return { type, targetId };
  }

  private async suspendUser(
    report: Report,
    payload?: Record<string, any> | null,
  ) {
    const userId = await this.resolveReportedUserId(report);

    if (!userId) {
      throw new BadRequestException("대상 사용자를 찾을 수 없습니다.");
    }

    const durationInput = payload?.durationDays ?? payload?.duration ?? 7;
    const durationDays = Math.max(1, parseInt(String(durationInput), 10) || 7);
    const reason =
      payload?.reason || report.description || `Report ${report.id} suspension`;

    const now = new Date();
    const suspensionUntil = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    await this.userRepository.update(userId, {
      isActive: false,
      suspensionUntil,
      suspensionReason: reason,
      isBanned: false,
      banReason: null,
      bannedAt: null,
    });

    return { userId, suspensionUntil, reason };
  }

  private async banUser(report: Report, payload?: Record<string, any> | null) {
    const userId = await this.resolveReportedUserId(report);

    if (!userId) {
      throw new BadRequestException("대상 사용자를 찾을 수 없습니다.");
    }

    const reason =
      payload?.reason || report.description || `Report ${report.id} ban`;

    const bannedAt = new Date();

    await this.userRepository.update(userId, {
      isActive: false,
      isBanned: true,
      banReason: reason,
      bannedAt,
      suspensionUntil: null,
      suspensionReason: null,
    });

    return { userId, reason, bannedAt };
  }

  private async restoreUser(
    report: Report,
    payload?: Record<string, any> | null,
  ) {
    const userId = await this.resolveReportedUserId(report);

    if (!userId) {
      throw new BadRequestException("대상 사용자를 찾을 수 없습니다.");
    }

    const reason =
      payload?.reason ||
      report.description ||
      `Report ${report.id} restoration`;

    await this.userRepository.update(userId, {
      isActive: true,
      isBanned: false,
      banReason: null,
      bannedAt: null,
      suspensionUntil: null,
      suspensionReason: null,
    });

    return { userId, reason };
  }

  private resolveCommunityId(
    report: Report,
    payload?: Record<string, any> | null,
  ): string {
    const communityId = report.communityId || payload?.communityId;
    if (!communityId) {
      throw new BadRequestException(
        "Community context is required for this action",
      );
    }
    return communityId;
  }

  private async lockCommunityByReport(
    report: Report,
    executorId: string,
    payload?: Record<string, any> | null,
  ) {
    const communityId = this.resolveCommunityId(report, payload);
    const reason = payload?.reason || `Report ${report.id} triggered lock`;
    await this.communityService.lockCommunity(communityId, executorId, reason);
    return { communityId, reason };
  }

  private async unlockCommunityByReport(
    report: Report,
    executorId: string,
    payload?: Record<string, any> | null,
  ) {
    const communityId = this.resolveCommunityId(report, payload);
    const reason = payload?.reason || `Report ${report.id} unlock`;
    await this.communityService.unlockCommunity(
      communityId,
      executorId,
      reason,
    );
    return { communityId, reason };
  }

  private async captureSnapshotForReport(
    report: Report,
    executorId: string,
    payload?: Record<string, any> | null,
  ) {
    const communityId = this.resolveCommunityId(report, payload);
    const reason = payload?.reason || `Report ${report.id} snapshot`;
    const metadata = payload?.metadata || undefined;
    const snapshot = await this.communityRecoveryService.captureSnapshot(
      communityId,
      executorId,
      reason,
      metadata,
    );
    return { communityId, snapshotId: snapshot.id };
  }

  private async removeModeratorForReport(
    report: Report,
    executorId: string,
    payload?: Record<string, any> | null,
  ) {
    const communityId = this.resolveCommunityId(report, payload);
    const moderatorUserId =
      report.reportedModeratorId || payload?.moderatorUserId || report.targetId;

    if (!moderatorUserId) {
      throw new BadRequestException(
        "Moderator user ID is required to remove a moderator",
      );
    }

    const reason = payload?.reason || `Report ${report.id} moderator removal`;

    await this.communityMembershipService.forceRemoveModerator(
      communityId,
      moderatorUserId,
      executorId,
      reason,
    );

    return { communityId, moderatorUserId };
  }

  private async getContentOwner(type: ReportType, targetId: string) {
    switch (type) {
      case ReportType.POST: {
        const post = await this.postRepository.findOne({
          where: { id: targetId },
          select: ["authorId"],
        });
        if (post) {
          return post;
        }
        return await this.communityPostRepository.findOne({
          where: { id: targetId },
          select: ["authorId"],
        });
      }
      case ReportType.COMMENT: {
        const comment = await this.commentRepository.findOne({
          where: { id: targetId },
          select: ["authorId"],
        });
        if (comment) {
          return comment;
        }
        return await this.communityCommentRepository.findOne({
          where: { id: targetId },
          select: ["authorId"],
        });
      }
      default:
        return null;
    }
  }

  private async resolveReportedUserId(report: Report): Promise<string | null> {
    if (report.type === ReportType.USER) {
      return report.targetId;
    }

    const content = await this.getContentOwner(report.type, report.targetId);
    return content?.authorId ?? null;
  }

  /**
   * 배치 쿼리로 여러 신고의 타겟 상세 정보를 한 번에 조회 (N+1 문제 해결)
   * 타입별로 그룹화하여 IN 쿼리로 조회
   */
  private async loadBatchTargetDetails(
    reports: Report[],
  ): Promise<Map<string, any>> {
    const targetMap = new Map<string, any>();

    // 타입별로 targetId 분류
    const postIds: string[] = [];
    const commentIds: string[] = [];
    const userIds: string[] = [];

    for (const report of reports) {
      if (report.type === ReportType.POST) {
        postIds.push(report.targetId);
      } else if (report.type === ReportType.COMMENT) {
        commentIds.push(report.targetId);
      } else if (report.type === ReportType.USER) {
        userIds.push(report.targetId);
      }
    }

    // 병렬로 5개 배치 쿼리 실행
    const [
      posts,
      communityPosts,
      comments,
      communityComments,
      users,
    ] = await Promise.all([
      postIds.length > 0
        ? this.postRepository.find({
            where: { id: In(postIds) },
            relations: ["author"],
          })
        : [],
      postIds.length > 0
        ? this.communityPostRepository.find({
            where: { id: In(postIds) },
            relations: ["author", "community"],
          })
        : [],
      commentIds.length > 0
        ? this.commentRepository.find({
            where: { id: In(commentIds) },
            relations: ["author", "post"],
          })
        : [],
      commentIds.length > 0
        ? this.communityCommentRepository.find({
            where: { id: In(commentIds) },
            relations: ["author", "post", "community"],
          })
        : [],
      userIds.length > 0
        ? this.userRepository.find({
            where: { id: In(userIds) },
            select: ["id", "username", "email", "createdAt"],
          })
        : [],
    ]);

    // Map으로 변환 (key: "TYPE:targetId")
    for (const post of posts) {
      targetMap.set(`${ReportType.POST}:${post.id}`, post);
    }
    for (const post of communityPosts) {
      const key = `${ReportType.POST}:${post.id}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, post);
      }
    }
    for (const comment of comments) {
      targetMap.set(`${ReportType.COMMENT}:${comment.id}`, comment);
    }
    for (const comment of communityComments) {
      const key = `${ReportType.COMMENT}:${comment.id}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, comment);
      }
    }
    for (const user of users) {
      targetMap.set(`${ReportType.USER}:${user.id}`, user);
    }

    return targetMap;
  }

  private async loadTargetDetails(report: Report) {
    switch (report.type) {
      case ReportType.POST: {
        const post = await this.postRepository.findOne({
          where: { id: report.targetId },
          relations: ["author"],
        });
        if (post) {
          return post;
        }
        return await this.communityPostRepository.findOne({
          where: { id: report.targetId },
          relations: ["author", "community"],
        });
      }
      case ReportType.COMMENT: {
        const comment = await this.commentRepository.findOne({
          where: { id: report.targetId },
          relations: ["author", "post"],
        });
        if (comment) {
          return comment;
        }
        return await this.communityCommentRepository.findOne({
          where: { id: report.targetId },
          relations: ["author", "post", "community"],
        });
      }
      case ReportType.USER:
        return await this.userRepository.findOne({
          where: { id: report.targetId },
          select: ["id", "username", "email", "createdAt"],
        });
      default:
        return null;
    }
  }

  private parseBrowserInfo(userAgent: string) {
    // Simple browser parsing
    const browsers = {
      Chrome: /Chrome\/(\d+)/,
      Firefox: /Firefox\/(\d+)/,
      Safari: /Safari\/(\d+)/,
      Edge: /Edg\/(\d+)/,
    };

    for (const [browser, regex] of Object.entries(browsers)) {
      const match = userAgent.match(regex);
      if (match) {
        return { browser, version: match[1] };
      }
    }

    return { browser: "Unknown", version: null };
  }

  private async getReportsByType(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder("report")
      .select("report.type", "type")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("report.type")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getReportsByReason(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder("report")
      .select("report.reason", "reason")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("report.reason")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.reason] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getTopReporters(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder("report")
      .select("report.reportedById", "userId")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("report.reportedById")
      .orderBy("COUNT(*)", "DESC")
      .limit(10)
      .getRawMany();

    return result;
  }

  private async getFrequentlyReportedContent(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder("report")
      .select("report.targetId", "targetId")
      .addSelect("report.type", "type")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("report.targetId, report.type")
      .orderBy("COUNT(*)", "DESC")
      .limit(10)
      .getRawMany();

    return result;
  }

  private async getAverageResolutionTime(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder("report")
      .select(
        "AVG(EXTRACT(EPOCH FROM (report.reviewedAt - report.createdAt)))",
        "avg",
      )
      .where({ ...where, status: ReportStatus.RESOLVED })
      .andWhere("report.reviewedAt IS NOT NULL")
      .getRawOne();

    return result?.avg ? Math.round(result.avg / 3600) : null; // Convert to hours
  }
}
