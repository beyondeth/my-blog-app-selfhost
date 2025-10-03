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

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly dataRetentionService: DataRetentionService,
    private readonly deletionQueueService: UserDeletionQueueService,
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
   * Get user details
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.adminUsersService.findOne(id);
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
}