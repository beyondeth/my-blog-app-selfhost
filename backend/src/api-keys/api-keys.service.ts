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
  async create(createApiKeyDto: CreateApiKeyDto, user: User): Promise<{ apiKey: ApiKey; keyId: string; keySecret: string }> {
    // 블로그 소유권 확인
    const blog = await this.blogRepository.findOne({
      where: { id: createApiKeyDto.blogId, userId: user.id }
    });

    if (!blog) {
      throw new ForbiddenException('해당 블로그에 대한 권한이 없습니다.');
    }

    // 사용자의 현재 API 키 개수 확인 (최대 3개 제한)
    const existingKeysCount = await this.apiKeyRepository.count({
      where: { userId: user.id }
    });

    if (existingKeysCount >= 3) {
      throw new ConflictException('API 키는 최대 3개까지만 생성할 수 있습니다. 기존 키를 삭제한 후 다시 시도해주세요.');
    }

    // API Key ID 생성 (공개 가능)
    const keyId = `akid_${crypto.randomBytes(16).toString('hex')}`;
    
    // API Key Secret 생성 (HMAC 서명용, 생성 시에만 보여줌)
    const keySecret = `aks_${crypto.randomBytes(32).toString('hex')}`;
    
    // Secret 해시 (실제 저장되는 값)
    const hashedSecret = await bcrypt.hash(keySecret, 10);

    // HMAC 서명용 시크릿 생성 (32바이트) - deprecated, keySecret 사용
    const signingSecret = keySecret; // keySecret을 서명용으로 사용
    
    // 서명 시크릿 암호화 (AES-256-GCM) - deprecated
    const encryptedSecret = this.encryptSigningSecret(signingSecret);

    // API 키 엔티티 생성
    const apiKey = this.apiKeyRepository.create({
      keyId: keyId,  // 공개 ID
      keySecret: hashedSecret,  // 해시된 Secret
      signingSecret: encryptedSecret,  // deprecated, 하위 호환성을 위해 유지
      name: createApiKeyDto.name,
      description: createApiKeyDto.description,
      userId: user.id,
      blogId: createApiKeyDto.blogId,
      expiresAt: createApiKeyDto.expiresAt,
      createdAt: new Date(), // 명시적으로 현재 시간 설정
      updatedAt: new Date(), // 명시적으로 현재 시간 설정
    });

    await this.apiKeyRepository.save(apiKey);

    // Key ID는 항상 표시, Secret은 생성 시에만 반환 (이후에는 볼 수 없음)
    return { 
      apiKey: {
        ...apiKey,
        keySecret: undefined, // 해시된 Secret은 반환하지 않음
        signingSecret: undefined // 암호화된 시크릿도 반환하지 않음
      }, 
      keyId,  // 공개 가능한 Key ID
      keySecret  // 평문 Secret (생성 시 1회만 표시)
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
        keyId: true,  // Key ID는 항상 표시
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
    return keys.map(k => ({ ...k, keySecret: undefined, signingSecret: undefined }));
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
        keyId: true,  // Key ID는 항상 표시
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

    return keys.map(k => ({ ...k, keySecret: undefined, signingSecret: undefined }));
  }

  /**
   * API Key ID로 API 키 찾기
   */
  async findByKeyId(keyId: string): Promise<ApiKey | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyId },
      relations: ['blog', 'user'],
    });
    
    return apiKey;
  }

  /**
   * API Key Secret 가져오기 (HMAC 서명 검증용) - keyId로 조회
   */
  async getApiKeySecret(keyId: string): Promise<string | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyId },
      select: ['signingSecret'],
    });
    
    if (!apiKey || !apiKey.signingSecret) {
      return null;
    }
    
    // signingSecret을 복호화하여 원본 시크릿 반환
    const decrypted = this.decryptSigningSecret(apiKey.signingSecret);
    return decrypted;
  }
  
  /**
   * API Key Secret 가져오기 by UUID (내부 ID)
   */
  async getApiKeySecretById(id: string): Promise<string | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      select: ['signingSecret'],
    });
    
    if (!apiKey || !apiKey.signingSecret) {
      return null;
    }
    
    // signingSecret을 복호화하여 원본 시크릿 반환
    const decrypted = this.decryptSigningSecret(apiKey.signingSecret);
    return decrypted;
  }

  /**
   * API 키 검증 (keyId와 keySecret으로)
   * 하위 호환성을 위해 단일 매개변수도 지원
   */
  async validateApiKey(keyIdOrPlainKey: string, keySecret?: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    // 하위 호환성: keySecret이 없으면 이전 방식으로 처리
    if (!keySecret) {
      // 이전 방식: 모든 API 키를 확인
      const apiKeys = await this.apiKeyRepository.find({
        where: { isActive: true },
        relations: ['user', 'blog']
      });

      for (const apiKey of apiKeys) {
        // 이전 key 필드 확인
        if (apiKey.key) {
          const isMatch = await bcrypt.compare(keyIdOrPlainKey, apiKey.key);
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
      }
      return { valid: false };
    }

    // 새 방식: keyId로 API 키 조회
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyId: keyIdOrPlainKey, isActive: true },
      relations: ['user', 'blog']
    });

    if (apiKey) {
      // keySecret 검증
      const isMatch = await bcrypt.compare(keySecret, apiKey.keySecret);
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

    return { ...apiKey, keySecret: undefined, signingSecret: undefined };
  }

  /**
   * 서명 시크릿 암호화
   */
  private encryptSigningSecret(secret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-for-dev',
      'salt',
      32
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // IV + authTag + encrypted를 합쳐서 저장
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * 서명 시크릿 복호화
   */
  decryptSigningSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-for-dev',
      'salt',
      32
    );
    
    const parts = encryptedSecret.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * API 키 ID로 서명 시크릿 가져오기
   */
  async getSigningSecret(apiKeyId: string): Promise<string | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId, isActive: true }
    });

    if (!apiKey || !apiKey.signingSecret) {
      return null;
    }

    return this.decryptSigningSecret(apiKey.signingSecret);
  }

  /**
   * API 키 ID로 조회
   */
  async findById(id: string): Promise<ApiKey | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id },
      relations: ['user', 'blog']
    });

    return apiKey;
  }

  /**
   * 마지막 사용 시간 업데이트
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.apiKeyRepository.update(id, {
      lastUsedAt: new Date()
    });
  }
}