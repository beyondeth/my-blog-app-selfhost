import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  ParseEnumPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminUsersService, UserFilters, UpdateUserDto } from './admin-users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { DataRetentionService } from '../../users/services/data-retention.service';
import { UserDeletionQueueService } from '../../users/services/user-deletion-queue.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailApproval } from '../../email/entities/email-approval.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly dataRetentionService: DataRetentionService,
    private readonly deletionQueueService: UserDeletionQueueService,
    private readonly auditService: AuditService,
    @InjectRepository(EmailApproval)
    private readonly emailApprovalRepository: Repository<EmailApproval>,
  ) {}

  /**
   * Get all users with filters
   */
  @Get()
  async findAll(
    @Query('role') role?: Role,
    @Query('isActive') isActive?: string,
    @Query('isEmailVerified') isEmailVerified?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy?: string,
    @Query('sortOrder', new DefaultValuePipe('DESC')) sortOrder?: 'ASC' | 'DESC',
  ) {
    const filters: UserFilters = {
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isEmailVerified: isEmailVerified === 'true' ? true : isEmailVerified === 'false' ? false : undefined,
      search,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return await this.adminUsersService.findAll(filters, page, limit, sortBy, sortOrder);
  }

  /**
   * Get user statistics
   */
  @Get('statistics')
  async getStatistics() {
    return await this.adminUsersService.getUserStatistics();
  }

  /**
   * Export users data
   */
  @Get('export')
  async exportUsers(
    @Query('format', new DefaultValuePipe('json')) format: 'json' | 'csv',
  ) {
    return await this.adminUsersService.exportUsers(format);
  }

  /**
   * 삭제된 사용자 목록 조회 (관리자 전용)
   * - isDeleted = true인 사용자만 조회
   * - 삭제일, 예정 삭제일, 남은 일수 표시
   *
   * IMPORTANT: @Get(':id')보다 먼저 정의되어야 함
   * - NestJS는 라우트를 위에서 아래로 매칭
   * - 'deleted'가 UUID로 파싱되는 것을 방지
   */
  @Get('deleted')
  async getDeletedUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sortBy', new DefaultValuePipe('deletedAt')) sortBy?: string,
    @Query('sortOrder', new DefaultValuePipe('DESC')) sortOrder?: 'ASC' | 'DESC',
    @Query('search') search?: string,
  ) {
    return await this.adminUsersService.findDeletedUsers(
      page,
      limit,
      sortBy,
      sortOrder,
      search,
    );
  }

  /**
   * Task 21: 이메일 발송 승인 대기 목록 조회
   * - 관리자 승인 대기 중인 이메일 목록 조회
   * - 상태별, 타입별 필터링 지원
   */
  @Get('email-approvals')
  async getEmailApprovals(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    // 쿼리 빌더 생성
    const queryBuilder = this.emailApprovalRepository
      .createQueryBuilder('approval')
      .orderBy('approval.createdAt', 'DESC');

    // 상태별 필터링 (PENDING_APPROVAL, APPROVED, REJECTED)
    if (status) {
      queryBuilder.andWhere('approval.status = :status', { status });
    }

    // 타입별 필터링 (DATA_RETENTION_NOTICE, ACCOUNT_DELETION_NOTICE, DORMANT_ACCOUNT_NOTICE)
    if (type) {
      queryBuilder.andWhere('approval.type = :type', { type });
    }

    // 페이지네이션
    queryBuilder.skip((page - 1) * limit).take(limit);

    // 조회 실행
    const [approvals, total] = await queryBuilder.getManyAndCount();

    return {
      success: true,
      data: approvals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Task 22: 이메일 미리보기
   * - 관리자가 이메일 발송 전 내용 확인
   * - 제목, 본문, 대상 사용자 수, 타입 등 정보 표시
   */
  @Get('email-approvals/:id/preview')
  async previewEmail(@Param('id', ParseUUIDPipe) id: string) {
    // EmailApproval 레코드 조회
    const approval = await this.emailApprovalRepository.findOne({
      where: { id },
    });

    if (!approval) {
      throw new NotFoundException('Email approval record not found');
    }

    return {
      success: true,
      data: {
        id: approval.id,
        type: approval.type,
        subject: approval.subject,
        content: approval.content,
        targetCount: approval.targetCount,
        status: approval.status,
        createdAt: approval.createdAt,
        approvedAt: approval.approvedAt,
        rejectedAt: approval.rejectedAt,
        rejectionReason: approval.rejectionReason,
        // 대상 사용자 ID 목록 (프라이버시 고려하여 일부만 표시)
        sampleTargetUserIds: approval.targetUserIds?.slice(0, 5) || [],
      },
    };
  }

  /**
   * Task 25: 삭제 실패 목록 조회
   */
  @Get('deletion-failures')
  async getDeletionFailures() {
    const metrics = await this.deletionQueueService.getMetrics();

    return {
      dlqSize: metrics.dlqSize,
      totalFailed: metrics.totalFailed,
      queueSize: metrics.queueSize,
      processingCount: metrics.processingCount,
      note: 'Use recoverFromDLQ to retry failed jobs',
    };
  }

  /**
   * 🔒 법적 조회: 삭제된 사용자의 원본 데이터 조회
   *
   * 용도: 형사 수사, 민사 소송, 금융감독 등 법적 요구 시 사용
   * 권한: 관리자 전용 (ADMIN role)
   * 데이터 출처: audit_logs 테이블의 previousData
   *
   * 법적 근거:
   * - 형사소송법 제106조 (법원 영장 시 데이터 제공 의무)
   * - 전자금융거래법 (거래 기록 보관 의무)
   * - 개인정보보호법 제63조 (조사 협조 의무)
   *
   * 주의:
   * - 이 API는 법적 요구가 있을 때만 사용해야 함
   * - 무분별한 사용 시 개인정보보호법 위반 가능
   * - 모든 조회는 감사 로그에 기록됨
   *
   * IMPORTANT: @Get(':id')보다 먼저 정의되어야 함
   * - NestJS는 라우트를 위에서 아래로 매칭
   * - 'legal/user-data/:id'가 ':id'로 매칭되는 것을 방지
   */
  @Get('legal/user-data/:id')
  async getLegalUserData(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    // 1. 삭제된 사용자의 감사 로그 조회
    const auditLogs = await this.auditService.findAll(
      {
        action: AuditAction.USER_DELETED,
        entityType: 'user',
        entityId: userId,
      },
      1,
      10, // 최대 10개 (중복 삭제 이력 대비)
    );

    if (!auditLogs.data || auditLogs.data.length === 0) {
      throw new NotFoundException(
        `User ${userId}에 대한 삭제 이력이 없습니다. ` +
        `삭제되지 않은 사용자이거나, 감사 로그가 없는 경우입니다.`,
      );
    }

    // 2. 가장 최근 삭제 이력 가져오기
    const latestDeletionLog = auditLogs.data[0];

    // 3. 원본 데이터 추출
    const originalData = latestDeletionLog.previousData;

    if (!originalData || Object.keys(originalData).length === 0) {
      throw new BadRequestException(
        `User ${userId}의 원본 데이터가 감사 로그에 저장되지 않았습니다.`,
      );
    }

    // 4. 삭제된 포스트 및 댓글 조회 (법적 요구사항)
    // isDeleted = true인 포스트와 댓글 조회 (soft deleted)
    const [deletedPosts, deletedComments] = await Promise.all([
      this.adminUsersService.getDeletedPostsByUserId(userId),
      this.adminUsersService.getDeletedCommentsByUserId(userId),
    ]);

    // 5. 법적 조회 기록 남기기 (감사 로그)
    await this.auditService.log(
      {
        action: AuditAction.ADMIN_ACCESS_DENIED, // 재사용 (적절한 action이 없어서)
        entityType: 'legal_inquiry',
        entityId: userId,
        metadata: {
          inquiryType: 'deleted_user_data',
          reason: '법적 요구에 따른 삭제된 사용자 원본 데이터 조회',
          deletedAt: latestDeletionLog.newData?.deletedAt,
          scheduledDeletionAt: latestDeletionLog.newData?.scheduledDeletionAt,
          postsCount: deletedPosts.length,
          commentsCount: deletedComments.length,
        },
      },
      {
        userId: req.user.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    );

    // 6. 응답 반환
    return {
      userId,
      status: 'deleted',
      deletedAt: latestDeletionLog.createdAt,
      scheduledDeletionAt: latestDeletionLog.newData?.scheduledDeletionAt,
      originalData: {
        // 개인정보
        email: originalData.email,
        username: originalData.username,
        profileImage: originalData.profileImage,
        bio: originalData.bio,

        // 계정 정보
        authProvider: originalData.authProvider,
        lastLoginProvider: originalData.lastLoginProvider,
        role: originalData.role,
        isEmailVerified: originalData.isEmailVerified,

        // 시간 정보
        createdAt: originalData.createdAt,
        lastLoginAt: originalData.lastLoginAt,

        // 구독 정보
        subscriptionTier: originalData.subscriptionTier,
        subscriptionStatus: originalData.subscriptionStatus,
      },
      // 삭제된 포스트 목록 (법적 조회용)
      deletedPosts: deletedPosts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content, // 법적 증거로 가장 중요
        category: post.category,
        excerpt: post.excerpt,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        publishedAt: post.publishedAt,
      })),
      // 삭제된 댓글 목록 (법적 조회용)
      deletedComments: deletedComments.map(comment => ({
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        likesCount: comment.likesCount,
        createdAt: comment.createdAt,
      })),
      legalNotice: {
        warning: '이 데이터는 법적 요구가 있을 때만 사용되어야 합니다',
        purpose: '형사 수사, 민사 소송, 금융감독 등',
        retention: `${latestDeletionLog.metadata?.retentionDays || 180}일 후 완전 삭제 예정`,
        inquiredBy: req.user.email,
        inquiredAt: new Date().toISOString(),
        postsCount: deletedPosts.length,
        commentsCount: deletedComments.length,
      },
    };
  }

  /**
   * Get user details
   *
   * IMPORTANT: 동적 파라미터 라우트는 특정 경로 라우트 뒤에 정의
   * - 'deleted', 'email-approvals', 'deletion-failures', 'legal/user-data/:id' 등 특정 경로가 먼저 매칭되도록
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.adminUsersService.findOne(id);
  }

  /**
   * Task 23: 이메일 발송 승인
   */
  @Post('email-approvals/:id/approve')
  async approveEmail(@Param('id', ParseUUIDPipe) id: string) {
    await this.dataRetentionService.approveEmailSending(id);

    return {
      success: true,
      message: 'Email sending approved successfully',
      approvalId: id,
    };
  }

  /**
   * Task 23: 이메일 발송 거부
   */
  @Post('email-approvals/:id/reject')
  async rejectEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    await this.dataRetentionService.rejectEmailSending(id, reason);

    return {
      success: true,
      message: 'Email sending rejected',
      approvalId: id,
    };
  }

  /**
   * Task 25: 삭제 실패 작업 재시도
   */
  @Post('deletion-failures/retry')
  async retryDeletionFailures(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    const recoveredJobs = await this.deletionQueueService.recoverFromDLQ(limit);

    return {
      success: true,
      message: `${recoveredJobs.length} jobs recovered from DLQ`,
      recoveredCount: recoveredJobs.length,
      jobs: recoveredJobs,
    };
  }

  /**
   * Update user
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserDto,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.update(id, updateDto, req.user.id, context);
  }

  /**
   * Suspend user
   */
  @Post(':id/suspend')
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('duration', ParseIntPipe) duration: number,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.suspend(id, duration, reason, req.user.id, context);
  }

  /**
   * Ban user
   */
  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.ban(id, reason, req.user.id, context);
  }

  /**
   * Activate user
   */
  @Post(':id/activate')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.activate(id, req.user.id, context);
  }

  /**
   * Delete user
   */
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.delete(id, req.user.id, context);
  }

  /**
   * 사용자 즉시 영구 삭제 (관리자 전용)
   * - DB에서 완전히 제거
   * - CASCADE로 관련 데이터 모두 삭제
   * - 복구 불가능 (주의!)
   */
  @Delete(':id/permanent')
  async permanentDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.permanentDeleteUser(
      id,
      req.user.id,
      context,
    );
  }
}