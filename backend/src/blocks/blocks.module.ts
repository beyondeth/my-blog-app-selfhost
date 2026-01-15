import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlocksController } from "./blocks.controller";
import { BlocksService } from "./blocks.service";
import { Block } from "./entities/block.entity";

/**
 * 사용자 차단 모듈
 * 사용자 간 차단 기능을 제공하는 모듈
 */
@Module({
  imports: [TypeOrmModule.forFeature([Block])],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService], // 다른 모듈에서 사용할 수 있도록 export
})
export class BlocksModule {}
