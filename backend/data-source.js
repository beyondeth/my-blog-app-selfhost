const { DataSource } = require('typeorm');
const { config } = require('dotenv');
const { join } = require('path');

// Load environment variables
config();

// Parse database URL
const dbUrl = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/blog_platform';
const url = new URL(dbUrl);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  username: url.username,
  password: url.password,
  database: url.pathname.substring(1),
  entities: [join(__dirname, 'src/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'src/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = { AppDataSource };