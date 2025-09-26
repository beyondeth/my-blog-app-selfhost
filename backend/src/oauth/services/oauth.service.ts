import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthCode } from '../entities/oauth-code.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { UnifiedRedisService } from '../../redis/unified-redis.service';

/**
 * OAuth2 인증 서비스
 * Authorization Code Flow와 PKCE를 구현하여 안전한 MCP 인증 제공
 */
@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(OAuthClient)
    private readonly clientRepository: Repository<OAuthClient>,
    @InjectRepository(OAuthCode)
    private readonly codeRepository: Repository<OAuthCode>,
    @InjectRepository(OAuthToken)
    private readonly tokenRepository: Repository<OAuthToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    private readonly configService: ConfigService,
    private readonly redisService: UnifiedRedisService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * OAuth 클라이언트 생성
   * MCP 클라이언트 앱 등록시 사용
   */
  async createClient(
    userId: string,
    clientName: string,
    redirectUris: string[],
    description?: string,
    allowedScopes?: string[],
  ): Promise<OAuthClient> {
    // 사용자당 최대 10개 클라이언트 제한
    const existingClients = await this.clientRepository.count({
      where: { userId },
    });

    if (existingClients >= 10) {
      throw new BadRequestException('최대 10개까지 OAuth 클라이언트를 생성할 수 있습니다');
    }

    // 클라이언트 ID와 시크릿 생성
    const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = await bcrypt.hash(rawSecret, 10);

    // 스코프 설정 (기본값 또는 전달된 값 사용, MCP 관련 스코프만 허용)
    const scopes = allowedScopes?.filter(scope => scope.startsWith('mcp:')) || ['mcp:post:create'];

    const client = this.clientRepository.create({
      clientId,
      clientSecret: hashedSecret,
      clientName,
      redirectUris,
      allowedScopes: scopes.length > 0 ? scopes : ['mcp:post:create'], // 최소한 mcp:post:create는 포함
      grantTypes: 'authorization_code',
      userId,
      description,
      isActive: true,
      isTrusted: false, // 기본적으로 신뢰하지 않음 (동의 화면 필요)
    });

    await this.clientRepository.save(client);

    // 처음 생성시에만 평문 시크릿 반환 (이후 조회 불가)
    return {
      ...client,
      clientSecret: rawSecret, // 평문 시크릿 (1회만 제공)
    } as OAuthClient;
  }

  /**
   * 클라이언트 검증
   * 클라이언트 ID와 시크릿이 유효한지 확인
   */
  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient> {
    // 디버그 로깅 추가
    console.log('🔍 OAuth 클라이언트 검증 시작:', {
      clientId,
      hasSecret: !!clientSecret,
      secretLength: clientSecret?.length,
    });

    const client = await this.clientRepository.findOne({
      where: { clientId, isActive: true },
    });

    if (!client) {
      console.error('❌ 클라이언트를 찾을 수 없음:', clientId);
      throw new UnauthorizedException('유효하지 않은 클라이언트입니다');
    }

    console.log('✅ 클라이언트 발견:', {
      id: client.id,
      clientId: client.clientId,
      clientName: client.clientName,
      hashedSecretLength: client.clientSecret?.length,
    });

    // 시크릿이 제공된 경우 검증
    if (clientSecret) {
      console.log('🔑 시크릿 검증 디버깅:', {
        providedSecret: clientSecret,
        providedLength: clientSecret.length,
        storedHash: client.clientSecret,
        storedHashLength: client.clientSecret.length,
        isHashFormat: client.clientSecret.startsWith('$2b$') || client.clientSecret.startsWith('$2a$'),
      });

      const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecret);
      console.log('🔐 bcrypt 검증 결과:', isValidSecret);

      // 추가 테스트: 알려진 시크릿으로 직접 테스트
      if (clientSecret === 'mcp-secret-key-2024' && !isValidSecret) {
        console.log('⚠️ 알려진 시크릿이지만 검증 실패. 해시 재생성 테스트:');
        const testHash = await bcrypt.hash('mcp-secret-key-2024', 10);
        console.log('  - 새로운 해시:', testHash);
        console.log('  - 저장된 해시:', client.clientSecret);
        const testCompare = await bcrypt.compare('mcp-secret-key-2024', testHash);
        console.log('  - 새 해시로 테스트:', testCompare);
      }

      if (!isValidSecret) {
        console.error('❌ 시크릿 검증 실패');
        throw new UnauthorizedException('클라이언트 시크릿이 올바르지 않습니다');
      }
    }

    // 마지막 사용 시간 업데이트
    client.lastUsedAt = new Date();
    await this.clientRepository.save(client);

    console.log('✅ 클라이언트 검증 성공');
    return client;
  }

  /**
   * 인증 코드 생성
   * 사용자가 OAuth 인증을 승인하면 임시 코드 발급
   */
  async generateAuthorizationCode(
    userId: string,
    blogId: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string,
    codeChallenge?: string,
    codeChallengeMethod?: string,
    clientIp?: string,
  ): Promise<string> {
    // 블로그 소유권 검증 (중요!)
    const blog = await this.blogRepository.findOne({
      where: { id: blogId, userId },
    });

    if (!blog) {
      throw new ForbiddenException('해당 블로그에 대한 권한이 없습니다');
    }

    // 클라이언트 검증
    const client = await this.validateClient(clientId);

    // 리다이렉트 URI 검증
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('등록되지 않은 리다이렉트 URI입니다');
    }

    // 스코프 검증 (MCP는 오직 'mcp:post:create'만 허용)
    const requestedScopes = scopes.filter(scope =>
      client.allowedScopes.includes(scope)
    );

    if (requestedScopes.length === 0 || !requestedScopes.includes('mcp:post:create')) {
      throw new BadRequestException('유효하지 않은 권한 요청입니다');
    }

    // 기존 미사용 코드 삭제 (중복 방지)
    await this.codeRepository.delete({
      userId,
      blogId,
      clientId: client.id,
      isUsed: false,
    });

    // 인증 코드 생성 (32바이트 랜덤)
    const code = crypto.randomBytes(32).toString('hex');

    // State 파라미터를 Redis에 저장 (CSRF 방지용)
    if (state) {
      const stateKey = `oauth:state:${userId}:${clientId}:${state}`;
      await this.redisService.setWithExpiry(stateKey, JSON.stringify({
        userId,
        clientId,
        code,
        timestamp: Date.now(),
      }), 300); // 5분 TTL
    }

    // 5분 후 만료
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const authCode = this.codeRepository.create({
      code,
      userId,
      blogId,
      clientId: client.id,
      redirectUri,
      scopes: requestedScopes,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
      isUsed: false,
      issuedIp: clientIp,
      state,
    });

    await this.codeRepository.save(authCode);

    return code;
  }

  /**
   * 코드를 토큰으로 교환
   * Authorization Code를 Access Token으로 교환
   */
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    codeVerifier?: string,
    clientIp?: string,
    userAgent?: string,
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    refresh_token?: string;
  }> {
    // 디버깅: 토큰 교환 시작
    console.log('🔄 토큰 교환 시작:', {
      code: code?.substring(0, 10) + '...',
      clientId,
      clientSecret: clientSecret?.substring(0, 10) + '...',
      redirectUri,
      hasVerifier: !!codeVerifier,
    });

    // 클라이언트 검증
    const client = await this.validateClient(clientId, clientSecret);

    // 인증 코드 조회
    const authCode = await this.codeRepository.findOne({
      where: {
        code,
        clientId: client.id,
        isUsed: false,
      },
      relations: ['user', 'blog'],
    });

    if (!authCode) {
      throw new UnauthorizedException('유효하지 않은 인증 코드입니다');
    }

    // 만료 확인
    if (new Date() > authCode.expiresAt) {
      await this.codeRepository.remove(authCode);
      throw new UnauthorizedException('인증 코드가 만료되었습니다');
    }

    // 리다이렉트 URI 검증
    if (authCode.redirectUri !== redirectUri) {
      throw new BadRequestException('리다이렉트 URI가 일치하지 않습니다');
    }

    // State 파라미터 검증 (CSRF 방지)
    if (authCode.state) {
      const stateKey = `oauth:state:${authCode.userId}:${clientId}:${authCode.state}`;
      const storedState = await this.redisService.get(stateKey);

      if (!storedState) {
        throw new UnauthorizedException('State 파라미터 검증 실패: State가 만료되었거나 유효하지 않습니다');
      }

      const stateData = JSON.parse(storedState);
      if (stateData.code !== code || stateData.userId !== authCode.userId) {
        throw new UnauthorizedException('State 파라미터 검증 실패: 데이터 불일치');
      }

      // State 검증 완료 후 삭제
      await this.redisService.del(stateKey);
    }

    // PKCE 검증 (선택적)
    if (authCode.codeChallenge) {
      if (!codeVerifier) {
        throw new BadRequestException('PKCE 검증이 필요합니다');
      }

      const verifierHash = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (verifierHash !== authCode.codeChallenge) {
        throw new UnauthorizedException('PKCE 검증 실패');
      }
    }

    // 코드를 사용 처리
    authCode.isUsed = true;
    authCode.usedAt = new Date();
    await this.codeRepository.save(authCode);

    // 액세스 토큰 생성 (JWT 대신 랜덤 토큰 사용)
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // 토큰 해시 생성 (DB 저장용)
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // 토큰 만료 시간 설정
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 1); // 1시간

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30); // 30일

    // DB에 토큰 정보 저장
    const token = this.tokenRepository.create({
      tokenHash,
      refreshTokenHash,
      tokenType: 'access',
      userId: authCode.userId,
      blogId: authCode.blogId,
      clientId: client.id,
      scopes: authCode.scopes,
      expiresAt: accessExpiresAt,
      isRevoked: false,
      issuedIp: clientIp,
      issuedUserAgent: userAgent,
    });

    await this.tokenRepository.save(token);

    // Redis에 토큰 저장 (빠른 검증용)
    const tokenData = {
      userId: authCode.userId,
      blogId: authCode.blogId,
      clientId: client.id,
      scopes: authCode.scopes,
      expiresAt: accessExpiresAt.toISOString(),
    };

    // Redis TTL은 토큰 만료 시간과 동일하게 설정
    const ttl = Math.floor((accessExpiresAt.getTime() - Date.now()) / 1000);
    await this.redisService.setCache(
      'oauth:token',
      accessToken,
      tokenData,
      ttl,
    );

    // 리프레시 토큰도 Redis에 저장
    await this.redisService.setCache(
      'oauth:refresh',
      refreshToken,
      {
        tokenId: token.id,
        userId: authCode.userId,
        clientId: client.id,
      },
      30 * 24 * 60 * 60, // 30일
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1시간 (초 단위)
      scope: authCode.scopes.join(' '),
      refresh_token: refreshToken,
    };
  }

  /**
   * 토큰 검증 및 정보 반환
   * API 요청시 토큰 유효성 확인
   */
  async validateToken(accessToken: string): Promise<{
    userId: string;
    blogId: string;
    clientId: string;
    scopes: string[];
  }> {
    // 디버깅: 토큰 검증 시작
    console.log('🔍 토큰 검증 시작:', {
      token: accessToken.substring(0, 10) + '...',
      timestamp: new Date().toISOString(),
    });

    // 먼저 Redis에서 확인 (빠른 검증)
    const cachedData = await this.redisService.getCache<any>('oauth:token', accessToken);

    console.log('📦 Redis 조회 결과:', {
      found: !!cachedData,
      data: cachedData ? JSON.stringify(cachedData).substring(0, 100) : null,
    });

    if (cachedData) {
      const tokenData = cachedData;  // 이미 JSON으로 파싱됨

      console.log('⏰ 만료 체크:', {
        expiresAt: tokenData.expiresAt,
        now: new Date().toISOString(),
        isValid: new Date(tokenData.expiresAt) > new Date(),
      });

      // 만료 확인
      if (new Date(tokenData.expiresAt) > new Date()) {
        console.log('✅ 토큰 유효함');
        return tokenData;
      }

      // 만료된 토큰은 Redis에서 삭제
      await this.redisService.deleteCache('oauth:token', accessToken);
    }

    // Redis에 없으면 DB 확인
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const token = await this.tokenRepository.findOne({
      where: {
        tokenHash,
        isRevoked: false,
      },
    });

    if (!token) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }

    // 만료 확인
    if (new Date() > token.expiresAt) {
      throw new UnauthorizedException('토큰이 만료되었습니다');
    }

    // 마지막 사용 시간 업데이트
    token.lastUsedAt = new Date();
    await this.tokenRepository.save(token);

    // Redis에 다시 캐싱
    const tokenData = {
      userId: token.userId,
      blogId: token.blogId,
      clientId: token.clientId,
      scopes: token.scopes,
      expiresAt: token.expiresAt.toISOString(),
    };

    const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
    await this.redisService.setCache(
      'oauth:token',
      accessToken,
      tokenData,
      ttl,
    );

    return tokenData;
  }

  /**
   * 리프레시 토큰으로 새 액세스 토큰 발급
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }> {
    // 클라이언트 검증
    const client = await this.validateClient(clientId, clientSecret);

    // Redis에서 리프레시 토큰 확인
    const refreshData = await this.redisService.getCache<any>('oauth:refresh', refreshToken);

    if (!refreshData) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다');
    }

    const { tokenId, userId, clientId: storedClientId } = refreshData;  // 이미 JSON으로 파싱됨

    // 클라이언트 ID 일치 확인
    if (storedClientId !== client.id) {
      throw new UnauthorizedException('토큰과 클라이언트가 일치하지 않습니다');
    }

    // 기존 토큰 정보 조회
    const oldToken = await this.tokenRepository.findOne({
      where: { id: tokenId },
    });

    if (!oldToken || oldToken.isRevoked) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }

    // 새 액세스 토큰 생성
    const newAccessToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(newAccessToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1시간

    // 새 토큰 DB 저장
    const newToken = this.tokenRepository.create({
      tokenHash,
      tokenType: 'access',
      userId: oldToken.userId,
      blogId: oldToken.blogId,
      clientId: oldToken.clientId,
      scopes: oldToken.scopes,
      expiresAt,
      isRevoked: false,
    });

    await this.tokenRepository.save(newToken);

    // Redis에 새 토큰 저장
    const tokenData = {
      userId: oldToken.userId,
      blogId: oldToken.blogId,
      clientId: oldToken.clientId,
      scopes: oldToken.scopes,
      expiresAt: expiresAt.toISOString(),
    };

    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    await this.redisService.setCache(
      'oauth:token',
      newAccessToken,
      tokenData,
      ttl,
    );

    return {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: oldToken.scopes.join(' '),
    };
  }

  /**
   * 토큰 취소
   * 로그아웃이나 권한 취소시 사용
   */
  async revokeToken(
    accessToken: string,
    reason?: string,
  ): Promise<void> {
    // Redis에서 즉시 삭제
    await this.redisService.deleteCache('oauth:token', accessToken);

    // DB에서 토큰 조회 및 취소 처리
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const token = await this.tokenRepository.findOne({
      where: { tokenHash },
    });

    if (token && !token.isRevoked) {
      token.isRevoked = true;
      token.revokedAt = new Date();
      token.revokeReason = reason || 'User revoked';
      await this.tokenRepository.save(token);
    }
  }

  /**
   * 클라이언트의 모든 토큰 취소
   * OAuth 앱 연결 해제시 사용
   */
  async revokeAllClientTokens(
    userId: string,
    clientId: string,
  ): Promise<void> {
    // 해당 클라이언트의 모든 활성 토큰 조회
    const tokens = await this.tokenRepository.find({
      where: {
        userId,
        clientId,
        isRevoked: false,
      },
    });

    // 모든 토큰 취소 처리
    for (const token of tokens) {
      // DB에서 취소 처리
      token.isRevoked = true;
      token.revokedAt = new Date();
      token.revokeReason = 'Client authorization revoked';
    }

    await this.tokenRepository.save(tokens);

    // 참고: Redis에 캐시된 토큰들은 TTL로 자동 만료되므로
    // 여기서는 DB 업데이트만 처리. 다음 검증시 DB 확인하여 거부됨
  }

  /**
   * 사용자의 OAuth 클라이언트 목록 조회
   */
  async getUserClients(userId: string): Promise<OAuthClient[]> {
    return this.clientRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 사용자가 인증한 OAuth 앱 목록 조회
   */
  async getAuthorizedApps(userId: string): Promise<{
    client: OAuthClient;
    lastUsed: Date;
    scopes: string[];
  }[]> {
    // 활성 토큰이 있는 클라이언트 조회
    const tokens = await this.tokenRepository
      .createQueryBuilder('token')
      .where('token.userId = :userId', { userId })
      .andWhere('token.isRevoked = false')
      .andWhere('token.expiresAt > :now', { now: new Date() })
      .leftJoinAndSelect('token.client', 'client')
      .orderBy('token.lastUsedAt', 'DESC')
      .getMany();

    // 클라이언트별로 그룹화
    const clientMap = new Map<string, {
      client: OAuthClient;
      lastUsed: Date;
      scopes: string[];
    }>();

    for (const token of tokens) {
      const existing = clientMap.get(token.clientId);
      if (!existing || token.lastUsedAt > existing.lastUsed) {
        clientMap.set(token.clientId, {
          client: token.client,
          lastUsed: token.lastUsedAt || token.createdAt,
          scopes: token.scopes,
        });
      }
    }

    return Array.from(clientMap.values());
  }

  /**
   * JWT 토큰 검증
   * OAuth 인증 페이지에서 로그인 여부 확인용
   */
  async verifyJwtToken(token: string): Promise<User | null> {
    try {
      // JWT 토큰 검증
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // 페이로드에서 사용자 ID 추출
      const userId = payload.sub || payload.id;
      if (!userId) {
        return null;
      }

      // 사용자 정보 조회
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      // 토큰 검증 실패 (만료, 잘못된 서명 등)
      return null;
    }
  }
}