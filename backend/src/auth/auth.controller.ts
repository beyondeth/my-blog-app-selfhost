import { Controller, Post, Body, UseGuards, Request, Get, Res, Delete, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { UserDeletionService } from '../users/services/user-deletion.service';
import { UserDeletionQueueService } from '../users/services/user-deletion-queue.service';
import { UsersService } from '../users/users.service';
import { SendCodeDto } from '../email/dto/send-code.dto';
import { VerifyCodeDto } from '../email/dto/verify-code.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ConsentDto } from './dto/consent.dto';
import { User } from '../users/entities/user.entity';
import { UnifiedRedisService } from '../redis/unified-redis.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly userDeletionService: UserDeletionService,
    private readonly userDeletionQueueService: UserDeletionQueueService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly redisService: UnifiedRedisService,
  ) {}

  /**
   * 웹 로그인 시 MCP 세션과 동기화를 위한 헬퍼 메서드
   * 웹에서 로그인하면 MCP 세션도 활성화 상태로 만들어 통일성 유지
   */
  private async createWebSessionInRedis(userId: number | string): Promise<void> {
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
        'sessions',
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
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })  // 분당 5회 제한 (브루트포스 공격 방지)
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 429, description: '요청 횟수 초과' })
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const authResponse = await this.authService.login(loginDto);

    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', authResponse.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', authResponse.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(authResponse.user.id);

    // 항상 JSON 응답 반환 (프론트엔드에서 리다이렉트 처리)
    return res.json({
      user: authResponse.user,
      message: '로그인 성공',
      ...(process.env.NODE_ENV !== 'production' && {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
      }),
    });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const authResponse = await this.authService.register(registerDto);
    
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', authResponse.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', authResponse.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(authResponse.user.id);

    // 토큰 제외하고 사용자 정보만 반환 (개발 환경에서는 토큰도 포함)
    return res.json({
      user: authResponse.user,
      message: '회원가입 성공',
      ...(process.env.NODE_ENV !== 'production' && {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
      }),
    });
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: '구글 로그인' })
  googleAuth() {
    // Google OAuth 시작
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: '구글 로그인 콜백' })
  async googleAuthRedirect(@Request() req, @Res() res) {
    // 🔍 디버그: OAuth 콜백에서 받은 user 정보 확인
    this.logger.log(`[Google OAuth Callback] User: ${req.user.user.email}, Role in response: ${req.user.user.role}`);

    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', req.user.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', req.user.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 🔍 디버그: 쿠키 설정 완료 로그
    this.logger.log(`[Google OAuth Callback] Cookies set - access_token length: ${req.user.access_token.length}`);

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(req.user.user.id);

    // 약관 동의 여부 확인
    const user = req.user.user;
    const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

    this.logger.debug(`Google OAuth callback - User: ${user.id}, termsAcceptedAt: ${user.termsAcceptedAt}, needsConsent: ${needsConsent}`);

    // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
    const redirectPath = needsConsent ? '/consent' : '/';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  }

  @Public()
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({ summary: '카카오 로그인' })
  kakaoAuth() {
    // Kakao OAuth 시작
  }

  @Public()
  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({ summary: '카카오 로그인 콜백' })
  async kakaoAuthRedirect(@Request() req, @Res() res) {
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', req.user.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', req.user.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(req.user.user.id);

    // 약관 동의 여부 확인
    const user = req.user.user;
    const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

    // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
    const redirectPath = needsConsent ? '/consent' : '/';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  }

  @Public()
  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'GitHub 로그인' })
  async githubAuth() {
    // GitHub OAuth redirect will be handled by Passport
  }

  @Public()
  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: 'GitHub 로그인 콜백' })
  async githubAuthRedirect(@Request() req, @Res() res) {
    if (!req.user) {
      return res.status(401).json({
        statusCode: 401,
        message: 'GitHub authentication failed',
      });
    }

    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', req.user.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', req.user.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 웹 세션 생성 (MCP 세션과 동기화를 위해)
    await this.createWebSessionInRedis(req.user.user.id);

    // 약관 동의 여부 확인
    const user = req.user.user;
    const needsConsent = !user.termsAcceptedAt || !user.privacyAcceptedAt;

    // 약관 동의가 필요하면 /consent로, 아니면 홈으로 리다이렉트
    const redirectPath = needsConsent ? '/consent' : '/';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  }

  @Public()
  @Post('email/send-code')
  @ApiOperation({ summary: '이메일 인증 코드 발송' })
  @ApiResponse({ status: 200, description: '인증 코드 발송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 409, description: '이미 존재하는 이메일' })
  async sendEmailCode(@Body() dto: SendCodeDto, @Res() res: Response) {
    try {
      await this.emailService.sendVerificationCode(dto.email);
      return res.json({ 
        success: true,
        message: '인증 코드가 발송되었습니다. 이메일을 확인해주세요.' 
      });
    } catch (error) {
      if (error.status === 409) {
        // ConflictException - 이미 가입된 이메일
        return res.status(409).json({ 
          success: false,
          message: error.message,
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
      if (error.status === 400) {
        return res.status(400).json({ 
          success: false,
          message: error.message 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: '인증 코드 발송에 실패했습니다.' 
      });
    }
  }

  @Public()
  @Post('email/verify-code')
  @ApiOperation({ summary: '이메일 인증 코드 검증' })
  @ApiResponse({ status: 200, description: '인증 코드 검증 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async verifyEmailCode(@Body() dto: VerifyCodeDto, @Res() res: Response) {
    try {
      const result = await this.emailService.verifyCode(dto.email, dto.code);
      return res.json({ 
        success: true,
        verified: result.verified,
        sessionToken: result.sessionToken,
        message: '이메일 인증이 완료되었습니다.' 
      });
    } catch (error) {
      if (error.status === 401 || error.status === 400) {
        return res.status(error.status).json({ 
          success: false,
          message: error.message 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: '인증 코드 검증에 실패했습니다.' 
      });
    }
  }

  @Public()
  @Post('email/resend-code')
  @ApiOperation({ summary: '이메일 인증 코드 재발송' })
  @ApiResponse({ status: 200, description: '인증 코드 재발송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async resendEmailCode(@Body() dto: SendCodeDto, @Res() res: Response) {
    try {
      await this.emailService.resendVerificationCode(dto.email);
      return res.json({ 
        success: true,
        message: '인증 코드가 재발송되었습니다. 이메일을 확인해주세요.' 
      });
    } catch (error) {
      if (error.status === 400) {
        return res.status(400).json({ 
          success: false,
          message: error.message 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: '인증 코드 재발송에 실패했습니다.' 
      });
    }
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: '토큰 갱신' })
  @ApiResponse({ status: 200, description: '토큰 갱신 성공' })
  @ApiResponse({ status: 401, description: '유효하지 않은 토큰' })
  async refreshToken(@Request() req, @Res() res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    const authResponse = await this.authService.refreshTokens(refreshToken);
    
    // 새로운 토큰들을 쿠키에 설정
    res.cookie('access_token', authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일 (JWT와 동일)
      path: '/',
    });

    res.cookie('refresh_token', authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    return res.json({
      user: authResponse.user,
      message: '토큰이 갱신되었습니다.',
    });
  }


  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '현재 사용자 정보 조회' })
  @ApiResponse({ status: 200, description: '사용자 정보 조회 성공' })
  async getCurrentUser(@CurrentUser() user: any) {
    // UsersService를 통해 CDN URL이 적용된 사용자 정보 가져오기
    const fullUser = await this.usersService.findOne(user.id);

    if (!fullUser) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        bio: user.bio,
        blogSlug: user.blog?.slug || null,
        termsAcceptedAt: user.termsAcceptedAt,
        privacyAcceptedAt: user.privacyAcceptedAt,
        marketingOptIn: user.marketingOptIn,
        newsletterOptIn: user.newsletterOptIn,
        createdAt: user.createdAt,
      };
    }

    // 보안을 위해 공개 정보만 반환 (CDN URL 적용됨)
    return {
      id: fullUser.id,
      email: fullUser.email,
      username: fullUser.username,
      role: fullUser.role,
      profileImage: fullUser.profileImage,  // ✅ CDN URL로 변환됨
      isEmailVerified: fullUser.isEmailVerified,
      subscriptionTier: fullUser.subscriptionTier,
      subscriptionStatus: fullUser.subscriptionStatus,
      bio: fullUser.bio,
      blogSlug: fullUser.blog?.slug || null,
      termsAcceptedAt: fullUser.termsAcceptedAt,       // 약관 동의 시각
      privacyAcceptedAt: fullUser.privacyAcceptedAt,   // 개인정보 동의 시각
      marketingOptIn: fullUser.marketingOptIn,         // 마케팅 정보 수신 동의
      newsletterOptIn: fullUser.newsletterOptIn,       // 뉴스레터 수신 동의
      createdAt: fullUser.createdAt,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  async logout(@CurrentUser() user: any, @Res() res: Response) {
    this.logger.log(`[Logout] 로그아웃 시작 - userId: ${user.id}, email: ${user.email}`);

    await this.authService.logout(user.id);

    // 웹 세션 삭제 (MCP 세션도 무효화되도록)
    try {
      // 웹 세션 삭제
      await this.redisService.deleteCache('sessions', `user:${user.id}`);

      // JWT validation 캐시 삭제 (JwtStrategy가 사용)
      await this.redisService.deleteCache('sessions', `user_validate_${user.id}`);

      // 해당 사용자의 모든 MCP 세션 찾아서 삭제
      // MCP 세션은 mcp:sessions:* 패턴으로 저장되어 있고, 세션 데이터에 userId가 포함됨
      // 여기서는 간단히 웹 세션만 삭제하고, MCP 세션은 검증 시 자동으로 무효화됨
      this.logger.debug(`웹 세션 및 JWT validation 캐시 삭제: userId=${user.id}`);
    } catch (error) {
      this.logger.error(`세션 삭제 실패: ${error.message}`);
      // 세션 삭제 실패해도 로그아웃은 진행
    }

    // 모든 쿠키 제거
    this.logger.log(`[Logout] 쿠키 삭제 중 - access_token, refresh_token`);

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    this.logger.log(`[Logout] 로그아웃 완료 - userId: ${user.id}`);

    return res.json({ message: '로그아웃되었습니다.' });
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: '비밀번호 재설정 요청' })
  @ApiResponse({ status: 200, description: '재설정 이메일 발송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async forgotPassword(
    @Body() dto: { email: string },
    @Request() req,
    @Res() res: Response
  ) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      await this.authService.forgotPassword(dto.email, ipAddress, userAgent);
      
      // 보안: 계정 존재 여부와 관계없이 동일한 응답
      return res.json({
        success: true,
        message: '이메일이 등록되어 있다면 비밀번호 재설정 링크가 발송됩니다.'
      });
    } catch (error) {
      if (error.message?.includes('소셜 로그인')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      // 다른 에러도 보안상 동일한 메시지
      return res.json({
        success: true,
        message: '이메일이 등록되어 있다면 비밀번호 재설정 링크가 발송됩니다.'
      });
    }
  }

  @Post('validate-reset-token')
  @Public()
  @ApiOperation({ summary: '비밀번호 재설정 토큰 검증' })
  @ApiResponse({ status: 200, description: '토큰 유효' })
  @ApiResponse({ status: 400, description: '토큰 무효' })
  async validateResetToken(
    @Body() dto: { token: string },
    @Res() res: Response
  ) {
    const isValid = await this.authService.validateResetToken(dto.token);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    return res.json({
      success: true,
      valid: true
    });
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: '비밀번호 재설정' })
  @ApiResponse({ status: 200, description: '비밀번호 재설정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async resetPassword(
    @Body() dto: { token: string; newPassword: string },
    @Res() res: Response
  ) {
    try {
      await this.authService.resetPassword(dto.token, dto.newPassword);
      
      return res.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || '비밀번호 재설정에 실패했습니다.'
      });
    }
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계정 탈퇴' })
  @ApiResponse({ status: 200, description: '계정 삭제 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
    @Res() res: Response
  ) {
    // 로컬 인증 사용자의 경우에만 비밀번호 확인
    if (user.authProvider === 'local' || !user.authProvider) {
      // 비밀번호가 제공되지 않은 경우
      if (!dto.password) {
        return res.status(400).json({
          success: false,
          message: '비밀번호를 입력해주세요.'
        });
      }

      // 비밀번호 재확인
      const validUser = await this.authService.validateUser(user.email, dto.password);
      if (!validUser) {
        return res.status(401).json({
          success: false,
          message: '비밀번호가 일치하지 않습니다.'
        });
      }
    }
    // OAuth 사용자의 경우 비밀번호 확인 건너뛰기

    try {
      // 1. 즉시 소프트 삭제 실행 (개인정보 마스킹 + 로그인 차단)
      await this.usersService.softDelete(user.id);
      this.logger.log(`User ${user.id} soft deleted, personal data masked`);

      // 2. 백그라운드 큐에 삭제 작업 추가
      await this.userDeletionQueueService.addDeletionJob(
        user.id,
        'soft-delete',
        {
          reason: dto.reason || 'User requested account deletion',
          requestedAt: new Date().toISOString(),
        }
      );
      this.logger.log(`Deletion job queued for user ${user.id}`);

      // 3. 웹 세션 삭제 (MCP 세션도 무효화되도록)
      try {
        await this.redisService.deleteCache('sessions', `user:${user.id}`);
        this.logger.debug(`Session deleted for user ${user.id}`);
      } catch (error) {
        this.logger.error(`Failed to delete session: ${error.message}`);
      }

      // 4. 쿠키 제거
      res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });

      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });

      // 5. 즉시 성공 응답 (백그라운드 작업은 비동기로 처리됨)
      return res.json({
        success: true,
        message: '계정 삭제가 요청되었습니다. 개인정보는 즉시 마스킹되었으며, 관련 데이터는 법적 보관 기간 후 자동으로 삭제됩니다.',
        deletedAt: new Date().toISOString(),
        info: {
          personalDataMasked: true,
          backgroundDeletionQueued: true,
          legalRetentionPeriod: '결제 기록: 5년, 분쟁 기록: 3년, 메시지: 30일'
        }
      });
    } catch (error) {
      this.logger.error(`Account deletion failed for user ${user.id}:`, error);
      return res.status(400).json({
        success: false,
        message: error.message || '계정 삭제 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * OAuth 로그인 후 약관 동의 완료
   * 소셜 로그인 사용자가 최초 로그인 시 필수 약관 동의를 받은 후 호출
   */
  @Post('consent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'OAuth 로그인 후 약관 동의 완료' })
  @ApiResponse({
    status: 200,
    description: '약관 동의 완료',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '약관 동의가 완료되었습니다.' }
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async updateConsent(
    @CurrentUser() user: User,
    @Body() consentDto: ConsentDto,
    @Res() res: Response,
  ) {
    try {
      await this.authService.updateConsent(user.id, consentDto);

      return res.status(200).json({
        success: true,
        message: '약관 동의가 완료되었습니다.'
      });
    } catch (error) {
      this.logger.error(`Consent update failed for user ${user.id}:`, error);
      return res.status(400).json({
        success: false,
        message: error.message || '약관 동의 처리 중 오류가 발생했습니다.'
      });
    }
  }
} 