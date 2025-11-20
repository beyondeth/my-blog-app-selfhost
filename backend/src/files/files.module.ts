import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FilesController } from './files.controller';
import { FilesV2Controller } from './controllers/files-v2.controller';
import { FileMigrationController } from './controllers/file-migration.controller';
import { FilesService } from './files.service';
import { S3Service } from './services/s3.service';
import { CdnService } from './services/cdn.service';
import { File } from './entities/file.entity';
import { FileContext } from './entities/file-context.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { ContextualFileService } from './services/contextual-file.service';
import { FileMigrationService } from './services/file-migration.service';
import { FileMonitoringService } from './services/file-monitoring.service';
import { FileLifecycleService } from './services/file-lifecycle.service';
import { ExternalImageDownloadService } from './services/external-image-download.service';
import s3Config from '../config/s3.config';
import cdnConfig from '../config/cdn.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, FileContext, User, Profile]),
    ConfigModule.forFeature(s3Config),
    ConfigModule.forFeature(cdnConfig),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    FilesController,
    FilesV2Controller,
    FileMigrationController,
  ],
  providers: [
    FilesService,
    S3Service,
    CdnService,
    ContextualFileService,
    FileMigrationService,
    FileMonitoringService,
    FileLifecycleService,
    ExternalImageDownloadService,
  ],
  exports: [
    FilesService,
    S3Service,
    CdnService,
    ContextualFileService,
    FileLifecycleService,
    ExternalImageDownloadService,
  ],
})
export class FilesModule {} 