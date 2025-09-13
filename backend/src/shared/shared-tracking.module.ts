import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpTrackingService } from '../mcp/mcp-tracking.service';
import { McpUserLog } from '../mcp/entities/mcp-user-log.entity';
import { User } from '../users/entities/user.entity';
import { ApiKey } from '../api-keys/entities/api-key.entity';

/**
 * SharedTrackingModule
 *
 * This module extracts the McpTrackingService to resolve circular dependencies
 * between McpModule and MonitoringModule.
 *
 * Architecture Decision:
 * - McpTrackingService is used by both McpModule and MonitoringModule
 * - By extracting it to a shared module, we eliminate the circular dependency
 * - This module is marked as @Global to be available throughout the application
 *
 * Note: Post entity removed as MCP only supports write tracking, not post reading
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([McpUserLog, User, ApiKey]),
  ],
  providers: [McpTrackingService],
  exports: [McpTrackingService],
})
export class SharedTrackingModule {}