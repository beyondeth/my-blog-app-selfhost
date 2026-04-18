import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { BlogsService } from "../blogs/blogs.service";
import { KnowledgeRebuildService } from "../knowledge/services/knowledge-rebuild.service";

function parseArgValue(rawArgs: string[], key: string) {
  const hit = rawArgs.find((value) => value.startsWith(`--${key}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

function parseArgs(rawArgs: string[]) {
  return {
    blog: (parseArgValue(rawArgs, "blog") ?? parseArgValue(rawArgs, "slug") ?? "")
      .replace(/^@/, "")
      .trim(),
  };
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  let exitCode = 0;

  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.blog) {
      throw new Error("`--blog=@alias` 또는 `--slug=slug` 값을 지정해야 합니다.");
    }

    const blogsService = app.get(BlogsService);
    const knowledgeRebuildService = app.get(KnowledgeRebuildService);

    const blog = await blogsService.findBySlugOrAliasMinimal(options.blog);
    if (!blog) {
      throw new Error(`블로그를 찾지 못했습니다: ${options.blog}`);
    }

    console.log("♻️ KB rebuild 시작...");
    console.log(` - blog: @${options.blog}`);
    console.log(` - blogId: ${blog.id}`);
    console.log(` - userId: ${blog.userId}`);

    const result = await knowledgeRebuildService.rebuildBlog(blog);

    console.log("\n📊 KB rebuild 결과");
    console.log(` - total blog posts: ${result.totalBlogPosts}`);
    console.log(` - published posts: ${result.publishedPosts}`);
    console.log(` - compiled posts: ${result.compiledPosts}`);
    console.log(` - failed posts: ${result.failedPosts}`);

    if (result.failures.length > 0) {
      console.log("\n⚠️ 실패 목록");
      for (const failure of result.failures.slice(0, 10)) {
        console.log(` - ${failure.title} (${failure.postId}): ${failure.error}`);
      }
      if (result.failures.length > 10) {
        console.log(` - ... 추가 ${result.failures.length - 10}건`);
      }
      exitCode = 1;
    } else {
      console.log("\n✅ KB rebuild 완료");
    }
  } catch (error) {
    console.error("❌ KB rebuild 실패:", error);
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
