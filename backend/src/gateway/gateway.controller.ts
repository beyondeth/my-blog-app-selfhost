import { Controller, Post, Body, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { PostsService } from '../posts/posts.service';
import { AuthService } from '../auth/auth.service';

@ApiExcludeController() // Swagger에서 숨김
@Controller('api/gateway')
export class GatewayController {
  private actionMap = {
    'A001': 'createPost',
    'A002': 'updatePost',
    'A003': 'deletePost',
    'A004': 'authenticate',
  };

  constructor(
    private postsService: PostsService,
    private authService: AuthService,
  ) {}

  @Post()
  async handleGatewayRequest(@Body() encryptedRequest: any) {
    try {
      // 1. 서명 검증
      if (!this.verifySignature(encryptedRequest)) {
        throw new UnauthorizedException('Invalid signature');
      }

      // 2. 페이로드 복호화
      const decryptedData = this.decryptPayload(encryptedRequest.data);
      
      // 3. 액션 코드를 실제 메서드로 매핑
      const action = this.actionMap[encryptedRequest.action];
      if (!action) {
        throw new BadRequestException('Unknown action');
      }

      // 4. 실제 서비스 호출
      let result;
      switch (action) {
        case 'createPost':
          result = await this.handleCreatePost(decryptedData);
          break;
        case 'authenticate':
          result = await this.handleAuthenticate(decryptedData);
          break;
        // ... 다른 액션들
      }

      // 5. 응답 암호화
      const encryptedResponse = this.encryptResponse(result);
      
      return {
        status: 'success',
        data: encryptedResponse,
      };
    } catch (error) {
      // 에러도 암호화하여 구조 숨김
      return {
        status: 'error',
        data: this.encryptResponse({ error: 'Request failed' }),
      };
    }
  }

  private verifySignature(request: any): boolean {
    const { signature, data } = request;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.GATEWAY_SECRET)
      .update(data)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  private decryptPayload(encryptedData: string): any {
    // 복호화 로직
    const cipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(process.env.ENCRYPTION_IV, 'hex')
    );
    
    let decrypted = cipher.update(encryptedData, 'base64', 'utf8');
    decrypted += cipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  private encryptResponse(data: any): string {
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(process.env.ENCRYPTION_IV, 'hex')
    );
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return encrypted;
  }

  private async handleCreatePost(data: any) {
    // 축약된 키를 실제 필드로 매핑
    const createPostDto = {
      title: data.t,
      content_markdown: data.c,
      tags: data.g,
    };
    
    // 실제 서비스 호출
    return await this.postsService.create(createPostDto, data.user);
  }

  private async handleAuthenticate(data: any) {
    return await this.authService.login({
      email: data.e,
      password: data.p,
    });
  }
}