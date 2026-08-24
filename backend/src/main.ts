import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe, Logger, LogLevel } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import * as session from "express-session";
import { join } from "path";
import * as hbs from "hbs";
import * as morgan from "morgan";
import { randomBytes, randomUUID } from "crypto";
import type { Request, Response } from "express";
import {
  isProductionEnvironment,
  validateProductionEnvironment,
} from "./config/environment.config";
import { RequestContextService } from "./common/services/request-context.service";
import { DataSource } from "typeorm";
import { UnifiedRedisService } from "./redis/unified-redis.service";
import { checkReadiness } from "./common/utils/readiness.util";
import {
  resolveSessionStoreMode,
  resolveTrustedProxyAddresses,
} from "./common/session/session-config.util";
import { RedisSessionStore } from "./common/session/redis-session.store";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { expandLoopbackOrigins } from "./common/utils/cors.util";

function getConfiguredOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value.includes("://") ? value : `https://${value}`).origin;
  } catch {
    return undefined;
  }
}

const bootstrapLogger = new Logger("Bootstrap");

async function bootstrap() {
  // 서버 시작 시 타임존을 한국 시간으로 설정
  process.env.TZ = "Asia/Seoul";
  validateProductionEnvironment();

  const logger = bootstrapLogger;

  // 환경에 따른 로그 레벨 설정
  // 프로덕션: ERROR, WARN만 출력 (LOG, DEBUG, VERBOSE 제외)
  //   - 운영 환경에서는 중요한 에러와 경고만 로깅
  //   - 성능 최적화 및 리소스 절약
  // 개발환경: 모든 레벨 출력
  const isProduction = isProductionEnvironment();
  const isDevelopment = !isProduction;
  const logLevels: LogLevel[] = isDevelopment
    ? ["error", "warn", "log", "debug", "verbose"]
    : ["error", "warn"];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  const configService = app.get(ConfigService);
  const requestContextService = app.get(RequestContextService);
  const redisService = app.get(UnifiedRedisService);
  const redisClient = app.get<Redis>(getRedisConnectionToken());

  // Correlate every request with logs, audit rows, and worker handoffs.
  app.use((req: Request, res: Response, next) => {
    const rawRequestId = req.headers["x-request-id"];
    const providedRequestId = Array.isArray(rawRequestId)
      ? rawRequestId[0]
      : rawRequestId;
    const requestId =
      typeof providedRequestId === "string" &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(providedRequestId)
        ? providedRequestId
        : randomUUID();

    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    requestContextService.run({ requestId }, next);
  });

  // Handlebars 뷰 엔진 설정
  app.setViewEngine("hbs");
  // 개발 환경과 프로덕션 환경 모두에서 작동하도록 수정
  const viewsPath = isDevelopment
    ? join(__dirname, "..", "src", "views") // 개발: src/views
    : join(__dirname, "views"); // 프로덕션: dist/views
  app.setBaseViewsDir(viewsPath);
  logger.log(`Views directory: ${viewsPath}`);

  // Handlebars 헬퍼 등록 (조건부 렌더링 등을 위해)
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerHelper("gt", (a, b) => a > b);
  hbs.registerHelper("includes", (array, value) => {
    return Array.isArray(array) && array.includes(value);
  });
  // URL 인코딩 헬퍼 추가
  hbs.registerHelper("encodeURIComponent", (value) => {
    return encodeURIComponent(value || "");
  });

  // CSP Nonce 생성 미들웨어
  app.use((req, res, next) => {
    const nonce = randomBytes(16).toString("base64");
    (res.locals as any).cspNonce = nonce;
    res.setHeader("x-csp-nonce", nonce);
    next();
  });

  const nonceDirective = (_req: Request, res: Response) => {
    const nonce = (res.locals as Record<string, string>).cspNonce;
    return nonce ? `'nonce-${nonce}'` : "'self'";
  };

  const configuredOrigins = [
    configService.get<string>("FRONTEND_URL"),
    configService.get<string>("PUBLIC_SITE_URL"),
    configService.get<string>("PUBLIC_BACKEND_URL"),
    configService.get<string>("BACKEND_PUBLIC_URL"),
    configService.get<string>("S3_PUBLIC_ENDPOINT"),
    configService.get<string>("R2_PUBLIC_URL"),
    configService.get<string>("CDN_DOMAIN"),
    configService.get<string>("CSP_ALLOWED_ORIGINS"),
    configService.get<string>("CORS_ALLOWED_ORIGINS"),
  ]
    .flatMap((value) => (value || "").split(","))
    .map((value) => getConfiguredOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
  const cspOrigins = [...new Set(configuredOrigins)];
  const developmentSources = isDevelopment
    ? ["http://localhost:*", "https:"]
    : [];

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", nonceDirective, ...developmentSources],
          imgSrc: ["'self'", "data:", ...cspOrigins, ...developmentSources],
          connectSrc: ["'self'", ...cspOrigins, ...developmentSources],
          formAction: ["'self'", ...cspOrigins, ...developmentSources],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Compression middleware
  app.use(compression());

  // HTTP request logging middleware (development only)
  if (isDevelopment) {
    app.use(morgan("dev"));
  }

  // Cookie parser middleware
  app.use(cookieParser());

  const configuredSessionSecret = configService.get<string>("SESSION_SECRET");
  const sessionSecret =
    configuredSessionSecret ||
    (isDevelopment ? randomBytes(32).toString("hex") : undefined);
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be defined in production");
  }

  const trustedProxyAddresses = resolveTrustedProxyAddresses(process.env);
  if (trustedProxyAddresses.length > 0) {
    app.set("trust proxy", trustedProxyAddresses);
    logger.log("Explicit reverse proxy trust is configured");
  }

  const sessionStoreMode = resolveSessionStoreMode(process.env);
  let sessionStore: session.Store;
  if (sessionStoreMode === "redis") {
    // Redis-backed sessions are required for consistent CSRF state across
    // PM2 workers and multiple application instances. Fail startup if the
    // shared store is unavailable instead of silently using MemoryStore.
    await redisClient.ping();
    sessionStore = new RedisSessionStore(redisClient);
  } else {
    logger.warn(
      "Using express-session MemoryStore by explicit development configuration",
    );
    sessionStore = new session.MemoryStore();
  }

  // Session middleware (CSRF 토큰용)
  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60 * 60 * 1000, // 1시간
        httpOnly: true,
        // OAuth providers return to the callback via a top-level GET. Strict
        // would drop this session cookie and lose the stored OAuth state.
        sameSite: "lax",
        secure: isProduction,
      },
      name: "session-id", // 세션 쿠키 이름
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      // 환경 변수에서 허용된 origin 목록 가져오기 (콤마로 구분)
      const corsOrigins =
        configService.get<string>("CORS_ALLOWED_ORIGINS") ||
        configService.get<string>("CORS_ORIGIN") ||
        configService.get<string>("FRONTEND_URL") ||
        configService.get<string>("PUBLIC_SITE_URL") ||
        (isDevelopment ? "http://localhost:3000,http://localhost:3001" : "");
      const allowedOrigins = expandLoopbackOrigins(corsOrigins.split(","));

      // CORS_ORIGIN 환경 변수가 있으면 추가 (하위 호환성)
      const additionalOrigin = configService.get("CORS_ORIGIN");
      if (additionalOrigin) {
        for (const origin of expandLoopbackOrigins([additionalOrigin])) {
          if (!allowedOrigins.includes(origin)) {
            allowedOrigins.push(origin);
          }
        }
      }

      // Requests without an Origin are not CORS requests (curl/mobile clients).
      if (!origin) return callback(null, true);

      // Never allow credentialed requests from an opaque file:// origin in production.
      if (origin === "null" && isDevelopment) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error("Not allowed by CORS"), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cache-Control",
      "Pragma",
      "X-CSRF-Token",
      "X-Organization-Id",
      "X-Request-Id",
      "X-Device-Name",
    ],
    credentials: true, // 쿠키 전송을 위해 필수
    exposedHeaders: [
      "Content-Type",
      "Content-Length",
      "ETag",
      "Cache-Control",
      "X-Request-Id",
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: 422,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter(configService));

  // API prefix
  app.setGlobalPrefix("api/v1", {
    exclude: [
      "/",
      "/health",
      "/ready",
      "/api-docs",
      process.env.METRICS_PATH || "/internal/health-check-2f4a8b9c",
      // MCP Discovery 엔드포인트는 루트 경로에 위치해야 함 (RFC 9728, RFC 8414)
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-authorization-server",
    ],
  });

  // Swagger documentation
  if (configService.get("NODE_ENV") !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Blog API")
      .setDescription("개인 블로그 API 문서")
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "JWT",
          description: "Enter JWT token",
          in: "header",
        },
        "JWT-auth",
      )
      .addTag("auth", "인증 관련 API")
      .addTag("users", "사용자 관련 API")
      .addTag("posts", "포스트 관련 API")
      .addTag("comments", "댓글 관련 API")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Health check endpoint
  app.getHttpAdapter().get("/health", (req: any, res: any) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const dataSource = app.get(DataSource);
  app.getHttpAdapter().get("/ready", async (req: any, res: any) => {
    const readiness = await checkReadiness([
      { name: "database", check: () => dataSource.query("SELECT 1") },
      { name: "redis", check: () => redisService.ping() },
    ]);

    res.status(readiness.ready ? 200 : 503).json({
      status: readiness.ready ? "ready" : "not_ready",
      checks: readiness.checks,
      timestamp: new Date().toISOString(),
    });
  });

  const port = configService.get<number>("PORT", 3000);

  await app.listen(port, "0.0.0.0");

  // PM2 ready 신호 - PM2가 wait_ready: true로 설정되어 있을 때 필요
  // 앱이 성공적으로 시작되고 요청을 받을 준비가 되었음을 알림
  if (process.send) {
    process.send("ready");
    logger.log("✅ PM2 ready signal sent");
  }

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  logger.log(`🏥 Health Check: http://localhost:${port}/health`);
  logger.log(`✅ Readiness Check: http://localhost:${port}/ready`);
  logger.log(`🌍 Environment: ${configService.get("NODE_ENV", "development")}`);

  // Graceful shutdown 신호 처리
  // SIGTERM: Kubernetes, Docker, PM2 reload 등에서 사용하는 정상 종료 신호
  // SIGINT: Ctrl+C로 프로세스를 종료할 때 발생하는 신호
  const handleShutdown = async (signal: string) => {
    logger.log(`${signal} signal received. Starting graceful shutdown...`);

    try {
      // PM2에 shutdown 시작 알림
      if (process.send) {
        process.send("shutdown");
      }

      // NestJS 앱 종료 (모든 연결 정리)
      await app.close();
      logger.log("Application closed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

bootstrap().catch((error) => {
  bootstrapLogger.error("Application failed to start:", error);
  process.exit(1);
});
