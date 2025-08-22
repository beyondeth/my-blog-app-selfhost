import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { ContextualFileService } from '../services/contextual-file.service';
import { FileContextType, FilePurpose } from '../entities/file-context.entity';
import { UsersService } from '../../users/users.service';

export class CreateUploadUrlDto {
  contextType: FileContextType;
  contextId?: string;
  purpose: FilePurpose;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class CompleteUploadDto {
  fileId: string;
}

@ApiTags('Files V2')
@Controller('files/v2')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesV2Controller {
  constructor(
    private readonly contextualFileService: ContextualFileService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 프로필 이미지 업로드
   */
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully' })
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.contextualFileService.uploadProfileImage(
      user.id,
      file,
      'avatar',
    );
    
    // 사용자 프로필에 이미지 URL 업데이트
    await this.usersService.update(user.id, {
      profileImage: result.s3Key,
    });
    
    return result;
  }

  /**
   * 프로필 커버 이미지 업로드
   */
  @Post('profile/cover')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile cover image' })
  @ApiResponse({ status: 201, description: 'Cover image uploaded successfully' })
  async uploadCover(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contextualFileService.uploadProfileImage(
      user.id,
      file,
      'cover',
    );
  }

  /**
   * 포스트 이미지 업로드
   */
  @Post('posts/:postId/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload post image' })
  @ApiResponse({ status: 201, description: 'Post image uploaded successfully' })
  async uploadPostImage(
    @CurrentUser() user: User,
    @Param('postId', ParseUUIDPipe) postId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contextualFileService.uploadPostImage(
      user.id,
      postId,
      file,
    );
  }

  /**
   * 블로그 로고 업로드
   */
  @Post('blogs/:blogId/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload blog logo' })
  @ApiResponse({ status: 201, description: 'Blog logo uploaded successfully' })
  async uploadBlogLogo(
    @CurrentUser() user: User,
    @Param('blogId', ParseUUIDPipe) blogId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contextualFileService.uploadBlogAsset(
      user.id,
      blogId,
      file,
      'logo',
    );
  }

  /**
   * 블로그 배너 업로드
   */
  @Post('blogs/:blogId/banner')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload blog banner' })
  @ApiResponse({ status: 201, description: 'Blog banner uploaded successfully' })
  async uploadBlogBanner(
    @CurrentUser() user: User,
    @Param('blogId', ParseUUIDPipe) blogId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contextualFileService.uploadBlogAsset(
      user.id,
      blogId,
      file,
      'banner',
    );
  }

  /**
   * 업로드 URL 생성 (브라우저 직접 업로드용)
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Upload URL generated' })
  async generateUploadUrl(
    @CurrentUser() user: User,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.contextualFileService.generateUploadUrl(
      user.id,
      {
        contextType: dto.contextType,
        contextId: dto.contextId,
        ownerId: user.id,
        purpose: dto.purpose,
      },
      dto.fileName,
      dto.fileSize,
      dto.mimeType,
    );
  }

  /**
   * 업로드 완료 처리
   */
  @Post('upload-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete file upload' })
  @ApiResponse({ status: 200, description: 'Upload completed' })
  async completeUpload(
    @CurrentUser() user: User,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.contextualFileService.completeUpload(
      dto.fileId,
      user.id,
    );
  }

  /**
   * 컨텍스트별 파일 조회
   */
  @Get('context/:contextType/:contextId')
  @ApiOperation({ summary: 'Get files by context' })
  @ApiResponse({ status: 200, description: 'Files retrieved' })
  async getFilesByContext(
    @Param('contextType') contextType: FileContextType,
    @Param('contextId', ParseUUIDPipe) contextId: string,
  ) {
    return this.contextualFileService.getFilesByContext(
      contextType,
      contextId,
    );
  }

  /**
   * 파일 삭제
   */
  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete file' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  async deleteFile(
    @CurrentUser() user: User,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    await this.contextualFileService.deleteFile(fileId, user.id);
  }

  /**
   * 사용자 프로필 이미지 조회
   */
  @Get('profile/:userId')
  @ApiOperation({ summary: 'Get user profile images' })
  @ApiResponse({ status: 200, description: 'Profile images retrieved' })
  async getUserProfileImages(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const avatar = await this.contextualFileService.getFilesByContext(
      FileContextType.PROFILE,
      userId,
    );
    
    return {
      avatar: avatar.find(f => f.context?.purpose === FilePurpose.AVATAR),
      cover: avatar.find(f => f.context?.purpose === FilePurpose.COVER),
    };
  }

  /**
   * 포스트 이미지 목록 조회
   */
  @Get('posts/:postId')
  @ApiOperation({ summary: 'Get post images' })
  @ApiResponse({ status: 200, description: 'Post images retrieved' })
  async getPostImages(
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.contextualFileService.getFilesByContext(
      FileContextType.POST,
      postId,
    );
  }

  /**
   * 블로그 브랜딩 이미지 조회
   */
  @Get('blogs/:blogId')
  @ApiOperation({ summary: 'Get blog branding images' })
  @ApiResponse({ status: 200, description: 'Blog images retrieved' })
  async getBlogImages(
    @Param('blogId', ParseUUIDPipe) blogId: string,
  ) {
    const images = await this.contextualFileService.getFilesByContext(
      FileContextType.BLOG,
      blogId,
    );
    
    return {
      logo: images.find(f => f.context?.purpose === FilePurpose.LOGO),
      banner: images.find(f => f.context?.purpose === FilePurpose.BANNER),
      favicon: images.find(f => f.context?.purpose === FilePurpose.FAVICON),
    };
  }
}