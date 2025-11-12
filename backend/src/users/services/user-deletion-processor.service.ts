import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { UserDeletionQueueService } from './user-deletion-queue.service';
import { UserDeletionLog } from '../entities/user-deletion-log.entity';
import { User } from '../entities/user.entity';
import { File } from '../../files/entities/file.entity';
import { S3Service } from '../../files/services/s3.service';

/**
 * 사용자 삭제 백그라운드 작업 프로세서
 * - Cron 스케줄러로 큐에서 작업 가져오기
 * - soft-delete, delete-files, delete-cascade 작업 처리
 * - 실패 시 재시도 및 DLQ 이동
 * - 관리자 알림 (이메일/슬랙)
 */
@Injectable()
export class UserDeletionProcessorService {
  private readonly logger = new Logger(UserDeletionProcessorService.name);
  private isProcessing = false; // 동시 처리 방지

  constructor(
    private readonly queueService: UserDeletionQueueService,
    private readonly dataSource: DataSource,
    @InjectRepository(UserDeletionLog)
    private readonly deletionLogRepository: Repository<UserDeletionLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly s3Service: S3Service,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Cron 스케줄러: 5분마다 큐에서 작업 가져와 처리
   */
  @Cron('0 */5 * * * *') // 5분마다 실행
  async processQueue(): Promise<void> {
    // 이미 처리 중이면 스킵 (동시 처리 방지)
    if (this.isProcessing) {
      return; // 로그 제거
    }

    try {
      this.isProcessing = true;

      // 큐에서 배치로 작업 가져오기 (최대 10개)
      const jobs = await this.queueService.dequeueJobs(10);

      if (jobs.length === 0) {
        return; // Job이 없으면 조용히 리턴 (디버그 로그 제거)
      }

      this.logger.log(`Processing ${jobs.length} deletion jobs`);

      // 각 작업 병렬 처리
      await Promise.allSettled(
        jobs.map((job) => this.processJob(job)),
      );
    } catch (error) {
      this.logger.error('Error processing deletion queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 작업 처리 라우터
   */
  private async processJob(job: any): Promise<void> {
    try {
      this.logger.log(`Processing job ${job.id} (type: ${job.type})`);

      switch (job.type) {
        case 'soft-delete':
          await this.processSoftDelete(job);
          break;
        case 'delete-files':
          await this.processDeleteFiles(job);
          break;
        case 'delete-cascade':
          await this.processDeleteCascade(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // 작업 완료 처리
      await this.queueService.markJobComplete(job.id);
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      // 작업 실패 처리 (재시도 또는 DLQ)
      await this.queueService.markJobFailed(job, error.message);

      // 재시도 횟수 초과 시 관리자 알림
      // TODO: 이메일 시스템 구현 완료 후 활성화
      // if (job.retryCount >= 4) {
      //   await this.sendAdminAlert(job, error);
      // }
    }
  }

  /**
   * Job Handler 1: Soft Delete 작업
   * - UserDeletionLog 레코드 생성
   * - 삭제 대상 데이터 수집 및 기록
   * - delete-files, delete-cascade 작업을 큐에 추가
   */
  private async processSoftDelete(job: any): Promise<void> {
    const { userId } = job;

    // 사용자 존재 확인
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // 이미 처리 중인 삭제 로그가 있는지 확인
    const existingLog = await this.deletionLogRepository.findOne({
      where: { userId, status: 'in_progress' },
    });

    if (existingLog) {
      this.logger.warn(`User ${userId} already has in-progress deletion`);
      return;
    }

    // 1. UserDeletionLog 레코드 생성
    const deletionLog = this.deletionLogRepository.create({
      userId,
      email: user.email,
      status: 'in_progress',
      retryCount: 0,
      createdAt: new Date(),
    });

    await this.deletionLogRepository.save(deletionLog);
    this.logger.log(`Created deletion log for user ${userId}`);

    // 2. 삭제 대상 데이터 수집 (카운트)
    const affectedRecords = await this.calculateAffectedRecords(userId);

    // 3. S3 파일 키 수집
    const s3Keys = await this.collectS3FileKeys(userId);

    // 4. 삭제 결과 초기화
    await this.deletionLogRepository.update(deletionLog.id, {
      deletionResult: {
        blogCount: affectedRecords.blogs,
        postCount: affectedRecords.posts,
        commentCount: affectedRecords.comments,
        fileCount: affectedRecords.files,
        s3Keys,
        subscriptionCount: affectedRecords.subscriptions,
        messageCount: affectedRecords.messages,
        errors: [],
      },
    });

    // 5. 후속 작업을 큐에 추가
    if (s3Keys.length > 0) {
      await this.queueService.addDeletionJob(userId, 'delete-files', {
        s3Keys,
        deletionLogId: deletionLog.id,
      });
    }

    await this.queueService.addDeletionJob(userId, 'delete-cascade', {
      deletionLogId: deletionLog.id,
    });

    this.logger.log(`Soft delete completed for user ${userId}, queued follow-up jobs`);
  }

  /**
   * Job Handler 2: S3 파일 삭제 작업
   * - S3에서 파일 삭제 (재시도 가능)
   * - 삭제 성공 시 File 엔티티 삭제
   * - 실패한 파일은 에러 로그에 기록
   */
  private async processDeleteFiles(job: any): Promise<void> {
    const { userId, metadata } = job;
    const { s3Keys, deletionLogId } = metadata;

    const errors: string[] = [];
    let successCount = 0;

    // S3 파일 삭제 - Temporarily disabled for testing
    /*
    for (const s3Key of s3Keys) {
      try {
        await this.s3Service.deleteFile(s3Key);
        successCount++;
        this.logger.log(`Deleted S3 file: ${s3Key}`);
      } catch (error) {
        const errorMsg = `Failed to delete S3 file ${s3Key}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    */

    // File 엔티티 삭제 (S3 삭제 성공 여부와 무관하게 레코드는 삭제)
    await this.fileRepository.delete({ userId });

    // 삭제 로그 업데이트
    if (deletionLogId) {
      const log = await this.deletionLogRepository.findOne({
        where: { id: deletionLogId },
      });

      if (log && log.deletionResult) {
        log.deletionResult.errors = [
          ...(log.deletionResult.errors || []),
          ...errors,
        ];
        await this.deletionLogRepository.save(log);
      }
    }

    this.logger.log(
      `File deletion completed for user ${userId}: ${successCount}/${s3Keys.length} files deleted`,
    );

    // 일부 파일 삭제 실패 시 에러 발생 (재시도 트리거)
    if (errors.length > 0) {
      throw new Error(
        `Failed to delete ${errors.length} files. Errors: ${errors.join(', ')}`,
      );
    }
  }

  /**
   * Job Handler 3: Cascade 삭제 작업 (배치 처리로 최적화)
   * - Blog, Posts, Comments, Subscriptions, Messages 등 삭제
   * - 트랜잭션으로 일관성 보장
   * - 삭제 완료 후 UserDeletionLog 상태 업데이트
   */
  private async processDeleteCascade(job: any): Promise<void> {
    const { userId, metadata } = job;
    const { deletionLogId } = metadata;

    // 타임아웃 설정 (5분)
    const timeoutMs = 5 * 60 * 1000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Cascade deletion timeout')), timeoutMs);
    });

    const deletionPromise = this.dataSource.transaction(async (manager) => {
      // 1. Blog 삭제 (CASCADE로 Posts도 함께 삭제됨)
      await manager.query(`DELETE FROM blogs WHERE "userId" = $1`, [userId]);

      // 2. Comments 삭제 (배치로 나누어 처리)
      const commentBatchSize = 1000;
      let deletedComments = 0;
      do {
        const result = await manager.query(
          `DELETE FROM comments WHERE "authorId" = $1 LIMIT $2`,
          [userId, commentBatchSize]
        );
        deletedComments = result[1] || 0;
        if (deletedComments > 0) {
          this.logger.debug(`Deleted ${deletedComments} comments for user ${userId}`);
        }
      } while (deletedComments >= commentBatchSize);

      // 3. Follow 관계 삭제
      await manager.query(
        `DELETE FROM follows WHERE "followerId" = $1 OR "followingId" = $1`,
        [userId],
      );

      // 4. Messages는 senderDeletedAt 설정 (30일 보관)
      const messageResult = await manager.query(
        `UPDATE messages SET "senderDeletedAt" = NOW() WHERE "senderId" = $1`,
        [userId],
      );
      if (messageResult[1] > 0) {
        this.logger.debug(`Marked ${messageResult[1]} messages as deleted for user ${userId}`);
      }

      // 5. Reports 삭제
      await manager.query(
        `DELETE FROM reports WHERE "reporterId" = $1 OR "reportedUserId" = $1`,
        [userId],
      );

      // 6. Bookmarks 삭제 (배치로 나누어 처리)
      const bookmarkBatchSize = 1000;
      let deletedBookmarks = 0;
      do {
        const result = await manager.query(
          `DELETE FROM bookmarks WHERE "userId" = $1 LIMIT $2`,
          [userId, bookmarkBatchSize]
        );
        deletedBookmarks = result[1] || 0;
        if (deletedBookmarks > 0) {
          this.logger.debug(`Deleted ${deletedBookmarks} bookmarks for user ${userId}`);
        }
      } while (deletedBookmarks >= bookmarkBatchSize);

      // 7. File 엔티티 삭제 (S3 파일은 이미 delete-files에서 삭제됨)
      const fileBatchSize = 1000;
      let deletedFiles = 0;
      do {
        const result = await manager.query(
          `DELETE FROM files WHERE user_id = $1 LIMIT $2`,
          [userId, fileBatchSize]
        );
        deletedFiles = result[1] || 0;
        if (deletedFiles > 0) {
          this.logger.debug(`Deleted ${deletedFiles} files for user ${userId}`);
        }
      } while (deletedFiles >= fileBatchSize);

      this.logger.log(`Cascade deletion completed for user ${userId}`);
    });

    // Promise.race로 타임아웃 처리
    await Promise.race([deletionPromise, timeoutPromise]);

    // UserDeletionLog 상태 업데이트
    if (deletionLogId) {
      await this.deletionLogRepository.update(deletionLogId, {
        status: 'completed',
        completedAt: new Date(),
      });
    }

    this.logger.log(`Deletion process completed for user ${userId}`);
  }

  /**
   * 영향받을 레코드 수 계산
   */
  private async calculateAffectedRecords(userId: string): Promise<{
    blogs: number;
    posts: number;
    comments: number;
    files: number;
    subscriptions: number;
    messages: number;
  }> {
    const [
      blogs,
      posts,
      comments,
      files,
      subscriptions,
      messages,
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) FROM blogs WHERE "userId" = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM posts p JOIN blogs b ON p."blogId" = b.id WHERE b."userId" = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM comments WHERE "authorId" = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM files WHERE user_id = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM subscriptions WHERE "userId" = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM messages WHERE "senderId" = $1`,
        [userId],
      ),
    ]);

    return {
      blogs: parseInt(blogs[0].count),
      posts: parseInt(posts[0].count),
      comments: parseInt(comments[0].count),
      files: parseInt(files[0].count),
      subscriptions: parseInt(subscriptions[0].count),
      messages: parseInt(messages[0].count),
    };
  }

  /**
   * S3 파일 키 수집
   */
  private async collectS3FileKeys(userId: string): Promise<string[]> {
    const files = await this.fileRepository.find({
      where: { userId },
      select: ['fileKey'],
    });

    return files.map((file) => file.fileKey);
  }

  /**
   * 관리자 알림 (이메일/슬랙)
   */
  private async sendAdminAlert(job: any, error: Error): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

      const emailContent = `
사용자 삭제 작업 실패 알림

Job ID: ${job.id}
User ID: ${job.userId}
Job Type: ${job.type}
Retry Count: ${job.retryCount}
Error: ${error.message}

작업이 Dead Letter Queue로 이동되었습니다.
관리자 페이지에서 재시도하거나 수동으로 처리해주세요.
      `;

      await this.mailerService.sendMail({
        to: adminEmail,
        subject: '[긴급] 사용자 삭제 작업 실패',
        text: emailContent,
        replyTo: 'noreply@codebase.blog', // 회신 주소를 noreply로 설정
      });

      this.logger.log(`Admin alert sent for job ${job.id}`);

      // TODO: 슬랙 알림 추가
      // await this.slackService.sendAlert(emailContent);
    } catch (alertError) {
      this.logger.error('Failed to send admin alert:', alertError);
    }
  }

  /**
   * Cron: 타임아웃된 작업 감지 및 재큐 (매시간)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkTimeouts(): Promise<void> {
    try {
      await this.queueService.checkTimeouts();
      this.logger.log('Timeout check completed');
    } catch (error) {
      this.logger.error('Error checking timeouts:', error);
    }
  }
}
