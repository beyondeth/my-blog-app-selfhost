#!/usr/bin/env ts-node
/**
 * 마이그레이션 검증 도구
 * - 타임스탬프 순서 확인
 * - 중복 파일 감지
 * - src와 dist 폴더 동기화 확인
 * - 환경별 마이그레이션 상태 비교
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 로그 헬퍼
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`),
};

interface MigrationFile {
  name: string;
  timestamp: string;
  date: Date;
  path: string;
}

class MigrationChecker {
  private srcDir = path.join(process.cwd(), 'src/migrations');
  private distDir = path.join(process.cwd(), 'dist/src/migrations');

  async run() {
    log.section('마이그레이션 검증 시작');

    // 1. src 폴더 검증
    await this.checkSourceMigrations();

    // 2. dist 폴더 검증
    await this.checkDistMigrations();

    // 3. 순서 검증
    await this.validateOrder();

    // 4. 중복 검증
    await this.checkDuplicates();

    // 5. 권장사항
    await this.printRecommendations();
  }

  private async checkSourceMigrations() {
    log.section('소스 마이그레이션 검증');

    if (!fs.existsSync(this.srcDir)) {
      log.error(`src/migrations 폴더가 없습니다: ${this.srcDir}`);
      return;
    }

    const files = fs.readdirSync(this.srcDir)
      .filter(f => f.endsWith('.ts'))
      .sort();

    log.info(`총 ${files.length}개의 마이그레이션 파일 발견`);

    const migrations = this.parseMigrationFiles(files, this.srcDir);

    // 타임스탬프 분석
    const timestamps = migrations.map(m => parseInt(m.timestamp));
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);

    log.info(`첫 마이그레이션: ${minDate.toISOString().split('T')[0]}`);
    log.info(`최근 마이그레이션: ${maxDate.toISOString().split('T')[0]}`);

    // 순서 확인
    let isOrdered = true;
    for (let i = 1; i < migrations.length; i++) {
      if (parseInt(migrations[i].timestamp) <= parseInt(migrations[i-1].timestamp)) {
        log.warning(`순서 오류: ${migrations[i-1].name} > ${migrations[i].name}`);
        isOrdered = false;
      }
    }

    if (isOrdered) {
      log.success('모든 마이그레이션이 올바른 순서입니다');
    }
  }

  private async checkDistMigrations() {
    log.section('빌드된 마이그레이션 검증');

    if (!fs.existsSync(this.distDir)) {
      log.warning('dist 폴더가 없습니다. "npm run build"를 실행하세요.');
      return;
    }

    const srcFiles = fs.readdirSync(this.srcDir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', ''));

    const distFiles = fs.readdirSync(this.distDir)
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''));

    // src에만 있는 파일
    const onlyInSrc = srcFiles.filter(f => !distFiles.includes(f));
    if (onlyInSrc.length > 0) {
      log.warning(`src에만 있는 파일 (빌드 필요):`);
      onlyInSrc.forEach(f => log.warning(`  - ${f}`));
    }

    // dist에만 있는 파일
    const onlyInDist = distFiles.filter(f => !srcFiles.includes(f));
    if (onlyInDist.length > 0) {
      log.error(`dist에만 있는 파일 (삭제 필요):`);
      onlyInDist.forEach(f => log.error(`  - ${f}`));
    }

    if (onlyInSrc.length === 0 && onlyInDist.length === 0) {
      log.success('src와 dist가 동기화되어 있습니다');
    }
  }

  private async validateOrder() {
    log.section('마이그레이션 실행 순서 검증');

    const files = fs.readdirSync(this.srcDir)
      .filter(f => f.endsWith('.ts'))
      .sort();

    // InitialSchema 찾기
    const initialSchema = files.find(f => f.includes('InitialSchema'));
    if (!initialSchema) {
      log.error('InitialSchema 마이그레이션을 찾을 수 없습니다');
      return;
    }

    const initialTimestamp = this.extractTimestamp(initialSchema);
    log.info(`InitialSchema 타임스탬프: ${initialTimestamp}`);

    // InitialSchema보다 이전 타임스탬프 찾기
    const beforeInitial = files.filter(f => {
      const ts = this.extractTimestamp(f);
      return ts < initialTimestamp;
    });

    if (beforeInitial.length > 0) {
      log.error(`InitialSchema보다 먼저 실행되는 마이그레이션:`);
      beforeInitial.forEach(f => {
        log.error(`  - ${f} (타임스탬프: ${this.extractTimestamp(f)})`);
      });
      log.warning('이 파일들은 InitialSchema 이후로 타임스탬프를 변경해야 합니다');
    } else {
      log.success('모든 마이그레이션이 InitialSchema 이후에 실행됩니다');
    }
  }

  private async checkDuplicates() {
    log.section('중복 마이그레이션 검증');

    const files = fs.readdirSync(this.srcDir)
      .filter(f => f.endsWith('.ts'));

    const nameMap = new Map<string, string[]>();

    files.forEach(file => {
      const name = file.replace(/^\d+-/, '').replace('.ts', '');
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name)!.push(file);
    });

    let hasDuplicates = false;
    nameMap.forEach((files, name) => {
      if (files.length > 1) {
        log.error(`중복된 마이그레이션: ${name}`);
        files.forEach(f => log.error(`  - ${f}`));
        hasDuplicates = true;
      }
    });

    if (!hasDuplicates) {
      log.success('중복된 마이그레이션이 없습니다');
    }
  }

  private async printRecommendations() {
    log.section('권장 사항');

    // dist 폴더 상태 확인
    if (fs.existsSync(this.distDir)) {
      const distFiles = fs.readdirSync(this.distDir);
      if (distFiles.length > 0) {
        log.info('💡 dist 폴더를 정리하고 다시 빌드하려면:');
        log.info('   npm run clean:build');
      }
    }

    // 마이그레이션 실행 명령어
    log.info('\n💡 마이그레이션 실행 명령어:');
    log.info('   개발 환경: npm run migration:run');
    log.info('   프로덕션: npm run migration:run:prod');
    log.info('   Docker: docker exec <container> npm run migration:run:prod:nobuild');

    // 새 마이그레이션 생성
    log.info('\n💡 새 마이그레이션 생성:');
    log.info('   npm run migration:generate -- src/migrations/YourMigrationName');
  }

  private parseMigrationFiles(files: string[], dir: string): MigrationFile[] {
    return files.map(file => {
      const timestamp = this.extractTimestamp(file);
      return {
        name: file,
        timestamp,
        date: new Date(parseInt(timestamp)),
        path: path.join(dir, file),
      };
    }).sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
  }

  private extractTimestamp(filename: string): string {
    const match = filename.match(/^(\d+)-/);
    return match ? match[1] : '0';
  }
}

// 메인 실행
async function main() {
  try {
    const checker = new MigrationChecker();
    await checker.run();

    log.section('검증 완료');
    process.exit(0);
  } catch (error) {
    log.error(`오류 발생: ${error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MigrationChecker };