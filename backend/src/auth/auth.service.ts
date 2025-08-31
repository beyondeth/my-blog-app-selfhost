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
import { EmailService } from '../email/email.service';
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
    private readonly emailService: EmailService,
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
      let user = await this.usersService.findByProviderId(profile.id, provider);

      if (!user) {
        // 이메일로 기존 사용자 확인
        const email = profile.emails?.[0]?.value;
        
        // OAuth에서 이메일을 반드시 가져와야 함
        if (!email) {
          this.logger.error(`OAuth ${provider} failed to get email from profile`);
          throw new BadRequestException(
            `${provider} 계정에서 이메일을 가져올 수 없습니다. ` +
            `${provider} 계정 설정에서 이메일 공개를 허용해주세요.`
          );
        }
        
        this.logger.log(`OAuth ${provider} email from profile:`, email);
        
        const existingUser = await this.usersService.findByEmail(email);
          
          if (existingUser) {
            // ✅ OAuth 로그인은 이메일 검증을 보장하므로 자동 병합
            // Google/Kakao OAuth는 이미 이메일 소유권을 확인했음
            
            // 기존 계정에 OAuth 정보 추가 및 이메일 검증 처리
            existingUser.providerId = profile.id;
            existingUser.authProvider = provider;
            
            // OAuth 로그인 시 이메일을 자동으로 검증 처리
            if (!existingUser.isEmailVerified) {
              existingUser.isEmailVerified = true;
              this.logger.log(`Email automatically verified through OAuth ${provider} for: ${email}`);
            }
            
            // 프로필 이미지가 없다면 OAuth에서 가져온 것으로 업데이트
            if (!existingUser.profileImage && profile.photos?.[0]?.value) {
              existingUser.profileImage = profile.photos[0].value;
            }
            
            user = await this.usersService.update(existingUser.id, existingUser);
            
            // 블로그가 없으면 자동 생성
            const userBlogs = await this.blogsService.findByUserId(user.id);
            if (!userBlogs || userBlogs.length === 0) {
              await this.createUserBlog(user);
              this.logger.log(`Blog automatically created for existing user during OAuth link: ${email}`);
            }
            
            // 계정 병합 알림 이메일 (선택적)
            try {
              await this.emailService.sendAccountLinkNotification(
                email,
                `${provider} 로그인이 계정에 연결되었습니다.`
              );
            } catch (emailError) {
              // 이메일 실패는 무시하고 계속 진행
              this.logger.warn(`Failed to send account link notification: ${emailError.message}`);
            }
            
            this.logger.log(`OAuth ${provider} linked to existing account: ${email}`);
            
            // 마지막 로그인 시간 업데이트
            await this.usersService.updateLastLogin(user.id);
            return this.generateTokenResponse(user);
          }

        // 새 사용자 생성 (이메일은 이미 위에서 검증됨)
        const userData = {
          email: email, // email은 반드시 존재함
          username: this.generateUsernameFromEmail(email),
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
        // 기존 OAuth 사용자 - 이메일이 providerId로 생성된 임시 이메일인 경우에만 업데이트
        const email = profile.emails?.[0]?.value;
        
        // providerId@provider.com 형식의 임시 이메일인지 확인
        const isTempEmail = user.email === `${profile.id}@${provider}.com`;
        
        if (email && isTempEmail) {
          // 임시 이메일을 실제 이메일로 업데이트
          this.logger.log(`Updating temporary email ${user.email} to ${email}`);
          user.email = email;
          user = await this.usersService.update(user.id, { email });
        }
        
        // 블로그가 없으면 자동 생성 (기존 OAuth 사용자)
        const userBlogs = await this.blogsService.findByUserId(user.id);
        if (!userBlogs || userBlogs.length === 0) {
          await this.createUserBlog(user);
          this.logger.log(`Blog automatically created for returning OAuth user: ${user.email}`);
        }
        
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

  async checkAuthMethod(email: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return { 
        exists: false,
        authProvider: null,
        message: '등록되지 않은 이메일입니다.'
      };
    }
    
    // 민감한 정보는 제외하고 인증 방법만 반환
    return {
      exists: true,
      authProvider: user.authProvider,
      hasPassword: !!user.password,
      isEmailVerified: user.isEmailVerified,
      // 사용자에게 친화적인 메시지 제공
      message: this.getAuthMethodMessage(user.authProvider)
    };
  }

  private getAuthMethodMessage(authProvider: string): string {
    switch (authProvider) {
      case 'kakao':
        return '카카오 계정으로 로그인하세요';
      case 'google':
        return '구글 계정으로 로그인하세요';
      case 'local':
      default:
        return '이메일과 비밀번호로 로그인하세요';
    }
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