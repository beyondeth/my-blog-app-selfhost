import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { File } from '../files/entities/file.entity';
import { S3Service } from '../files/services/s3.service';
import { User } from '../users/entities/user.entity';

@ApiTags('Admin - Files')
@Controller('admin/files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminFilesController {
  constructor(
    @InjectRepository(File)
    private filesRepository: Repository<File>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private s3Service: S3Service,
  ) {}

  @Get()
  @ApiOperation({ summary: '모든 파일 목록 조회 (관리자)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'fileType', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllFiles(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('fileType') fileType?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    const where: any = {};
    
    if (fileType && fileType !== 'all') {
      where.fileType = fileType;
    }
    
    if (userId && userId !== 'all') {
      where.userId = userId;
    }
    
    if (search) {
      where.originalName = Like(`%${search}%`);
    }
    
    const [files, total] = await this.filesRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    // 각 파일에 접근 URL 생성
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const accessUrl = file.mimeType.startsWith('image/')
            ? await this.s3Service.generatePresignedDownloadUrl(file.fileKey)
            : null;
          return { ...file, accessUrl };
        } catch (error) {
          return { ...file, accessUrl: null };
        }
      })
    );
    
    return {
      files: filesWithUrls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '파일 통계 조회 (관리자)' })
  async getFileStats() {
    // 전체 파일 수와 용량
    const totalStats = await this.filesRepository
      .createQueryBuilder('file')
      .select('COUNT(*)', 'totalFiles')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .getRawOne();
    
    // 사용자 수
    const userCount = await this.filesRepository
      .createQueryBuilder('file')
      .select('COUNT(DISTINCT file.userId)', 'count')
      .getRawOne();
    
    // 파일 타입별 통계
    const typeStats = await this.filesRepository
      .createQueryBuilder('file')
      .select('file.fileType', 'fileType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .groupBy('file.fileType')
      .getRawMany();
    
    // WebP 파일 비율 계산
    const webpCount = await this.filesRepository
      .createQueryBuilder('file')
      .where('file.mimeType = :mimeType', { mimeType: 'image/webp' })
      .getCount();
    
    const imageCount = await this.filesRepository
      .createQueryBuilder('file')
      .where('file.mimeType LIKE :pattern', { pattern: 'image/%' })
      .getCount();
    
    const webpPercentage = imageCount > 0 
      ? Math.round((webpCount / imageCount) * 100) 
      : 0;
    
    return {
      totalFiles: parseInt(totalStats.totalFiles) || 0,
      totalSize: parseInt(totalStats.totalSize) || 0,
      userCount: parseInt(userCount.count) || 0,
      webpPercentage,
      byType: typeStats.map(stat => ({
        fileType: stat.fileType,
        count: parseInt(stat.count),
        totalSize: parseInt(stat.totalSize || '0'),
      })),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '파일 상세 정보 조회 (관리자)' })
  async getFileById(@Param('id') fileId: string) {
    const file = await this.filesRepository.findOne({
      where: { id: fileId },
      relations: ['user'],
    });
    
    if (!file) {
      throw new ForbiddenException('File not found');
    }
    
    // S3 메타데이터 추가
    const accessUrl = file.mimeType.startsWith('image/')
      ? await this.s3Service.generatePresignedDownloadUrl(file.fileKey)
      : null;
    
    return {
      ...file,
      accessUrl,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 삭제 (관리자)' })
  async deleteFile(
    @Param('id') fileId: string,
    @CurrentUser() admin: User,
  ) {
    const file = await this.filesRepository.findOne({
      where: { id: fileId },
    });
    
    if (!file) {
      throw new ForbiddenException('File not found');
    }
    
    try {
      // S3에서 파일 삭제
      await this.s3Service.deleteFile(file.fileKey);
      
      // DB에서 파일 정보 삭제
      await this.filesRepository.remove(file);
      
      console.log(`[Admin] File deleted by ${admin.email}: ${file.fileKey}`);
    } catch (error) {
      console.error(`[Admin] Failed to delete file: ${error.message}`);
      throw error;
    }
  }

  @Get('users/list')
  @ApiOperation({ summary: '파일을 업로드한 사용자 목록 (관리자)' })
  async getUsersWithFiles() {
    const users = await this.filesRepository
      .createQueryBuilder('file')
      .select('file.userId', 'userId')
      .addSelect('COUNT(*)', 'fileCount')
      .addSelect('SUM(file.fileSize)', 'totalSize')
      .leftJoinAndSelect('file.user', 'user')
      .groupBy('file.userId')
      .addGroupBy('user.id')
      .getRawMany();
    
    return users.map(u => ({
      userId: u.userId,
      username: u.user_username,
      email: u.user_email,
      fileCount: parseInt(u.fileCount),
      totalSize: parseInt(u.totalSize || '0'),
    }));
  }
}