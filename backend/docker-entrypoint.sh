#!/bin/bash

# Docker 컨테이너 진입점 스크립트
# 컨테이너 시작 시 마이그레이션 자동 실행 및 상태 확인

set -e  # 에러 발생 시 즉시 종료

# 로깅 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DOCKER: $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DOCKER ERROR: $1" >&2
    exit 1
}

# 환경 변수 설정
setup_env() {
    log "환경 변수 설정..."

    # 기본 환경 변수
    export NODE_ENV=${NODE_ENV:-production}
    export SKIP_BACKUP=${SKIP_BACKUP:-true}  # Docker 환경에서는 보통 빌드 시점에 백업함

    log "NODE_ENV=$NODE_ENV"
    log "SKIP_BACKUP=$SKIP_BACKUP"
}

# 소스 파일 확인
check_sources() {
    log "소스 파일 확인..."

    if [ ! -f "dist/main.js" ]; then
        error "빌드된 main.js 파일을 찾을 수 없습니다."
    fi

    if [ ! -f "dist/src/data-source.js" ]; then
        error "빌드된 data-source.js 파일을 찾을 수 없습니다."
    fi
}

# 데이터베이스 연결 대기
wait_for_db() {
    log "데이터베이스 연결 대기 중..."

    # DATABASE_URL에서 연결 정보 추출
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL 환경 변수가 설정되지 않았습니다."
    fi

    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

    if [ -z "$DB_HOST" ]; then DB_HOST="localhost"; fi
    if [ -z "$DB_PORT" ]; then DB_PORT="5432"; fi

    # 최대 60초 대기
    local MAX_RETRIES=60
    local RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" pg_isready \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -q 2>/dev/null; then
            log "✅ 데이터베이스 연결 성공"
            return 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "데이터베이스 연결 대기 중... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 1
    done

    error "데이터베이스 연결 실패. 60초 내에 연결되지 않았습니다."
}

# 마이그레이션 실행 필요 여부 확인
check_migrations_needed() {
    log "마이그레이션 실행 필요 여부 확인..."

    # 빌드된 마이그레이션 파일 존재 확인
    if [ ! -d "dist/src/migrations" ]; then
        log "마이그레이션 파일이 빌드되지 않았습니다. 마이그레이션을 건너뜁니다."
        return 1
    fi

    # 실행된 마이그레이션 수 확인
    local EXECUTED_COUNT=$(node -e "
        const { DataSource } = require('./dist/src/data-source.js');
        const dataSource = new DataSource();
        dataSource.initialize()
            .then(async () => {
                try {
                    const queryRunner = dataSource.createQueryRunner();
                    const result = await queryRunner.query('SELECT COUNT(*) as count FROM migrations');
                    await queryRunner.release();
                    await dataSource.destroy();
                    console.log(result[0].count);
                    process.exit(0);
                } catch (err) {
                    console.error(0);
                    process.exit(0);
                }
            })
            .catch(() => {
                console.error(0);
                process.exit(0);
            });
    " 2>/dev/null || echo "0")

    # 파일 시스템의 마이그레이션 파일 수
    local FILE_COUNT=$(find dist/src/migrations -name "*.js" 2>/dev/null | wc -l)

    log "실행된 마이그레이션: $EXECUTED_COUNT"
    log "사용 가능한 마이그레이션: $FILE_COUNT"

    if [ "$EXECUTED_COUNT" -lt "$FILE_COUNT" ]; then
        log "실행되지 않은 마이그레이션이 있습니다. 실행을 시작합니다."
        return 0
    else
        log "모든 마이그레이션이 이미 실행되었습니다."
        return 1
    fi
}

# 마이그레이션 실행
run_migrations() {
    log "마이그레이션 실행 시작..."

    # 마이그레이션 실행 스크립트 호출
    if [ -f "scripts/run-migrations.sh" ]; then
        ./scripts/run-migrations.sh
    else
        log "run-migrations.sh 스크립트를 찾을 수 없습니다. 직접 실행합니다."

        # 직접 실행 (폴백업)
        log "경고: run-migrations.sh가 없습니다. 직접 마이그레이션을 실행합니다."

        # 마이그레이션 실행
        node ./node_modules/typeorm/cli.js migration:run -d ./dist/src/data-source.js

        # 성공 시 상태 저장
        STATE_FILE=".migration_state.json"
        node -e "
            const { DataSource } = require('./dist/src/data-source.js');
            const dataSource = new DataSource();
            dataSource.initialize()
                .then(async () => {
                    const queryRunner = dataSource.createQueryRunner();
                    const migrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id');
                    await queryRunner.release();
                    await dataSource.destroy();

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

                    console.log('✅ 마이그레이션 상태 저장 완료');
                    process.exit(0);
                })
                .catch((err) => {
                    console.error('상태 저장 실패:', err.message);
                    process.exit(1);
                });
        "
    fi

    log "✅ 마이그레이션 실행 완료"
}

# 상태 확인
verify_state() {
    if [ -f ".migration_state.json" ]; then
        log "마이그레이션 상태:"
        cat .migration_state.json | python3 -m json.tool || cat .migration_state.json
    else
        log "마이그레이션 상태 파일이 없습니다."
    fi
}

# 헬스체크
health_check() {
    log "애�리케이션 헬스체크..."

    # 5초 대기 후 애�리케이션 상태 확인
    sleep 5

    if curl -f http://localhost:3000/internal/health-check-2f4a8b9c >/dev/null 2>&1; then
        log "✅ 애�리케이션 헬스체크 통과"
    else
        log "⚠️  애피리케이션 헬스체크 실패"
        log "애플리케이션이 시작되지 않았을 수 있습니다."
    fi
}

# 메인 실행 로직
main() {
    log "===== Docker 진입점 시작 ====="
    log "Container ID: $(cat /proc/self/cgroup | grep -o 'docker-[^/]*' | head -1 | cut -d/ -f2)"

    setup_env
    check_sources
    wait_for_db

    # 마이그레이션이 필요한 경우에만 실행
    if check_migrations_needed; then
        run_migrations
    fi

    verify_state

    # PM2 시작 (사용 중지 않으면 주석 해제)
    # log "PM2 시작..."
    # npm run start:prod

    log "===== 진입점 완료 ====="
}

# 트랩 핸들링
trap 'log "인터럽트 신호 감지. 정상 종료합니다."; exit 0' INT TERM

# 스크립트 실행
main "$@"