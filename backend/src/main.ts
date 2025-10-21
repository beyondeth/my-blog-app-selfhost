import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import { join } from 'path';
import * as hbs from 'hbs';

async function bootstrap() {
  // 서버 시작 시 타임존을 한국 시간으로 설정
  process.env.TZ = 'Asia/Seoul';
  
  const logger = new Logger('Bootstrap');
  
  // 환경에 따른 로그 레벨 설정
  // 프로덕션: ERROR, WARN, LOG만 출력 (DEBUG, VERBOSE 제외)
  // 개발환경: 모든 레벨 출력
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevels: LogLevel[] = isDevelopment
    ? ['error', 'warn', 'log', 'debug', 'verbose']
    : ['error', 'warn', 'log'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  const configService = app.get(ConfigService);

  // Handlebars 뷰 엔진 설정
  app.setViewEngine('hbs');
  // 개발 환경과 프로덕션 환경 모두에서 작동하도록 수정
  const viewsPath = isDevelopment
    ? join(__dirname, '..', 'src', 'views')  // 개발: src/views
    : join(__dirname, 'views');              // 프로덕션: dist/views
  app.setBaseViewsDir(viewsPath);
  console.log('📁 Views directory:', viewsPath);

  // Handlebars 헬퍼 등록 (조건부 렌더링 등을 위해)
  hbs.registerHelper('eq', (a, b) => a === b);
  hbs.registerHelper('gt', (a, b) => a > b);
  hbs.registerHelper('includes', (array, value) => {
    return Array.isArray(array) && array.includes(value);
  });
  // URL 인코딩 헬퍼 추가
  hbs.registerHelper('encodeURIComponent', (value) => {
    return encodeURIComponent(value || '');
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // OAuth 페이지의 인라인 스크립트를 위해 추가
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "http://localhost:*",
          "*.s3.amazonaws.com",        // AWS S3
          "*.oraclecloud.com",         // Oracle OCI Object Storage
          // Cloudflare CDN (계정 생성 후 실제 도메인으로 교체 필요)
          // 예: "cdn.yourdomain.com"
        ],
        connectSrc: [
          "'self'",
          "http://localhost:*",
          "https:",
          "*.s3.amazonaws.com",        // AWS S3
          "*.oraclecloud.com",         // Oracle OCI Object Storage
          // Cloudflare CDN (계정 생성 후 실제 도메인으로 교체 필요)
          // 예: "cdn.yourdomain.com"
        ],
        formAction: ["'self'", "http://localhost:*"], // OAuth 폼 제출을 위해 추가
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // Compression middleware
  app.use(compression());

  // Cookie parser middleware
  app.use(cookieParser());

  // Session middleware (CSRF 토큰용)
  app.use(
    session({
      secret: configService.get('SESSION_SECRET', 'csrf-secret-key-2024'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60 * 60 * 1000, // 1시간
        httpOnly: true,
        sameSite: 'strict', // CSRF 방지
        secure: process.env.NODE_ENV === 'production',
      },
      name: 'session-id', // 세션 쿠키 이름
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      // 환경 변수에서 허용된 origin 목록 가져오기 (콤마로 구분)
      const corsOrigins = configService.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001');
      const allowedOrigins = corsOrigins.split(',').map((o: string) => o.trim());

      // CORS_ORIGIN 환경 변수가 있으면 추가 (하위 호환성)
      const additionalOrigin = configService.get('CORS_ORIGIN');
      if (additionalOrigin && !allowedOrigins.includes(additionalOrigin)) {
        allowedOrigins.push(additionalOrigin);
      }
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // OAuth 인증 페이지를 위해 null origin 허용 (file:// 프로토콜 등)
      if (origin === 'null') {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'ETag',
      'Cache-Control',
    ],
    credentials: true, // 쿠키 전송을 위해 활성화
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

  // API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: [
      '/',
      '/health',
      '/api-docs',
      process.env.METRICS_PATH || '/internal/health-check-2f4a8b9c',
      // MCP Discovery 엔드포인트는 루트 경로에 위치해야 함 (RFC 9728, RFC 8414)
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-authorization-server',
    ],
  });

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Blog API')
      .setDescription('개인 블로그 API 문서')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', '인증 관련 API')
      .addTag('users', '사용자 관련 API')
      .addTag('posts', '포스트 관련 API')
      .addTag('comments', '댓글 관련 API')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const port = configService.get<number>('PORT', 3000);
  
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  logger.log(`🏥 Health Check: http://localhost:${port}/health`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
}); 