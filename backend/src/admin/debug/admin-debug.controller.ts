import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { User } from "../../users/entities/user.entity";
import { UserDeletionDebugService } from "../../users/services/user-deletion-debug.service";
import { UserDeletionService } from "../../users/services/user-deletion.service";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("Admin - Debug")
@Controller("admin/debug")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminDebugController {
  constructor(
    private readonly debugService: UserDeletionDebugService,
    private readonly deletionService: UserDeletionService,
  ) {}

  @Get("deletion/:userIdOrEmail")
  @ApiOperation({ summary: "사용자 삭제 전 데이터 미리보기 (디버그용)" })
  async previewDeletion(@Param("userIdOrEmail") userIdOrEmail: string) {
    try {
      console.log(`[DEBUG] Preview deletion request for: ${userIdOrEmail}`);
      const debugInfo =
        await this.debugService.collectPreDeletionData(userIdOrEmail);
      console.log(`[DEBUG] Debug info collected successfully`);
      return {
        message: "삭제 예정 데이터 미리보기",
        warning: "이것은 시뮬레이션입니다. 실제로 삭제되지 않습니다.",
        data: debugInfo,
      };
    } catch (error) {
      console.error(`[DEBUG] Error in previewDeletion:`, error);
      throw new NotFoundException(
        `사용자를 찾을 수 없습니다: ${userIdOrEmail} - ${error.message}`,
      );
    }
  }

  @Post("deletion/:userIdOrEmail/simulate")
  @ApiOperation({ summary: "사용자 삭제 시뮬레이션 (실제 삭제 안함)" })
  async simulateDeletion(@Param("userIdOrEmail") userIdOrEmail: string) {
    try {
      // 삭제 전 데이터 수집
      const debugInfo =
        await this.debugService.collectPreDeletionData(userIdOrEmail);
      const userId = debugInfo.userId;

      // 시뮬레이션 단계 추가
      this.debugService.addDeletionStep(
        "initialization",
        "completed",
        "삭제 프로세스 초기화",
        { userId, timestamp: new Date() },
      );

      this.debugService.addDeletionStep(
        "backup_creation",
        "completed",
        "사용자 데이터 백업 생성 (시뮬레이션)",
        { backupId: "simulated-backup-" + Date.now() },
      );

      this.debugService.addDeletionStep(
        "file_deletion",
        "completed",
        `S3 파일 ${debugInfo.beforeDeletion.files.count}개 삭제 (시뮬레이션)`,
        { files: debugInfo.beforeDeletion.files.items },
      );

      this.debugService.addDeletionStep(
        "database_deletion",
        "completed",
        "Database 레코드 삭제 (시뮬레이션)",
        {
          blogs: debugInfo.beforeDeletion.blogs.count,
          posts: debugInfo.beforeDeletion.posts.count,
          comments: debugInfo.beforeDeletion.comments.count,
        },
      );

      this.debugService.addDeletionStep(
        "verification",
        "completed",
        "삭제 검증 완료 (시뮬레이션)",
        { status: "simulated" },
      );

      return {
        message: "삭제 시뮬레이션 완료",
        warning: "이것은 시뮬레이션입니다. 실제로 삭제되지 않습니다.",
        debugInfo: this.debugService.getDebugInfo(),
      };
    } catch (error) {
      throw new NotFoundException(
        `사용자를 찾을 수 없습니다: ${userIdOrEmail}`,
      );
    }
  }

  @Delete("deletion/:userIdOrEmail/execute")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "실제 사용자 삭제 실행 (디버그 모드)" })
  async executeRealDeletion(
    @Param("userIdOrEmail") userIdOrEmail: string,
    @CurrentUser() admin: User,
    @Body()
    options: {
      confirm: boolean;
      softDelete?: boolean;
    },
  ) {
    if (!options.confirm) {
      return {
        error: "Deletion not confirmed",
        message: "confirm 필드를 true로 설정해야 실제 삭제가 실행됩니다.",
      };
    }

    try {
      // 삭제 전 데이터 수집
      const preData =
        await this.debugService.collectPreDeletionData(userIdOrEmail);
      const userId = preData.userId;

      // 실제 삭제 실행
      this.debugService.addDeletionStep(
        "real_deletion_start",
        "in-progress",
        `관리자 ${admin?.email || "DEBUG"}에 의한 실제 삭제 시작`,
        { adminId: admin?.id || "debug", timestamp: new Date() },
      );

      const result = await this.deletionService.deleteUserAccount(userId, {
        softDelete: options.softDelete || false,
        backupData: true,
        notifyByEmail: false, // 디버그 모드에서는 이메일 알림 안함
      });

      this.debugService.addDeletionStep(
        "real_deletion_complete",
        "completed",
        "실제 삭제 완료",
        result,
      );

      // 삭제 후 검증
      await this.debugService.verifyDeletion(userId);

      const finalDebugInfo = this.debugService.getDebugInfo();

      return {
        message: "사용자 삭제 완료",
        result,
        debugInfo: finalDebugInfo,
        summary: {
          deletedUser: {
            id: userId,
            username: preData.username,
            email: preData.email,
          },
          deletedData: {
            blogs: preData.beforeDeletion.blogs.count,
            posts: preData.beforeDeletion.posts.count,
            comments: preData.beforeDeletion.comments.count,
            files: preData.beforeDeletion.files.count,
            totalFileSize: this.formatBytes(
              preData.beforeDeletion.totalDataSize,
            ),
          },
          verificationStatus: finalDebugInfo?.afterDeletion.verificationStatus,
        },
      };
    } catch (error) {
      this.debugService.addDeletionStep(
        "real_deletion_error",
        "failed",
        `삭제 실패: ${error.message}`,
        { error: error.stack },
      );

      return {
        error: "Deletion failed",
        message: error.message,
        debugInfo: this.debugService.getDebugInfo(),
      };
    }
  }

  @Get("deletion/status")
  @ApiOperation({ summary: "현재 디버그 정보 조회" })
  async getCurrentDebugInfo() {
    const debugInfo = this.debugService.getDebugInfo();

    if (!debugInfo) {
      return {
        message: "현재 진행 중인 디버그 세션이 없습니다.",
        hint: "GET /admin/debug/deletion/:userId 를 먼저 호출하세요.",
      };
    }

    return {
      message: "현재 디버그 정보",
      data: debugInfo,
    };
  }

  @Post("deletion/clear")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "디버그 정보 초기화" })
  async clearDebugInfo() {
    this.debugService.clearDebugInfo();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
