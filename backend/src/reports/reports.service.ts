import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportType, ReportStatus, ReportAction, ReportReason } from './enums/report.enum';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    await this.validateTarget(createReportDto.type, createReportDto.targetId);

    // Check for duplicate reports from same user
    const existingReport = await this.reportRepository.findOne({
      where: {
        type: createReportDto.type,
        targetId: createReportDto.targetId,
        reportedById: userId,
        status: In([ReportStatus.PENDING, ReportStatus.UNDER_REVIEW]),
      },
    });

    if (existingReport) {
      throw new ConflictException('You have already reported this content');
    }

    // Calculate priority based on reason
    const priority = this.calculatePriority(createReportDto.reason);

    const report = this.reportRepository.create({
      ...createReportDto,
      reportedById: userId,
      priority,
      ipAddress,
      userAgent,
      metadata: {
        reportedAt: new Date().toISOString(),
        browserInfo: userAgent ? this.parseBrowserInfo(userAgent) : null,
      },
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
    limit = 20,
  ) {
    const where: FindOptionsWhere<Report> = {};
    
    if (status) where.status = status;
    if (type) where.type = type;

    const [reports, total] = await this.reportRepository.findAndCount({
      where,
      relations: ['reportedBy', 'reviewedBy'],
      order: {
        priority: 'DESC',
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Load target details for each report
    const reportsWithTargets = await Promise.all(
      reports.map(async (report) => {
        const target = await this.loadTargetDetails(report);
        // Map target to specific fields based on type
        const result: any = { ...report };
        if (report.type === ReportType.POST && target) {
          result.post = target;
        } else if (report.type === ReportType.COMMENT && target) {
          result.comment = target;
        } else if (report.type === ReportType.USER && target) {
          result.targetUser = target;
        }
        result.target = target; // Keep for backward compatibility
        return result;
      }),
    );

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
      relations: ['reportedBy', 'reviewedBy'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Check access permission
    if (userId && userRole !== Role.ADMIN && userRole !== Role.MODERATOR) {
      if (report.reportedById !== userId) {
        throw new ForbiddenException('You can only view your own reports');
      }
    }

    const target = await this.loadTargetDetails(report);
    return { ...report, target };
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
      throw new NotFoundException('Report not found');
    }

    // Update report
    Object.assign(report, updateReportDto);
    report.reviewedById = reviewerId;
    report.reviewedAt = new Date();

    const updatedReport = await this.reportRepository.save(report);

    // Execute action if specified
    if (updateReportDto.actionTaken && updateReportDto.actionTaken !== ReportAction.NO_ACTION) {
      await this.executeAction(report, updateReportDto.actionTaken);
    }

    return updatedReport;
  }

  /**
   * Get reports by user
   */
  async findByUser(userId: string, page = 1, limit = 20) {
    const [reports, total] = await this.reportRepository.findAndCount({
      where: { reportedById: userId },
      order: { createdAt: 'DESC' },
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
      this.reportRepository.count({ where: { ...where, status: ReportStatus.PENDING } }),
      this.reportRepository.count({ where: { ...where, status: ReportStatus.RESOLVED } }),
      this.getReportsByType(where),
      this.getReportsByReason(where),
      this.getTopReporters(where),
      this.getFrequentlyReportedContent(where),
    ]);

    const escalatedReports = await this.reportRepository.count({ 
      where: { ...where, status: ReportStatus.ESCALATED } 
    });
    const dismissedReports = await this.reportRepository.count({ 
      where: { ...where, status: ReportStatus.DISMISSED } 
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
      throw new NotFoundException('Some reports not found');
    }

    const updatedReports = await Promise.all(
      reports.map((report) => this.update(report.id, updateDto, reviewerId)),
    );

    return updatedReports;
  }

  // Private helper methods

  private async validateTarget(type: ReportType, targetId: string) {
    let exists = false;

    switch (type) {
      case ReportType.POST:
        exists = await this.postRepository.exist({ where: { id: targetId } });
        break;
      case ReportType.COMMENT:
        exists = await this.commentRepository.exist({ where: { id: targetId } });
        break;
      case ReportType.USER:
        exists = await this.userRepository.exist({ where: { id: targetId } });
        break;
    }

    if (!exists) {
      throw new NotFoundException(`${type} not found`);
    }
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
      case ReportType.POST:
        await this.postRepository.update(targetId, { isPublished: false });
        break;
      case ReportType.COMMENT:
        await this.commentRepository.update(targetId, { isDeleted: true });
        break;
      case ReportType.USER:
        // For users, we might want to restrict their actions instead
        await this.userRepository.update(targetId, { isActive: false });
        break;
    }
  }

  private async executeAction(report: Report, action: ReportAction) {
    switch (action) {
      case ReportAction.CONTENT_REMOVED:
        await this.removeContent(report.type, report.targetId);
        break;
      case ReportAction.USER_SUSPENDED:
        await this.suspendUser(report);
        break;
      case ReportAction.USER_BANNED:
        await this.banUser(report);
        break;
      case ReportAction.WARNING_ISSUED:
        // TODO: Implement warning system
        break;
    }
  }

  private async removeContent(type: ReportType, targetId: string) {
    switch (type) {
      case ReportType.POST:
        await this.postRepository.update(targetId, { isPublished: false });
        break;
      case ReportType.COMMENT:
        await this.commentRepository.update(targetId, { isDeleted: true });
        break;
    }
  }

  private async suspendUser(report: Report) {
    let userId: string;

    if (report.type === ReportType.USER) {
      userId = report.targetId;
    } else {
      // Get user ID from content
      const content = await this.getContentOwner(report.type, report.targetId);
      userId = content?.authorId;
    }

    if (userId) {
      await this.userRepository.update(userId, { isActive: false });
      // TODO: Add suspension end date
    }
  }

  private async banUser(report: Report) {
    let userId: string;

    if (report.type === ReportType.USER) {
      userId = report.targetId;
    } else {
      const content = await this.getContentOwner(report.type, report.targetId);
      userId = content?.authorId;
    }

    if (userId) {
      await this.userRepository.update(userId, { 
        isActive: false,
        // TODO: Add permanent ban flag
      });
    }
  }

  private async getContentOwner(type: ReportType, targetId: string) {
    switch (type) {
      case ReportType.POST:
        return await this.postRepository.findOne({ 
          where: { id: targetId },
          select: ['authorId'],
        });
      case ReportType.COMMENT:
        return await this.commentRepository.findOne({ 
          where: { id: targetId },
          select: ['authorId'],
        });
      default:
        return null;
    }
  }

  private async loadTargetDetails(report: Report) {
    switch (report.type) {
      case ReportType.POST:
        return await this.postRepository.findOne({
          where: { id: report.targetId },
          relations: ['author'],
        });
      case ReportType.COMMENT:
        return await this.commentRepository.findOne({
          where: { id: report.targetId },
          relations: ['author', 'post'],
        });
      case ReportType.USER:
        return await this.userRepository.findOne({
          where: { id: report.targetId },
          select: ['id', 'username', 'email', 'createdAt'],
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

    return { browser: 'Unknown', version: null };
  }

  private async getReportsByType(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('report.type')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getReportsByReason(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('report.reason')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.reason] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getTopReporters(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.reportedById', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('report.reportedById')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return result;
  }

  private async getFrequentlyReportedContent(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.targetId', 'targetId')
      .addSelect('report.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('report.targetId, report.type')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return result;
  }

  private async getAverageResolutionTime(where: FindOptionsWhere<Report>) {
    const result = await this.reportRepository
      .createQueryBuilder('report')
      .select('AVG(EXTRACT(EPOCH FROM (report.reviewedAt - report.createdAt)))', 'avg')
      .where({ ...where, status: ReportStatus.RESOLVED })
      .andWhere('report.reviewedAt IS NOT NULL')
      .getRawOne();

    return result?.avg ? Math.round(result.avg / 3600) : null; // Convert to hours
  }
}