import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FilesController } from './files.controller';
import { FilesV2Controller } from './controllers/files-v2.controller';
import { FileMigrationController } from './controllers/file-migration.controller';
import { FilesService } from './files.service';
import { S3Service } from './services/s3.service';
import { File } from './entities/file.entity';
import { FileContext } from './entities/file-context.entity';
import { ContextualFileService } from './services/contextual-file.service';
import { FileMigrationService } from './services/file-migration.service';
import { FileMonitoringService } from './services/file-monitoring.service';
import { FileLifecycleService } from './services/file-lifecycle.service';
import { UsersModule } from '../users/users.module';
import s3Config from '../config/s3.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, FileContext]),
    ConfigModule.forFeature(s3Config),
    ScheduleModule.forRoot(),
    UsersModule,
  ],
  controllers: [
    FilesController,
    FilesV2Controller,
    FileMigrationController,
  ],
  providers: [
    FilesService,
    S3Service,
    ContextualFileService,
    FileMigrationService,
    FileMonitoringService,
    FileLifecycleService,
  ],
  exports: [
    FilesService,
    S3Service,
    ContextualFileService,
    FileLifecycleService,
  ],
})
export class FilesModule {} 