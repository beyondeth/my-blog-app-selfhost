import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ORDERED_MIGRATIONS } from "../migrations/migration-manifest";
import { isInternalDatabaseUrl } from "./database-url.util";

export default registerAs("database", (): TypeOrmModuleOptions => {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  const getSslConfig = (enabled: boolean) =>
    enabled
      ? {
          rejectUnauthorized,
          ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
        }
      : undefined;

  const baseConfig: TypeOrmModuleOptions = {
    type: "postgres",
    entities: [__dirname + "/../**/*.entity{.ts,.js}"],
    // Schema changes must always go through reviewed TypeORM migrations.
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    migrations: ORDERED_MIGRATIONS,
    migrationsRun: false,
    // 추가 TypeORM 옵션
    maxQueryExecutionTime: 1000, // 1초 이상 걸리는 쿼리 로깅
    dropSchema: false, // 절대 스키마를 드롭하지 않음
    cache: {
      type: "database",
      duration: parseInt(process.env.DB_CACHE_DURATION || "30000"), // 데이터베이스 캐시 지속 시간 (환경변수 또는 기본 30초)
    },
  };

  // DB_URL이 있는 경우 (AWS RDS 등)
  if (dbUrl) {
    // 로컬 데이터베이스인 경우 SSL 비활성화
    const isLocal = isInternalDatabaseUrl(dbUrl);
    const sslEnabled =
      process.env.DB_SSL_ENABLED === "true" ||
      (process.env.DB_SSL_ENABLED === undefined && !isLocal);
    const ssl = getSslConfig(sslEnabled);

    return {
      ...baseConfig,
      url: dbUrl,
      ...(ssl ? { ssl } : {}),
      extra: {
        // Connection Pool 설정
        max: parseInt(process.env.DB_POOL_SIZE || "100", 10), // 동시 요청 처리를 위해 증가
        connectionTimeoutMillis: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || "3000",
          10,
        ), // 데이터베이스 연결 타임아웃
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
        allowExitOnIdle: true,
        // PgBouncer rejects statement_timeout as a startup parameter. Its
        // server-side QUERY_TIMEOUT handles the same production limit.
        ...(!isLocal
          ? {
              statement_timeout: parseInt(
                process.env.DB_STATEMENT_TIMEOUT || "30000",
                10,
              ),
            }
          : {}),
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000", 10),
        ...(ssl ? { ssl } : {}),
      },
    };
  }

  // 개별 환경 변수 사용 (로컬 개발)
  const host = process.env.DB_HOST || "localhost";
  const isLocalHost = [
    "localhost",
    "127.0.0.1",
    "::1",
    "postgres",
    "pgbouncer",
  ].includes(host);
  const ssl = getSslConfig(
    process.env.DB_SSL_ENABLED === "true" ||
      (isProduction && !isLocalHost && process.env.DOCKERIZED !== "true"),
  );

  return {
    ...baseConfig,
    host,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "blog-db",
    ...(ssl ? { ssl } : {}),
    extra: {
      // Connection Pool 설정
      max: parseInt(process.env.DB_POOL_SIZE || "20", 10),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "3000",
        10,
      ),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
      allowExitOnIdle: true,
      ...(!isLocalHost
        ? {
            statement_timeout: parseInt(
              process.env.DB_STATEMENT_TIMEOUT || "30000",
              10,
            ),
          }
        : {}),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || "30000", 10),
      ...(ssl ? { ssl } : {}),
    },
  };
});
