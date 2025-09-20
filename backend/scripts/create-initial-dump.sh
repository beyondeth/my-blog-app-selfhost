#!/bin/bash

# 현재 데이터베이스 상태를 초기 덤프 마이그레이션으로 생성하는 스크립트
# Usage: ./scripts/create-initial-dump.sh

set -e

echo "🔍 현재 데이터베이스 스키마 덤프 생성 중..."

# 환경 변수 로드
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 타임스탬프 생성
TIMESTAMP=$(date +%s)000
MIGRATION_NAME="InitialDump"
FILE_NAME="${TIMESTAMP}-${MIGRATION_NAME}.ts"
OUTPUT_PATH="src/migrations/${FILE_NAME}"

# PostgreSQL 연결 정보 파싱
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "📦 데이터베이스: $DB_NAME"

# 스키마만 덤프 (데이터 제외)
PGPASSWORD=$DB_PASS pg_dump \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_USER \
    -d $DB_NAME \
    --schema-only \
    --no-owner \
    --no-privileges \
    --no-tablespaces \
    --no-unlogged-table-data \
    -t 'public.*' \
    --exclude-table=migrations \
    --exclude-table=typeorm_metadata \
    > /tmp/schema_dump.sql

echo "✨ TypeORM 마이그레이션 파일 생성 중..."

# TypeORM 마이그레이션 파일 생성
cat > $OUTPUT_PATH << 'EOF'
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial Database Dump - 최적화된 초기 스키마
 *
 * 이 마이그레이션은 모든 이전 마이그레이션의 최종 결과를 포함합니다.
 * 새로운 환경에서는 이 파일만 실행하면 됩니다.
 *
 * 포함된 최적화:
 * - 모든 필요한 인덱스만 생성 (중복 제거)
 * - 최적화된 테이블 구조
 * - 필요한 확장 기능 포함
 */
export class InitialDumpTIMESTAMP implements MigrationInterface {
  name = 'InitialDumpTIMESTAMP';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 DB가 있는지 확인
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);

    if (tableExists[0].exists) {
      console.log('✅ 기존 데이터베이스 감지 - InitialDump 건너뜀');
      return;
    }

    console.log('🚀 새 데이터베이스 감지 - 최적화된 스키마 생성 시작');

    // 확장 기능 설치
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "hypopg"`);

EOF

# SQL 덤프를 TypeORM 쿼리로 변환
echo "    // 테이블 생성" >> $OUTPUT_PATH
cat /tmp/schema_dump.sql | \
    grep -E '^CREATE TABLE|^CREATE INDEX|^ALTER TABLE' | \
    sed "s/'/\\\\'/g" | \
    sed "s/^/    await queryRunner.query(\`/" | \
    sed "s/$/\`);/" >> $OUTPUT_PATH

cat >> $OUTPUT_PATH << 'EOF'

    console.log('✅ 최적화된 스키마 생성 완료');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 모든 테이블 삭제 (역순)
    const tables = [
      'messages', 'conversations', 'message_read_status',
      'comments', 'post_likes', 'post_files', 'posts',
      'follows', 'blogs', 'users', 'tags',
      'suspicious_requests', 'mcp_user_logs'
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    // 확장 기능 제거
    await queryRunner.query(`DROP EXTENSION IF EXISTS "hypopg"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_stat_statements"`);
  }
}
EOF

# 타임스탬프 치환
sed -i '' "s/TIMESTAMP/${TIMESTAMP}/g" $OUTPUT_PATH

echo "✅ InitialDump 마이그레이션 생성 완료: $OUTPUT_PATH"
echo ""
echo "📝 사용 방법:"
echo "1. 새 환경: 이 마이그레이션만 실행"
echo "2. 기존 환경: 자동으로 건너뜀"
echo ""
echo "⚠️  주의: 프로덕션에 적용 전 반드시 테스트 환경에서 검증하세요!"

# 임시 파일 정리
rm /tmp/schema_dump.sql