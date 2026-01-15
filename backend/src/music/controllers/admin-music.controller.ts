import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Logger,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { MusicService } from "../services/music.service";
import {
  CreateMusicUploadUrlDto,
  MusicUploadCompleteDto,
  UpdateMusicDto,
  ReorderMusicDto,
  AdminMusicDto,
  MusicUploadUrlResponseDto,
} from "../dto";

/**
 * 관리자 음악 관리 API 컨트롤러
 * 관리자 권한 필요
 */
@ApiTags("Admin - Music")
@ApiBearerAuth()
@Controller("admin/music")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminMusicController {
  private readonly logger = new Logger(AdminMusicController.name);

  constructor(private readonly musicService: MusicService) {}

  /**
   * 음악 업로드용 Presigned URL 생성
   */
  @Post("upload-url")
  @ApiOperation({ summary: "음악 업로드 URL 생성" })
  @ApiResponse({
    status: 201,
    description: "S3 업로드용 Presigned URL 반환",
    type: MusicUploadUrlResponseDto,
  })
  async createUploadUrl(
    @Body() dto: CreateMusicUploadUrlDto,
  ): Promise<MusicUploadUrlResponseDto> {
    return this.musicService.createUploadUrl(dto);
  }

  /**
   * 음악 업로드 완료 처리
   */
  @Post("upload-complete")
  @ApiOperation({ summary: "음악 업로드 완료 처리" })
  @ApiResponse({
    status: 201,
    description: "메타데이터 추출 후 음악 정보 반환",
    type: AdminMusicDto,
  })
  async uploadComplete(
    @CurrentUser("id") adminId: string,
    @Body() dto: MusicUploadCompleteDto,
  ): Promise<AdminMusicDto> {
    return this.musicService.uploadComplete(adminId, dto);
  }

  /**
   * 전체 음악 목록 조회
   */
  @Get()
  @ApiOperation({ summary: "전체 음악 목록 조회" })
  @ApiResponse({
    status: 200,
    description: "모든 음악 목록 반환",
    type: [AdminMusicDto],
  })
  async findAll(): Promise<AdminMusicDto[]> {
    return this.musicService.findAll();
  }

  /**
   * 음악 상세 조회
   */
  @Get(":id")
  @ApiOperation({ summary: "음악 상세 조회" })
  @ApiResponse({
    status: 200,
    description: "음악 상세 정보 반환",
    type: AdminMusicDto,
  })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AdminMusicDto> {
    return this.musicService.findOne(id);
  }

  /**
   * 음악 정보 수정
   */
  @Patch(":id")
  @ApiOperation({ summary: "음악 정보 수정" })
  @ApiResponse({
    status: 200,
    description: "수정된 음악 정보 반환",
    type: AdminMusicDto,
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMusicDto,
  ): Promise<AdminMusicDto> {
    return this.musicService.update(id, dto);
  }

  /**
   * 음악 삭제
   */
  @Delete(":id")
  @ApiOperation({ summary: "음악 삭제" })
  @ApiResponse({
    status: 200,
    description: "삭제 완료",
  })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.musicService.remove(id);
  }

  /**
   * 활성화/비활성화 토글
   */
  @Patch(":id/toggle-active")
  @ApiOperation({ summary: "음악 활성화/비활성화 토글" })
  @ApiResponse({
    status: 200,
    description: "토글된 음악 정보 반환",
    type: AdminMusicDto,
  })
  async toggleActive(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AdminMusicDto> {
    return this.musicService.toggleActive(id);
  }

  /**
   * 재생 순서 변경
   */
  @Put("reorder")
  @ApiOperation({ summary: "음악 재생 순서 변경" })
  @ApiResponse({
    status: 200,
    description: "순서 변경 완료",
  })
  async reorder(@Body() dto: ReorderMusicDto): Promise<void> {
    return this.musicService.reorder(dto);
  }
}
