import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request, Query, DefaultValuePipe, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateMarketingPreferencesDto } from './dto/update-marketing-preferences.dto';
import { Public } from '../common/decorators/public.decorator';

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
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '특정 사용자 조회' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
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
