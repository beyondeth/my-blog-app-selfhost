import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PostsService } from './src/posts/posts.service';
import { DataSource } from 'typeorm';
import { User } from './src/users/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const postsService = app.get(PostsService);
  const dataSource = app.get(DataSource);

  const userRepository = dataSource.getRepository(User);
  const user = await userRepository.findOne({ where: {} });

  if (!user) {
    console.log("No user found.");
    process.exit(0);
  }

  try {
    const post = await postsService.create({
      title: "Direct Internal Test " + Date.now(),
      content: "Testing TransactionEventBuffer directly",
      category: "test",
      tags: ["test"],
      isPublished: true, 
      content_markdown: "Testing TransactionEventBuffer directly"
    }, user, undefined);
    console.log("Post created internal trigger success", post.id);

    // wait for events
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch(e) {
    console.error(e);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
