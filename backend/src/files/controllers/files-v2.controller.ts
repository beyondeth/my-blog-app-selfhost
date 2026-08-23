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
  ForbiddenException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { User } from "../../users/entities/user.entity";
import { Profile } from "../../users/entities/profile.entity";
import { Blog } from "../../blogs/entities/blog.entity";
import { Post as PostEntity } from "../../posts/entities/post.entity";
import { Express } from "express";
import "multer";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ContextualFileService } from "../services/contextual-file.service";
import { FileContextType, FilePurpose } from "../entities/file-context.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  OrganizationId,
  RequireOrganizationContext,
} from "../../organizations/decorators/organization-context.decorator";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";

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

@ApiTags("Files V2")
@Controller("files/v2")
@UseGuards(JwtAuthGuard, OrganizationContextGuard)
@RequireOrganizationContext()
@ApiBearerAuth()
export class FilesV2Controller {
  constructor(
    private readonly contextualFileService: ContextualFileService,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 프로필 이미지 업로드
   */
  @Post("profile/avatar")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload profile avatar" })
  @ApiResponse({ status: 201, description: "Avatar uploaded successfully" })
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @OrganizationId() organizationId: string,
  ) {
    const result = await this.contextualFileService.uploadProfileImage(
      user.id,
      file,
      "avatar",
      organizationId,
    );

    // Phase 1-2-3: Profile 테이블에 이미지 URL 업데이트
    // s3Key를 그대로 저장 (예: v2/users/xxx/profile/avatar/xxx.png)
    // 프론트엔드에서 /api/v1/files/{s3Key} 형태로 접근
    const existingProfile = await this.profileRepository.findOne({
      where: { userId: user.id },
    });
    const oldProfileImage = existingProfile?.profileImage || null;

    await this.profileRepository.update(
      { userId: user.id },
      { profileImage: result.s3Key },
    );

    // 프로필 이미지 업데이트 이벤트 발생 (캐시 무효화용)
    this.eventEmitter.emit("user.avatar.updated", {
      userId: user.id,
      username: user.username,
      oldProfileImage,
      newProfileImage: result.s3Key,
    });

    return result;
  }

  /**
   * 프로필 커버 이미지 업로드
   */
  @Post("profile/cover")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload profile cover image" })
  @ApiResponse({
    status: 201,
    description: "Cover image uploaded successfully",
  })
  async uploadCover(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @OrganizationId() organizationId: string,
  ) {
    return this.contextualFileService.uploadProfileImage(
      user.id,
      file,
      "cover",
      organizationId,
    );
  }

  /**
   * 포스트 이미지 업로드
   */
  @Post("posts/:postId/images")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload post image" })
  @ApiResponse({ status: 201, description: "Post image uploaded successfully" })
  async uploadPostImage(
    @CurrentUser() user: User,
    @Param("postId", ParseUUIDPipe) postId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @OrganizationId() organizationId: string,
  ) {
    const post = await this.postRepository.findOne({
      where: { id: postId, authorId: user.id },
      relations: ["blog"],
    });

    if (!post || post.blog?.organizationId !== organizationId) {
      throw new ForbiddenException("포스트에 대한 권한이 없습니다.");
    }

    return this.contextualFileService.uploadPostImage(
      user.id,
      postId,
      file,
      organizationId,
    );
  }

