#!/usr/bin/env node

/**
 * MCP Proxy OAuth2 클라이언트 시드 스크립트
 * MCP Proxy 서버를 위한 OAuth 클라이언트를 데이터베이스에 등록합니다.
 *
 * 사용법:
 * pnpm ts-node src/scripts/seed-mcp-proxy-client.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { OAuthClient } from '../oauth/entities/oauth-client.entity';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

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
    const clientData = {
      clientId: 'mcp-proxy-client',
      clientSecret: 'test-secret-key-123',
      clientName: 'MCP Proxy Client',
      description: 'Model Context Protocol Proxy Server for auto-posting',
      redirectUris: [
        'http://localhost:3002/oauth/callback',  // MCP 프록시 서버 실제 포트 (3002)
        'http://localhost:8080/oauth/callback',  // 이전 테스트용 포트
        'http://localhost:7777/callback',
        'http://localhost:8080/callback'
      ],
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
    console.log('Client ID:', clientData.clientId);
    console.log('Client Secret:', clientData.clientSecret);
    console.log('Redirect URIs:', clientData.redirectUris.join(', '));
    console.log('Allowed Scopes:', clientData.allowedScopes.join(', '));

    console.log('\n💡 이 정보는 MCP Proxy 서버 .env 파일과 일치합니다.');
    console.log('⚠️ Client Secret은 안전하게 보관하세요.');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await app.close();
  }
}

bootstrap();