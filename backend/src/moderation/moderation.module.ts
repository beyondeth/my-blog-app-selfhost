import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import { ModerationLog } from "./entities/moderation-log.entity";
import { IpBlockList } from "./entities/ip-block-list.entity";
import { UsersModule } from "../users/users.module"; // For user banning

@Module({
  imports: [
    TypeOrmModule.forFeature([ModerationLog, IpBlockList]),
    UsersModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
