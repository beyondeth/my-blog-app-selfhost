# ============================================
# Codebase Backend - Multi-stage Dockerfile
# ============================================
# Node 22 LTS (Active until 2027-04-30)
#
# 사용법:
#   개발: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
#   프로덕션: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# ============================================

# ============================================
# Stage 1: Development (Hot Reload)
# ============================================
FROM node:22-slim AS development

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치 (procps: ps 명령어 포함, NestJS watch mode 필요)
RUN apt-get update && \
    apt-get install -y procps && \
    rm -rf /var/lib/apt/lists/*

# pnpm 설치 (Node 22와 호환되는 최신 버전)
RUN npm install -g pnpm@latest

# package.json과 pnpm-lock.yaml 복사 (의존성 캐싱 최적화)
COPY package.json pnpm-lock.yaml* ./

# 의존성 설치 (개발 의존성 포함)
RUN pnpm install --frozen-lockfile

# 소스 코드는 volume mount로 제공 (docker-compose.dev.yml)
# 개발 모드에서는 node_modules도 volume으로 제공

# 포트 노출
EXPOSE 3000

# 개발 서버 실행 (Hot Reload)
CMD ["pnpm", "run", "start:dev"]

# ============================================
# Stage 2: Builder (의존성 설치 및 빌드)
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm@latest

# package.json과 pnpm-lock.yaml 복사
COPY package.json pnpm-lock.yaml* ./

# 의존성 설치 (프로덕션 전용)
RUN pnpm install --frozen-lockfile --prod=false

# 소스 코드 복사
COPY . .

# NestJS 빌드
RUN pnpm run build

# 프로덕션 의존성만 재설치
RUN rm -rf node_modules && \
    pnpm install --frozen-lockfile --prod

# ============================================
# Stage 3: Production (최적화된 런타임)
# ============================================
FROM node:22-slim AS production

# 보안 강화: 비-루트 사용자 생성 (Debian 방식)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nestjs

# PM2 전역 설치 (클러스터 모드 지원)
RUN npm install -g pm2@latest

WORKDIR /app

# PM2 로그 디렉토리 생성 (nestjs 사용자 권한)
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app/logs

# 필요한 파일만 복사 (빌드된 파일 + 프로덕션 의존성)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# PM2 Ecosystem 설정 파일 복사
COPY --chown=nestjs:nodejs ecosystem.config.js ./ecosystem.config.js

# 비-루트 사용자로 전환
USER nestjs

# 포트 노출
EXPOSE 3000

# 환경 변수 (기본값, docker-compose에서 오버라이드)
ENV NODE_ENV=production

# PM2 Runtime으로 프로덕션 서버 실행
# pm2-runtime: foreground 모드 (Docker 컨테이너에 적합)
# --env production: 프로덕션 환경 변수 사용
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
