import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Not } from 'typeorm';
import { UsersService } from '../users/users.service';
import { BlogsService } from '../blogs/blogs.service';
import { EmailService } from '../email/email.service';
import { IdentityService } from '../users/services/identity.service';
import { User, AuthProvider } from '../users/entities/user.entity';
import { IdentityProvider } from '../users/entities/user-identity.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly blogsService: BlogsService,
    private readonly emailService: EmailService,
    private readonly identityService: IdentityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      if (!user || !user.isActive) {
        return null;
      }

      // 비밀번호가 없는 경우 (소셜 로그인만 사용 중)
      if (!user.password) {
        // Identity 확인하여 더 명확한 안내 제공
        const identities = await this.identityService.findByUserId(user.id);
        const providers = identities.map(i => i.getProviderDisplayName()).join(', ');
        
        throw new BadRequestException(
          `이 계정은 ${providers || '소셜'} 로그인으로만 접속 가능합니다. ` +
          `비밀번호로 로그인하려면 먼저 소셜 로그인 후 계정 설정에서 비밀번호를 추가하세요.`
        );
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
      // BadRequestException은 그대로 throw, 다른 에러는 null 반환
      if (error instanceof BadRequestException) {
        throw error;
      }
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
    const { email, username, password, emailVerificationToken } = registerDto;

    // 이메일 인증 확인 (선택적)
    if (emailVerificationToken) {
      const isVerified = await this.emailService.checkVerificationStatus(email, emailVerificationToken);
      if (!isVerified) {
        throw new BadRequestException('Invalid or expired email verification token');
      }
    }

    // 이메일 중복 체크
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('이미 존재하는 회원입니다. 로그인 페이지에서 로그인해주세요.');
    }

    // 사용자명 중복 체크
    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException(`이미 사용 중인 '${username}'입니다. 다른 사용자명을 선택해주세요.`);
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
      const identityProvider = provider as unknown as IdentityProvider;
      const email = profile.email || profile.emails?.[0]?.value;
      
      // OAuth에서 이메일을 반드시 가져와야 함
      if (!email) {
        this.logger.error(`OAuth ${provider} failed to get email from profile`);
        throw new BadRequestException(
          `${provider} 계정에서 이메일을 가져올 수 없습니다. ` +
          `${provider} 계정 설정에서 이메일 공개를 허용해주세요.`
        );
      }

      // 1. Provider ID로 기존 identity 찾기
      const existingIdentity = await this.identityService.findByProviderId(
        profile.id,
        identityProvider
      );

      if (existingIdentity) {
        // 기존 identity로 로그인
        this.logger.log(`Existing ${provider} identity found for user ${existingIdentity.userId}`);
        
        await this.identityService.updateLastUsed(existingIdentity.id);
        const user = await this.usersService.findById(existingIdentity.userId);
        
        // 블로그가 없으면 자동 생성
        const userBlogs = await this.blogsService.findByUserId(user.id);
        if (!userBlogs || userBlogs.length === 0) {
          await this.createUserBlog(user);
          this.logger.log(`Blog automatically created for returning OAuth user: ${user.email}`);
        }
        
        await this.usersService.updateLastLogin(user.id);
        return this.generateTokenResponse(user);
      }

      // 2. 이메일로 기존 사용자 찾기
      const existingUser = await this.usersService.findByEmail(email);

      if (existingUser) {
        // Multi-Identity: 기존 사용자에 새 identity 연결
        if (existingUser.isEmailVerified || this.identityService.isTrustedProvider(identityProvider)) {
          // 자동 링킹 가능
          await this.identityService.linkIdentity(existingUser.id, {
            provider: identityProvider,
            providerId: profile.id,
            email,
            providerData: {
              name: profile.displayName || profile.username,
              picture: profile.profileImage || profile.photos?.[0]?.value,
              bio: profile.bio,
            }
          });

          // 이메일 미인증 사용자는 자동 인증 처리
          if (!existingUser.isEmailVerified) {
            await this.usersService.update(existingUser.id, {
              isEmailVerified: true,
              accountVerifiedAt: new Date(),
              // 중요: password는 절대 건드리지 않음
              // authProvider도 변경하지 않음 (최초 가입 방법 유지)
            });
            this.logger.log(`Email automatically verified through ${provider} OAuth for: ${email}`);
          }

          // 프로필 이미지 업데이트 (없는 경우)
          if (!existingUser.profileImage && profile.profileImage) {
            await this.usersService.update(existingUser.id, {
              profileImage: profile.profileImage,
              // 중요: password는 절대 건드리지 않음
            });
          }

          // 블로그가 없으면 자동 생성
          const userBlogs = await this.blogsService.findByUserId(existingUser.id);
          if (!userBlogs || userBlogs.length === 0) {
            await this.createUserBlog(existingUser);
            this.logger.log(`Blog automatically created for existing user during OAuth link: ${email}`);
          }

          // 계정 연결 알림
          try {
            await this.emailService.sendAccountLinkNotification(
              email,
              `${provider} 계정이 성공적으로 연결되었습니다.`
            );
          } catch (emailError) {
            this.logger.warn(`Failed to send account link notification: ${emailError.message}`);
          }

          this.logger.log(`${provider} identity linked to existing account: ${email}`);
          await this.usersService.updateLastLogin(existingUser.id);
          return this.generateTokenResponse(existingUser);
        } else {
          // 수동 링킹 필요
          throw new ConflictException({
            code: 'MANUAL_LINK_REQUIRED',
            message: `이 이메일은 이미 등록되어 있습니다. 기존 방법으로 로그인 후 ${provider} 계정을 연결해주세요.`,
            existingProvider: existingUser.authProvider || 'email'
          });
        }
      }

      // 3. 새 사용자 생성
      const newUser = await this.usersService.create({
        email,
        username: profile.username || this.generateUsernameFromEmail(email),
        profileImage: profile.profileImage || profile.photos?.[0]?.value,
        bio: profile.bio,
        authProvider: provider,
        providerId: profile.id,
        isEmailVerified: true,
        accountVerifiedAt: new Date(),
      });

      // Identity 생성
      await this.identityService.linkIdentity(newUser.id, {
        provider: identityProvider,
        providerId: profile.id,
        email,
        providerData: {
          name: profile.displayName || profile.username,
          picture: profile.profileImage || profile.photos?.[0]?.value,
          bio: profile.bio,
        }
      });

      // 블로그 자동 생성
      await this.createUserBlog(newUser);
      
      this.logger.log(`New OAuth user created with blog: ${newUser.email} via ${provider}`);
      return this.generateTokenResponse(newUser);
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

  async checkAuthMethod(email: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return { 
        exists: false,
        authProviders: [],
        message: '등록되지 않은 이메일입니다.'
      };
    }
    
    // 사용 가능한 모든 인증 방법 확인
    const identities = await this.identityService.findByUserId(user.id);
    const availableProviders = identities.map(i => i.provider);
    
    // 민감한 정보는 제외하고 인증 방법만 반환
    return {
      exists: true,
      authProvider: user.authProvider, // 최초 가입 방법 (호환성 유지)
      availableProviders, // 사용 가능한 모든 인증 방법
      hasPassword: !!user.password,
      isEmailVerified: user.isEmailVerified,
      // 사용자에게 친화적인 메시지 제공
      message: this.getAuthMethodMessage(user, identities)
    };
  }

  private getAuthMethodMessage(user: User, identities: any[]): string {
    const hasPassword = !!user.password;
    const providers = identities
      .filter(i => i.provider !== 'local')
      .map(i => {
        switch (i.provider) {
          case 'kakao': return '카카오';
          case 'google': return '구글';
          case 'github': return '깃헙';
          default: return i.provider;
        }
      });
    
    const methods = [];
    if (hasPassword) {
      methods.push('이메일/비밀번호');
    }
    if (providers.length > 0) {
      methods.push(...providers);
    }
    
    if (methods.length === 0) {
      return '로그인 방법을 설정해주세요';
    }
    
    return `${methods.join(', ')} 로그인이 가능합니다`;
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
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '1d'),
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
      expires_in: this.getTokenExpiresIn('JWT_ACCESS_EXPIRES_IN', '1d'),
      user: user.toPublicJSON(), // 보안 강화: 공개 정보만 반환
    };
  }

  private generateUsernameFromEmail(email: string): string {
    // 이메일에서 @ 앞 부분 추출
    const emailPrefix = email.split('@')[0].toLowerCase();
    
    // 영문, 숫자, 언더스코어만 허용 (사용자명 규칙)
    let username = emailPrefix.replace(/[^a-z0-9_]/g, '_');
    
    // 너무 짧으면 랜덤 문자 추가
    if (username.length < 3) {
      const uniqueId = crypto.randomUUID().slice(0, 4);
      username = `${username}_${uniqueId}`;
    }
    
    // 너무 길면 자르기
    if (username.length > 20) {
      username = username.slice(0, 20);
    }
    
    return username;
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
      while (!(await this.blogsService.checkSlugAvailability(finalSlug))) {
        // 알파벳 랜덤 4자리 생성 (a-z)
        const randomSuffix = Array.from({ length: 4 }, () => 
          String.fromCharCode(97 + Math.floor(Math.random() * 26))
        ).join('');
        finalSlug = `${slug}-${randomSuffix}`;
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

  // Password Reset Methods
  async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    
    // Security: Don't reveal if email exists
    if (!user) {
      this.logger.log(`Password reset attempted for non-existent email: ${email}`);
      return;
    }

    // Check if OAuth user
    if (user.authProvider !== AuthProvider.LOCAL) {
      this.logger.log(`Password reset attempted for OAuth user: ${email}`);
      throw new BadRequestException('소셜 로그인 계정은 비밀번호 재설정이 필요하지 않습니다');
    }

    // Clean up expired tokens
    await this.passwordResetTokenRepository.delete({
      userId: user.id,
      expiresAt: LessThan(new Date()),
    });

    // Check for recent requests (rate limiting)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await this.passwordResetTokenRepository.findOne({
      where: {
        userId: user.id,
        createdAt: MoreThan(fiveMinutesAgo), // Fixed: MoreThan to check recent tokens
      },
    });

    if (recentToken) {
      this.logger.warn(`Too many password reset requests for user: ${email}`);
      return; // Silently ignore to prevent email bombing
    }

    // Generate secure token
    const token = uuidv4();
    const hashedToken = crypto
      .createHmac('sha256', this.configService.get('JWT_SECRET'))
      .update(token)
      .digest('hex');

    // Save token with 15 minutes expiry
    const resetToken = this.passwordResetTokenRepository.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress,
      userAgent,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    // Send email (implementation in EmailService)
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(user.email, user.username, resetUrl);

    this.logger.log(`Password reset email sent to: ${email}`);
  }

  async validateResetToken(token: string): Promise<boolean> {
    const hashedToken = crypto
      .createHmac('sha256', this.configService.get('JWT_SECRET'))
      .update(token)
      .digest('hex');

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: MoreThan(new Date()), // Fixed: MoreThan instead of LessThan
      },
    });

    return !!resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto
      .createHmac('sha256', this.configService.get('JWT_SECRET'))
      .update(token)
      .digest('hex');

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        token: hashedToken,
        used: false,
      },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Update password
    await this.usersService.updatePassword(resetToken.userId, newPassword);

    // Mark token as used
    resetToken.used = true;
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    // Clear all other tokens for this user
    await this.passwordResetTokenRepository.delete({
      userId: resetToken.userId,
      id: resetToken.id, // Exclude current token
    });

    this.logger.log(`Password reset successful for user: ${resetToken.user.email}`);
  }
} 