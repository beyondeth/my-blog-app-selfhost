import fs from "fs/promises";
import path from "path";
import os from "os";
import { generateSafeFilename } from "./markdown.js";

export async function savePostToFile(
  title: string,
  body: string,
  tags?: string[]
): Promise<string | null> {
  /** Save markdown post to file in BLOG_POSTS_DIR directory */
  try {
    // 포스트 저장 디렉토리 결정 로직:
    // 1. 환경 변수 BLOG_POSTS_DIR이 설정된 경우 사용 (우선순위)
    // 2. 기본값: 사용자 홈 디렉토리의 Documents/codebase-mcp-posts
    let postsDir: string;

    if (process.env['BLOG_POSTS_DIR']) {
      // 사용자가 명시적으로 설정한 경로 사용
      postsDir = process.env['BLOG_POSTS_DIR'];
    } else {
      // 기본값: ~/Documents/codebase-mcp-posts
      postsDir = path.join(os.homedir(), 'Documents', 'codebase-mcp-posts');
    }

    // Create posts directory if it doesn't exist
    await fs.mkdir(postsDir, { recursive: true });

    // Generate filename: YYYYMMDD_title.md
    const dateStr = new Date().toISOString().split("T")[0]?.replace(/-/g, "") || "";
    const safeTitle = generateSafeFilename(title);
    const filename = `${dateStr}_${safeTitle}.md`;
    const filePath = path.join(postsDir, filename);

    // Create full content with front matter
    const fullContent = `---
title: "${title}"
tags: ${JSON.stringify(tags || [], null, 2)}
date: ${new Date().toISOString()}
---

${body}`;

    // Write file
    await fs.writeFile(filePath, fullContent, "utf-8");
    return filePath;
  } catch (error) {
    console.error("Failed to save post to file:", error);
    return null;
  }
}

export async function readPostFromFile(filePath: string): Promise<string | null> {
  /** Read post content from file */
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error);
    return null;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  /** Check if file exists */
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}