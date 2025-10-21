import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateUtils } from '../common/utils/date.utils';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UnifiedRedisService } from '../redis/unified-redis.service';
import { CdnService } from '../files/services/cdn.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly redisService: UnifiedRedisService,
    private readonly cdnService: CdnService,
  ) {}

  /**
   * 사용자의 블로그 개수 조회
   */
  async getUserBlogCount(userId: string): Promise<number> {
    // 현재 사용자는 블로그를 1개만 가질 수 있음
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['blog'],
    });

    return user?.blog ? 1 : 0;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = this.usersRepository.create(createUserDto);
      const savedUser = await this.usersRepository.save(user);
      
      this.logger.log(`User created: ${savedUser.email}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      select: ['id', 'email', 'username', 'role', 'createdAt', 'lastLoginAt', 'isActive'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'createdAt', 'lastLoginAt', 'isActive', 'bio', 'authProvider', 'providerId']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 프로필 이미지를 CDN URL로 변환
    if (user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL: ${user.profileImage}`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    // QueryBuilder 사용하여 blog relation과 필요한 모든 필드 포함
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.blog', 'blog')
      .select([
        'user.id',
        'user.email',
        'user.password',
        'user.username',
        'user.role',
        'user.authProvider',
        'user.isActive',
        'user.profileImage',
        'user.isEmailVerified',
        'user.bio',
        'user.subscriptionTier',     // 구독 티어 추가
        'user.subscriptionStatus',   // 구독 상태 추가
        'blog.slug',                  // blog의 slug만 선택
      ])
      .where('user.email = :email', { email })
      .getOne();

    // 프로필 이미지를 CDN URL로 변환
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findById): ${user.profileImage}`);
    }

    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'bio', 'profileImage', 'createdAt', 'isActive']
    });

    // Transform profile image to CDN URL for public access
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findByUsername): ${user.profileImage}`);
    }

    return user;
  }

  async findByProviderId(providerId: string, provider: AuthProvider): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { providerId, authProvider: provider },
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'authProvider', 'providerId', 'bio']
    });

    // 프로필 이미지를 CDN URL로 변환
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      user.profileImage = this.cdnService.generateCdnUrlFromKey(user.profileImage);
      this.logger.debug(`Profile image CDN URL (findByProviderId): ${user.profileImage}`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Cache Busting: 프로필 이미지 변경 시 타임스탬프 쿼리 파라미터 추가
    // CDN 캐시 즉시 회피 (Cloudflare 최적화)
    if (updateUserDto.profileImage && updateUserDto.profileImage !== user.profileImage) {
      const timestamp = Date.now();

      // 기존 쿼리 파라미터 제거
      let cleanUrl = updateUserDto.profileImage.split('?')[0];

      // 새 타임스탬프 추가
      updateUserDto.profileImage = `${cleanUrl}?v=${timestamp}`;

      this.logger.log(`🔄 Profile image cache busting applied: ?v=${timestamp}`);
    }

    // 패스워드는 엔티티에서 자동으로 해시됨
    Object.assign(user, updateUserDto);

    const updatedUser = await this.usersRepository.save(user);
    this.logger.log(`User updated: ${updatedUser.email}`);

    // Redis 캐시 무효화 (JWT 검증 캐시)
    try {
      const cacheKey = `user_validate_${id}`;
      await this.redisService.deleteCache('sessions', cacheKey);
      this.logger.debug(`User cache invalidated: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate user cache: ${error.message}`);
      // 캐시 무효화 실패해도 업데이트는 성공으로 처리
    }

    return updatedUser;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, { 
      lastLoginAt: new Date() 
    });
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
    
    this.logger.log(`User deactivated: ${user.email}`);
  }

  async activate(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = true;
    await this.usersRepository.save(user);
    
    this.logger.log(`User activated: ${user.email}`);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    
    this.logger.log(`User removed: ${user.email}`);
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['role']
    });
    
    return user?.role === Role.ADMIN;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({ where: { isActive: true } });
    const adminUsers = await this.usersRepository.count({ where: { role: Role.ADMIN } });
    
    // 최근 30일 가입자 - DateUtils를 사용한 일수 기반 계산
    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);
    
    const recentUsers = await this.usersRepository.count({
      where: { createdAt: { $gte: thirtyDaysAgo } as any }
    });

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      recentUsers,
    };
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      where: [
        { username: { $ilike: `%${query}%` } as any },
        { email: { $ilike: `%${query}%` } as any },
      ],
      select: ['id', 'email', 'username', 'role', 'createdAt', 'isActive'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  // UUID 지원을 위한 새로운 findById 메서드
  async findById(id: string): Promise<User | null> {
    // QueryBuilder를 사용해서 필요한 필드만 선택 (리소스 최적화)
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.blog', 'blog')  // blog relation 조인
      .select([
        'user.id',
        'user.email',
        'user.username',
        'user.role',
        'user.profileImage',
        'user.isEmailVerified',
        'user.createdAt',
        'user.lastLoginAt',
        'user.isActive',
        'user.isDeleted',                // 삭제 플래그 (JwtStrategy 로그인 차단용)
        'user.refreshToken',
        'user.refreshTokenExpiresAt',
        'user.subscriptionTier',        // 구독 티어
        'user.subscriptionStatus',      // 구독 상태
        'user.bio',                      // 사용자 소개
        'blog.slug',                     // blog의 slug만 선택 (헤더 "내 블로그" 버튼용)
      ])
      .where('user.id = :id', { id })
      .getOne();
  }

  // Refresh Token 업데이트
  async updateRefreshToken(id: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.usersRepository.update(id, { 
      refreshToken,
      refreshTokenExpiresAt: expiresAt
    });
  }

  // Refresh Token 삭제 (로그아웃시)
  async clearRefreshToken(id: string): Promise<void> {
    await this.usersRepository.update(id, { 
      refreshToken: null,
      refreshTokenExpiresAt: null
    });
  }

  // 비밀번호 업데이트 (비밀번호 재설정)
  async updatePassword(userId: number | string, newPassword: string): Promise<void> {
    const user = await this.findById(String(userId));
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.usersRepository.update(userId, {
      password: hashedPassword,
      // 보안: 비밀번호 변경 시 모든 refresh token 무효화
      refreshToken: null,
      refreshTokenExpiresAt: null
    });
  }

  /**
   * 소프트 삭제: 즉시 개인정보 마스킹 + 법적 보관 기간 설정
   * - 즉시: isDeleted=true, 개인정보 마스킹, 로그인 차단
   * - 법적 보관: 결제 기록 5년, 분쟁 기록 3년 후 완전 삭제
   * - 백그라운드 작업: 큐에 삭제 작업 추가하여 비동기 처리
   */
  async softDelete(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 이미 삭제된 사용자인지 확인
    if (user.isDeleted) {
      this.logger.warn(`User ${userId} already deleted`);
      return;
    }

    const now = new Date();

    // 법적 보관 기간 계산: 기본 3년, 결제 기록 있으면 5년
    // TODO: 실제로는 결제 기록 존재 여부를 확인하여 5년/3년 결정
    const retentionYears = user.dataRetentionYears || 3;
    const scheduledDeletionAt = new Date(now);
    scheduledDeletionAt.setFullYear(scheduledDeletionAt.getFullYear() + retentionYears);

    // 즉시 개인정보 마스킹 및 삭제 플래그 설정
    await this.usersRepository.update(userId, {
      // 소프트 삭제 플래그
      isDeleted: true,
      deletedAt: now,
      scheduledDeletionAt,

      // 개인정보 즉시 마스킹 (법적 요구사항)
      email: `deleted_${userId}@deleted.local`,
      username: `deleted_${userId}`,
      profileImage: null,
      bio: null,

      // 인증 정보 무효화
      password: null,
      refreshToken: null,
      refreshTokenExpiresAt: null,

      // 활성화 상태 false로 변경 (로그인 차단)
      isActive: false,
    });

    this.logger.log(`User ${userId} soft deleted. Scheduled for permanent deletion at ${scheduledDeletionAt.toISOString()}`);

    // TODO: BullMQ 큐에 백그라운드 삭제 작업 추가
    // await this.userDeletionQueue.add('soft-delete', { userId });
  }

} 