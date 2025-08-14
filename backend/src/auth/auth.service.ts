import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { BlogsService } from '../blogs/blogs.service';
import { User, AuthProvider } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly blogsService: BlogsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      if (!user || !user.isActive) {
        return null;
      }

      if (user.authProvider !== AuthProvider.LOCAL) {
        throw new BadRequestException('Please use OAuth login for this account');
      }

      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return null;
      }

      // 마지막 로그인 시간 업데이트
      await this.usersService.updateLastLogin(user.id);
      
      return user;
    } catch (error) {
      this.logger.error(`Validation failed for email ${email}:`, error.message);
      return null;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokenResponse(user);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, username, password } = registerDto;

    // 이메일 중복 체크
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 사용자명 중복 체크
    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    try {
      const user = await this.usersService.create({
        email,
        username,
        password,
        authProvider: AuthProvider.LOCAL,
      });

      // 자동으로 블로그 생성
      await this.createUserBlog(user);

      this.logger.log(`New user registered with blog: ${email}`);
      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error(`Registration failed for ${email}:`, error.message);
      throw new BadRequestException('Registration failed');
    }
  }

  async validateOAuthUser(profile: any, provider: AuthProvider): Promise<AuthResponse> {
    try {
      let user = await this.usersService.findByProviderId(profile.id, provider);

      if (!user) {
        // 이메일로 기존 사용자 확인
        const email = profile.emails?.[0]?.value;
        if (email) {
          const existingUser = await this.usersService.findByEmail(email);
          if (existingUser && existingUser.authProvider !== provider) {
            throw new ConflictException('Account exists with different provider');
          }
        }

        // 새 사용자 생성
        const userData = {
          email: email || `${profile.id}@${provider}.com`,
          username: this.generateUniqueUsername(profile),
          profileImage: profile.photos?.[0]?.value,
          authProvider: provider,
          providerId: profile.id,
          isEmailVerified: true,
        };

        user = await this.usersService.create(userData);
        
        // 자동으로 블로그 생성
        await this.createUserBlog(user);
        
        this.logger.log(`New OAuth user created with blog: ${user.email} via ${provider}`);
      } else {
        // 마지막 로그인 시간 업데이트
        await this.usersService.updateLastLogin(user.id);
      }

      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error(`OAuth validation failed for ${provider}:`, error.message);
      throw error;
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      // Refresh Token 검증
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // 저장된 refresh token과 비교
      if (user.refreshToken !== refreshToken || 
          !user.refreshTokenExpiresAt || 
          user.refreshTokenExpiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      return this.generateTokenResponse(user);
    } catch (error) {
      this.logger.error('Refresh token validation failed:', error.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    // Refresh Token 무효화
    await this.usersService.clearRefreshToken(userId);
    this.logger.log(`User ${userId} logged out`);
  }

  async createSessionToken(userId: string): Promise<string> {
    // API 키 검증 후 세션 토큰 생성
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'session',
      iat: Math.floor(Date.now() / 1000),
    };

    // 세션 토큰은 2시간 유효 (GitHub 스타일)
    return this.jwtService.sign(payload, {
      expiresIn: '2h',
    });
  }

  private async generateTokenResponse(user: User): Promise<AuthResponse> {
    const now = Math.floor(Date.now() / 1000);

    // Access Token 생성 (짧은 수명)
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'access',
      iat: now,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    // Refresh Token 생성 (긴 수명)
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
      iat: now,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Refresh Token을 DB에 저장
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일
    await this.usersService.updateRefreshToken(user.id, refreshToken, refreshExpiresAt);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.getTokenExpiresIn('JWT_ACCESS_EXPIRES_IN', '15m'),
      user: user.toPublicJSON(), // 보안 강화: 공개 정보만 반환
    };
  }

  private generateUniqueUsername(profile: any): string {
    const baseUsername = profile.displayName || 
                        profile.username || 
                        profile.name?.givenName || 
                        'user';
    
    // UUID 일부 사용으로 고유성 보장
    const uniqueId = crypto.randomUUID().slice(0, 8);
    return `${baseUsername}_${uniqueId}`;
  }

  private getTokenExpiresIn(configKey: string, defaultValue: string): number {
    const expiresIn = this.configService.get<string>(configKey, defaultValue);
    // 간단한 파싱 (1d = 86400초, 15m = 900초)
    if (expiresIn.includes('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    }
    if (expiresIn.includes('h')) {
      return parseInt(expiresIn) * 60 * 60;
    }
    if (expiresIn.includes('m')) {
      return parseInt(expiresIn) * 60;
    }
    return parseInt(expiresIn) || 900;
  }

  private async createUserBlog(user: User): Promise<void> {
    try {
      // 이메일에서 @ 앞 부분 추출
      const emailPrefix = user.email.split('@')[0].toLowerCase();
      
      // slug 규칙에 맞게 변환 (영문 소문자, 숫자, 하이픈만 허용)
      let slug = emailPrefix.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      
      // slug가 비어있거나 너무 짧으면 기본값 사용
      if (!slug || slug.length < 3) {
        slug = `user-${user.id.slice(0, 8)}`;
      }
      
      // slug 중복 확인 및 고유하게 만들기
      let finalSlug = slug;
      let counter = 1;
      while (!(await this.blogsService.checkSlugAvailability(finalSlug))) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      
      // 블로그 생성
      await this.blogsService.create({
        slug: finalSlug,
        name: user.username || emailPrefix,
        description: `${user.username || emailPrefix}님의 블로그입니다.`,
      }, user);
      
      this.logger.log(`Blog created automatically for user: ${user.email} with slug: ${finalSlug}`);
    } catch (error) {
      // 블로그 생성 실패는 회원가입을 막지 않음 (로그만 남김)
      this.logger.error(`Failed to create blog for user ${user.email}:`, error.message);
    }
  }
} 