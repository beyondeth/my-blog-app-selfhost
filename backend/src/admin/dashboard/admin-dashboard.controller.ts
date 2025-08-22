import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * Get dashboard statistics
   */
  @Get('stats')
  async getStats() {
    return await this.dashboardService.getStats();
  }

  /**
   * Get activity feed
   */
  @Get('activity')
  async getActivityFeed(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return await this.dashboardService.getActivityFeed(limit);
  }

  /**
   * Get trend data for charts
   */
  @Get('trends')
  async getTrendData(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days?: number,
  ) {
    return await this.dashboardService.getTrendData(days);
  }

  /**
   * Get popular posts
   */
  @Get('popular-posts')
  async getPopularPosts(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return await this.dashboardService.getPopularPosts(limit);
  }

  /**
   * Get top contributors
   */
  @Get('top-contributors')
  async getTopContributors(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    return await this.dashboardService.getTopContributors(limit);
  }

  /**
   * Get system health metrics
   */
  @Get('health')
  @Roles(Role.ADMIN) // Only admins can view system health
  async getSystemHealth() {
    return await this.dashboardService.getSystemHealth();
  }

  /**
   * Get moderation queue
   */
  @Get('moderation-queue')
  async getModerationQueue() {
    return await this.dashboardService.getModerationQueue();
  }

  /**
   * Get analytics summary for date range
   */
  @Get('analytics-summary')
  async getAnalyticsSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    return await this.dashboardService.getAnalyticsSummary(start, end);
  }
}