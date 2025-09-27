import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
  BadRequestException,
  HttpException,
  UnauthorizedException,
  Ip,
  Headers,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { OAuthGuard } from '../guards/oauth.guard';
import { RequireScopes } from '../decorators/scopes.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OAuthService } from '../services/oauth.service';
import { BlogsService } from '../../blogs/blogs.service';
import { UsersService } from '../../users/users.service';
import { UnifiedRedisService } from '../../redis/unified-redis.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { AuthorizeDto } from '../dto/authorize.dto';
import { TokenExchangeDto } from '../dto/token-exchange.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import * as crypto from 'crypto';

/**
 * OAuth2 인증 컨트롤러
 * OAuth2 Authorization Code Flow 엔드포인트 제공
 */
@ApiTags('OAuth2')
@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly blogsService: BlogsService,
    private readonly usersService: UsersService,
    private readonly redisService: UnifiedRedisService,
  ) {}

  /**
   * OAuth 클라이언트 생성
   * 개발자가 새 OAuth 클라이언트를 등록
   */
  @Post('clients')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'OAuth 클라이언트 생성',
    description: '새로운 OAuth 클라이언트를 등록합니다.'
  })
  async createClient(@Req() req: any, @Body() dto: CreateClientDto) {
    const userId = req.user.id;
    const client = await this.oauthService.createClient(
      userId,
      dto.clientName,
      dto.redirectUris,
      dto.description,
      dto.allowedScopes,
    );

    return {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
    };
  }

  /**
   * 사용자의 OAuth 클라이언트 목록 조회
   */
  @Get('clients')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'OAuth 클라이언트 목록 조회',
    description: '현재 사용자가 생성한 OAuth 클라이언트 목록을 조회합니다.'
  })
  async getMyClients(@Req() req: any) {
    const userId = req.user.id;
    const clients = await this.oauthService.getUserClients(userId);

    return clients.map(client => ({
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      allowed_scopes: client.allowedScopes,
      is_active: client.isActive,
      last_used_at: client.lastUsedAt,
      created_at: client.createdAt,
    }));
  }

  /**
   * OAuth 인증 데이터 API
   * 프론트엔드 OAuth 페이지에서 사용할 데이터를 반환
   */
  @Get('authorize-data')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'OAuth 인증 데이터 조회',
    description: 'OAuth 승인 페이지에 필요한 데이터를 JSON으로 반환합니다.'
  })
  async getAuthorizeData(
    @Req() req: any,
    @Query() query: AuthorizeDto,
  ) {
    try {
      console.log('🔍 OAuth authorize-data 엔드포인트 호출됨:', {
        client_id: query.client_id,
        redirect_uri: query.redirect_uri,
        scope: query.scope,
        userId: req.user?.id,
      });

      // 사용자 인증 체크
      if (!req.user) {
        throw new UnauthorizedException('로그인이 필요합니다.');
      }

      // 클라이언트 검증
      const client = await this.oauthService.validateClient(query.client_id);

      // 사용자의 블로그 목록 조회
      const blogs = await this.blogsService.findByUserId(req.user.id);

      // 요청된 스코프 확인
      const requestedScopes = query.scope?.split(' ') || [];

      // 사용자 정보
      const userInfo = await this.usersService.findById(req.user.id);

      return {
        client: {
          client_id: client.clientId,
          client_name: client.clientName,
          client_description: client.description,
        },
        requested_scopes: requestedScopes,
        blogs: blogs.map(blog => ({
          id: blog.id,
          name: blog.name,
          slug: blog.slug,
        })),
        user_email: userInfo?.email || 'user@example.com',
      };
    } catch (error) {
      console.error('❌ OAuth 인증 데이터 조회 오류:', error);
      throw new HttpException(
        'Failed to get authorization data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * OAuth 인증 페이지 (리다이렉트용)
   * 프론트엔드 OAuth 페이지로 리다이렉트
   */
  @Public()
  @Get('authorize')
  @ApiOperation({
    summary: 'OAuth 인증 페이지 리다이렉트',
    description: '프론트엔드 OAuth 승인 페이지로 리다이렉트합니다.'
  })
  async showAuthorizePage(
    @Req() req: any,
    @Res() res: Response,
    @Query() query: AuthorizeDto,
  ) {
    try {
      console.log('🔍 OAuth authorize 엔드포인트 호출됨:', {
        client_id: query.client_id,
        redirect_uri: query.redirect_uri,
        scope: query.scope,
        hasCookie: !!req.cookies?.access_token,
      });

      // JWT 토큰이 있는지 확인 (로그인 여부 체크)
      const token = req.cookies?.access_token;

      // 계정 전환 요청 처리
      if (query.switch_account === 'true') {
        // 기존 쿠키 삭제
        res.clearCookie('access_token');
        const newQuery = { ...query };
        delete newQuery.switch_account;
        const queryString = new URLSearchParams(newQuery as any).toString();
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        return res.redirect(`${frontendUrl}/oauth/authorize?${queryString}`);
      }

      // 로그인되지 않은 경우
      if (!token) {
        const queryString = new URLSearchParams(query as any).toString();
        const returnUrl = `/oauth/authorize?${queryString}`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const loginUrl = `${frontendUrl}/login?returnUrl=${encodeURIComponent(returnUrl)}`;
        return res.redirect(loginUrl);
      }

      // 토큰 검증
      try {
        const user = await this.oauthService.verifyJwtToken(token);
        if (!user) {
          // 토큰이 유효하지 않으면 로그인 페이지로
          const queryString = new URLSearchParams(query as any).toString();
          const returnUrl = `/oauth/authorize?${queryString}`;
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
          const loginUrl = `${frontendUrl}/login?returnUrl=${encodeURIComponent(returnUrl)}`;
          return res.redirect(loginUrl);
        }
      } catch (error) {
        // 토큰 검증 실패
        const queryString = new URLSearchParams(query as any).toString();
        const returnUrl = `/oauth/authorize?${queryString}`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const loginUrl = `${frontendUrl}/login?returnUrl=${encodeURIComponent(returnUrl)}`;
        return res.redirect(loginUrl);
      }

      // 모든 검증을 통과하면 프론트엔드 OAuth 페이지로 리다이렉트
      const queryString = new URLSearchParams(query as any).toString();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/oauth/authorize?${queryString}`);
    } catch (error) {
      console.error('❌ OAuth 인증 페이지 오류:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * OAuth 권한 승인/거부 처리
   * 사용자가 권한 부여를 승인하거나 거부할 때 호출
   */
  @Post('authorize')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'OAuth 권한 승인/거부 처리',
    description: '사용자가 클라이언트 앱에 대한 권한 부여를 승인하거나 거부합니다.'
  })
  async handleAuthorization(
    @Req() req: any,
    @Body() body: any,
  ) {
    console.log('🔍 OAuth authorize POST 엔드포인트 호출됨');
    console.log('🔍 req.user:', req.user);
    console.log('🔍 body:', body);
    console.log('🔍 cookies:', req.cookies);

    // 사용자 인증 체크
    if (!req.user) {
      console.log('❌ req.user가 없음 - 401 에러 반환');
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    const userId = req.user.id;

    // 클라이언트 검증
    const client = await this.oauthService.validateClient(body.client_id);

    // 리다이렉트 URI 검증
    if (!client.redirectUris.includes(body.redirect_uri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    // 사용자가 승인한 경우
    if (body.approved) {
      // 선택된 블로그 검증
      const blog = await this.blogsService.findOne(body.blog_id);
      if (!blog || String(blog.userId) !== String(userId)) {
        throw new BadRequestException('Invalid blog selected');
      }

      // Authorization Code 생성
      // 파라미터 순서 수정: userId, blogId, clientId, redirectUri, scopes, state, codeChallenge, codeChallengeMethod
      const authorizationCode = await this.oauthService.generateAuthorizationCode(
        userId,                      // 사용자 ID
        blog.id,                     // 블로그 ID
        client.clientId,             // 클라이언트 ID (client.id가 아닌 client.clientId 사용)
        body.redirect_uri,           // 리다이렉트 URI
        body.scope ? body.scope.split(' ') : ['mcp:post:create'], // 스코프 배열
        body.state,                  // State 파라미터
        body.code_challenge,         // PKCE 코드 챌린지
        body.code_challenge_method,  // PKCE 메소드
        req.ip,                      // 클라이언트 IP
      );

      // MCP 세션이 있으면 Redis에 연결 정보 저장
      // state가 실제로 MCP 세션 ID인 경우
      if (body.state) {
        try {
          // MCP 세션과 OAuth 승인 연결
          await this.redisService.setCache(
            'mcp',
            `sessions:${body.state}`,
            {
              userId,
              blogId: blog.id,
              createdAt: Date.now(),
              isActive: true,
            },
            86400, // 24시간
          );
          console.log(`✅ MCP 세션 생성됨: ${body.state.substring(0, 8)}... (userId: ${userId}, blogId: ${blog.id})`);
        } catch (error) {
          console.error('❌ MCP 세션 생성 실패:', error);
        }
      }

      const state = body.state || '';
      const redirectUri = body.redirect_uri;

      // 리다이렉트 URL 반환 (프론트엔드에서 처리)
      const redirectUrl = `${redirectUri}?code=${authorizationCode}&state=${state}`;
      console.log('✅ OAuth 승인 성공, 리다이렉트:', redirectUrl);
      return { redirect_url: redirectUrl };
    } else {
      // 사용자가 거부한 경우
      console.log('❌ 사용자가 OAuth 권한 부여를 거부함');
      const redirectUrl = `${body.redirect_uri}?error=access_denied&state=${body.state}`;
      return { redirect_url: redirectUrl };
    }
  }

  /**
   * Access Token 발급 (Authorization Code 교환)
   */
  @Post('token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access Token 발급',
    description: 'Authorization Code를 Access Token으로 교환합니다.'
  })
  async exchangeToken(@Body() body: TokenExchangeDto, @Headers() headers: any) {
    console.log('🔄 Token exchange 요청:', {
      grant_type: body.grant_type,
      client_id: body.client_id,
      hasCode: !!body.code,
    });

    if (body.grant_type === 'authorization_code') {
      return await this.oauthService.exchangeCodeForToken(
        body.code,           // 인증 코드가 첫 번째 파라미터
        body.client_id,      // 클라이언트 ID가 두 번째
        body.client_secret,  // 클라이언트 시크릿이 세 번째
        body.redirect_uri,   // 리다이렉트 URI가 네 번째
        body.code_verifier,  // PKCE 검증자가 다섯 번째
      );
    } else if (body.grant_type === 'refresh_token') {
      return await this.oauthService.refreshAccessToken(
        body.client_id,
        body.client_secret,
        '', // refresh_token은 기본값 사용
      );
    } else {
      throw new BadRequestException('Unsupported grant_type');
    }
  }

  /**
   * Token Introspection
   * Access Token의 유효성 및 정보 조회
   */
  @Post('introspect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Token Introspection',
    description: 'Access Token의 유효성 및 정보를 조회합니다.'
  })
  async introspectToken(
    @Body('token') token: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
  ) {
    // 클라이언트 인증
    const client = await this.oauthService.validateClient(clientId);
    // validateClient에 clientSecret도 전달하여 검증
    let isValidSecret = false;
    try {
      await this.oauthService.validateClient(clientId, clientSecret);
      isValidSecret = true;
    } catch (error) {
      isValidSecret = false;
    }

    if (!isValidSecret) {
      return { active: false };
    }

    // 토큰 검증 - validateToken 사용
    const tokenInfo = await this.oauthService.validateToken(token);

    if (!tokenInfo || tokenInfo.clientId !== client.id) {
      return { active: false };
    }

    // OAuth 2.0 Token Introspection 표준 형식으로 반환
    return {
      active: true,
      ...tokenInfo,
    };
  }

  /**
   * 승인된 OAuth 앱 목록 조회
   */
  @Get('authorized-apps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '승인된 OAuth 앱 목록',
    description: '사용자가 승인한 OAuth 앱 목록을 조회합니다.'
  })
  async getAuthorizedApps(@Req() req: any) {
    const userId = req.user.id;
    const apps = await this.oauthService.getAuthorizedApps(userId);

    return apps.map(app => ({
      client_id: app.client.clientId,
      client_name: app.client.clientName,
      scopes: app.scopes,
      authorized_at: app.client.createdAt,
      last_used_at: app.lastUsed,
    }));
  }

  /**
   * OAuth 앱 승인 취소
   */
  @Delete('authorized-apps/:clientId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'OAuth 앱 승인 취소',
    description: '특정 OAuth 앱에 대한 승인을 취소합니다.'
  })
  async revokeApp(@Req() req: any, @Param('clientId') clientId: string) {
    const userId = req.user.id;

    // 해당 클라이언트의 모든 토큰을 실제로 취소 처리
    // revokeAllClientTokens 메서드를 사용하여 DB에서 모든 토큰을 revoked 상태로 변경
    await this.oauthService.revokeAllClientTokens(userId, clientId);

    this.logger.log(`✅ OAuth 앱 승인 취소: userId=${userId}, clientId=${clientId}`);

    return { message: 'Authorization revoked successfully' };
  }

  /**
   * Token 취소 (Revocation)
   */
  @Post('revoke')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Token 취소',
    description: 'Access Token 또는 Refresh Token을 취소합니다.'
  })
  async revokeToken(
    @Body('token') token: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
  ) {
    // 클라이언트 인증
    const client = await this.oauthService.validateClient(clientId);
    // validateClient에 clientSecret도 전달하여 검증
    let isValidSecret = false;
    try {
      await this.oauthService.validateClient(clientId, clientSecret);
      isValidSecret = true;
    } catch (error) {
      isValidSecret = false;
    }

    if (!isValidSecret) {
      throw new BadRequestException('Invalid client credentials');
    }

    await this.oauthService.revokeToken(token, client.id);

    return { message: 'Token revoked successfully' };
  }
}