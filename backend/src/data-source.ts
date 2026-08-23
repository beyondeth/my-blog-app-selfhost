import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";
import { ORDERED_MIGRATIONS } from "./migrations/migration-manifest";

// 프로덕션 환경이 아닐 때만 dotenv 로드 (프로덕션에서는 환경변수가 이미 설정됨)
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

/**
 * Migration 전용 DataSource 생성 함수
 * NestJS 애플리케이션은 TypeORM 모듈을 통해 연결 관리
 */
export const createDataSourceOptions = (): any => {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;

  // 프로덕션 환경에서는 빌드된 경로 사용
  const isProduction = process.env.NODE_ENV === "production";
  const isCompiled = __dirname.split(path.sep).includes("dist");
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  const baseConfig = {
    type: "postgres",
    entities: isCompiled
      ? [path.join(__dirname, "**/*.entity.js")]
      : ["src/**/*.entity.ts"],
    migrations: ORDERED_MIGRATIONS,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
  };

  if (dbUrl) {
    // 로컬 데이터베이스인 경우 SSL 비활성화
    const isLocal =
      dbUrl.includes("localhost") ||
      dbUrl.includes("127.0.0.1") ||
      dbUrl.includes("[::1]") ||
      dbUrl.includes("@postgres");
    return {
      ...baseConfig,
      url: dbUrl,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized } }),
      extra: {
        // Connection Pool 설정 (migrations에서도 동일하게 적용)
        max: parseInt(process.env.DB_POOL_SIZE || "5", 10), // migration은 적은 연결로 충분
        connectionTimeoutMillis: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || "3000",
          10,
        ),
        ...(isLocal ? {} : { ssl: { rejectUnauthorized } }),
      },
    };
  }

  // 개별 환경 변수 사용
  const host = process.env.DB_HOST || "localhost";
  const isLocalHost = ["localhost", "127.0.0.1", "::1", "postgres"].includes(
    host,
  );
  const useSsl =
    process.env.DB_SSL_ENABLED === "true" ||
    (isProduction && !isLocalHost && process.env.DOCKERIZED !== "true");
  const ssl = useSsl
    ? {
        rejectUnauthorized,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
      }
    : undefined;

  return {
    ...baseConfig,
    host,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "blog-db",
    ...(ssl ? { ssl } : {}),
    extra: {
      max: parseInt(process.env.DB_POOL_SIZE || "5", 10),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "3000",
        10,
      ),
      ...(ssl ? { ssl } : {}),
    },
  };
};

/**
 * Migration CLI 전용 DataSource 인스턴스
 * TypeORM CLI가 직접 사용
 */
export const AppDataSource = new DataSource(createDataSourceOptions());
