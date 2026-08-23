import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from "@nestjs/common";
import {
  CreateCommunityWidgetDto,
  ReorderCommunityWidgetsDto,
  UpdateCommunityWidgetDto,
} from "../dto";
import { CommunityWidgetService } from "../services/community-widget.service";
import { CommunitySlug } from "../decorators/community-id.decorator";
import { CommunityService } from "../services";
import { ContextualFileService } from "../../files/services/contextual-file.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import {
  CommunityRoles,
  ModeratorOnly,
} from "../decorators/community-roles.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { CommunityVisibilityGuard } from "../guards/community-visibility.guard";
import { CommunityOrganizationGuard } from "../guards/community-organization.guard";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";
import { RequireOrganizationContext } from "../../organizations/decorators/organization-context.decorator";

@ApiTags("Community Widgets")
@Controller("community/:slug/widgets")
@UseGuards(OrganizationContextGuard, CommunityOrganizationGuard)
@RequireOrganizationContext()
export class CommunityWidgetController {
  constructor(
    private readonly communityWidgetService: CommunityWidgetService,
    private readonly communityService: CommunityService,
    private readonly contextualFileService: ContextualFileService,
  ) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "커뮤니티 공개 사이드바 위젯 조회" })
  async getPublicWidgets(@CommunitySlug() slug: string) {
    const community = await this.communityService.findBySlug(slug);
    const widgets = await this.communityWidgetService.getWidgetsForCommunity(
      community.id,
    );

    return {
      success: true,
      data: widgets,
    };
  }

  @Get("manage")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 위젯 관리용 조회" })
  async getManageWidgets(@CommunitySlug() slug: string, @Request() req: any) {
    const community =
      req.community ?? (await this.communityService.findBySlug(slug));
    const widgets = await this.communityWidgetService.getWidgetsForCommunity(
      community.id,
      { includeDisabled: true },
    );

    return {
      success: true,
      data: widgets,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "새 사이드바 위젯 생성" })
  async createWidget(
    @CommunitySlug() slug: string,
    @Body() dto: CreateCommunityWidgetDto,
    @Request() req: any,
  ) {
    const community =
      req.community ?? (await this.communityService.findBySlug(slug));
    const widget = await this.communityWidgetService.createWidget(
      community.id,
      dto,
    );

    await this.communityService.invalidateCommunityCache(community);

    return {
      success: true,
      data: widget,
    };
  }

  @Put(":widgetId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiParam({ name: "widgetId", description: "위젯 ID" })
  @ApiOperation({ summary: "사이드바 위젯 수정" })
  async updateWidget(
    @CommunitySlug() slug: string,
    @Param("widgetId", new ParseUUIDPipe()) widgetId: string,
    @Body() dto: UpdateCommunityWidgetDto,
    @Request() req: any,
  ) {
    const community =
      req.community ?? (await this.communityService.findBySlug(slug));

    const widget = await this.communityWidgetService.updateWidget(
      community.id,
      widgetId,
      dto,
    );

    await this.communityService.invalidateCommunityCache(community);

    return {
      success: true,
      data: widget,
    };
  }

  @Patch("reorder")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "사이드바 위젯 순서 재정렬" })
  async reorderWidgets(
    @CommunitySlug() slug: string,
    @Body() dto: ReorderCommunityWidgetsDto,
    @Request() req: any,
  ) {
    const community =
      req.community ?? (await this.communityService.findBySlug(slug));

    await this.communityWidgetService.reorderWidgets(community.id, dto);
    await this.communityService.invalidateCommunityCache(community);

    return {
      success: true,
      message: "위젯 순서를 저장했습니다.",
    };
  }

  @Delete(":widgetId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiParam({ name: "widgetId", description: "위젯 ID" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "위젯 삭제" })
  async deleteWidget(
    @CommunitySlug() slug: string,
    @Param("widgetId", new ParseUUIDPipe()) widgetId: string,
    @Request() req: any,
  ) {
    const community =
      req.community ?? (await this.communityService.findBySlug(slug));

    await this.communityWidgetService.deleteWidget(community.id, widgetId);
    await this.communityService.invalidateCommunityCache(community);
  }

  @Post(":widgetId/images")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiParam({ name: "widgetId", description: "위젯 ID" })
  @ApiOperation({ summary: "위젯 전용 이미지 업로드" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async uploadWidgetImage(
    @CommunitySlug() slug: string,
    @Param("widgetId", new ParseUUIDPipe()) widgetId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException("업로드할 파일이 필요합니다");
    }

    const community =
      req.community ?? (await this.communityService.findBySlug(slug));

    await this.communityWidgetService.getWidgetById(widgetId, community.id);

    const uploadResult =
      await this.contextualFileService.uploadCommunityWidgetAsset(
        req.user.id,
        community.id,
        widgetId,
        file,
        community.organizationId || undefined,
      );

    return {
      success: true,
      data: uploadResult,
    };
  }
}
