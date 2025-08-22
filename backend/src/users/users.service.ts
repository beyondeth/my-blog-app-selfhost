import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

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
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'createdAt', 'lastLoginAt', 'isActive', 'bio']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // 프로필 이미지를 프록시 URL로 변환
    if (user.profileImage && user.profileImage.startsWith('v2/')) {
      // 프록시 URL 사용 (공개 접근 가능)
      user.profileImage = `/api/v1/files/proxy/${user.profileImage}`;
    }
    
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ 
      where: { email },
      select: ['id', 'email', 'password', 'username', 'role', 'authProvider', 'isActive', 'profileImage', 'isEmailVerified', 'bio']
    });
    
    // 프로필 이미지를 프록시 URL로 변환
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      // 프록시 URL 사용 (공개 접근 가능)
      user.profileImage = `/api/v1/files/proxy/${user.profileImage}`;
    }
    
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ 
      where: { username },
      select: ['id', 'username', 'email']
    });
  }

  async findByProviderId(providerId: string, provider: AuthProvider): Promise<User | null> {
    const user = await this.usersRepository.findOne({ 
      where: { providerId, authProvider: provider },
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'authProvider', 'providerId', 'bio']
    });
    
    // 프로필 이미지를 프록시 URL로 변환
    if (user && user.profileImage && user.profileImage.startsWith('v2/')) {
      // 프록시 URL 사용 (공개 접근 가능)
      user.profileImage = `/api/v1/files/proxy/${user.profileImage}`;
    }
    
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    // 패스워드는 엔티티에서 자동으로 해시됨
    Object.assign(user, updateUserDto);
    
    const updatedUser = await this.usersRepository.save(user);
    this.logger.log(`User updated: ${updatedUser.email}`);
    
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
    
    // 최근 30일 가입자
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
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
    return this.usersRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'username', 'role', 'profileImage', 'isEmailVerified', 'createdAt', 'lastLoginAt', 'isActive', 'refreshToken', 'refreshTokenExpiresAt']
    });
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
} 