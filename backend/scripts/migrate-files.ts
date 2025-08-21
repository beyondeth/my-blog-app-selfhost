#!/usr/bin/env ts-node

/**
 * 파일 시스템 v1 → v2 마이그레이션 스크립트
 * 
 * 사용법:
 * npm run migrate:files -- --batch-size=100 --dry-run
 * npm run migrate:files -- --execute
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FileMigrationService } from '../src/files/services/file-migration.service';
import { FileMonitoringService } from '../src/files/services/file-monitoring.service';
const chalk = require('chalk');
import * as readline from 'readline';

interface MigrationOptions {
  batchSize: number;
  dryRun: boolean;
  execute: boolean;
  verbose: boolean;
  yes: boolean;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function parseArguments(): Promise<MigrationOptions> {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    batchSize: 100,
    dryRun: false,
    execute: false,
    verbose: false,
    yes: false,
  };

  for (const arg of args) {
    if (arg.includes('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--help') {
      console.log(chalk.cyan('File Migration Script'));
      console.log('Usage: npm run migrate:files -- [options]');
      console.log('');
      console.log('Options:');
      console.log('  --batch-size=N   Process N files at a time (default: 100)');
      console.log('  --dry-run        Analyze without making changes');
      console.log('  --execute        Execute migration (requires confirmation)');
      console.log('  --yes, -y        Skip confirmation prompt');
      console.log('  --verbose        Show detailed output');
      console.log('  --help           Show this help message');
      process.exit(0);
    }
  }

  return options;
}

async function runMigration() {
  const options = await parseArguments();
  
  console.log(chalk.blue.bold('\n================================='));
  console.log(chalk.blue.bold(' File System Migration v1 → v2'));
  console.log(chalk.blue.bold('=================================\n'));

  // NestJS 앱 초기화
  console.log(chalk.yellow('Initializing application...'));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: options.verbose ? ['log', 'error', 'warn', 'debug'] : ['error'],
  });

  const migrationService = app.get(FileMigrationService);
  const monitoringService = app.get(FileMonitoringService);

  try {
    // 현재 상태 분석
    console.log(chalk.yellow('\nAnalyzing current file system...'));
    const analysis = await migrationService.analyzeExistingFiles();
    
    console.log(chalk.cyan('\n📊 Current Status:'));
    console.log(`   Total files: ${chalk.white(analysis.total)}`);
    console.log(`   v1 files (need migration): ${chalk.yellow(analysis.v1Files)}`);
    console.log(`   v2 files (already migrated): ${chalk.green(analysis.v2Files)}`);
    
    if (analysis.fileTypes.length > 0) {
      console.log(chalk.cyan('\n📁 File Types:'));
      for (const type of analysis.fileTypes) {
        console.log(`   ${type.type}: ${type.count} files`);
      }
    }

    // 마이그레이션 필요 여부 확인
    if (analysis.v1Files === 0) {
      console.log(chalk.green('\n✅ No files need migration!'));
      await app.close();
      process.exit(0);
    }

    // Dry Run 모드
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - No changes will be made'));
      
      // 예상 시간 계산
      const estimatedMinutes = Math.ceil(analysis.v1Files / 100);
      console.log(chalk.cyan(`\n⏱  Estimated migration time: ${estimatedMinutes} minutes`));
      
      await app.close();
      process.exit(0);
    }

    // 실행 모드
    if (options.execute) {
      console.log(chalk.red.bold('\n⚠️  WARNING: This will migrate all v1 files to v2 structure'));
      console.log(chalk.red('   This operation cannot be easily undone.\n'));
      
      let confirm = 'yes';
      if (!options.yes) {
        confirm = await question(
          chalk.yellow('Are you sure you want to proceed? (yes/no): ')
        );
      }
      
      if (confirm.toLowerCase() !== 'yes') {
        console.log(chalk.red('\n❌ Migration cancelled by user'));
        await app.close();
        process.exit(0);
      }

      console.log(chalk.green('\n🚀 Starting migration...'));
      console.log(chalk.gray(`   Batch size: ${options.batchSize} files`));
      
      // 진행률 표시
      let lastProgress = 0;
      const progressInterval = setInterval(async () => {
        const status = await migrationService.getMigrationStatus();
        if (status.percentage !== lastProgress) {
          process.stdout.write(
            `\r   Progress: ${chalk.cyan(status.percentage + '%')} ` +
            `[${chalk.green(status.successful)} succeeded, ` +
            `${chalk.red(status.failed)} failed, ` +
            `${chalk.yellow(status.skipped)} skipped]`
          );
          lastProgress = status.percentage;
        }
      }, 1000);

      // 마이그레이션 실행
      const result = await migrationService.runFullMigration();
      clearInterval(progressInterval);
      
      console.log('\n');
      console.log(chalk.green.bold('✅ Migration completed!'));
      console.log(chalk.cyan('\n📊 Final Results:'));
      console.log(`   Total processed: ${result.progress.processed}`);
      console.log(`   Successful: ${chalk.green(result.progress.successful)}`);
      console.log(`   Failed: ${chalk.red(result.progress.failed)}`);
      console.log(`   Skipped: ${chalk.yellow(result.progress.skipped)}`);
      console.log(`   Duration: ${Math.round(result.duration / 1000)} seconds`);
      
      if (result.errors.length > 0) {
        console.log(chalk.red('\n❌ Errors:'));
        for (const error of result.errors.slice(0, 10)) {
          console.log(`   - File ${error.fileId}: ${error.error}`);
        }
        if (result.errors.length > 10) {
          console.log(chalk.gray(`   ... and ${result.errors.length - 10} more errors`));
        }
      }

      // 최종 상태 확인
      console.log(chalk.yellow('\n🔍 Verifying final state...'));
      const finalAnalysis = await migrationService.analyzeExistingFiles();
      console.log(`   Remaining v1 files: ${chalk.yellow(finalAnalysis.v1Files)}`);
      console.log(`   Total v2 files: ${chalk.green(finalAnalysis.v2Files)}`);

      // 헬스 체크
      const health = await monitoringService.healthCheck();
      console.log(chalk.cyan('\n🏥 System Health:'));
      console.log(`   Status: ${
        health.status === 'healthy' ? chalk.green(health.status) :
        health.status === 'degraded' ? chalk.yellow(health.status) :
        chalk.red(health.status)
      }`);
      
      if (health.issues.length > 0) {
        console.log(chalk.yellow('   Issues:'));
        for (const issue of health.issues) {
          console.log(`   - ${issue}`);
        }
      }

    } else {
      // 도움말 표시
      console.log(chalk.cyan('\n📝 Next Steps:'));
      console.log('   1. Run with --dry-run to see what would be migrated');
      console.log('   2. Run with --execute to start the migration');
      console.log('   3. Use --batch-size=N to control processing speed');
      console.log('   4. Add --verbose for detailed output');
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await app.close();
    rl.close();
  }
}

// 스크립트 실행
runMigration().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});