  /**
   * 블로그 로고 업로드
   */
  @Post("blogs/:blogId/logo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload blog logo" })
  @ApiResponse({ status: 201, description: "Blog logo uploaded successfully" })
  async uploadBlogLogo(
    @CurrentUser() user: User,
    @Param("blogId", ParseUUIDPipe) blogId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @OrganizationId() organizationId: string,
  ) {
    await this.assertBlogAccess(user.id, blogId, organizationId);

    return this.contextualFileService.uploadBlogAsset(
      user.id,
      blogId,
      file,
      "logo",
      organizationId,
    );
  }

  /**
   * 블로그 파비콘 업로드
   */
  @Post("blogs/:blogId/favicon")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload blog favicon" })
  @ApiResponse({
    status: 201,
    description: "Blog favicon uploaded successfully",
  })
  async uploadBlogFavicon(
    @CurrentUser() user: User,
    @Param("blogId", ParseUUIDPipe) blogId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contextualFileService.uploadBlogAsset(
      user.id,
      blogId,
      file,
      "favicon",
    );
  }

  /**
   * 블로그 배너 업로드
   */
  @Post("blogs/:blogId/banner")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload blog banner" })
  @ApiResponse({
    status: 201,
    description: "Blog banner uploaded successfully",
  })
  async uploadBlogBanner(
    @CurrentUser() user: User,
    @Param("blogId", ParseUUIDPipe) blogId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @OrganizationId() organizationId: string,
  ) {
    await this.assertBlogAccess(user.id, blogId, organizationId);

    return this.contextualFileService.uploadBlogAsset(
      user.id,
      blogId,
      file,
      "banner",
      organizationId,
    );
  }

  /**
   * 업로드 URL 생성 (브라우저 직접 업로드용)
   */
  @Post("upload-url")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate presigned upload URL" })
  @ApiResponse({ status: 200, description: "Upload URL generated" })
  async generateUploadUrl(
    @CurrentUser() user: User,
    @Body() dto: CreateUploadUrlDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.contextualFileService.generateUploadUrl(
      user.id,
      {
        contextType: dto.contextType,
        contextId: dto.contextId,
        ownerId: user.id,
        purpose: dto.purpose,
        organizationId,
      },
      dto.fileName,
      dto.fileSize,
      dto.mimeType,
    );
  }

  /**
   * 업로드 완료 처리
   */
  @Post("upload-complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete file upload" })
  @ApiResponse({ status: 200, description: "Upload completed" })
  async completeUpload(
    @CurrentUser() user: User,
    @Body() dto: CompleteUploadDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.contextualFileService.completeUpload(
      dto.fileId,
      user.id,
      organizationId,
    );
  }

  /**
   * 컨텍스트별 파일 조회
   */
  @Get("context/:contextType/:contextId")
  @ApiOperation({ summary: "Get files by context" })
  @ApiResponse({ status: 200, description: "Files retrieved" })
  async getFilesByContext(
    @Param("contextType") contextType: FileContextType,
    @Param("contextId", ParseUUIDPipe) contextId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.contextualFileService.getFilesByContext(
      contextType,
      contextId,
      organizationId,
    );
  }

  /**
   * 파일 삭제
   */
  @Delete(":fileId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete file" })
  @ApiResponse({ status: 204, description: "File deleted" })
  async deleteFile(
    @CurrentUser() user: User,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @OrganizationId() organizationId: string,
  ) {
    await this.contextualFileService.deleteFile(
      fileId,
      user.id,
      organizationId,
    );
  }

  /**
   * 사용자 프로필 이미지 조회
   */
  @Get("profile/:userId")
  @ApiOperation({ summary: "Get user profile images" })
  @ApiResponse({ status: 200, description: "Profile images retrieved" })
  async getUserProfileImages(
    @Param("userId", ParseUUIDPipe) userId: string,
    @OrganizationId() organizationId: string,
  ) {
    const avatar = await this.contextualFileService.getFilesByContext(
      FileContextType.PROFILE,
      userId,
      organizationId,
    );

    return {
      avatar: avatar.find((f) => f.context?.purpose === FilePurpose.AVATAR),
      cover: avatar.find((f) => f.context?.purpose === FilePurpose.COVER),
    };
  }

  /**
   * 포스트 이미지 목록 조회
   */
  @Get("posts/:postId")
  @ApiOperation({ summary: "Get post images" })
  @ApiResponse({ status: 200, description: "Post images retrieved" })
  async getPostImages(
    @Param("postId", ParseUUIDPipe) postId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.contextualFileService.getFilesByContext(
      FileContextType.POST,
      postId,
      organizationId,
    );
  }

  /**
   * 블로그 브랜딩 이미지 조회
   */
  @Get("blogs/:blogId")
  @ApiOperation({ summary: "Get blog branding images" })
  @ApiResponse({ status: 200, description: "Blog images retrieved" })
  async getBlogImages(
    @Param("blogId", ParseUUIDPipe) blogId: string,
    @OrganizationId() organizationId: string,
  ) {
    const images = await this.contextualFileService.getFilesByContext(
      FileContextType.BLOG,
      blogId,
      organizationId,
    );

    return {
      logo: images.find((f) => f.context?.purpose === FilePurpose.LOGO),
      banner: images.find((f) => f.context?.purpose === FilePurpose.BANNER),
      favicon: images.find((f) => f.context?.purpose === FilePurpose.FAVICON),
    };
  }

  private async assertBlogAccess(
    userId: string,
    blogId: string,
    organizationId: string,
  ): Promise<void> {
    const blog = await this.blogRepository.findOne({
      where: { id: blogId, userId, organizationId },
    });

    if (!blog) {
      throw new ForbiddenException("블로그에 대한 권한이 없습니다.");
    }
  }
}
