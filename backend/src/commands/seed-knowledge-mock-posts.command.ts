import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { BlogsService } from "../blogs/blogs.service";
import { PostsService } from "../posts/posts.service";
import { UsersService } from "../users/users.service";
import { buildKnowledgeMockPosts, parseSeedArgs } from "./knowledge-mock-posts.generator";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  let exitCode = 0;

  try {
    const options = parseSeedArgs(process.argv.slice(2));
    const blogAlias = options.blog;
    const count = options.count;
    const prefix = options.prefix;
    const dryRun = options.dryRun;

    console.log("🌱 knowledge mock seed 시작...");
    console.log(` - blog: @${blogAlias}`);
    console.log(` - count: ${count}`);
    console.log(` - prefix: ${prefix}`);
    console.log(` - dryRun: ${dryRun}`);

    const blogsService = app.get(BlogsService);
    const usersService = app.get(UsersService);
    const postsService = app.get(PostsService);

    const target = await blogsService.findBySlugOrAliasMinimal(blogAlias);
    if (!target) {
      throw new Error(`블로그를 찾지 못했습니다: ${blogAlias}`);
    }

    const author = await usersService.findById(target.userId);
    if (!author) {
      throw new Error(`블로그 소유자를 찾지 못했습니다: ${blogAlias}`);
    }

    const posts = buildKnowledgeMockPosts({
      count,
      blogAlias,
      prefix,
    });

    console.log(` - candidate posts: ${posts.length}`);

    if (dryRun) {
      for (const [index, post] of posts.slice(0, 3).entries()) {
        console.log(`[dry-run] ${index + 1}. ${post.title} / ${post.category}`);
      }
      return;
    }

    let success = 0;
    const failures: Array<{ index: number; title: string; reason: string }> = [];

    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      try {
        await postsService.create(post, author);
        success += 1;
        if ((i + 1) % 25 === 0 || i === posts.length - 1) {
          console.log(`   ✅ ${i + 1}/${posts.length} 완료`);
        }
      } catch (error) {
        failures.push({
          index: i + 1,
          title: post.title,
          reason: String(error?.message || error),
        });
      }
    }

    console.log(`\n📊 결과: ${success} / ${posts.length} 생성 성공`);
    if (failures.length > 0) {
      console.log(`⚠️  실패: ${failures.length}`);
      for (const fail of failures.slice(0, 5)) {
        console.log(` - #${fail.index} ${fail.title}: ${fail.reason}`);
      }
      if (failures.length > 5) {
        console.log(` - ... 추가 ${failures.length - 5}건`);
      }
    }

    if (success !== posts.length) {
      exitCode = 1;
    }
  } catch (error) {
    console.error("❌ 시드 실행 실패:", error);
    exitCode = 1;
  } finally {
    try {
      await app.close();
    } finally {
      process.exit(exitCode);
    }
  }
}

void run();
