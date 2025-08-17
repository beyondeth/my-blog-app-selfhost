import { Controller, Post, Body, UseGuards, Request, Get, Res, Response, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthApiKeyService } from './auth-api-key.service';
import { EmailService } from '../email/email.service';
import { UserDeletionService } from '../users/services/user-deletion.service';
import { SendCodeDto } from '../email/dto/send-code.dto';
import { VerifyCodeDto } from '../email/dto/verify-code.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyApiKeyDto } from './dto/verify-api-key.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { User } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authApiKeyService: AuthApiKeyService,
    private readonly emailService: EmailService,
    private readonly userDeletionService: UserDeletionService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() loginDto: LoginDto, @Response() res) {
    const authResponse = await this.authService.login(loginDto);
    
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15분
      path: '/',
    });

    res.cookie('refresh_token', authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 토큰 제외하고 사용자 정보만 반환 (개발 환경에서는 토큰도 포함)
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
  async register(@Body() registerDto: RegisterDto, @Response() res) {
    const authResponse = await this.authService.register(registerDto);
    
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', authResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15분
      path: '/',
    });

    res.cookie('refresh_token', authResponse.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

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
  googleAuthRedirect(@Request() req, @Res() res) {
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', req.user.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15분
      path: '/',
    });

    res.cookie('refresh_token', req.user.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 프론트엔드로 리다이렉트 (토큰 없이)
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true`);
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
  kakaoAuthRedirect(@Request() req, @Res() res) {
    // HttpOnly 쿠키로 토큰들 설정
    res.cookie('access_token', req.user.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15분
      path: '/',
    });

    res.cookie('refresh_token', req.user.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // 프론트엔드로 리다이렉트 (토큰 없이)
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?success=true`);
  }

  @Public()
  @Post('email/send-code')
  @ApiOperation({ summary: '이메일 인증 코드 발송' })
  @ApiResponse({ status: 200, description: '인증 코드 발송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 409, description: '이미 존재하는 이메일' })
  async sendEmailCode(@Body() dto: SendCodeDto, @Response() res) {
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
  async verifyEmailCode(@Body() dto: VerifyCodeDto, @Response() res) {
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
  async resendEmailCode(@Body() dto: SendCodeDto, @Response() res) {
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
  async refreshToken(@Request() req, @Response() res) {
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
      maxAge: 15 * 60 * 1000, // 15분
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
    // 보안을 위해 공개 정보만 반환
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  async logout(@CurrentUser() user: any, @Response() res) {
    await this.authService.logout(user.id);
    
    // 모든 쿠키 제거
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

    return res.json({ message: '로그아웃되었습니다.' });
  }

  @Post('verify-api-key')
  @Public()
  @ApiOperation({ summary: 'API 키 HMAC 서명 검증' })
  @ApiResponse({ status: 200, description: 'API 키 검증 성공' })
  @ApiResponse({ status: 401, description: 'API 키 검증 실패' })
  async verifyApiKey(@Body() verifyDto: VerifyApiKeyDto, @Response() res) {
    const result = await this.authApiKeyService.verifyApiKeySignature(
      verifyDto.timestamp,
      verifyDto.nonce,
      verifyDto.signature,
      verifyDto.keyId,
    );

    if (!result.valid) {
      return res.status(401).json({ 
        message: 'Invalid API key signature',
        valid: false 
      });
    }

    // 검증 성공 시 세션 토큰 생성 (선택적)
    const sessionToken = await this.authService.createSessionToken(result.userId);

    return res.json({
      valid: true,
      userId: result.userId,
      blogId: result.blogId,
      sessionToken,
      message: 'API key verified successfully'
    });
  }

  @Post('verify-request')
  @Public()
  @ApiOperation({ summary: 'API 요청 서명 검증' })
  @ApiResponse({ status: 200, description: '요청 서명 검증 성공' })
  @ApiResponse({ status: 401, description: '요청 서명 검증 실패' })
  async verifyRequest(@Body() body: any, @Response() res) {
    const { method, endpoint, timestamp, nonce, signature, apiKey } = body;
    
    const isValid = await this.authApiKeyService.verifyRequestSignature(
      method,
      endpoint,
      timestamp,
      nonce,
      signature,
      apiKey,
    );

    if (!isValid) {
      return res.status(401).json({ 
        message: 'Invalid request signature',
        valid: false 
      });
    }

    return res.json({
      valid: true,
      message: 'Request signature verified successfully'
    });
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
    @Response() res
  ) {
    // 비밀번호 재확인
    const validUser = await this.authService.validateUser(user.email, dto.password);
    if (!validUser) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다.'
      });
    }

    try {
      // 계정 삭제 실행
      const result = await this.userDeletionService.deleteUserAccount(
        user.id,
        {
          softDelete: dto.softDelete || false,
          backupData: true,
          notifyByEmail: true
        }
      );

      // 쿠키 제거
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

      return res.json({
        success: true,
        message: dto.softDelete 
          ? '계정이 비활성화되었습니다. 30일 이내에 복구 가능합니다.'
          : '계정이 완전히 삭제되었습니다.',
        deletionResult: {
          deletedAt: result.deletedAt,
          affectedRecords: result.affectedRecords,
          backupId: result.backupId
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || '계정 삭제 중 오류가 발생했습니다.'
      });
    }
  }
} 