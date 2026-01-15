import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Res,
  Delete,
  Logger,
  Req,
  Query,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { EmailService } from "../email/email.service";
import { UserDeletionService } from "../users/services/user-deletion.service";
import { UsersService } from "../users/users.service";
import { SendCodeDto } from "../email/dto/send-code.dto";
import { VerifyCodeDto } from "../email/dto/verify-code.dto";
import { CheckEmailDto } from "./dto/check-email.dto";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { KakaoAuthGuard } from "./guards/kakao-auth.guard";
import { GitHubAuthGuard } from "./guards/github-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { ConsentDto } from "./dto/consent.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UnifiedRedisService } from "../redis/unified-redis.service";
import { User } from "../users/entities/user.entity";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly userDeletionService: UserDeletionService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly redisService: UnifiedRedisService,
  ) {}

  /**
   * 웹 로그인 시 MCP 세션과 동기화를 위한 헬퍼 메서드
   * 웹에서 로그인하면 MCP 세션도 활성화 상태로 만들어 통일성 유지
   */
  private async createWebSessionInRedis(
    userId: number | string,
  ): Promise<void> {
    try {
      // userId는 UUID이므로 문자열로 유지
      const userIdString = String(userId);

      // 웹 세션을 Redis에 저장 (MCP 세션 검증에 사용)
      const sessionData = {
        userId: userIdString,
        isActive: true,
        loginAt: Date.now(),
        lastAccessAt: Date.now(),
      };

      // 24시간 TTL로 세션 저장
      await this.redisService.setCache(
        "sessions",
        `user:${userIdString}`,
        sessionData,
        24 * 60 * 60, // 24시간
      );

      this.logger.debug(`웹 세션 생성: userId=${userIdString}`);
    } catch (error) {
      this.logger.error(`웹 세션 생성 실패: ${error.message}`);
      // 세션 생성 실패해도 로그인은 진행
    }
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 분당 5회 제한 (브루트포스 공격 방지)
  @ApiOperation({ summary: "로그인" })
  @ApiResponse({ status: 200, description: "로그인 성공" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  @ApiResponse({ status: 429, description: "요청 횟수 초과" })
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const authResponse = await this.authService.login(loginDto);

    // HttpOnly 쿠키로 토큰들 설정
    res.cookie("access_token", authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 프로덕션에서만 HTTPS 사용
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // 개발 환경에서는 lax 사용
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: "/",
    });

    res.cookie("refresh_token", authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: "/",
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(authResponse.user.id);

    // 항상 JSON 응답 반환 (프론트엔드에서 리다이렉트 처리)
    return res.json({
      user: authResponse.user,
      message: "로그인 성공",
      ...(process.env.NODE_ENV !== "production" && {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
      }),
    });
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "회원가입" })
  @ApiResponse({ status: 201, description: "회원가입 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const authResponse = await this.authService.register(registerDto);

    // HttpOnly 쿠키로 토큰들 설정
    res.cookie("access_token", authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 프로덕션에서만 HTTPS 사용
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // 개발 환경에서는 lax 사용
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: "/",
    });

    res.cookie("refresh_token", authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: "/",
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(authResponse.user.id);

    // 토큰 제외하고 사용자 정보만 반환 (개발 환경에서는 토큰도 포함)
    return res.json({
      user: authResponse.user,
      message: "회원가입 성공",
      ...(process.env.NODE_ENV !== "production" && {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
      }),
    });
  }

  @Public()
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "구글 로그인" })
  googleAuth() {
    // Google OAuth 시작
  }

  @Public()
  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "구글 로그인 콜백" })
  async googleAuthRedirect(@Request() req, @Res() res) {
    try {
      // OAuth Guard가 이미 사용자를 찾았는지 확인
      if (!req.user || !req.user.user) {
        this.logger.error(`[Google OAuth Callback] No user found in request`);
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=auth_failed`,
        );
      }

      // 🔍 디버그: OAuth 콜백에서 받은 user 정보 확인
      this.logger.log(
        `[Google OAuth Callback] User: ${req.user.user.email}, Role in response: ${req.user.user.role}`,
      );

      // HttpOnly 쿠키로 토큰들 설정
      res.cookie("access_token", req.user.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
        path: "/",
      });

      res.cookie("refresh_token", req.user.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        path: "/",
      });

      // 🔍 디버그: 쿠키 설정 완료 로그
      this.logger.log(
        `[Google OAuth Callback] Cookies set - access_token length: ${req.user.access_token.length}`,
      );

      // 웹 세션 생성 (MCP 세션과 동기화를 위해)
      await this.createWebSessionInRedis(req.user.user.id);

      // 약관 동의 여부 확인
      const user = req.user.user;
      const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

      this.logger.debug(
        `Google OAuth callback - User: ${user.id}, termsAcceptedAt: ${user.termsAcceptedAt}, needsConsent: ${needsConsent}`,
      );

      // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
      const redirectPath = needsConsent ? "/consent" : "/";
      res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
    } catch (error) {
      this.logger.error(`[Google OAuth Callback] Error:`, error);

      // 에러 메시지 추출
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Authentication failed";

      // 헤더가 이미 전송되었는지 확인
      if (!res.headersSent) {
        // Handle specific error codes
        const code = error.response?.code || error.code;
        
        if (code === "ACCOUNT_DELETED" || errorMessage.includes("계정이 삭제되었습니다")) {
           return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_deleted&message=${encodeURIComponent(errorMessage)}`,
          );
        }
        
        if (code === "ACCOUNT_SUSPENDED" || errorMessage.includes("계정이 정지되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_suspended&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}&until=${encodeURIComponent(error.response?.suspensionUntil || error.suspensionUntil || "")}`,
          );
        }
        
        if (code === "ACCOUNT_BANNED" || errorMessage.includes("계정이 영구 차단되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_banned&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}`,
          );
        }

        // 기본 에러 처리
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=oauth_failed&message=${encodeURIComponent("로그인에 실패했습니다. 다시 시도해주세요.")}`,
        );
      }
    }
  }

  @Public()
  @Get("kakao")
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({ summary: "카카오 로그인" })
  kakaoAuth() {
    // Kakao OAuth 시작
  }

  @Public()
  @Get("kakao/callback")
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({ summary: "카카오 로그인 콜백" })
  async kakaoAuthRedirect(@Request() req, @Res() res) {
    try {
      // HttpOnly 쿠키로 토큰들 설정
      res.cookie("access_token", req.user.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
        path: "/",
      });

      res.cookie("refresh_token", req.user.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        path: "/",
      });

      // 웹 세션 생성 (MCP 세션과 동기화를 위해)
      await this.createWebSessionInRedis(req.user.user.id);

      // 약관 동의 여부 확인
      const user = req.user.user;
      const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

      // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
      const redirectPath = needsConsent ? "/consent" : "/";

      // 헤더가 이미 전송되었는지 확인
      if (!res.headersSent) {
        res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
      }
    } catch (error) {
      this.logger.error("카카오 로그인 콜백 처리 중 오류 발생:", error);

      // 헤더가 이미 전송되었는지 확인
      if (!res.headersSent) {
        const errorMessage =
          error.message || "카카오 로그인 처리 중 오류가 발생했습니다.";
        const code = error.response?.code || error.code;

        // Handle specific error codes
        if (code === "ACCOUNT_DELETED" || errorMessage.includes("계정이 삭제되었습니다")) {
          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_deleted&message=${encodeURIComponent(errorMessage)}`,
          );
        }

        if (code === "ACCOUNT_SUSPENDED" || errorMessage.includes("계정이 정지되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_suspended&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}&until=${encodeURIComponent(error.response?.suspensionUntil || error.suspensionUntil || "")}`,
          );
        }
        
        if (code === "ACCOUNT_BANNED" || errorMessage.includes("계정이 영구 차단되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_banned&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}`,
          );
        }

        res.redirect(
          `${process.env.FRONTEND_URL}/login?error=kakao_auth_failed&message=${encodeURIComponent(errorMessage)}`,
        );
      }
    }
  }

  @Public()
  @Get("github")
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: "GitHub 로그인" })
  async githubAuth() {
    // GitHub OAuth redirect will be handled by Passport
  }

  @Public()
  @Get("github/callback")
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: "GitHub 로그인 콜백" })
  async githubAuthRedirect(@Request() req, @Res() res) {
    try {
      // OAuth Guard가 이미 사용자를 찾았는지 확인
      if (!req.user || !req.user.user) {
        this.logger.error(`[GitHub OAuth Callback] No user found in request`);
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=auth_failed`,
        );
      }

      // HttpOnly 쿠키로 토큰들 설정
      res.cookie("access_token", req.user.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
        path: "/",
      });

      res.cookie("refresh_token", req.user.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        path: "/",
      });

      // 웹 세션 생성 (MCP 세션과 동기화를 위해)
      await this.createWebSessionInRedis(req.user.user.id);

      // 약관 동의 여부 확인
      const user = req.user.user;
      const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

      // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
      const redirectPath = needsConsent ? "/consent" : "/";
      res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
    } catch (error) {
      this.logger.error(`[GitHub OAuth Callback] Error:`, error);

      // 에러 메시지 추출
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Authentication failed";

      // 헤더가 이미 전송되었는지 확인
      if (!res.headersSent) {
        // Handle specific error codes
        const code = error.response?.code || error.code;
        
        if (code === "ACCOUNT_DELETED" || errorMessage.includes("계정이 삭제되었습니다")) {
           return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_deleted&message=${encodeURIComponent(errorMessage)}`,
          );
        }
        
        if (code === "ACCOUNT_SUSPENDED" || errorMessage.includes("계정이 정지되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_suspended&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}&until=${encodeURIComponent(error.response?.suspensionUntil || error.suspensionUntil || "")}`,
          );
        }
        
        if (code === "ACCOUNT_BANNED" || errorMessage.includes("계정이 영구 차단되었습니다")) {
             return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=account_banned&message=${encodeURIComponent(errorMessage)}&reason=${encodeURIComponent(error.response?.reason || error.reason || "")}`,
          );
        }

        // 기본 에러 처리
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=oauth_failed&message=${encodeURIComponent("로그인에 실패했습니다. 다시 시도해주세요.")}`,
        );
      }
    }
  }

  @Public()
  @Post("email/send-code")
  @ApiOperation({ summary: "이메일 인증 코드 발송" })
  @ApiResponse({ status: 200, description: "인증 코드 발송 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  @ApiResponse({ status: 409, description: "이미 존재하는 이메일" })
  async sendEmailCode(@Body() dto: SendCodeDto, @Res() res: Response) {
    try {
      await this.emailService.sendVerificationCode(dto.email);
      return res.json({
        success: true,
        message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
      });
    } catch (error) {
      if (error.status === 409) {
        // ConflictException - 이미 가입된 이메일
        return res.status(409).json({
          success: false,
          message: error.message,
          code: "EMAIL_ALREADY_EXISTS",
        });
      }
      if (error.status === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: "인증 코드 발송에 실패했습니다.",
      });
    }
  }

  @Public()
  @Post("email/verify-code")
  @ApiOperation({ summary: "이메일 인증 코드 검증" })
  @ApiResponse({ status: 200, description: "인증 코드 검증 성공" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  async verifyEmailCode(@Body() dto: VerifyCodeDto, @Res() res: Response) {
    try {
      const result = await this.emailService.verifyCode(dto.email, dto.code);
      return res.json({
        success: true,
        verified: result.verified,
        sessionToken: result.sessionToken,
        message: "이메일 인증이 완료되었습니다.",
      });
    } catch (error) {
      if (error.status === 401 || error.status === 400) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: "인증 코드 검증에 실패했습니다.",
      });
    }
  }

  @Public()
  @Post("email/resend-code")
  @ApiOperation({ summary: "이메일 인증 코드 재발송" })
  @ApiResponse({ status: 200, description: "인증 코드 재발송 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async resendEmailCode(@Body() dto: SendCodeDto, @Res() res: Response) {
    try {
      await this.emailService.resendVerificationCode(dto.email);
      return res.json({
        success: true,
        message: "인증 코드가 재발송되었습니다. 이메일을 확인해주세요.",
      });
    } catch (error) {
      if (error.status === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: "인증 코드 재발송에 실패했습니다.",
      });
    }
  }

  @Post("refresh")
  @Public()
  @ApiOperation({ summary: "토큰 갱신" })
  @ApiResponse({ status: 200, description: "토큰 갱신 성공" })
  @ApiResponse({ status: 401, description: "유효하지 않은 토큰" })
  async refreshToken(@Request() req, @Res() res: Response) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    const authResponse = await this.authService.refreshTokens(refreshToken);

    // 새로운 토큰들을 쿠키에 설정
    res.cookie("access_token", authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: "/",
    });

    res.cookie("refresh_token", authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: "/",
    });

    return res.json({
      user: authResponse.user,
      message: "토큰이 갱신되었습니다.",
    });
  }

  @Get("me")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "현재 사용자 정보 조회" })
  @ApiResponse({ status: 200, description: "사용자 정보 조회 성공" })
  async getCurrentUser(@CurrentUser() user: any) {
    if (!user) {
      return null;
    }

    // UsersService를 통해 CDN URL이 적용된 사용자 정보 가져오기
    const fullUser = await this.usersService.findOne(user.id);

    if (!fullUser) {
      const fallbackResponse = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider, // 최초 가입 방법 (계정 관리용)
        lastLoginProvider: user.lastLoginProvider, // 현재 로그인 방법 (계정 삭제 UX용)
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

      this.logger.debug(
        `[/auth/me] Fallback response - authProvider: ${fallbackResponse.authProvider}, lastLoginProvider: ${fallbackResponse.lastLoginProvider}`,
      );
      return fallbackResponse;
    }

    // 보안을 위해 공개 정보만 반환 (CDN URL 적용됨)
    const response = {
      id: fullUser.id,
      email: fullUser.email,
      username: fullUser.username,
      role: fullUser.role,
      profileImage: fullUser.profileImage, // ✅ CDN URL로 변환됨
      isEmailVerified: fullUser.isEmailVerified,
      authProvider: fullUser.authProvider, // 최초 가입 방법 (계정 관리용)
      lastLoginProvider: fullUser.lastLoginProvider, // 현재 로그인 방법 (계정 삭제 UX용)
      subscriptionTier: fullUser.subscriptionTier,
      subscriptionStatus: fullUser.subscriptionStatus,
      bio: fullUser.bio,
      jobTitle: fullUser.jobTitle,
      socialLinks: fullUser.socialLinks ?? [],
      blogSlug: fullUser.blog?.slug || null,
      termsAcceptedAt: fullUser.termsAcceptedAt, // 약관 동의 시각
      privacyAcceptedAt: fullUser.privacyAcceptedAt, // 개인정보 동의 시각
      marketingOptIn: fullUser.marketingOptIn, // 마케팅 정보 수신 동의
      newsletterOptIn: fullUser.newsletterOptIn, // 뉴스레터 수신 동의
      createdAt: fullUser.createdAt,
    };

    this.logger.debug(
      `[/auth/me] Response for ${fullUser.email} - authProvider: ${response.authProvider}, lastLoginProvider: ${response.lastLoginProvider}`,
    );
    return response;
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "로그아웃" })
  @ApiResponse({ status: 200, description: "로그아웃 성공" })
  async logout(@CurrentUser() user: any, @Res() res: Response) {
    this.logger.log(
      `[Logout] 로그아웃 시작 - userId: ${user.id}, email: ${user.email}`,
    );

    await this.authService.logout(user.id);

    // 웹 세션 삭제 (MCP 세션도 무효화되도록)
    try {
      // 웹 세션 삭제
      await this.redisService.deleteCache("sessions", `user:${user.id}`);

      // JWT validation 캐시 삭제 (JwtStrategy가 사용)
      await this.redisService.deleteCache(
        "sessions",
        `user_validate_${user.id}`,
      );

      // 해당 사용자의 모든 MCP 세션 찾아서 삭제
      // MCP 세션은 mcp:sessions:* 패턴으로 저장되어 있고, 세션 데이터에 userId가 포함됨
      // 여기서는 간단히 웹 세션만 삭제하고, MCP 세션은 검증 시 자동으로 무효화됨
      this.logger.debug(
        `웹 세션 및 JWT validation 캐시 삭제: userId=${user.id}`,
      );
    } catch (error) {
      this.logger.error(`세션 삭제 실패: ${error.message}`);
      // 세션 삭제 실패해도 로그아웃은 진행
    }

    // 모든 쿠키 제거
    this.logger.log(`[Logout] 쿠키 삭제 중 - access_token, refresh_token`);

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    this.logger.log(`[Logout] 로그아웃 완료 - userId: ${user.id}`);

    return res.json({ message: "로그아웃되었습니다." });
  }

  @Post("check-email")
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 1분에 3회 제한
  @ApiOperation({ summary: "이메일 존재 여부 확인" })
  @ApiResponse({ status: 200, description: "이메일 존재 여부 반환" })
  async checkEmail(
    @Body() dto: CheckEmailDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const result = await this.authService.checkEmailExists(dto.email);

      return res.json({
        success: true,
        exists: result.exists,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "이메일 확인 중 오류가 발생했습니다.",
      });
    }
  }

  @Post("forgot-password")
  @Public()
  @ApiOperation({ summary: "비밀번호 재설정 요청" })
  @ApiResponse({ status: 200, description: "재설정 이메일 발송 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async forgotPassword(
    @Body() dto: { email: string },
    @Request() req,
    @Res() res: Response,
  ) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];

      await this.authService.forgotPassword(dto.email, ipAddress, userAgent);

      // 보안: 계정 존재 여부와 관계없이 동일한 응답
      return res.json({
        success: true,
        message: "이메일이 등록되어 있다면 비밀번호 재설정 링크가 발송됩니다.",
      });
    } catch (error) {
      if (error.message?.includes("소셜 로그인")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      // 다른 에러도 보안상 동일한 메시지
      return res.json({
        success: true,
        message: "이메일이 등록되어 있다면 비밀번호 재설정 링크가 발송됩니다.",
      });
    }
  }

  @Post("validate-reset-token")
  @Public()
  @ApiOperation({ summary: "비밀번호 재설정 토큰 검증" })
  @ApiResponse({ status: 200, description: "토큰 유효" })
  @ApiResponse({ status: 400, description: "토큰 무효" })
  async validateResetToken(
    @Body() dto: { token: string },
    @Res() res: Response,
  ) {
    const isValid = await this.authService.validateResetToken(dto.token);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    return res.json({
      success: true,
      valid: true,
    });
  }

  @Post("reset-password")
  @Public()
  @ApiOperation({ summary: "비밀번호 재설정" })
  @ApiResponse({ status: 200, description: "비밀번호 재설정 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async resetPassword(
    @Body() dto: { token: string; newPassword: string },
    @Res() res: Response,
  ) {
    try {
      await this.authService.resetPassword(dto.token, dto.newPassword);

      return res.json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "비밀번호 재설정에 실패했습니다.",
      });
    }
  }

  /**
   * 비밀번호 변경 (로그인한 사용자)
   * 현재 비밀번호를 입력하고 새 비밀번호로 변경
   *
   * 보안:
   * - JWT 인증 필수
   * - 현재 비밀번호 검증 필수
   * - 소셜 로그인 계정은 불가
   */
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "비밀번호 변경 (로그인한 사용자)" })
  @ApiResponse({ status: 200, description: "비밀번호 변경 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  @ApiResponse({
    status: 401,
    description: "인증 실패 또는 현재 비밀번호 불일치",
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res() res: Response,
  ) {
    try {
      await this.authService.changePassword(
        user.id,
        dto.currentPassword,
        dto.newPassword,
      );

      return res.json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      // 상태 코드 결정
      const statusCode = error.status || 400;

      return res.status(statusCode).json({
        success: false,
        message: error.message || "비밀번호 변경에 실패했습니다.",
      });
    }
  }

  @Delete("account")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "계정 탈퇴" })
  @ApiResponse({ status: 200, description: "계정 삭제 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
    @Res() res: Response,
  ) {
    /**
     * UX 개선: 현재 세션의 로그인 방법 기준으로 비밀번호 확인
     *
     * 시나리오:
     * 1. 로컬 가입 → 로컬 로그인 → 계정 삭제: 비밀번호 필요 ✅
     * 2. 로컬 가입 → 구글 로그인 → 계정 삭제: 비밀번호 불필요 ✅
     * 3. 구글 가입만 → 계정 삭제: 비밀번호 불필요 ✅
     *
     * lastLoginProvider: 현재 세션의 로그인 방법
     * authProvider: 최초 가입 방법 (변경 안됨)
     */
    const currentLoginMethod =
      user.lastLoginProvider || user.authProvider || "local";

    if (currentLoginMethod === "local") {
      // 로컬 로그인 사용자만 비밀번호 확인
      if (!dto.password) {
        return res.status(400).json({
          success: false,
          message: "비밀번호를 입력해주세요.",
        });
      }

      // 비밀번호 재확인
      const validUser = await this.authService.validateUser(
        user.email,
        dto.password,
      );
      if (!validUser) {
        return res.status(401).json({
          success: false,
          message: "비밀번호가 일치하지 않습니다.",
        });
      }
    }
    // OAuth로 로그인한 사용자는 비밀번호 없이 삭제 가능

    try {
      // 1. 즉시 소프트 삭제 실행 (개인정보 마스킹 + 로그인 차단)
      await this.usersService.softDelete(user.id);
      this.logger.log(`User ${user.id} soft deleted, personal data masked`);

      // 2. 180일 후 자동 완전 삭제 (DataRetentionService가 매일 자정 처리)
      // scheduledDeletionAt이 account_settings 테이블에 저장됨
      this.logger.log(
        `User ${user.id} scheduled for permanent deletion in 180 days`,
      );

      // 3. 웹 세션 삭제 (MCP 세션도 무효화되도록)
      try {
        await this.redisService.deleteCache("sessions", `user:${user.id}`);
        this.logger.debug(`Session deleted for user ${user.id}`);
      } catch (error) {
        this.logger.error(`Failed to delete session: ${error.message}`);
      }

      // 4. 쿠키 제거
      res.clearCookie("access_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });

      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
      });

      // 5. 즉시 성공 응답 (백그라운드 작업은 비동기로 처리됨)
      return res.json({
        success: true,
        message:
          "계정 삭제가 요청되었습니다. 개인정보는 즉시 마스킹되었으며, 관련 데이터는 법적 보관 기간 후 자동으로 삭제됩니다.",
        deletedAt: new Date().toISOString(),
        info: {
          personalDataMasked: true,
          backgroundDeletionQueued: true,
          legalRetentionPeriod: "결제 기록: 5년, 분쟁 기록: 3년, 메시지: 30일",
        },
      });
    } catch (error) {
      this.logger.error(`Account deletion failed for user ${user.id}:`, error);
      return res.status(400).json({
        success: false,
        message: error.message || "계정 삭제 중 오류가 발생했습니다.",
      });
    }
  }

  // ===== MCP OAuth 관련 엔드포인트 =====

  /**
   * MCP OAuth 로그인 페이지
   *
   * MCP Proxy Server에서 OAuth 인증 시작 시 사용자를 이 URL로 리다이렉트
   * 이미 로그인된 사용자는 바로 MCP Proxy callback으로 전달
   * 로그인되지 않은 사용자는 로그인 페이지로 리다이렉트
   *
   * 쿼리 파라미터:
   * - state: MCP OAuth 세션 상태
   * - client_name: 연결하려는 클라이언트 이름 (예: "Claude")
   * - scope: 요청 스코프
   * - callback_url: MCP Proxy의 콜백 URL
   */
  @Get("oauth/mcp/login")
  @Public()
  @ApiOperation({ summary: "MCP OAuth 로그인 (Claude 커스텀 커넥터용)" })
  async mcpOAuthLogin(
    @Query("state") state: string,
    @Query("client_name") clientName: string,
    @Query("scope") scope: string,
    @Query("callback_url") callbackUrl: string,
    @Request() req,
    @Res() res: Response,
  ) {
    this.logger.debug(
      {
        state: state?.substring(0, 8),
        clientName,
        scope,
      },
      "🔐 MCP OAuth login request",
    );

    // 필수 파라미터 검증
    if (!state || !callbackUrl) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameters: state, callback_url",
      });
    }

    // 쿠키에서 access_token 확인 (이미 로그인된 사용자)
    const accessToken = req.cookies?.access_token;

    if (accessToken) {
      try {
        // JWT 검증하여 사용자 정보 추출
        const user = await this.authService.validateAccessToken(accessToken);

        if (user) {
          // 이미 로그인된 사용자 - MCP Proxy callback으로 리다이렉트
          this.logger.log(
            `✅ MCP OAuth - Already logged in, userId: ${user.id.substring(0, 8)}, clientName: ${clientName}`,
          );

          const redirectUrl = new URL(callbackUrl);
          redirectUrl.searchParams.set("state", state);
          redirectUrl.searchParams.set("user_id", user.id);

          return res.redirect(redirectUrl.toString());
        }
      } catch (error) {
        // 토큰 검증 실패 - 로그인 페이지로 이동
        this.logger.debug("Token validation failed, redirecting to login");
      }
    }

    // 로그인되지 않은 사용자 - Frontend 로그인 페이지로 리다이렉트
    // MCP OAuth 파라미터를 쿼리스트링으로 전달
    const frontendLoginUrl = new URL(`${process.env.FRONTEND_URL}/login`);
    frontendLoginUrl.searchParams.set("mcp_oauth", "true");
    frontendLoginUrl.searchParams.set("state", state);
    frontendLoginUrl.searchParams.set(
      "client_name",
      clientName || "MCP Client",
    );
    frontendLoginUrl.searchParams.set("scope", scope || "mcp:tools");
    frontendLoginUrl.searchParams.set("callback_url", callbackUrl);

    this.logger.debug(
      { frontendLoginUrl: frontendLoginUrl.toString() },
      "➡️ Redirecting to frontend login",
    );
    return res.redirect(frontendLoginUrl.toString());
  }

  /**
   * MCP OAuth 로그인 완료 (Frontend에서 호출)
   *
   * Frontend에서 로그인 성공 후 MCP OAuth 콜백을 처리
   * 이 엔드포인트는 로그인된 사용자만 호출 가능
   */
  @Post("oauth/mcp/complete")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "MCP OAuth 로그인 완료 (Frontend에서 호출)" })
  async mcpOAuthComplete(
    @Body() body: { state: string; callback_url: string },
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { state, callback_url } = body;

    if (!state || !callback_url) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameters",
      });
    }

    this.logger.log(
      `✅ MCP OAuth login completed - userId: ${user.id.substring(0, 8)}, state: ${state.substring(0, 8)}`,
    );

    // MCP Proxy callback URL 생성
    const redirectUrl = new URL(callback_url);
    redirectUrl.searchParams.set("state", state);
    redirectUrl.searchParams.set("user_id", user.id);

    return res.json({
      success: true,
      redirect_url: redirectUrl.toString(),
    });
  }

  /**
   * OAuth 로그인 후 약관 동의 완료
   * 소셜 로그인 사용자가 최초 로그인 시 필수 약관 동의를 받은 후 호출
   */
  @Post("consent")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "OAuth 로그인 후 약관 동의 완료" })
  @ApiResponse({
    status: 200,
    description: "약관 동의 완료",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "약관 동의가 완료되었습니다." },
      },
    },
  })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  async updateConsent(
    @CurrentUser() user: User,
    @Body() consentDto: ConsentDto,
    @Res() res: Response,
  ) {
    try {
      await this.authService.updateConsent(user.id, consentDto);

      return res.status(200).json({
        success: true,
        message: "약관 동의가 완료되었습니다.",
      });
    } catch (error) {
      this.logger.error(`Consent update failed for user ${user.id}:`, error);
      return res.status(400).json({
        success: false,
        message: error.message || "약관 동의 처리 중 오류가 발생했습니다.",
      });
    }
  }
}
