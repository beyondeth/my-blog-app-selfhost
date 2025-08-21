import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { File } from '../entities/file.entity';
import { FileContext } from '../entities/file-context.entity';
import { S3Service } from './s3.service';

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  filesByContext: Record<string, number>;
  orphanedFiles: number;
  expiredFiles: number;
  storageByUser: Array<{
    userId: string;
    fileCount: number;
    totalSize: number;
  }>;
}

export interface MigrationMonitor {
  v1Files: number;
  v2Files: number;
  migrationProgress: number;
  estimatedTimeRemaining: number;
  errors: Array<{
    timestamp: Date;
    fileId: string;
    error: string;
  }>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'operational' | 'unavailable';
    s3: 'operational' | 'unavailable';
  };
  issues: string[];
}

export interface FileSystemMetrics {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  filesByContext: Record<string, number>;
  v1Files: number;
  v2Files: number;
  orphanedFiles: number;
  averageFileSize: number;
  error?: string;
}

export interface StorageUsage {
  userId: string;
  fileCount: number;
  totalSize: number;
}

export interface Anomaly {
  type: 'large_file' | 'duplicate' | 'orphaned' | 'v1_structure';
  fileId: string;
  fileName?: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * 파일 시스템 모니터링 서비스
 */
@Injectable()
export class FileMonitoringService {
  private readonly logger = new Logger(FileMonitoringService.name);
  private migrationErrors: Array<any> = [];

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private contextRepository: Repository<FileContext>,
    private s3Service: S3Service,
  ) {}

  /**
   * 파일 시스템 통계 조회
   */
  async getFileSystemStats(): Promise<FileStats> {
    const totalFiles = await this.fileRepository.count();
    
    const totalSizeResult = await this.fileRepository
      .createQueryBuilder('file')
      .select('SUM(file.fileSize)', 'total')
      .getRawOne();
    
    const filesByType = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.fileType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('file.fileType')
      .getRawMany();
    
    const filesByContext = await this.contextRepository
      .createQueryBuilder('context')
      .select('context.contextType', 'type')
      .addSelect('SUM(context.fileCount)', 'count')
      .groupBy('context.contextType')
      .getRawMany();
    
    const orphanedFiles = await this.fileRepository.count({
      where: { contextId: IsNull() },
    });
    
    const expiredFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.expiresAt < :now', { now: new Date() })
      .getCount();
    
    const storageByUser = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.userId', 'userId')
      .addSelect('COUNT(*)', 'fileCount')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .groupBy('file.userId')
      .orderBy('totalSize', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalFiles,
      totalSize: parseInt(totalSizeResult?.total || '0'),
      filesByType: this.arrayToRecord(filesByType, 'type', 'count'),
      filesByContext: this.arrayToRecord(filesByContext, 'type', 'count'),
      orphanedFiles,
      expiredFiles,
      storageByUser: storageByUser.map(user => ({
        userId: user.userId,
        fileCount: parseInt(user.fileCount),
        totalSize: parseInt(user.totalSize || '0'),
      })),
    };
  }

