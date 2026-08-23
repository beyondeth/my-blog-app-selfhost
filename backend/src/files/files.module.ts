import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";
import { FilesController } from "./files.controller";
import { FilesV2Controller } from "./controllers/files-v2.controller";
import { FileMigrationController } from "./controllers/file-migration.controller";
import { FilesService } from "./files.service";
import { S3Service } from "./services/s3.service";
import { R2Service } from "./services/r2.service";
import { CdnService } from "./services/cdn.service";
import { File } from "./entities/file.entity";
import { FileContext } from "./entities/file-context.entity";
import { Video } from "./entities/video.entity";
import { User } from "../users/entities/user.entity";
import { Profile } from "../users/entities/profile.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { Post } from "../posts/entities/post.entity";
import { ContextualFileService } from "./services/contextual-file.service";
import { FileMigrationService } from "./services/file-migration.service";
import { FileMonitoringService } from "./services/file-monitoring.service";
import { FileLifecycleService } from "./services/file-lifecycle.service";
import { ExternalImageDownloadService } from "./services/external-image-download.service";
import { VideoProcessingProcessor } from "./processors/video-processing.processor";
import { VideoCleanupService } from "./services/video-cleanup.service";
import { VideoLifecycleService } from "./services/video-lifecycle.service";
import { VIDEO_PROCESSING_QUEUE } from "./queues/video-processing.queue";
import s3Config from "../config/s3.config";
import cdnConfig from "../config/cdn.config";
import { UrlSafetyService } from "../common/services/url-safety.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      File,
      FileContext,
      Video,
      User,
      Profile,
      Blog,
      Post,
    ]),
    ConfigModule.forFeature(s3Config),
    ConfigModule.forFeature(cdnConfig),
    ScheduleModule.forRoot(),
    // 비디오 처리 큐 등록
    BullModule.registerQueue({
      name: VIDEO_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // 24시간
          count: 500,
        },
        removeOnFail: {
          age: 604800, // 7일
          count: 1000,
        },
      },
    }),
  ],
  controllers: [FilesController, FilesV2Controller, FileMigrationController],
  providers: [
    FilesService,
    S3Service,
    R2Service,
    CdnService,
    ContextualFileService,
    FileMigrationService,
    FileMonitoringService,
    FileLifecycleService,
    ExternalImageDownloadService,
    VideoProcessingProcessor,
    VideoCleanupService,
    VideoLifecycleService,
    UrlSafetyService,
  ],
  exports: [
    FilesService,
    S3Service,
    R2Service,
    CdnService,
    ContextualFileService,
    FileLifecycleService,
    ExternalImageDownloadService,
    VideoCleanupService,
    VideoLifecycleService,
  ],
})
export class FilesModule {}
