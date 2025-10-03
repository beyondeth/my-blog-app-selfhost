import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { User } from '../entities/user.entity';
import { EmailApproval } from '../../email/entities/email-approval.entity';

/**
 * 개인정보 보유기간 관리 서비스
 * - 법적 요구사항: 개인정보보호법 제21조 (보유기간 만료 시 파기)
 * - 보유기간 만료 대상자 자동 조회
 * - 관리자 승인 후 일괄 이메일 발송
 * - 만료 데이터 자동 삭제 (30일/3년/5년)
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmailApproval)
    private readonly emailApprovalRepository: Repository<EmailApproval>,
  ) {}

  /**
   * Cron: 매일 오전 9시에 보유기간 만료 대상자 체크
   * - 마지막 활동일 기준 1년 이상 비활성 사용자
   * - 보유기간 만료 30일 전 사용자에게 알림
   */
  @Cron('0 9 * * *', {
    name: 'check-retention-expiry',
    timeZone: 'Asia/Seoul',
  })
  async checkRetentionExpiry(): Promise<void> {
    this.logger.log('Starting retention expiry check...');

    try {
      // 1. 보유기간 만료 30일 전 대상자 조회
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const usersNearingExpiry = await this.userRepository
        .createQueryBuilder('user')
        .where('user.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere('user.isActive = :isActive', { isActive: true })
        .andWhere('user.lastLoginAt < :oneYearAgo', {
          oneYearAgo: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        })
        .andWhere(
          '(user.dataRetentionNotifiedAt IS NULL OR user.dataRetentionNotifiedAt < :thirtyDaysAgo)',
          {
            thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        )
        .select(['user.id', 'user.email', 'user.username', 'user.lastLoginAt'])
        .getMany();

      if (usersNearingExpiry.length === 0) {
        this.logger.log('No users nearing retention expiry');
        return;
      }

      this.logger.log(
        `Found ${usersNearingExpiry.length} users nearing retention expiry`,
      );

      // 2. 관리자 승인 대기 레코드 생성
      await this.createEmailApprovalRecord(
        'DATA_RETENTION_NOTICE',
        usersNearingExpiry,
      );

      this.logger.log('Retention expiry check completed');
    } catch (error) {
      this.logger.error('Failed to check retention expiry:', error);
    }
  }

  /**
   * 관리자 승인 대기 레코드 생성
   * - 대량 이메일 발송 전 관리자 승인 필요
   * - 법적 요구사항: 개인정보 파기 전 사용자 통지 의무
   */
  async createEmailApprovalRecord(
    type: string,
    users: User[],
  ): Promise<EmailApproval> {
    const userIds = users.map((u) => u.id);

    // 기존 대기 중인 승인 건이 있는지 확인
    const existingApproval = await this.emailApprovalRepository.findOne({
      where: {
        type,
        status: 'PENDING_APPROVAL',
      },
    });

    if (existingApproval) {
      // 기존 승인 건이 있으면 업데이트
      existingApproval.targetCount = users.length;
      existingApproval.targetUserIds = userIds;
      existingApproval.updatedAt = new Date();

      await this.emailApprovalRepository.save(existingApproval);
      this.logger.log(
        `Updated existing email approval: ${existingApproval.id}`,
      );

      return existingApproval;
    }

    // 새로운 승인 레코드 생성
    const approval = this.emailApprovalRepository.create({
      type,
      subject: this.getEmailSubject(type),
      content: this.getEmailContent(type),
      targetCount: users.length,
      targetUserIds: userIds,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
    });

    await this.emailApprovalRepository.save(approval);
    this.logger.log(`Created email approval record: ${approval.id}`);

    return approval;
  }

  /**
   * 이메일 제목 생성
   */
  private getEmailSubject(type: string): string {
    const subjects = {
      DATA_RETENTION_NOTICE:
        '[중요] 개인정보 보유기간 만료 예정 안내',
      ACCOUNT_DELETION_NOTICE: '[안내] 계정 삭제 완료 안내',
      DORMANT_ACCOUNT_NOTICE: '[안내] 휴면 계정 전환 안내',
    };

    return subjects[type] || '안내 메일';
  }

  /**
   * 이메일 내용 생성
   */
  private getEmailContent(type: string): string {
    if (type === 'DATA_RETENTION_NOTICE') {
      return `
안녕하세요, DevLog입니다.

귀하의 계정이 1년 이상 사용되지 않아 개인정보 보유기간이 곧 만료됩니다.

【개인정보 보유기간 만료 안내】
- 마지막 로그인: {{lastLoginAt}}
- 보유기간 만료일: {{expiryDate}}
- 파기 대상 정보: 이메일, 사용자명, 프로필 이미지, 게시물, 댓글 등

【조치가 필요한 경우】
계정을 계속 사용하시려면 만료일 전까지 로그인해주세요.
로그인 시 보유기간이 자동으로 연장됩니다.

【법적 근거】
개인정보보호법 제21조에 따라 보유기간이 경과한 개인정보는 파기됩니다.

문의사항이 있으시면 고객센터로 연락 주시기 바랍니다.

감사합니다.
DevLog 드림
      `;
    }

    return '안내 메일 내용';
  }

  /**
   * Cron: 매일 자정에 만료 데이터 자동 삭제
   * - 메시지: 30일 경과 (senderDeletedAt 기준)
   * - 개인정보: 3년 경과 (scheduledDeletionAt 기준)
   * - 결제 기록: 5년 경과 (scheduledDeletionAt 기준)
   */
  @Cron('0 0 * * *', {
    name: 'delete-expired-data',
    timeZone: 'Asia/Seoul',
  })
  async deleteExpiredData(): Promise<void> {
    this.logger.log('Starting expired data deletion...');

    try {
      const now = new Date();

      // 1. 메시지 자동 삭제 (발신자 삭제 후 30일 경과)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedMessagesResult = await this.userRepository.query(
        `
        DELETE FROM messages
        WHERE "senderDeletedAt" IS NOT NULL
        AND "senderDeletedAt" < $1
      `,
        [thirtyDaysAgo],
      );

      const deletedMessagesCount = deletedMessagesResult[1] || 0;
      this.logger.log(`Deleted ${deletedMessagesCount} expired messages`);

      // 2. 사용자 완전 삭제 (scheduledDeletionAt 도래)
      const usersToDelete = await this.userRepository.find({
        where: {
          isDeleted: true,
          scheduledDeletionAt: LessThan(now),
        },
        select: ['id', 'email', 'scheduledDeletionAt'],
      });

      if (usersToDelete.length > 0) {
        this.logger.log(
          `Found ${usersToDelete.length} users scheduled for permanent deletion`,
        );

        for (const user of usersToDelete) {
          try {
            // 사용자 완전 삭제 (CASCADE로 관련 데이터 자동 삭제)
            await this.userRepository.delete(user.id);
            this.logger.log(
              `Permanently deleted user ${user.id} (scheduled at ${user.scheduledDeletionAt})`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to delete user ${user.id}:`,
              error,
            );
          }
        }
      } else {
        this.logger.log('No users scheduled for permanent deletion');
      }

      this.logger.log('Expired data deletion completed');
    } catch (error) {
      this.logger.error('Failed to delete expired data:', error);
    }
  }

  /**
   * 관리자용: 이메일 발송 승인 처리
   */
  async approveEmailSending(approvalId: string): Promise<void> {
    const approval = await this.emailApprovalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error('Approval record not found');
    }

    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error('Approval already processed');
    }

    // 상태 변경 (실제 이메일 발송은 별도 서비스에서 처리)
    approval.status = 'APPROVED';
    approval.approvedAt = new Date();

    await this.emailApprovalRepository.save(approval);
    this.logger.log(`Email sending approved: ${approvalId}`);

    // TODO: 실제 이메일 발송 큐에 추가
    // await this.emailQueueService.addBulkEmailJob(approval);
  }

  /**
   * 관리자용: 이메일 발송 거부 처리
   */
  async rejectEmailSending(
    approvalId: string,
    reason: string,
  ): Promise<void> {
    const approval = await this.emailApprovalRepository.findOne({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error('Approval record not found');
    }

    if (approval.status !== 'PENDING_APPROVAL') {
      throw new Error('Approval already processed');
    }

    approval.status = 'REJECTED';
    approval.rejectedAt = new Date();
    approval.rejectionReason = reason;

    await this.emailApprovalRepository.save(approval);
    this.logger.log(`Email sending rejected: ${approvalId}`);
  }
}
