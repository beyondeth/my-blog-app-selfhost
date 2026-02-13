import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { MobileRefreshTokenDto } from "./dto/mobile-refresh-token.dto";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "../users/users.service";
import { UnifiedRedisService } from "../redis/unified-redis.service";

@Controller("mobile/auth")
@ApiTags("mobile-auth")
export class MobileAuthController {
  private readonly logger = new Logger(MobileAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly redisService: UnifiedRedisService,
  ) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "모바일 로그인" })
  @ApiResponse({ status: 200, description: "모바일 로그인 성공" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  async mobileLogin(@Body() loginDto: LoginDto) {
    const authResponse = await this.authService.login(loginDto);

    return {
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      user: authResponse.user,
      message: "로그인 성공",
    };
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "모바일 토큰 갱신" })
  @ApiResponse({ status: 200, description: "토큰 갱신 성공" })
  @ApiResponse({ status: 401, description: "유효하지 않은 토큰" })
  async mobileRefresh(@Body() dto: MobileRefreshTokenDto) {
    const refreshToken = dto?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const authResponse = await this.authService.refreshTokens(refreshToken);

    return {
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      user: authResponse.user,
      message: "토큰 갱신 성공",
    };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "모바일 사용자 정보 조회" })
  @ApiResponse({ status: 200, description: "사용자 정보 조회 성공" })
  async mobileGetCurrentUser(@CurrentUser() user: any) {
    if (!user) {
      return null;
    }
    try {
      const fullUser = await this.usersService.findOne(user.id);
      if (!fullUser) {
        return this.buildFallbackUser(user);
      }

      return {
        id: fullUser.id,
        email: fullUser.email,
        username: fullUser.username,
        role: fullUser.role,
        profileImage: fullUser.profileImage,
        isEmailVerified: fullUser.isEmailVerified,
        authProvider: fullUser.authProvider,
        lastLoginProvider: fullUser.lastLoginProvider,
        subscriptionTier: fullUser.subscriptionTier,
        subscriptionStatus: fullUser.subscriptionStatus,
        bio: fullUser.bio,
        jobTitle: fullUser.jobTitle,
        socialLinks: fullUser.socialLinks ?? [],
        blogSlug: fullUser.blog?.slug || null,
        termsAcceptedAt: fullUser.termsAcceptedAt,
        privacyAcceptedAt: fullUser.privacyAcceptedAt,
        marketingOptIn: fullUser.marketingOptIn,
        newsletterOptIn: fullUser.newsletterOptIn,
        createdAt: fullUser.createdAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`mobileGetCurrentUser user not found: ${user.id}`);
      } else {
        this.logger.error(
          `mobileGetCurrentUser fallback for user=${user.id}: ${error?.message ?? error}`,
        );
      }
      return this.buildFallbackUser(user);
    }
  }

  private buildFallbackUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified,
      authProvider: user.authProvider,
      lastLoginProvider: user.lastLoginProvider,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      bio: user.bio,
      blogSlug: user.blog?.slug || null,
      jobTitle: user.jobTitle || null,
      termsAcceptedAt: user.termsAcceptedAt,
      privacyAcceptedAt: user.privacyAcceptedAt,
      marketingOptIn: user.marketingOptIn,
      newsletterOptIn: user.newsletterOptIn,
      socialLinks: user.socialLinks ?? [],
      createdAt: user.createdAt,
    };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "모바일 로그아웃" })
  @ApiResponse({ status: 200, description: "모바일 로그아웃 성공" })
  async mobileLogout(@CurrentUser() user: any) {
    await this.authService.logout(user.id);

    try {
      await this.redisService.deleteCache("sessions", `user:${user.id}`);
      await this.redisService.deleteCache(
        "sessions",
        `user_validate_${user.id}`,
      );
      this.logger.debug(`모바일 세션 정리 완료 userId=${user.id}`);
    } catch (error) {
      this.logger.error(`모바일 로그아웃 세션 삭제 실패: ${error.message}`);
    }

    return { message: "로그아웃되었습니다." };
  }
}
