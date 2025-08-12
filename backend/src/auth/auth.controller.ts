import { Controller, Post, Body, UseGuards, Request, Get, Res, Response } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
} 