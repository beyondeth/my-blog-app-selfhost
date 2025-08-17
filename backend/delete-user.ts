import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  synchronize: false,
  logging: true,
  ssl: {
    rejectUnauthorized: false, // AWS RDS용 SSL 설정
  },
});

async function deleteUser(userId: string) {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');
    
    // CASCADE 설정이 되어 있으므로 연관된 데이터도 자동 삭제됨
    const result = await AppDataSource.query(
      `DELETE FROM users WHERE id = $1 RETURNING email, username`,
      [userId]
    );
    
    if (result.length > 0) {
      console.log('✅ User deleted successfully:', result[0]);
      console.log('Related data (blogs, posts, comments, etc.) also deleted due to CASCADE');
    } else {
      console.log('❌ User not found with ID:', userId);
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

// 실행
const userId = '8eba0469-7338-47cb-8c31-fbd1e5d86697';
deleteUser(userId);