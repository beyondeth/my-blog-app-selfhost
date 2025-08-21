import { 
  Controller, 
  Post, 
  Get, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FileMigrationService } from '../services/file-migration.service';
import { FileMonitoringService } from '../services/file-monitoring.service';
import { FileLifecycleService } from '../services/file-lifecycle.service';

@ApiTags('File Migration')
@Controller('api/v1/files/migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FileMigrationController {
  constructor(
    private readonly migrationService: FileMigrationService,
    private readonly monitoringService: FileMonitoringService,
    private readonly lifecycleService: FileLifecycleService,
  ) {}

  /**
   * 마이그레이션 시작 (관리자만)
   */
  @Post('start')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start file system migration' })
  @ApiResponse({ status: 200, description: 'Migration started successfully' })
  async startMigration() {
    return this.migrationService.runFullMigration();
  }

  /**
   * 마이그레이션 상태 조회
   */
  @Get('status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get migration status' })
  @ApiResponse({ status: 200, description: 'Migration status retrieved' })
  async getMigrationStatus() {
    const migrationProgress = await this.migrationService.getMigrationStatus();
    const monitoringStatus = await this.monitoringService.getMigrationStatus();
    
    return {
      migration: migrationProgress,
      monitoring: monitoringStatus,
    };
  }

  /**
   * 기존 파일 분석
   */
  @Get('analyze')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Analyze existing files' })
  @ApiResponse({ status: 200, description: 'File analysis completed' })
  async analyzeFiles() {
    return this.migrationService.analyzeExistingFiles();
  }

  /**
   * 마이그레이션 롤백
   */
  @Post('rollback')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback migration' })
  @ApiResponse({ status: 200, description: 'Migration rolled back' })
  async rollbackMigration() {
    await this.migrationService.rollbackMigration();
    return { message: 'Migration rollback initiated' };
  }

  /**
   * 수동 정리 트리거
   */
  @Post('cleanup')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual cleanup' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async triggerCleanup() {
    return this.lifecycleService.triggerManualCleanup();
  }

  /**
   * 파일 시스템 통계
   */
  @Get('stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get file system statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getFileStats() {
    return this.monitoringService.getFileSystemStats();
  }

  /**
   * 헬스 체크
   */
  @Get('health')
  @ApiOperation({ summary: 'Check file system health' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async healthCheck() {
    return this.monitoringService.healthCheck();
  }

  /**
   * 사용자 할당량 체크
   */
  @Get('quota')
  @ApiOperation({ summary: 'Check user quota' })
  @ApiResponse({ status: 200, description: 'Quota information retrieved' })
  async checkQuota(@Query('userId') userId: string) {
    return this.monitoringService.checkUserQuota(userId);
  }
}