import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { MobileSettingsSnapshot, UsersService } from "./users.service";
import { UpdateMobileThemePreferenceDto } from "./dto/update-mobile-theme-preference.dto";
import { UpdateMobileNotificationPreferencesDto } from "./dto/update-mobile-notification-preferences.dto";
import { UpdateMobilePrivacyPreferencesDto } from "./dto/update-mobile-privacy-preferences.dto";

@ApiTags("mobile-settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("mobile/settings")
export class MobileSettingsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "모바일 설정 스냅샷 조회" })
  @ApiResponse({ status: 200, description: "모바일 설정 조회 성공" })
  getSettings(
    @CurrentUser() user: { id: string },
  ): Promise<MobileSettingsSnapshot> {
    const accountId = user.id;
    return this.usersService.getMobileSettings(accountId);
  }

  @Patch("theme")
  @ApiOperation({ summary: "모바일 테마 설정 변경" })
  @ApiResponse({ status: 200, description: "모바일 테마 설정 변경 성공" })
  updateTheme(
    @CurrentUser() user: { id: string },
    @Body() updateThemeCommand: UpdateMobileThemePreferenceDto,
  ): Promise<MobileSettingsSnapshot> {
    const accountId = user.id;
    return this.usersService.updateMobileThemePreference(
      accountId,
      updateThemeCommand.themePreference,
    );
  }

  @Patch("notifications")
  @ApiOperation({ summary: "모바일 알림 설정 변경" })
  @ApiResponse({ status: 200, description: "모바일 알림 설정 변경 성공" })
  updateNotifications(
    @CurrentUser() user: { id: string },
    @Body() updateNotificationsCommand: UpdateMobileNotificationPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    const accountId = user.id;
    return this.usersService.updateMobileNotificationPreferences(
      accountId,
      updateNotificationsCommand,
    );
  }

  @Patch("privacy")
  @ApiOperation({ summary: "모바일 프라이버시 설정 변경" })
  @ApiResponse({ status: 200, description: "모바일 프라이버시 설정 변경 성공" })
  updatePrivacy(
    @CurrentUser() user: { id: string },
    @Body() updatePrivacyCommand: UpdateMobilePrivacyPreferencesDto,
  ): Promise<MobileSettingsSnapshot> {
    const accountId = user.id;
    return this.usersService.updateMobilePrivacyPreferences(
      accountId,
      updatePrivacyCommand,
    );
  }
}
