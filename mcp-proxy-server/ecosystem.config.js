/**
 * PM2 설정 파일
 *
 * 프로덕션 환경을 위한 클러스터 모드 설정
 * CPU 코어 수만큼 워커 프로세스 실행
 */

module.exports = {
  apps: [
    {
      // 기본 설정
      name: 'mcp-proxy-server',
      script: './dist/index.js',

      // 클러스터 설정
      instances: 'max',  // CPU 코어 수만큼 인스턴스 실행 (또는 숫자로 지정 가능)
      exec_mode: 'cluster',  // 클러스터 모드 활성화

      // 환경 변수
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8080,
        LOG_LEVEL: 'debug',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8080,
        LOG_LEVEL: 'info',
      },

      // 로그 설정
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,

      // 재시작 정책
      watch: false,  // 파일 변경 감지 (개발 환경에서만 true)
      max_restarts: 10,  // 최대 재시작 횟수
      min_uptime: '10s',  // 최소 가동 시간
      listen_timeout: 3000,  // 시작 시 대기 시간 (ms)
      kill_timeout: 5000,  // 종료 시 대기 시간 (ms)

      // 메모리 관리
      max_memory_restart: '500M',  // 메모리 제한 초과 시 재시작

      // Zero-downtime reload
      wait_ready: true,  // process.send('ready') 대기

      // 환경별 인스턴스 수 조정
      instance_var: 'INSTANCE_ID',  // 각 인스턴스별 고유 ID 환경 변수
    },

    // 개발 환경 설정 (선택적)
    {
      name: 'mcp-proxy-dev',
      script: './src/index.ts',
      interpreter: 'node',
      interpreter_args: '-r ts-node/register',

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'development',
        PORT: 8080,
        LOG_LEVEL: 'debug',
        LOG_PRETTY: 'true',
      },

      watch: ['src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      watch_delay: 1000,

      error_file: './logs/dev-error.log',
      out_file: './logs/dev-out.log',
    },
  ],

  // 배포 설정 (선택적)
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/mcp-proxy-server.git',
      path: '/var/www/mcp-proxy-server',
      'pre-deploy': 'npm run build',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Pre-setup commands"',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};

/**
 * PM2 명령어 가이드:
 *
 * 시작:
 * - pm2 start ecosystem.config.js                  # 기본 시작
 * - pm2 start ecosystem.config.js --env production # 프로덕션 모드
 * - pm2 start ecosystem.config.js --env development # 개발 모드
 *
 * 관리:
 * - pm2 list                   # 실행 중인 프로세스 목록
 * - pm2 show mcp-proxy-server  # 프로세스 상세 정보
 * - pm2 monit                  # 실시간 모니터링
 * - pm2 logs                   # 로그 보기
 * - pm2 logs --lines 100      # 최근 100줄 로그
 *
 * 재시작 (Zero-downtime):
 * - pm2 reload mcp-proxy-server  # Graceful reload
 * - pm2 restart mcp-proxy-server # 전체 재시작
 *
 * 정지:
 * - pm2 stop mcp-proxy-server   # 프로세스 정지
 * - pm2 delete mcp-proxy-server # 프로세스 삭제
 *
 * 클러스터 관리:
 * - pm2 scale mcp-proxy-server 4  # 인스턴스 수 조정
 * - pm2 scale mcp-proxy-server +2 # 인스턴스 2개 추가
 *
 * 모니터링:
 * - pm2 web                    # 웹 모니터링 대시보드 (포트 9615)
 * - pm2 plus                   # PM2+ 모니터링 서비스 (유료)
 *
 * 시스템 시작 시 자동 실행:
 * - pm2 startup               # 시스템 시작 스크립트 생성
 * - pm2 save                  # 현재 프로세스 목록 저장
 */