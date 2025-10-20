import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DateUtils } from '../../common/utils/date.utils';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthCode } from '../entities/oauth-code.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { User } from '../../users/entities/user.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { RegisterClientDto } from '../dto/register-client.dto';

/**
 * OAuth2 인증 서비스
 * Authorization Code Flow와 PKCE를 구현하여 안전한 MCP 인증 제공
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

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
   * 클라이언트 검증
   * 클라이언트 ID와 시크릿이 유효한지 확인
   */
  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient> {

    const client = await this.clientRepository.findOne({
      where: { clientId, isActive: true },
    });

    if (!client) {
      throw new UnauthorizedException('유효하지 않은 클라이언트입니다');
    }

    // 시크릿이 제공된 경우 검증
    if (clientSecret) {
      const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecret);

      if (!isValidSecret) {
        throw new UnauthorizedException('클라이언트 시크릿이 올바르지 않습니다');
      }
    }

    // 마지막 사용 시간 업데이트
    client.lastUsedAt = new Date();
    await this.clientRepository.save(client);

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
    resource?: string, // ✅ RFC 8707: Resource Indicator 추가
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

    // 5분 후 만료 - DateUtils를 사용한 밀리초 기반 계산
    const expiresAt = DateUtils.fromNowAddMinutes(5);

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
      resource, // ✅ RFC 8707: Resource Indicator 저장
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

    // JWT 토큰 생성 (AuthService와 동일한 방식)
    const now = Math.floor(Date.now() / 1000);

    // Access Token 생성
    const accessPayload = {
      sub: authCode.userId,
      email: authCode.user.email,
      role: authCode.user.role,
      tokenType: 'access',
      iat: now,
      // OAuth 특정 필드 추가
      clientId: client.id,
      scopes: authCode.scopes,
      blogId: authCode.blogId,
      // ✅ RFC 8707: Resource Indicator를 audience claim으로 추가
      ...(authCode.resource && { aud: authCode.resource }),
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '1d'),
    });

    // Refresh Token 생성
    const refreshPayload = {
      sub: authCode.userId,
      email: authCode.user.email,
      role: authCode.user.role,
      tokenType: 'refresh',
      iat: now,
      // OAuth 특정 필드 추가
      clientId: client.id,
      scopes: authCode.scopes,
      blogId: authCode.blogId,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // 토큰 해시 생성 (DB 저장용)
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // 토큰 만료 시간 설정 - DateUtils를 사용한 밀리초 기반 계산
    // 환경 변수는 초 단위이므로 fromSecondsToDate 사용
    const accessTokenSeconds = this.configService.get<number>('OAUTH_ACCESS_TOKEN_EXPIRES_IN', 86400);
    const refreshTokenSeconds = this.configService.get<number>('OAUTH_REFRESH_TOKEN_EXPIRES_IN', 2592000);
    const accessExpiresAt = DateUtils.fromSecondsToDate(accessTokenSeconds);
    const refreshExpiresAt = DateUtils.fromSecondsToDate(refreshTokenSeconds);

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
      this.configService.get<number>('OAUTH_REFRESH_TOKEN_EXPIRES_IN', 2592000), // 환경 변수에서 읽기
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.configService.get<number>('OAUTH_ACCESS_TOKEN_EXPIRES_IN', 86400), // 환경 변수에서 읽기
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

    // 먼저 Redis에서 확인 (빠른 검증)
    const cachedData = await this.redisService.getCache<any>('oauth:token', accessToken);


    if (cachedData) {
      const tokenData = cachedData;  // 이미 JSON으로 파싱됨

      // 만료 확인
      if (new Date(tokenData.expiresAt) > new Date()) {
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

    // 만료 시간 설정 - DateUtils를 사용한 밀리초 기반 계산
    const accessTokenSeconds = this.configService.get<number>('OAUTH_ACCESS_TOKEN_EXPIRES_IN', 86400);
    const expiresAt = DateUtils.fromSecondsToDate(accessTokenSeconds);

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
      expires_in: this.configService.get<number>('OAUTH_ACCESS_TOKEN_EXPIRES_IN', 86400), // 환경 변수에서 읽기
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

  /**
   * Dynamic Client Registration (RFC 7591)
   *
   * MCP 클라이언트가 자동으로 등록할 수 있도록 합니다.
   * Public Client (PKCE 사용) 또는 Confidential Client 지원.
   *
   * @param dto - 클라이언트 등록 정보
   * @param initialAccessToken - Initial Access Token (Enterprise 배포용, 선택적)
   * @returns 등록된 클라이언트 정보
   */
  async registerClient(
    dto: RegisterClientDto,
    initialAccessToken?: string,
  ): Promise<{
    client_id: string;
    client_secret?: string;
    client_id_issued_at: number;
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
  }> {
    // 1. Initial Access Token 검증 (Enterprise 환경)
    const requireInitialToken = this.configService.get<boolean>(
      'OAUTH_REQUIRE_INITIAL_ACCESS_TOKEN',
      false,
    );

    if (requireInitialToken) {
      if (!initialAccessToken) {
        throw new UnauthorizedException(
          'Initial access token required for client registration',
        );
      }
      // TODO: Initial Access Token 검증 로직 (Phase 6에서 구현)
      // await this.validateInitialAccessToken(initialAccessToken);
    }

    // 2. 입력값 검증 및 기본값 설정
    const grantTypes = dto.grant_types || ['authorization_code', 'refresh_token'];
    const responseTypes = dto.response_types || ['code'];
    const tokenEndpointAuthMethod = dto.token_endpoint_auth_method || 'none';
    const scopes = dto.scope?.split(' ') || ['mcp:post:create'];

    // 3. Public Client 여부 판단
    const isPublic = tokenEndpointAuthMethod === 'none';

    // 4. 동적 Client ID 생성
    const clientId = `mcp-${crypto.randomUUID()}`;

    // 5. Client Secret 생성 (Public Client가 아닌 경우만)
    let clientSecretPlain: string | undefined;
    let clientSecretHashed: string;

    if (!isPublic) {
      // Confidential Client: client_secret 생성
      clientSecretPlain = crypto.randomBytes(32).toString('hex');
      clientSecretHashed = await bcrypt.hash(clientSecretPlain, 10);
    } else {
      // Public Client: client_secret 없음 (PKCE로 보안 보장)
      clientSecretHashed = 'N/A';
    }

    // 6. Redirect URI 검증 (localhost 또는 loopback 주소만 허용)
    for (const uri of dto.redirect_uris) {
      const url = new URL(uri);
      const isLocalhost =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]';

      if (!isLocalhost) {
        throw new BadRequestException(
          `Redirect URI must be localhost or loopback address: ${uri}`,
        );
      }
    }

    // 7. DB에 클라이언트 저장
    const issuedAt = Math.floor(Date.now() / 1000);

    const client = this.clientRepository.create({
      clientId,
      clientSecret: clientSecretHashed,
      clientName: dto.client_name,
      redirectUris: dto.redirect_uris,
      allowedScopes: scopes,
      grantTypes: grantTypes.join(','),
      tokenEndpointAuthMethod,
      isDynamic: true, // ✅ 동적 등록 표시
      isPublic, // ✅ Public Client 여부
      issuedAt, // ✅ RFC 7591 필드
      userId: null, // 동적 등록은 특정 사용자에게 속하지 않음
      description: dto.description || `Dynamically registered MCP client`,
      isActive: true,
      isTrusted: false, // 동적 등록은 기본적으로 신뢰하지 않음
    });

    await this.clientRepository.save(client);

    this.logger.log(
      `Dynamic client registered: ${clientId} (${isPublic ? 'Public' : 'Confidential'})`,
    );

    // 8. RFC 7591 표준 응답 반환
    const response: any = {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: dto.client_name,
      redirect_uris: dto.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      scope: scopes.join(' '), // ✅ RFC 7591: scope 필드 추가 (MCP SDK가 Authorization URL에 scope를 포함하도록 함)
    };

    // Confidential Client인 경우에만 client_secret 반환
    if (clientSecretPlain) {
      response.client_secret = clientSecretPlain;
    }

    return response;
  }
}