import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { AdminUsersService, UserFilters, UpdateUserDto } from './admin-users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /**
   * Get all users with filters
   */
  @Get()
  async findAll(
    @Query('role') role?: Role,
    @Query('isActive') isActive?: string,
    @Query('isEmailVerified') isEmailVerified?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy?: string,
    @Query('sortOrder', new DefaultValuePipe('DESC')) sortOrder?: 'ASC' | 'DESC',
  ) {
    const filters: UserFilters = {
      role,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isEmailVerified: isEmailVerified === 'true' ? true : isEmailVerified === 'false' ? false : undefined,
      search,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return await this.adminUsersService.findAll(filters, page, limit, sortBy, sortOrder);
  }

  /**
   * Get user statistics
   */
  @Get('statistics')
  async getStatistics() {
    return await this.adminUsersService.getUserStatistics();
  }

  /**
   * Export users data
   */
  @Get('export')
  async exportUsers(
    @Query('format', new DefaultValuePipe('json')) format: 'json' | 'csv',
  ) {
    return await this.adminUsersService.exportUsers(format);
  }

  /**
   * Get user details
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.adminUsersService.findOne(id);
  }

  /**
   * Update user
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserDto,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.update(id, updateDto, req.user.id, context);
  }

  /**
   * Suspend user
   */
  @Post(':id/suspend')
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('duration', ParseIntPipe) duration: number,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.suspend(id, duration, reason, req.user.id, context);
  }

  /**
   * Ban user
   */
  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.ban(id, reason, req.user.id, context);
  }

  /**
   * Activate user
   */
  @Post(':id/activate')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.activate(id, req.user.id, context);
  }

  /**
   * Delete user
   */
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    return await this.adminUsersService.delete(id, req.user.id, context);
  }
}