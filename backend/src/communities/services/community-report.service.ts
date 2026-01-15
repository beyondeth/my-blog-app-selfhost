import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CommunityReport,
  CommunityRemovalReason,
  CommunityPost,
  CommunityComment,
  CommunityModLog,
  CommunityRule,
} from "../entities";
import {
  ReportReason,
  ReportTargetType,
  ReportStatus,
  ModAction,
  CommunityPostStatus,
} from "../enums";
import {
  ReportPostDto,
  ReportCommentDto,
  HandleReportDto,
  GetReportsQueryDto,
  CreateRemovalReasonDto,
  UpdateRemovalReasonDto,
} from "../dto";
import { PaginationHelper } from "../../common/dto/pagination.dto";

/**
 * 커뮤니티 신고 서비스
 *
 * @description 게시물/댓글 신고 및 삭제 사유 관리
 *
 * **설계 원칙:**
 * - 신고는 중복 제출 방지 (동일 사용자가 동일 콘텐츠 재신고 불가)
 * - 에스컬레이션: 커뮤니티 모더레이터 → 사이트 관리자
 * - 삭제 사유 템플릿: 커뮤니티별로 관리
 */
@Injectable()
export class CommunityReportService {
  private readonly logger = new Logger(CommunityReportService.name);

  constructor(
    @InjectRepository(CommunityReport)
    private readonly reportRepository: Repository<CommunityReport>,
    @InjectRepository(CommunityRemovalReason)
    private readonly removalReasonRepository: Repository<CommunityRemovalReason>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityComment)
    private readonly commentRepository: Repository<CommunityComment>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    @InjectRepository(CommunityRule)
    private readonly ruleRepository: Repository<CommunityRule>,
  ) {}

  // =========================================================================
  // 신고 생성
  // =========================================================================

  /**
   * 게시물 신고 생성
   */
  async reportPost(
    communityId: string,
    postId: string,
    dto: ReportPostDto,
    reporterId: string,
  ): Promise<CommunityReport> {
    // 게시물 존재 확인
    const post = await this.postRepository.findOne({
      where: { id: postId, communityId },
    });

    if (!post) {
      throw new NotFoundException("게시물을 찾을 수 없습니다");
    }

    // 자신의 게시물 신고 방지
    if (post.authorId === reporterId) {
      throw new BadRequestException("자신의 게시물은 신고할 수 없습니다");
    }

    // 중복 신고 확인
    const existingReport = await this.reportRepository.findOne({
      where: {
        communityId,
        reporterId,
        targetType: ReportTargetType.POST,
        targetPostId: postId,
      },
    });

    if (existingReport) {
      throw new ConflictException("이미 신고한 게시물입니다");
    }

    // 규칙 위반 신고 시 규칙 존재 확인
    if (dto.reason === ReportReason.RULE_VIOLATION && dto.violatedRuleId) {
      const rule = await this.ruleRepository.findOne({
        where: { id: dto.violatedRuleId, communityId },
      });
      if (!rule) {
        throw new BadRequestException("존재하지 않는 규칙입니다");
      }
    }

    // 신고 생성
    const report = this.reportRepository.create({
      communityId,
      reporterId,
      targetType: ReportTargetType.POST,
      targetPostId: postId,
      reason: dto.reason,
      violatedRuleId: dto.violatedRuleId,
      description: dto.description,
      status: ReportStatus.PENDING,
    });

    const savedReport = await this.reportRepository.save(report);
    this.logger.log(`Post reported: ${postId} by ${reporterId}`);

    return savedReport;
  }

  /**
   * 댓글 신고 생성
   */
  async reportComment(
    communityId: string,
    commentId: string,
    dto: ReportCommentDto,
    reporterId: string,
  ): Promise<CommunityReport> {
    // 댓글 존재 확인
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment || comment.communityId !== communityId) {
      throw new NotFoundException("댓글을 찾을 수 없습니다");
    }

    // 자신의 댓글 신고 방지
    if (comment.authorId === reporterId) {
      throw new BadRequestException("자신의 댓글은 신고할 수 없습니다");
    }

    // 중복 신고 확인
    const existingReport = await this.reportRepository.findOne({
      where: {
        communityId,
        reporterId,
        targetType: ReportTargetType.COMMENT,
        targetCommentId: commentId,
      },
    });

    if (existingReport) {
      throw new ConflictException("이미 신고한 댓글입니다");
    }

    // 규칙 위반 신고 시 규칙 존재 확인
    if (dto.reason === ReportReason.RULE_VIOLATION && dto.violatedRuleId) {
      const rule = await this.ruleRepository.findOne({
        where: { id: dto.violatedRuleId, communityId },
      });
      if (!rule) {
        throw new BadRequestException("존재하지 않는 규칙입니다");
      }
    }

    // 신고 생성
    const report = this.reportRepository.create({
      communityId,
      reporterId,
      targetType: ReportTargetType.COMMENT,
      targetCommentId: commentId,
      reason: dto.reason,
      violatedRuleId: dto.violatedRuleId,
      description: dto.description,
      status: ReportStatus.PENDING,
    });

    const savedReport = await this.reportRepository.save(report);
    this.logger.log(`Comment reported: ${commentId} by ${reporterId}`);

    return savedReport;
  }

  // =========================================================================
  // 신고 조회
  // =========================================================================

  /**
   * 커뮤니티 신고 목록 조회 (모더레이터용)
   */
  async getReports(communityId: string, query: GetReportsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.reportRepository
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.reporter", "reporter")
      .leftJoinAndSelect("reporter.profile", "reporterProfile")
      .leftJoinAndSelect("report.targetPost", "targetPost")
      .leftJoinAndSelect("targetPost.author", "postAuthor")
      .leftJoinAndSelect("report.targetComment", "targetComment")
      .leftJoinAndSelect("targetComment.author", "commentAuthor")
      .leftJoinAndSelect("report.resolvedBy", "resolvedBy")
      .where("report.communityId = :communityId", { communityId })
      .orderBy("report.createdAt", "DESC");

    // 상태 필터
    if (query.status) {
      qb.andWhere("report.status = :status", { status: query.status });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
   * 에스컬레이션된 신고 목록 조회 (사이트 관리자용)
   */
  async getEscalatedReports(query: GetReportsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.reportRepository
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.community", "community")
      .leftJoinAndSelect("report.reporter", "reporter")
      .leftJoinAndSelect("reporter.profile", "reporterProfile")
      .leftJoinAndSelect("report.targetPost", "targetPost")
      .leftJoinAndSelect("targetPost.author", "postAuthor")
      .leftJoinAndSelect("report.targetComment", "targetComment")
      .leftJoinAndSelect("targetComment.author", "commentAuthor")
      .leftJoinAndSelect("report.escalatedBy", "escalatedBy")
      .where("report.isEscalated = :isEscalated", { isEscalated: true })
      .orderBy("report.escalatedAt", "DESC");

    // 상태 필터 (에스컬레이션된 것 중에서 처리된 것 vs 미처리)
    if (query.status) {
      qb.andWhere("report.status = :status", { status: query.status });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
   * 단일 신고 조회
   */
  async getReport(communityId: string, reportId: string) {
    const report = await this.reportRepository.findOne({
      where: { id: reportId, communityId },
      relations: [
        "reporter",
        "reporter.profile",
        "targetPost",
        "targetPost.author",
        "targetComment",
        "targetComment.author",
        "resolvedBy",
        "escalatedBy",
      ],
    });

    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다");
    }

    return report;
  }

  // =========================================================================
  // 신고 처리
  // =========================================================================

  /**
   * 신고 처리 (resolve/dismiss)
   */
  async handleReport(
    communityId: string,
    reportId: string,
    dto: HandleReportDto,
    moderatorId: string,
  ): Promise<CommunityReport> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId, communityId },
    });

    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다");
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException("이미 처리된 신고입니다");
    }

    // 상태 업데이트
    report.status = dto.status;
    report.moderatorNote = dto.moderatorNote;
    report.resolvedById = moderatorId;
    report.resolvedAt = new Date();

    // 에스컬레이션 처리
    if (dto.status === ReportStatus.ESCALATED) {
      report.isEscalated = true;
      report.escalatedAt = new Date();
      report.escalatedById = moderatorId;
    }

    const savedReport = await this.reportRepository.save(report);

    // 모더레이션 로그 기록
    const action =
      dto.status === ReportStatus.RESOLVED
        ? ModAction.RESOLVE_REPORT
        : dto.status === ReportStatus.DISMISSED
          ? ModAction.DISMISS_REPORT
          : ModAction.ESCALATE_REPORT;

    await this.modLogRepository.save({
      communityId,
      moderatorId,
      action,
      targetPostId: report.targetPostId,
      reason: dto.moderatorNote,
      metadata: {
        reportId,
        status: dto.status,
        targetType: report.targetType,
        targetCommentId: report.targetCommentId,
      },
    });

    this.logger.log(
      `Report ${reportId} handled: ${dto.status} by ${moderatorId}`,
    );

    return savedReport;
  }

  /**
   * 에스컬레이션된 신고 처리 (사이트 관리자용)
   */
  async handleEscalatedReport(
    reportId: string,
    dto: HandleReportDto,
    adminId: string,
  ): Promise<CommunityReport> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId, isEscalated: true },
    });

    if (!report) {
      throw new NotFoundException("에스컬레이션된 신고를 찾을 수 없습니다");
    }

    if (
      report.status !== ReportStatus.PENDING &&
      report.status !== ReportStatus.ESCALATED
    ) {
      throw new BadRequestException("이미 최종 처리된 신고입니다");
    }

    // 상태 업데이트
    report.status = dto.status;
    report.moderatorNote = dto.moderatorNote;
    report.resolvedById = adminId;
    report.resolvedAt = new Date();

    const savedReport = await this.reportRepository.save(report);

    // 모더레이션 로그 기록
    const action =
      dto.status === ReportStatus.RESOLVED
        ? ModAction.RESOLVE_REPORT
        : ModAction.DISMISS_REPORT;

    await this.modLogRepository.save({
      communityId: report.communityId,
      moderatorId: adminId,
      action,
      targetPostId: report.targetPostId,
      reason: `[사이트 관리자] ${dto.moderatorNote || ""}`,
      metadata: {
        reportId,
        status: dto.status,
        targetType: report.targetType,
        targetCommentId: report.targetCommentId,
        isEscalatedResolution: true,
      },
    });

    this.logger.log(
      `Escalated report ${reportId} handled: ${dto.status} by admin ${adminId}`,
    );

    return savedReport;
  }

  // =========================================================================
  // 삭제 사유 관리
  // =========================================================================

  /**
   * 삭제 사유 목록 조회
   */
  async getRemovalReasons(communityId: string) {
    return this.removalReasonRepository.find({
      where: { communityId },
      order: { displayOrder: "ASC" },
    });
  }

  /**
   * 삭제 사유 생성
   */
  async createRemovalReason(
    communityId: string,
    dto: CreateRemovalReasonDto,
  ): Promise<CommunityRemovalReason> {
    const reason = this.removalReasonRepository.create({
      communityId,
      ...dto,
    });

    return this.removalReasonRepository.save(reason);
  }

  /**
   * 삭제 사유 수정
   */
  async updateRemovalReason(
    communityId: string,
    reasonId: string,
    dto: UpdateRemovalReasonDto,
  ): Promise<CommunityRemovalReason> {
    const reason = await this.removalReasonRepository.findOne({
      where: { id: reasonId, communityId },
    });

    if (!reason) {
      throw new NotFoundException("삭제 사유를 찾을 수 없습니다");
    }

    Object.assign(reason, dto);
    return this.removalReasonRepository.save(reason);
  }

  /**
   * 삭제 사유 삭제
   */
  async deleteRemovalReason(
    communityId: string,
    reasonId: string,
  ): Promise<void> {
    const reason = await this.removalReasonRepository.findOne({
      where: { id: reasonId, communityId },
    });

    if (!reason) {
      throw new NotFoundException("삭제 사유를 찾을 수 없습니다");
    }

    await this.removalReasonRepository.remove(reason);
  }

  // =========================================================================
  // 모드 큐 (Mod Queue)
  // =========================================================================

  /**
   * 모드 큐 조회 (신고/스팸/삭제된 콘텐츠)
   */
  async getModQueue(
    communityId: string,
    type: "reports" | "spam" | "removed",
    page: number = 1,
    limit: number = 20,
  ) {
    if (type === "reports") {
      // 대기 중인 신고 목록
      return this.getReports(communityId, {
        status: ReportStatus.PENDING,
        page,
        limit,
      });
    }

    if (type === "spam") {
      // 스팸 표시된 게시물
      const [items, total] = await this.postRepository.findAndCount({
        where: { communityId, status: CommunityPostStatus.SPAM },
        relations: ["author", "author.profile"],
        order: { updatedAt: "DESC" },
        skip: (page - 1) * limit,
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

    if (type === "removed") {
      // 삭제된 게시물
      const [items, total] = await this.postRepository.findAndCount({
        where: { communityId, status: CommunityPostStatus.REMOVED },
        relations: ["author", "author.profile", "removedBy"],
        order: { removedAt: "DESC" },
        skip: (page - 1) * limit,
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

    throw new BadRequestException("유효하지 않은 모드 큐 타입입니다");
  }
}
