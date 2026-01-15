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
import { randomBytes } from "crypto";
import type { Request, Response } from "express";

async function bootstrap() {
  // 서버 시작 시 타임존을 한국 시간으로 설정
  process.env.TZ = "Asia/Seoul";

  const logger = new Logger("Bootstrap");

  // 환경에 따른 로그 레벨 설정
  // 프로덕션: ERROR, WARN만 출력 (LOG, DEBUG, VERBOSE 제외)
  //   - 운영 환경에서는 중요한 에러와 경고만 로깅
  //   - 성능 최적화 및 리소스 절약
  // 개발환경: 모든 레벨 출력
  const isDevelopment = process.env.NODE_ENV !== "production";
  const logLevels: LogLevel[] = isDevelopment
    ? ["error", "warn", "log", "debug", "verbose"]
    : ["error", "warn"];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  const configService = app.get(ConfigService);

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

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", nonceDirective, "https:", "http://localhost:*"],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "http://localhost:*",
            "*.s3.amazonaws.com", // AWS S3
            "*.oraclecloud.com", // Oracle OCI Object Storage
            "*.storage.googleapis.com", // Google Cloud Storage (Gemini AI images)
            // Cloudflare CDN (계정 생성 후 실제 도메인으로 교체 필요)
            // 예: "cdn.yourdomain.com"
          ],
          connectSrc: [
            "'self'",
            "http://localhost:*",
            "https:",
            "*.s3.amazonaws.com", // AWS S3
            "*.oraclecloud.com", // Oracle OCI Object Storage
            "*.storage.googleapis.com", // Google Cloud Storage (Gemini AI images)
            // Cloudflare CDN (계정 생성 후 실제 도메인으로 교체 필요)
            // 예: "cdn.yourdomain.com"
          ],
          formAction: ["'self'", "http://localhost:*"], // OAuth 폼 제출을 위해 추가
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

  // Session middleware (CSRF 토큰용)
  app.use(
    session({
      secret: configService.get("SESSION_SECRET", "csrf-secret-key-2024"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60 * 60 * 1000, // 1시간
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // 개발 환경에서는 lax 사용
        secure: process.env.NODE_ENV === "production",
      },
      name: "session-id", // 세션 쿠키 이름
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      // 환경 변수에서 허용된 origin 목록 가져오기 (콤마로 구분)
      const corsOrigins = configService.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
      );
      const allowedOrigins = corsOrigins
        .split(",")
        .map((o: string) => o.trim());

      // CORS_ORIGIN 환경 변수가 있으면 추가 (하위 호환성)
      const additionalOrigin = configService.get("CORS_ORIGIN");
      if (additionalOrigin && !allowedOrigins.includes(additionalOrigin)) {
        allowedOrigins.push(additionalOrigin);
      }

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // OAuth 인증 페이지를 위해 null origin 허용 (file:// 프로토콜 등)
      if (origin === "null") {
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
    ],
    credentials: true, // 쿠키 전송을 위해 필수
    exposedHeaders: ["Content-Type", "Content-Length", "ETag", "Cache-Control"],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // 파라미터에 대해서는 허용
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
  console.error("Application failed to start:", error);
  process.exit(1);
});
