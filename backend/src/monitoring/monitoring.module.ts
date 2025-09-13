import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { SuspiciousRequest } from './entities/suspicious-request.entity';
import { SharedTrackingModule } from '../shared/shared-tracking.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SuspiciousRequest]),
    SharedTrackingModule,  // Import SharedTrackingModule instead of McpModule
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}