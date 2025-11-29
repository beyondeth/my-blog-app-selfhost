import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, Query, DefaultValuePipe, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateMarketingPreferencesDto } from './dto/update-marketing-preferences.dto';
import { Public } from '../common/decorators/public.decorator';
import { getAllCharacters } from '../common/utils/character.util';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '모든 사용자 조회 (관리자만)' })
  @ApiBearerAuth()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiBearerAuth()
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.id);
    // UserResponseDto로 변환하여 반환 (profileImage는 이미 CDN URL로 변환됨)
    return user; // ClassSerializerInterceptor가 없으므로 그대로 반환
  }

  @Get('characters')
  @Public()
  @ApiOperation({ summary: '사용 가능한 캐릭터 목록 조회 (Public)' })
  getCharacters() {
    // 프론트엔드 캐릭터 선택 UI에서 사용
    // /public/character 폴더의 정적 이미지 목록 반환
    return {
      characters: getAllCharacters(),
      total: getAllCharacters().length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '특정 사용자 조회' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * MCP용 사용자 정보 조회
   *
   * MCP Proxy Server에서 OAuth 인증 후 사용자 정보를 조회할 때 사용
   * 내부 서비스 간 통신용 (MCP Proxy → Backend)
   */
  @Get(':id/mcp-info')
  @Public()  // 내부 통신용 - 실제 인증은 MCP Proxy에서 처리됨
  @ApiOperation({ summary: 'MCP용 사용자 정보 조회 (내부 API)' })
  async getMcpInfo(@Param('id') id: string) {
    // findOne은 이미 blog 관계를 포함
    const user = await this.usersService.findOne(id);

    if (!user) {
      return null;
    }

    // MCP에서 필요한 최소 정보만 반환
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      blog: user.blog ? {
        id: user.blog.id,
        name: user.blog.name,
        slug: user.blog.slug,
      } : null,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 프로필 수정' })
  @ApiBearerAuth()
  updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.update(req.user.id, updateProfileDto);
  }

  @Patch('marketing-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '마케팅 정보 수신 설정 업데이트' })
  @ApiBearerAuth()
  updateMarketingPreferences(
    @Request() req,
    @Body() updateMarketingPreferencesDto: UpdateMarketingPreferencesDto,
  ) {
    return this.usersService.updateMarketingPreferences(
      req.user.id,
      updateMarketingPreferencesDto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '사용자 삭제 (관리자만) - 180일 보관 후 자동 삭제' })
  @ApiBearerAuth()
  async remove(@Param('id') id: string) {
    // Soft Delete: 180일 보관 후 자동 삭제
    await this.usersService.softDelete(id);
    return { message: 'User deleted successfully. Will be permanently removed after 180 days.' };
  }

  @Delete(':id/account')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '본인 계정 삭제' })
  @ApiBearerAuth()
  async deleteMyAccount(@Request() req) {
    // 본인 계정 삭제: Soft Delete (180일 보관)
    await this.usersService.softDelete(req.user.id);
    return { message: 'Your account has been deleted. Data will be kept for 180 days for safety.' };
  }
} 
