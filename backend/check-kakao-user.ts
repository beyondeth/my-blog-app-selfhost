import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  synchronize: false,
  logging: true,
});

async function checkKakaoUser() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');
    
    const result = await AppDataSource.query(`
      SELECT id, email, username, "authProvider", "providerId", "isEmailVerified"
      FROM users 
      WHERE email LIKE '%kakao.com%' OR "authProvider" = 'kakao'
    `);
    
    console.log('Kakao users:', result);
    
    // 이메일 업데이트가 필요한 경우
    if (result.length > 0) {
      console.log('\n이메일을 업데이트하려면 다음 쿼리를 실행하세요:');
      console.log(`UPDATE users SET email = 'luticek@naver.com' WHERE id = '${result[0].id}';`);
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkKakaoUser();