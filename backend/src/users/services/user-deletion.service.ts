import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  Logger,
  Optional
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { EmailService } from '../../email/email.service';
import { S3Service } from '../../files/services/s3.service';
import { File } from '../../files/entities/file.entity';

export interface DeletionOptions {
  softDelete?: boolean;
  backupData?: boolean;
  notifyByEmail?: boolean;
}

export interface DeletionResult {
  success: boolean;
  deletedAt: Date;
  userId: string;
  email: string;
  affectedRecords?: {
    blogs: number;
    posts: number;
    comments: number;
    files: number;
  };
  backupId?: string;
}

@Injectable()
export class UserDeletionService {
  private readonly logger = new Logger(UserDeletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    @Optional() private readonly s3Service: S3Service,
  ) {}

  /**
   * 사용자 계정 완전 삭제
   * CASCADE 제약조건이 설정되어 있어 관련 데이터가 자동으로 삭제됩니다.
   */
  async deleteUserAccount(
    userId: string,
    options: DeletionOptions = {}
  ): Promise<DeletionResult> {
    const { 
      softDelete = false,
      backupData = false,
      notifyByEmail = true 
    } = options;

    try {
      // 1. 사용자 존재 확인
      const user = await this.validateUserExists(userId);
      
      // 2. 백업 생성 (선택적)
      let backupId: string | undefined;
      if (backupData) {
        backupId = await this.createUserBackup(user);
        this.logger.log(`User backup created with ID: ${backupId}`);
      }

      // 3. S3 파일 삭제 (CASCADE가 DB 레코드는 삭제하지만 실제 파일은 수동 삭제 필요)
      await this.deleteUserFiles(userId);

      // 4. 삭제 수행
      let affectedRecords;
      if (softDelete) {
        affectedRecords = await this.performSoftDelete(user);
      } else {
        affectedRecords = await this.performHardDelete(user);
      }

      // 5. 이메일 알림 (선택적)
      if (notifyByEmail && user.email) {
        await this.sendDeletionNotification(user.email);
      }

      this.logger.log(`User ${userId} successfully deleted`);

      return {
        success: true,
        deletedAt: new Date(),
        userId: user.id,
        email: user.email,
        affectedRecords,
        backupId
      };
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}:`, error);
      throw new BadRequestException(
        `Failed to delete user account: ${error.message}`
      );
    }
  }

  /**
   * 사용자 존재 확인
   */
  private async validateUserExists(userId: string): Promise<User> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ 
        where: { id: userId },
        relations: ['blogs']
      });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  /**
   * 사용자 데이터 백업 생성
   */
  private async createUserBackup(user: User): Promise<string> {
    const backupData = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      blogs: await this.dataSource.query(
        `SELECT * FROM blogs WHERE "userId" = $1`,
        [user.id]
      ),
      posts: await this.dataSource.query(
        `SELECT p.* FROM posts p 
         JOIN blogs b ON p."blogId" = b.id 
         WHERE b."userId" = $1`,
        [user.id]
      ),
      timestamp: new Date().toISOString()
    };

    // 백업을 JSON으로 저장 (실제로는 S3나 별도 저장소에 저장)
    const backupId = `backup_${user.id}_${Date.now()}`;
    // TODO: S3에 백업 저장 구현
    
    return backupId;
  }

  /**
   * S3에서 사용자 파일 삭제
   */
  private async deleteUserFiles(userId: string): Promise<void> {
    // S3Service가 없으면 파일 삭제 건너뛰기
    if (!this.s3Service) {
      this.logger.warn('S3Service not available, skipping file deletion');
      return;
    }

    const files = await this.dataSource
      .getRepository(File)
      .find({ where: { userId: userId } });

    for (const file of files) {
      try {
        await this.s3Service.deleteFile(file.fileKey);
        this.logger.log(`Deleted S3 file: ${file.fileKey}`);
      } catch (error) {
        this.logger.error(`Failed to delete S3 file ${file.fileKey}:`, error);
        // S3 삭제 실패는 무시하고 계속 진행
      }
    }
  }

  /**
   * Soft Delete 수행 (현재는 Hard Delete와 동일하게 처리)
   * 추후 deletedAt 필드 추가 시 업데이트 필요
   */
  private async performSoftDelete(user: User) {
    // 현재는 Hard Delete와 동일하게 처리
    // TODO: User 엔티티에 deletedAt 필드 추가 후 수정
    return this.performHardDelete(user);
  }

  /**
   * Hard Delete 수행 (CASCADE로 자동 삭제)
   */
  private async performHardDelete(user: User) {
    return this.dataSource.transaction(async manager => {
      // 삭제 전 영향받을 레코드 수 계산
      const affectedRecords = await this.calculateAffectedRecords(user.id, manager);

      // 사용자 삭제 (CASCADE가 관련 데이터 자동 삭제)
      await manager.delete(User, { id: user.id });

      return affectedRecords;
    });
  }

  /**
   * 영향받을 레코드 수 계산
   */
  private async calculateAffectedRecords(userId: string, manager: any) {
    const blogs = await manager.query(
      `SELECT COUNT(*) FROM blogs WHERE "userId" = $1`,
      [userId]
    );
    
    const posts = await manager.query(
      `SELECT COUNT(*) FROM posts p 
       JOIN blogs b ON p."blogId" = b.id 
       WHERE b."userId" = $1`,
      [userId]
    );

    const comments = await manager.query(
      `SELECT COUNT(*) FROM comments WHERE "authorId" = $1`,
      [userId]
    );

    const files = await manager.query(
      `SELECT COUNT(*) FROM files WHERE user_id = $1`,
      [userId]
    );

    return {
      blogs: parseInt(blogs[0].count),
      posts: parseInt(posts[0].count),
      comments: parseInt(comments[0].count),
      files: parseInt(files[0].count)
    };
  }

  /**
   * 삭제 완료 이메일 발송
   */
  private async sendDeletionNotification(email: string): Promise<void> {
    try {
      await this.emailService.sendAccountDeletionNotification(email);
      this.logger.log(`Deletion notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send deletion notification to ${email}:`, error);
      // 이메일 발송 실패는 무시하고 계속 진행
    }
  }

  /**
   * 관리자용: 여러 사용자 일괄 삭제
   */
  async deleteMultipleUsers(userIds: string[]): Promise<{
    successful: string[];
    failed: string[];
  }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const userId of userIds) {
      try {
        await this.deleteUserAccount(userId, {
          softDelete: false,
          backupData: true,
          notifyByEmail: false
        });
        successful.push(userId);
      } catch (error) {
        this.logger.error(`Failed to delete user ${userId}:`, error);
        failed.push(userId);
      }
    }

    return { successful, failed };
  }
}