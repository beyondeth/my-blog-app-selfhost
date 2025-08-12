import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/blog-db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true, // CASCADE 설정을 위해 임시로 true
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: false,
  ssl: { rejectUnauthorized: false },
})); 