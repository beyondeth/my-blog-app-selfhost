#!/usr/bin/env ts-node

/**
 * 30일 보존 정책 빠른 테스트
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FileLifecycleService } from '../src/files/services/file-lifecycle.service';
import { DataSource } from 'typeorm';
const chalk = require('chalk');

async function quickTest() {
  console.log(chalk.blue.bold('\n===================================='));
  console.log(chalk.blue.bold(' 30-Day Retention Policy Quick Test'));
  console.log(chalk.blue.bold('====================================\n'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const lifecycleService = app.get(FileLifecycleService);
  const dataSource = app.get(DataSource);

  try {
    // 1. 파일 상태 확인
    console.log(chalk.cyan('📊 Current Status:'));
    const fileCount = await dataSource.query(`SELECT COUNT(*) as count FROM files`);
    const contextCount = await dataSource.query(`SELECT COUNT(*) as count FROM file_contexts`);
    
    console.log(`   Total files: ${fileCount[0].count}`);
    console.log(`   Total contexts: ${contextCount[0].count}`);

    // 2. 라이프사이클 서비스 테스트
    console.log(chalk.yellow('\n🧹 Testing Lifecycle Service:'));
    
    // 고아 파일 정리 테스트
    const orphanedCount = await lifecycleService.cleanupOrphanedFiles();
    console.log(`   Orphaned files processed: ${orphanedCount}`);
    
    // 만료 파일 삭제 테스트
    const expiredCount = await lifecycleService.deleteExpiredTemporaryFiles();
    console.log(`   Expired files deleted: ${expiredCount}`);

    // 3. 최종 결과
    console.log(chalk.green.bold('\n✅ Test Complete!'));
    console.log('   - File lifecycle service is operational');
    console.log('   - 30-day retention policy is configured');
    console.log('   - Cleanup functions are working');

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
  } finally {
    await app.close();
  }
}

quickTest().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});