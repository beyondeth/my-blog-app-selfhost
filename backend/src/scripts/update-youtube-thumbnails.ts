import { DataSource } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { parse } from 'url';

dotenv.config();

async function updateYouTubeThumbnails() {
  // Parse DATABASE_URL or DB_URL
  const dbUrl = process.env.DATABASE_URL || process.env.DB_URL;
  
  let dbConfig: any = {};
  
  if (dbUrl) {
    const parsedUrl = parse(dbUrl);
    const [username, password] = (parsedUrl.auth || '').split(':');
    const database = (parsedUrl.pathname || '/').slice(1);
    
    dbConfig = {
      type: 'postgres',
      host: parsedUrl.hostname || 'localhost',
      port: parseInt(parsedUrl.port || '5432'),
      username: username || 'postgres',
      password: password || 'postgres',
      database: database || 'myblog',
      entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
      synchronize: false,
      ssl: {
        rejectUnauthorized: false
      }
    };
  } else {
    dbConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'myblog',
      entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
      synchronize: false,
    };
  }
  
  const dataSource = new DataSource(dbConfig);

  try {
    await dataSource.initialize();
    console.log('Database connected');

    const postRepository = dataSource.getRepository(Post);
    
    // Find all posts with no thumbnail
    const posts = await postRepository.find({
      where: { thumbnail: null }
    });

    console.log(`Found ${posts.length} posts without thumbnails`);

    let updatedCount = 0;
    
    for (const post of posts) {
      if (!post.content) continue;
      
      // Check for YouTube iframe in content
      const youtubeRegex = /<iframe[^>]+class="youtube-video"[^>]+src="[^"]*\/embed\/([a-zA-Z0-9_-]+)/i;
      const youtubeMatch = post.content.match(youtubeRegex);
      
      if (youtubeMatch && youtubeMatch[1]) {
        const videoId = youtubeMatch[1];
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        // Update the post directly
        await postRepository.update(
          { id: post.id },
          { thumbnail: thumbnailUrl }
        );
        
        console.log(`Updated post ${post.id} (${post.title}) with YouTube thumbnail`);
        updatedCount++;
      } else {
        // Check for regular images if no YouTube content
        const imgRegex = /<img[^>]+src="([^">]+)"/i;
        const imgMatch = post.content.match(imgRegex);
        
        if (imgMatch && imgMatch[1]) {
          let imageUrl = imgMatch[1];
          
          // Convert S3 URLs to proxy URLs if needed
          if (imageUrl.includes('amazonaws.com') || imageUrl.startsWith('uploads/')) {
            let s3Key = imageUrl;
            if (imageUrl.includes('amazonaws.com')) {
              const urlParts = imageUrl.split('/');
              const uploadsIndex = urlParts.findIndex(part => part === 'uploads');
              if (uploadsIndex !== -1) {
                s3Key = urlParts.slice(uploadsIndex).join('/');
              }
            }
            imageUrl = `http://localhost:3001/api/v1/files/proxy/${s3Key}`;
          }
          
          await postRepository.update(
            { id: post.id },
            { thumbnail: imageUrl }
          );
          
          console.log(`Updated post ${post.id} (${post.title}) with image thumbnail`);
          updatedCount++;
        }
      }
    }

    console.log(`\nUpdate complete! Updated ${updatedCount} posts with thumbnails.`);
    
  } catch (error) {
    console.error('Error updating thumbnails:', error);
  } finally {
    await dataSource.destroy();
  }
}

// Run the script
updateYouTubeThumbnails().catch(console.error);