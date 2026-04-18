import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";

import { AppModule } from "../app.module";
import { Post } from "../posts/entities/post.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { User } from "../users/entities/user.entity";
import { PostsService } from "../posts/posts.service";
import { convertLegacyMermaidMarkdownToDiagramBlocks } from "../common/utils/legacy-mermaid.util";

function parseArgValue(rawArgs: string[], key: string) {
  const hit = rawArgs.find((value) => value.startsWith(`--${key}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

function hasFlag(rawArgs: string[], key: string) {
  return rawArgs.includes(`--${key}`);
}

function parseArgs(rawArgs: string[]) {
  const limit = Number.parseInt(parseArgValue(rawArgs, "limit") || "100", 10);
  return {
    blog: (parseArgValue(rawArgs, "blog") ?? parseArgValue(rawArgs, "slug") ?? "")
      .replace(/^@/, "")
      .trim(),
    postSlug: (parseArgValue(rawArgs, "post") ?? "").trim(),
    dryRun: hasFlag(rawArgs, "dry-run"),
    includeDeleted: hasFlag(rawArgs, "include-deleted"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
  };
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  let exitCode = 0;

  try {
    const options = parseArgs(process.argv.slice(2));
    const dataSource = app.get(DataSource);
    const postsService = app.get(PostsService);
    const postRepo = dataSource.getRepository(Post);
    const userRepo = dataSource.getRepository(User);

    console.log("♻️ legacy Mermaid backfill 시작...");
    console.log(` - blog: ${options.blog ? `@${options.blog}` : "(all)"}`);
    console.log(` - post: ${options.postSlug || "(all)"}`);
    console.log(` - dryRun: ${options.dryRun}`);
    console.log(` - includeDeleted: ${options.includeDeleted}`);
    console.log(` - limit: ${options.limit}`);

    const query = postRepo
      .createQueryBuilder("post")
      .leftJoin(Blog, "blog", "blog.id = post.blogId")
      .where("post.content_markdown LIKE :pattern", {
        pattern: "%```mermaid%",
      })
      .take(options.limit)
      .orderBy("post.createdAt", "DESC");

    if (options.blog) {
      query.andWhere("(blog.slug = :blog OR blog.alias = :blog)", {
        blog: options.blog,
      });
    }

    if (options.postSlug) {
      query.andWhere("post.slug = :postSlug", {
        postSlug: options.postSlug,
      });
    }

    if (!options.includeDeleted) {
      query.andWhere("post.isDeleted = false");
    }

    const posts = await query.getMany();
    console.log(` - candidates: ${posts.length}`);

    const userCache = new Map<string, User>();
    let converted = 0;
    let skipped = 0;
    let unchanged = 0;

    for (const post of posts) {
      const conversion = convertLegacyMermaidMarkdownToDiagramBlocks(
        post.content_markdown || "",
      );

      if (conversion.convertedBlocks === 0) {
        unchanged += 1;
        console.log(`   ↷ unchanged ${post.slug}`);
        continue;
      }

      if (conversion.skippedBlocks > 0) {
        skipped += 1;
        console.log(
          `   ⚠️ skipped ${post.slug} (${conversion.skippedReasons.join(" | ")})`,
        );
        continue;
      }

      if (options.dryRun) {
        converted += 1;
        console.log(`   ✅ dry-run convert ${post.slug}`);
        continue;
      }

      let author = userCache.get(post.authorId);
      if (!author) {
        author = await userRepo.findOne({ where: { id: post.authorId } });
        if (!author) {
          skipped += 1;
          console.log(`   ⚠️ skipped ${post.slug} (author not found)`);
          continue;
        }
        userCache.set(post.authorId, author);
      }

      await postsService.update(
        post.id,
        { content_markdown: conversion.markdown },
        author,
      );
      converted += 1;
      console.log(`   ✅ converted ${post.slug}`);
    }

    console.log("\n📊 Mermaid backfill 결과");
    console.log(` - converted: ${converted}`);
    console.log(` - skipped: ${skipped}`);
    console.log(` - unchanged: ${unchanged}`);
    console.log(` - total: ${posts.length}`);

    if (skipped > 0) {
      exitCode = 1;
    }
  } catch (error) {
    console.error("❌ Mermaid backfill 실패:", error);
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
