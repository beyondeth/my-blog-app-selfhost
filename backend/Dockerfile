# ============================================
# Aigory Backend - Multi-stage Dockerfile
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
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS development

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치 (procps: ps 명령어 포함, NestJS watch mode 필요)
RUN apt-get update && \
    apt-get install -y procps && \
    rm -rf /var/lib/apt/lists/*

# pnpm 설치 (Node 22와 호환되는 최신 버전)
RUN npm install -g pnpm@9.0.0

# package.json과 pnpm-lock.yaml 복사 (의존성 캐싱 최적화)
COPY package.json pnpm-lock.yaml* .npmrc ./

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
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS builder

WORKDIR /app

ARG TARGETARCH

# pnpm 설치
RUN npm install -g pnpm@9.0.0

# 빌드 도구 설치 (native 모듈 컴파일을 위해)
RUN apt-get update && \
    apt-get install -y python3 make g++ build-essential && \
    rm -rf /var/lib/apt/lists/*

# msgpackr-extract 비활성화 (Node.js 22 + ARM64 호환성)
ENV MSGPACKR_NO_EXTRACT=1
ENV SKIP_NODE_GYP_BUILD=1

# 추가 네이티브 모듈 컴파일 방지 (ARM64 최적화)
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV AVOID_NATIVE=1
ENV npm_config_build_from_source=false

# package.json과 pnpm-lock.yaml 복사
COPY package.json pnpm-lock.yaml* .npmrc ./

# 의존성 설치 (프로덕션 전용, 캐시 마운트)
# Sharp를 위한 플랫폼별 빌드 활성화
RUN --mount=type=cache,target=/root/.npm \
    NPM_ARCH=$(if [ "$TARGETARCH" = "amd64" ]; then echo x64; else echo "$TARGETARCH"; fi) && \
    npm_config_arch=$NPM_ARCH \
    npm_config_platform=linux \
    npm_config_libc=glibc \
    SHARP_IGNORE_GLOBAL_LIBVIPS=1 \
    pnpm install --frozen-lockfile --prod=false

# 소스 코드 복사
COPY . .

# 빌드 전 dist 폴더 정리 및 NestJS 빌드
RUN rm -rf dist && pnpm run build

# 프로덕션 의존성만 재설치 (선택적 메일 템플릿 엔진 제외)
# Sharp 네이티브 모듈은 런타임에 필요한 플랫폼 패키지를 직접 포함한다.
RUN --mount=type=cache,target=/root/.npm \
    rm -rf node_modules && \
    NPM_ARCH=$(if [ "$TARGETARCH" = "amd64" ]; then echo x64; else echo "$TARGETARCH"; fi) && \
    npm_config_arch=$NPM_ARCH \
    npm_config_platform=linux \
    npm_config_libc=glibc \
    SHARP_IGNORE_GLOBAL_LIBVIPS=1 \
    pnpm install --frozen-lockfile --prod

# ============================================
# Stage 3: Production (최적화된 런타임)
# ============================================
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS production

LABEL org.opencontainers.image.licenses="LicenseRef-Proprietary" \
      org.opencontainers.image.source="https://github.com/beyondeth/my-blog-app"

# msgpackr-extract 및 node-gyp 비활성화 (전역 적용)
ENV MSGPACKR_NO_EXTRACT=1
ENV SKIP_NODE_GYP_BUILD=1
ENV npm_config_build_from_source=false

# FFmpeg 설치 (비디오 압축용) + 보안 강화: 비-루트 사용자 생성
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs -m nestjs

# pnpm 및 PM2 전역 설치 (마이그레이션 실행 및 클러스터 모드 지원)
RUN npm install -g pnpm@9.0.0 pm2@7.0.3

WORKDIR /app

# PM2 로그 및 설정 디렉토리 생성 (nestjs 사용자 권한)
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app/logs && \
    mkdir -p /home/nestjs/.pm2 && chown -R nestjs:nodejs /home/nestjs/.pm2

# 필요한 파일만 복사 (빌드된 파일 + 프로덕션 의존성)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
# PM2 Ecosystem 설정 파일 복사
COPY --chown=nestjs:nodejs ecosystem.config.js ./ecosystem.config.js

# pnpm creates a temporary file in the working directory during migrations.
RUN chown nestjs:nodejs /app

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
