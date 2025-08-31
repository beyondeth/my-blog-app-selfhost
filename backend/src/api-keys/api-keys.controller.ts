import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Put, UseInterceptors } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TimezoneInterceptor } from '../common/interceptors/timezone.interceptor';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TimezoneInterceptor)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(@Body() createApiKeyDto: CreateApiKeyDto, @CurrentUser() user: User) {
    const result = await this.apiKeysService.create(createApiKeyDto, user);
    return {
      apiKey: result.apiKey,
      keyId: result.keyId,  // 공개 가능한 ID
      keySecret: result.keySecret,  // 생성 시 1회만 보여지는 Secret
      message: '⚠️ 이 Secret은 다시 볼 수 없으니 안전한 곳에 저장하세요. Key ID는 공개 가능합니다.'
    };
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    return await this.apiKeysService.findByUser(user.id);
  }

  @Get('blog/:blogId')
  async findByBlog(@Param('blogId') blogId: string, @CurrentUser() user: User) {
    return await this.apiKeysService.findByBlog(blogId, user.id);
  }

  @Put(':id/toggle')
  async toggleActive(@Param('id') id: string, @CurrentUser() user: User) {
    return await this.apiKeysService.toggleActive(id, user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.apiKeysService.remove(id, user.id);
    return { message: 'API 키가 삭제되었습니다.' };
  }
}