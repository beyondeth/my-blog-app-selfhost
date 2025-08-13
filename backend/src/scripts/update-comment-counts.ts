import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  synchronize: false,
  logging: true,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function updateCommentCounts() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');
    
    // 모든 포스트의 댓글 수를 실제 댓글 개수로 업데이트
    const result = await AppDataSource.query(`
      UPDATE posts p
      SET "commentCount" = (
        SELECT COUNT(*)
        FROM comments c
        WHERE c."postId" = p.id
        AND c."isDeleted" = false
      )
    `);
    
    console.log('Comment counts updated');
    
    // 업데이트된 결과 확인
    const posts = await AppDataSource.query(`
      SELECT p.id, p.title, p."commentCount",
             (SELECT COUNT(*) FROM comments c WHERE c."postId" = p.id AND c."isDeleted" = false) as actual_count
      FROM posts p
      WHERE p."commentCount" > 0 OR EXISTS (SELECT 1 FROM comments c WHERE c."postId" = p.id AND c."isDeleted" = false)
      ORDER BY p."commentCount" DESC
    `);
    
    console.log('\nPosts with comments:');
    posts.forEach((post: any) => {
      console.log(`- ${post.title}: ${post.commentCount} comments`);
    });
    
    await AppDataSource.destroy();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateCommentCounts();