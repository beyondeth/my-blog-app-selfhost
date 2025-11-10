#!/bin/bash

# 프로덕션 환경 마이그레이션 실행 스크립트
# Docker 및 일반 서버 환경에서 모두 사용 가능

set -e  # 에러 발생 시 즉시 종료

# 로깅 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# 환경 변수 확인
check_env() {
    log "환경 변수 확인..."

    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL 환경 변수가 설정되지 않았습니다."
    fi

    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV=production
        log "NODE_ENV를 production으로 설정했습니다."
    fi
}

# 빌드된 소스 확인
check_build() {
    log "빌드된 소스 파일 확인..."

    if [ ! -f "dist/src/data-source.js" ]; then
        error "빌드된 data-source.js 파일을 찾을 수 없습니다. 먼저 'npm run build'를 실행하세요."
    fi

    if [ ! -d "dist/src/migrations" ]; then
        log "경고: 빌드된 마이그레이션 디렉토리를 찾을 수 없습니다."
    fi
}

# 데이터베이스 연결 확인
check_db() {
    log "데이터베이스 연결 확인..."

    # 간단한 연결 테스트
    timeout 30 node -e "
        const { DataSource } = require('./dist/src/data-source.js');
        const dataSource = new DataSource();
        dataSource.initialize()
            .then(() => {
                console.log('✅ 데이터베이스 연결 성공');
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ 데이터베베이스 연결 실패:', err.message);
                process.exit(1);
            });
    " || error "데이터베이스 연결에 실패했습니다."
}

# 백업 생성
create_backup() {
    if [ "$SKIP_BACKUP" != "true" ]; then
        log "데이터베이스 백업 생성 중..."

        BACKUP_FILE="backup_before_migration_$(date +%Y%m%d_%H%M%S).sql"

        # 데이터베이스 URL에서 연결 정보 추출
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

        if [ -z "$DB_HOST" ]; then DB_HOST="localhost"; fi
        if [ -z "$DB_PORT" ]; then DB_PORT="5432"; fi

        # pg_dump로 백업 생성
        PGPASSWORD="${DATABASE_PASSWORD:-postgres}" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-privileges \
            --verbose \
            --file="$BACKUP_FILE" 2>/dev/null

        if [ $? -eq 0 ]; then
            log "✅ 백업 생성 완료: $BACKUP_FILE"
            echo "$BACKUP_FILE" > .last_migration_backup
        else
            log "⚠️  백업 생성에 실패했습니다. 계속 진행합니다."
        fi
    else
        log "⏭️  백업 건너뜀 (SKIP_BACKUP=true)"
    fi
}

# 마이그레이션 실행
run_migrations() {
    log "마이그레이션 실행 중..."

    # 현재 실행된 마이그레이션 확인
    PENDING_MIGRATIONS=$(node -e "
        const { DataSource } = require('./dist/src/data-source.js');
        const dataSource = new DataSource();
        dataSource.initialize()
            .then(async () => {
                const queryRunner = dataSource.createQueryRunner();
                const migrations = await queryRunner.query('SELECT COUNT(*) as count FROM migrations');
                await queryRunner.release();
                console.log(migrations[0].count);
                process.exit(0);
            })
            .catch((err) => {
                console.error(err.message);
                process.exit(1);
            });
    ")

    log "대기 중인 마이그레이션 수: $PENDING_MIGRATIONS"

    # 마이그레이션 실행
    node ./node_modules/typeorm/cli.js migration:run -d ./dist/src/data-source.js

    log "✅ 마이그레이션 완료"
}

# 상태 저장
save_state() {
    log "마이그레이션 상태 저장..."

    STATE_FILE=".migration_state.json"

    node -e "
        const { DataSource } = require('./dist/src/data-source.js');
        const dataSource = new DataSource();
        dataSource.initialize()
            .then(async () => {
                const queryRunner = dataSource.createQueryRunner();
                const migrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id');
                await queryRunner.release();

                const fs = require('fs');
                fs.writeFileSync('$STATE_FILE', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    count: migrations.length,
                    migrations: migrations.map(m => ({
                        id: m.id,
                        name: m.name,
                        timestamp: m.timestamp
                    }))
                }, null, 2));

                console.log('✅ 상태 저장 완료: $STATE_FILE');
                process.exit(0);
            })
            .catch((err) => {
                console.error('상태 저장 실패:', err.message);
                process.exit(1);
            });
    " || error "상태 저장에 실패했습니다."
}

# 롤백 함수
rollback() {
    log "마지막 성공한 백업으로 롤백 중..."

    if [ -f ".last_migration_backup" ]; then
        BACKUP_FILE=$(cat .last_migration_backup)
        log "백업 파일: $BACKUP_FILE"

        # 데이터베이스 URL에서 연결 정보 추출
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

        if [ -z "$DB_HOST" ]; then DB_HOST="localhost"; fi
        if [ -z "$DB_PORT" ]; then DB_PORT="5432"; fi

        # 데이터베이스 복원
        PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$BACKUP_FILE" \
            --verbose

        if [ $? -eq 0 ]; then
            log "✅ 롤백 완료"
        else
            error "롤백에 실패했습니다. 수동으로 복구해주세요."
        fi
    else
        error "백업 파일을 찾을 수 없습니다."
    fi
}

# 메인 실행 로직
main() {
    log "===== 프로덕션 마이그레이션 시작 ====="

    # 인자 처리
    if [ "$1" = "rollback" ]; then
        rollback
        exit 0
    fi

    check_env
    check_build
    check_db
    create_backup
    run_migrations
    save_state

    log "===== 마이그레이션 성공적으로 완료 ====="
}

# 트랩 핸들링
trap 'log "인터럽트 신호 감지. 롤백을 시도록합니다..."; rollback' INT TERM

# 스크립트 실행
main "$@"