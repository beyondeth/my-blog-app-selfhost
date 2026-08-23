// ============================================
// PM2 Ecosystem Configuration
// ============================================
// Oracle Cloud Free Tier 최적화 설정
// - 4 OCPU, 24GB RAM 할당량 내에서 동적 스케일링
// - 월 3,000 OCPU시간, 18,000 GB시간 제한 고려
//
// 사용법:
//   시작: pm2 start ecosystem.config.js --env production
//   재시작: pm2 reload all --update-env
//   스케일: pm2 scale aigory-blog-backend 2
//   상태: pm2 status
//   로그: pm2 logs aigory-blog-backend
//   모니터: pm2 monit
// ============================================

module.exports = {
  apps: [
    {
      // 앱 이름 (pm2 list에 표시)
      name: 'aigory-blog-backend',

      // 실행할 스크립트 (NestJS 빌드 결과물)
      script: 'dist/src/main.js',

      // 클러스터 모드 설정 (Oracle Free Tier 최적화)
      instances: 2, // 시작 시 2개 워커 (고정, 메모리 절약)
      exec_mode: 'cluster', // cluster 모드 (단일 컨테이너 내 멀티 프로세스)

      // 동적 스케일링 설정 (배포 안정성 위해 고정)
      min_instances: 2, // 최소 2개 워커 (안정성 확보)
      max_instances: 2, // 최대 2개 워커 (메모리 제한)

      // 메모리 제한 (워커당)
      max_memory_restart: '700M', // 워커가 700MB 초과 시 자동 재시작
      // 2 워커 × 700MB = 1.4GB (백엔드 컨테이너 3GB 내 여유 확보)

      // 프로세스 관리
      autorestart: true, // 크래시 시 자동 재시작
      watch: false, // 파일 변경 감지 비활성화 (프로덕션)
      max_restarts: 10, // 최대 재시작 횟수 (무한 재시작 방지)
      min_uptime: '10s', // 최소 실행 시간 (10초 미만이면 비정상 종료로 판단)
      restart_delay: 4000, // 재시작 지연 (4초)
      increment_var: 'PORT_OFFSET', // 워커 순차 시작 (CPU 병목 완화)

      // Graceful Shutdown/Reload 설정
      kill_timeout: 5000, // SIGINT 후 5초 대기 후 SIGKILL
      wait_ready: true, // 앱에서 process.send('ready') 신호 대기
      listen_timeout: 10000, // ready 신호 대기 시간 (10초로 단축, Cold Start 고려)

      // 로그 설정
      error_file: '/app/logs/pm2-error.log', // 에러 로그 경로
      out_file: '/app/logs/pm2-out.log', // 일반 로그 경로
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // 로그 날짜 포맷
      merge_logs: true, // 모든 워커의 로그를 하나로 병합
      log_type: 'json', // JSON 포맷 로그 (파싱 용이)

      // 환경 변수 (프로덕션)
      env_production: {
        NODE_ENV: 'production',

        // Node.js 최적화 옵션 (ARM64 + 메모리 최적화)
        NODE_OPTIONS: '--max-old-space-size=700', // 워커당 힙 메모리 700MB

        // PM2 Graceful Shutdown
        PM2_GRACEFUL_LISTEN_TIMEOUT: 5000,
        PM2_KILL_TIMEOUT: 5000,
      },

      // 환경 변수 (개발)
      env_development: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
    },
  ],

  // ============================================
  // PM2 Deploy 설정 (선택사항)
  // ============================================
  // GitHub Actions에서 SSH로 배포하므로 주석 처리
  // 필요시 활성화 (pm2 deploy 명령어 사용)
  /*
  deploy: {
    production: {
      user: 'ubuntu',
      host: process.env.DEPLOY_HOST || 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/my-blog-app.git',
      path: '/home/ubuntu/my-blog-app',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
  */
};
