#!/usr/bin/env node

/**
 * MCP Proxy OAuth2 클라이언트 시드 스크립트
 * MCP Proxy 서버를 위한 OAuth 클라이언트를 데이터베이스에 등록합니다.
 *
 * 환경변수 (선택):
 * - OAUTH_CLIENT_ID: 클라이언트 ID (기본값: mcp-proxy-client)
 * - OAUTH_CLIENT_SECRET: 클라이언트 시크릿 (미설정 시 자동 생성, 프로덕션에서는 필수)
 * - OAUTH_REDIRECT_URIS: 리다이렉트 URI 목록 (쉼표로 구분)
 *
 * 사용법:
 * pnpm ts-node src/scripts/seed-mcp-proxy-client.ts
 *
 * 프로덕션 환경:
 * OAUTH_CLIENT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 * pnpm ts-node src/scripts/seed-mcp-proxy-client.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { OAuthClient } from '../oauth/entities/oauth-client.entity';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Client Secret 생성/로드 로직
 * 1. 환경변수 OAUTH_CLIENT_SECRET이 있으면 사용
 * 2. 없으면:
 *    - 개발환경: 강력한 랜덤 secret 생성 (64자 hex)
 *    - 프로덕션: 에러 발생 (보안상 환경변수 필수)
 */
function generateClientSecret(): string {
  // 환경변수에서 읽기
  const envSecret = process.env.OAUTH_CLIENT_SECRET;

  if (envSecret) {
    console.log('✅ 환경변수에서 Client Secret을 로드했습니다.');
    return envSecret;
  }

  // 프로덕션에서는 환경변수 필수
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '❌ 프로덕션 환경에서는 OAUTH_CLIENT_SECRET 환경변수가 필수입니다.\n' +
      '💡 다음 명령어로 강력한 secret을 생성하세요:\n' +
      '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // 개발환경: 강력한 랜덤 secret 생성 (256-bit, 64자 hex)
  const generatedSecret = crypto.randomBytes(32).toString('hex');

  console.log('\n⚠️  OAUTH_CLIENT_SECRET 환경변수가 없어 랜덤 secret을 생성했습니다.');
  console.log('📝 .env 파일에 다음 라인을 추가하세요:');
  console.log(`\nOAUTH_CLIENT_SECRET=${generatedSecret}\n`);
  console.log('⚠️  이 secret은 재시작 시마다 변경됩니다. 환경변수에 저장하세요!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return generatedSecret;
}

async function bootstrap() {
  // NestJS 애플리케이션 인스턴스 생성
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // DataSource 가져오기
    const dataSource = app.get(DataSource);
    const clientRepo = dataSource.getRepository(OAuthClient);
    const userRepo = dataSource.getRepository(User);

    // 시스템 관리자 계정 찾기 (첫 번째 사용자 사용)
    let adminUser = await userRepo.findOne({
      where: { email: 'admin@example.com' } // 특정 이메일로 찾기 시도
    });

    // 관리자가 없으면 첫 번째 사용자 사용
    if (!adminUser) {
      const users = await userRepo.find({ take: 1 });
      if (users.length > 0) {
        adminUser = users[0];
        console.log(`ℹ️ 첫 번째 사용자 (${adminUser.email})를 클라이언트 소유자로 사용합니다.`);
      }
    }

    if (!adminUser) {
      console.error('❌ 사용자를 찾을 수 없습니다.');
      console.log('💡 먼저 사용자를 생성해주세요.');
      await app.close();
      return;
    }

    // MCP Proxy 클라이언트 정보
    const clientId = process.env.OAUTH_CLIENT_ID || 'mcp-proxy-client';
    const clientSecret = generateClientSecret();

    // Redirect URIs: 환경변수에서 쉼표로 구분된 리스트 읽기
    const defaultRedirectUris = [
      'http://localhost:3002/oauth/callback',  // MCP 프록시 서버 실제 포트 (3002)
      'http://localhost:8080/oauth/callback',  // 이전 테스트용 포트
      'http://localhost:7777/callback',
      'http://localhost:8080/callback'
    ];
    const redirectUris = process.env.OAUTH_REDIRECT_URIS
      ? process.env.OAUTH_REDIRECT_URIS.split(',').map(uri => uri.trim())
      : defaultRedirectUris;

    const clientData = {
      clientId: clientId,
      clientSecret: clientSecret,
      clientName: 'MCP Proxy Client',
      description: 'Model Context Protocol Proxy Server for auto-posting',
      redirectUris: redirectUris,
      allowedScopes: ['mcp:post:create'],
      grantTypes: 'authorization_code',
      userId: adminUser.id,
      isActive: true,
      isTrusted: false, // 승인 화면 표시를 위해 false로 설정
    };

    // 기존 클라이언트 확인
    const existingClient = await clientRepo.findOne({
      where: { clientId: clientData.clientId }
    });

    if (existingClient) {
      console.log('⚠️ 이미 존재하는 클라이언트입니다. 업데이트를 진행합니다.');

      // 시크릿 해싱
      const hashedSecret = await bcrypt.hash(clientData.clientSecret, 10);

      // 업데이트
      await clientRepo.update(existingClient.id, {
        ...clientData,
        clientSecret: hashedSecret,
      });

      console.log('✅ MCP Proxy OAuth 클라이언트가 업데이트되었습니다.');
    } else {
      // 새 클라이언트 생성
      console.log('📝 새 MCP Proxy OAuth 클라이언트를 생성합니다...');

      // 시크릿 해싱
      const hashedSecret = await bcrypt.hash(clientData.clientSecret, 10);

      const newClient = clientRepo.create({
        ...clientData,
        clientSecret: hashedSecret,
      });

      await clientRepo.save(newClient);

      console.log('✅ MCP Proxy OAuth 클라이언트가 생성되었습니다.');
    }

    console.log('\n📌 클라이언트 정보:');
    console.log('Client ID:', clientId);
    console.log('Client Secret:', '***' + clientSecret.slice(-8) + ' (보안상 일부만 표시)');
    console.log('Redirect URIs:', redirectUris.join(', '));
    console.log('Allowed Scopes:', clientData.allowedScopes.join(', '));

    console.log('\n💡 MCP Proxy 서버 .env 파일에 다음을 설정하세요:');
    console.log(`OAUTH_CLIENT_ID=${clientId}`);
    console.log(`OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log('\n⚠️  Client Secret은 절대 커밋하지 마세요! (.env는 .gitignore에 포함)');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await app.close();
  }
}

bootstrap();