import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MonitoringService } from "./monitoring.service";
import { MonitoringController } from "./monitoring.controller";
import { SuspiciousRequest } from "./entities/suspicious-request.entity";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SuspiciousRequest])],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
