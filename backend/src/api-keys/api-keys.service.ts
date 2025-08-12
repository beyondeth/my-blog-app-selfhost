import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { User } from '../users/entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(Blog)
    private blogRepository: Repository<Blog>,
  ) {}

  /**
   * API 키 생성
   */
  async create(createApiKeyDto: CreateApiKeyDto, user: User): Promise<{ apiKey: ApiKey; plainKey: string }> {
    // 블로그 소유권 확인
    const blog = await this.blogRepository.findOne({
      where: { id: createApiKeyDto.blogId, userId: user.id }
    });

    if (!blog) {
      throw new ForbiddenException('해당 블로그에 대한 권한이 없습니다.');
    }

    // API 키 생성 (32바이트 랜덤 문자열)
    const plainKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    
    // API 키 해시 (실제 저장되는 값)
    const hashedKey = await bcrypt.hash(plainKey, 10);

    // API 키 엔티티 생성
    const apiKey = this.apiKeyRepository.create({
      key: hashedKey,
      name: createApiKeyDto.name,
      description: createApiKeyDto.description,
      userId: user.id,
      blogId: createApiKeyDto.blogId,
      expiresAt: createApiKeyDto.expiresAt,
    });

    await this.apiKeyRepository.save(apiKey);

    // 평문 키는 생성 시에만 반환 (이후에는 볼 수 없음)
    return { 
      apiKey: {
        ...apiKey,
        key: undefined // 해시된 키는 반환하지 않음
      }, 
      plainKey 
    };
  }

  /**
   * 사용자의 API 키 목록 조회
   */
  async findByUser(userId: string): Promise<ApiKey[]> {
    const keys = await this.apiKeyRepository.find({
      where: { userId },
      relations: ['blog'],
      select: {
        id: true,
        name: true,
        description: true,
        blogId: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' }
    });

    // key 필드는 제외하고 반환
    return keys.map(k => ({ ...k, key: undefined }));
  }

  /**
   * 특정 블로그의 API 키 목록 조회
   */
  async findByBlog(blogId: string, userId: string): Promise<ApiKey[]> {
    // 블로그 소유권 확인
    const blog = await this.blogRepository.findOne({
      where: { id: blogId, userId }
    });

    if (!blog) {
      throw new ForbiddenException('해당 블로그에 대한 권한이 없습니다.');
    }

    const keys = await this.apiKeyRepository.find({
      where: { blogId, userId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' }
    });

    return keys.map(k => ({ ...k, key: undefined }));
  }

  /**
   * API 키 검증
   */
  async validateApiKey(plainKey: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    // 모든 활성 API 키 조회
    const apiKeys = await this.apiKeyRepository.find({
      where: { isActive: true },
      relations: ['user', 'blog']
    });

    // 각 키와 비교
    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(plainKey, apiKey.key);
      if (isMatch) {
        // 만료 시간 확인
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return { valid: false };
        }

        // 마지막 사용 시간 업데이트
        apiKey.lastUsedAt = new Date();
        await this.apiKeyRepository.save(apiKey);

        return { valid: true, apiKey };
      }
    }

    return { valid: false };
  }

  /**
   * API 키 삭제
   */
  async remove(id: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      throw new NotFoundException('API 키를 찾을 수 없습니다.');
    }

    await this.apiKeyRepository.remove(apiKey);
  }

  /**
   * API 키 활성화/비활성화
   */
  async toggleActive(id: string, userId: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, userId }
    });

    if (!apiKey) {
      throw new NotFoundException('API 키를 찾을 수 없습니다.');
    }

    apiKey.isActive = !apiKey.isActive;
    await this.apiKeyRepository.save(apiKey);

    return { ...apiKey, key: undefined };
  }
}