  /**
   * 시스템 헬스 체크
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const issues: string[] = [];
    let dbStatus: 'operational' | 'unavailable' = 'operational';
    let s3Status: 'operational' | 'unavailable' = 'operational';
    
    try {
      // Database check
      const fileCount = await this.fileRepository.count();
      
      // Check for orphaned files
      const orphanedFiles = await this.fileRepository.count({
        where: { 
          contextId: IsNull(),
          createdAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000))
        },
      });
      
      if (orphanedFiles > 0) {
        issues.push(`${orphanedFiles} orphaned files detected`);
      }
      
      // Check for v1 files needing migration
      const v1Files = await this.fileRepository
        .createQueryBuilder('file')
        .where('file.fileKey NOT LIKE :pattern', { pattern: 'v2/%' })
        .getCount();
      
      if (v1Files > 0) {
        issues.push(`${v1Files} files need migration to v2`);
      }
      
      // Check for scheduled deletions
      const scheduledDeletions = await this.fileRepository.count({
        where: { expiresAt: Not(IsNull()) },
      });
      
      if (scheduledDeletions > 0) {
        issues.push(`${scheduledDeletions} files scheduled for deletion`);
      }
      
    } catch (error) {
      dbStatus = 'unavailable';
      issues.push('Database connection failed');
      this.logger.error('Database health check failed:', error);
    }
    
    // S3 check would go here
    // For now, we'll assume it's operational
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (dbStatus !== 'operational' || s3Status !== 'operational') {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }
    
    return {
      status,
      services: {
        database: dbStatus,
        s3: s3Status,
      },
      issues,
    };
  }

  /**
   * 메트릭 수집
   */
  async getMetrics(): Promise<FileSystemMetrics> {
    try {
      const totalFiles = await this.fileRepository.count();
      
      const totalSizeResult = await this.fileRepository
        .createQueryBuilder('file')
        .select('SUM(file.fileSize)', 'total')
        .getRawOne();
      
      const filesByType = await this.fileRepository
        .createQueryBuilder('file')
        .select('file.fileType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('file.fileType')
        .getRawMany();
      
      const contexts = await this.contextRepository
        .createQueryBuilder('context')
        .select('context.contextType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('context.contextType')
        .getRawMany();
      
      const v1Files = await this.fileRepository
        .createQueryBuilder('file')
        .where('file.fileKey NOT LIKE :pattern', { pattern: 'v2/%' })
        .getCount();
      
      const v2Files = await this.fileRepository
        .createQueryBuilder('file')
        .where('file.fileKey LIKE :pattern', { pattern: 'v2/%' })
        .getCount();
      
      const orphanedFiles = await this.fileRepository
        .createQueryBuilder('file')
        .where('file.contextId IS NULL')
        .getCount();
      
      const totalSize = parseInt(totalSizeResult?.total || '0');
      const averageFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;
      
      return {
        totalFiles,
        totalSize,
        filesByType: this.arrayToRecord(filesByType, 'type', 'count'),
        filesByContext: this.arrayToRecord(contexts, 'type', 'count'),
        v1Files,
        v2Files,
        orphanedFiles,
        averageFileSize,
      };
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        filesByType: {},
        filesByContext: {},
        v1Files: 0,
        v2Files: 0,
        orphanedFiles: 0,
        averageFileSize: 0,
        error: error.message,
      };
    }
  }

  /**
   * 사용자별 스토리지 사용량
   */
  async getStorageUsageByUser(): Promise<StorageUsage[]> {
    const usageData = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.userId', 'userId')
      .addSelect('COUNT(*)', 'fileCount')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .groupBy('file.userId')
      .orderBy('SUM(file.fileSize)', 'DESC')
      .getRawMany();
    
    return usageData.map(data => ({
      userId: data.userId,
      fileCount: parseInt(data.fileCount),
      totalSize: parseInt(data.totalSize || '0'),
    }));
  }

  /**
   * 이상 징후 감지
   */
  async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    // Large files (>50MB)
    const largeFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileSize > :size', { size: 50 * 1024 * 1024 })
      .getMany();
    
    for (const file of largeFiles) {
      anomalies.push({
        type: 'large_file',
        fileId: file.id,
        fileName: file.fileName,
        details: `File size: ${(file.fileSize / 1024 / 1024).toFixed(2)}MB`,
        severity: file.fileSize > 100 * 1024 * 1024 ? 'high' : 'medium',
      });
    }
    
    // Duplicate files (by checksum)
    const duplicates = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.checksum', 'checksum')
      .addSelect('COUNT(*)', 'count')
      .addSelect('GROUP_CONCAT(file.id)', 'fileIds')
      .where('file.checksum IS NOT NULL')
      .andWhere('file.checksum != :empty', { empty: '' })
      .groupBy('file.checksum')
      .having('COUNT(*) > 1')
      .getRawMany();
    
    for (const dup of duplicates) {
      const fileIds = dup.fileIds.split(',');
      for (const fileId of fileIds) {
        const file = await this.fileRepository.findOne({ where: { id: fileId } });
        if (file) {
          anomalies.push({
            type: 'duplicate',
            fileId: file.id,
            fileName: file.fileName,
            details: `Duplicate of ${fileIds.filter(id => id !== fileId)[0]}`,
            severity: 'low',
          });
        }
      }
    }
    
    // Orphaned files (older than 24 hours)
    const orphanedFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.contextId IS NULL')
      .andWhere('file.createdAt < :date', {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .getMany();
    
    for (const file of orphanedFiles) {
      anomalies.push({
        type: 'orphaned',
        fileId: file.id,
        fileName: file.fileName,
        details: 'File has no context association',
        severity: 'medium',
      });
    }
    
    // v1 structure files
    const v1Files = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileKey NOT LIKE :pattern', { pattern: 'v2/%' })
      .getMany();
    
    for (const file of v1Files) {
      anomalies.push({
        type: 'v1_structure',
        fileId: file.id,
        fileName: file.fileName,
        details: 'File needs migration to v2 structure',
        severity: 'medium',
      });
    }
    
    return anomalies;
  }

  /**
   * 보고서 생성
   */
  async generateReport(): Promise<string> {
    const health = await this.healthCheck();
    const metrics = await this.getMetrics();
    const anomalies = await this.detectAnomalies();
    
    const activeContexts = await this.contextRepository.count({
      where: { isActive: true },
    });
    
    const totalContexts = await this.contextRepository.count();
    
    let report = '=== File System Monitoring Report ===\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += 'Health Status:\n';
    report += `  Status: ${health.status}\n`;
    report += `  Database: ${health.services.database}\n`;
    report += `  S3: ${health.services.s3}\n`;
    if (health.issues.length > 0) {
      report += '  Issues:\n';
      health.issues.forEach(issue => {
        report += `    - ${issue}\n`;
      });
    }
    report += '\n';
    
    report += 'Metrics:\n';
    report += `  Total Files: ${metrics.totalFiles}\n`;
    report += `  Total Size: ${(metrics.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    report += `  Average File Size: ${(metrics.averageFileSize / 1024 / 1024).toFixed(2)} MB\n`;
    report += `  v1 Files: ${metrics.v1Files}\n`;
    report += `  v2 Files: ${metrics.v2Files}\n`;
    report += `  Orphaned Files: ${metrics.orphanedFiles}\n`;
    report += `  Active Contexts: ${activeContexts}\n`;
    report += `  Total Contexts: ${totalContexts}\n`;
    report += '\n';
    
    if (anomalies.length > 0) {
      report += 'Anomalies Detected:\n';
      const anomalyGroups = this.groupAnomaliesByType(anomalies);
      for (const [type, items] of Object.entries(anomalyGroups)) {
        report += `  ${type}: ${items.length} files\n`;
        items.slice(0, 3).forEach(item => {
          report += `    - ${item.fileName}: ${item.details}\n`;
        });
        if (items.length > 3) {
          report += `    ... and ${items.length - 3} more\n`;
        }
      }
      report += '\n';
    }
    
    report += 'Recommendations:\n';
    const recommendations = await this.cleanupRecommendations();
    if (recommendations.length > 0) {
      recommendations.forEach(rec => {
        report += `  - ${rec}\n`;
      });
    } else {
      report += '  - System is healthy, no immediate actions required\n';
    }
    
    return report;
  }

  /**
   * 정리 권장 사항
   */
  async cleanupRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    const orphanedCount = await this.fileRepository.count({
      where: { 
        contextId: IsNull(),
        createdAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000))
      },
    });
    
    if (orphanedCount > 0) {
      recommendations.push(`Run orphaned file cleanup (${orphanedCount} files)`);
    }
    
    const v1Count = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileKey NOT LIKE :pattern', { pattern: 'v2/%' })
      .getCount();
    
    if (v1Count > 0) {
      recommendations.push(`Migrate v1 files to v2 structure (${v1Count} files)`);
    }
    
    const expiredCount = await this.fileRepository.count({
      where: {
        expiresAt: LessThan(new Date()),
      },
    });
    
    if (expiredCount > 0) {
      recommendations.push(`Process expired files for deletion (${expiredCount} files)`);
    }
    
    return recommendations;
  }

  /**
   * 마이그레이션 모니터링
   */
  async getMigrationStatus(): Promise<MigrationMonitor> {
    const v1Files = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileKey NOT LIKE :pattern', { pattern: 'v2/%' })
      .getCount();
    
    const v2Files = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileKey LIKE :pattern', { pattern: 'v2/%' })
      .getCount();
    
    const total = v1Files + v2Files;
    const migrationProgress = total > 0 ? (v2Files / total) * 100 : 0;
    
    // 예상 완료 시간 계산 (최근 마이그레이션 속도 기반)
    const estimatedTimeRemaining = this.calculateEstimatedTime(v1Files);

    return {
      v1Files,
      v2Files,
      migrationProgress,
      estimatedTimeRemaining,
      errors: this.migrationErrors.slice(-100), // 최근 100개 에러만
    };
  }

  /**
   * 사용자별 할당량 체크
   */
  async checkUserQuota(userId: string): Promise<{
    used: number;
    limit: number;
    percentage: number;
    canUpload: boolean;
  }> {
    const userStats = await this.fileRepository
      .createQueryBuilder('file')
      .select('SUM(file.fileSize)', 'totalSize')
      .where('file.userId = :userId', { userId })
      .getRawOne();
    
    const used = parseInt(userStats?.totalSize || '0');
    const limit = 10 * 1024 * 1024 * 1024; // 10GB per user
    const percentage = (used / limit) * 100;
    
    return {
      used,
      limit,
      percentage,
      canUpload: used < limit,
    };
  }

  /**
   * 매일 자정 실행: 만료된 파일 정리
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredFiles(): Promise<void> {
    this.logger.log('Starting expired files cleanup...');
    
    const expiredFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.expiresAt < :now', { now: new Date() })
      .getMany();
    
    for (const file of expiredFiles) {
      try {
        // S3에서 파일 삭제
        await this.s3Service.deleteFile(file.fileKey);
        
        // DB에서 레코드 삭제
        await this.fileRepository.remove(file);
        
        this.logger.log(`Cleaned up expired file: ${file.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup file ${file.id}:`, error);
      }
    }
    
    this.logger.log(`Cleanup completed. Processed ${expiredFiles.length} files.`);
  }

  /**
   * 매시간 실행: 고아 파일 감지
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectOrphanedFiles(): Promise<void> {
    this.logger.log('Detecting orphaned files...');
    
    const orphanedFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.contextId IS NULL')
      .andWhere('file.createdAt < :date', {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24시간 이상 된 파일
      })
      .getCount();
    
    if (orphanedFiles > 0) {
      this.logger.warn(`Found ${orphanedFiles} orphaned files`);
      // TODO: 알림 발송 또는 자동 정리
    }
  }

  /**
   * 알림 발송
   */
  async sendAlert(type: 'warning' | 'error', message: string, data?: any): Promise<void> {
    this.logger[type === 'error' ? 'error' : 'warn'](message, data);
    
    // TODO: 실제 알림 시스템 연동
    // - Slack
    // - Email
    // - Discord
  }

  /**
   * Helper: 배열을 레코드로 변환
   */
  private arrayToRecord(array: any[], keyField: string, valueField: string): Record<string, number> {
    return array.reduce((acc, item) => {
      acc[item[keyField]] = parseInt(item[valueField]);
      return acc;
    }, {});
  }

  /**
   * Helper: Anomaly 그룹화
   */
  private groupAnomaliesByType(anomalies: Anomaly[]): Record<string, Anomaly[]> {
    return anomalies.reduce((acc, anomaly) => {
      if (!acc[anomaly.type]) {
        acc[anomaly.type] = [];
      }
      acc[anomaly.type].push(anomaly);
      return acc;
    }, {} as Record<string, Anomaly[]>);
  }

  /**
   * 예상 완료 시간 계산
   */
  private calculateEstimatedTime(remainingFiles: number): number {
    // 평균 100개/분 처리 가정
    const filesPerMinute = 100;
    return Math.ceil(remainingFiles / filesPerMinute);
  }

  /**
   * 마이그레이션 에러 기록
   */
  recordMigrationError(fileId: string, error: string): void {
    this.migrationErrors.push({
      timestamp: new Date(),
      fileId,
      error,
    });
    
    // 메모리 관리: 최대 1000개까지만 유지
    if (this.migrationErrors.length > 1000) {
      this.migrationErrors = this.migrationErrors.slice(-1000);
    }
  }
}