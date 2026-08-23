/**
 * 파일 시스템 유틸리티
 *
 * 로컬 파일 백업 기능
 */

import fs from "fs/promises";
import path from "path";

/**
 * 포스트를 로컬 .md 파일로 저장
 *
 * @param title - 포스트 제목
 * @param body - 포스트 본문 (마크다운)
 * @param tags - 태그 배열 (선택적)
 * @returns 저장된 파일 경로 (실패 시 null)
 *
 * 동작:
 * 1. BLOG_POSTS_DIR 환경변수 확인 (없으면 ~/Documents/aigory-mcp-posts/ 사용)
 * 2. 디렉토리 생성 (없으면)
 * 3. 파일명 생성: YYYYMMDD_safe-title.md
 * 4. Frontmatter + 본문 형식으로 저장
 * 5. 성공 시 파일 경로 반환, 실패 시 null 반환
 */
export async function savePostToFile(
  title: string,
  body: string,
  tags?: string[]
): Promise<string | null> {
  try {
    // os 모듈 동적 import (이미 top-level에 있으면 재사용)
    const os = await import('os');
    const { generateSafeFilename } = await import('./markdown.js');

    // 저장 디렉토리 결정 (환경변수 우선, 기본값: ~/Documents/aigory-mcp-posts)
    let postsDir: string;
    if (process.env['BLOG_POSTS_DIR']) {
      postsDir = process.env['BLOG_POSTS_DIR'];
    } else {
      postsDir = path.join(os.homedir(), 'Documents', 'aigory-mcp-posts');
    }

    // 디렉토리 생성 (이미 존재하면 무시)
    await fs.mkdir(postsDir, { recursive: true });

    // 날짜 문자열 생성: YYYYMMDD 형식
    const dateStr = new Date().toISOString().split('T')[0]?.replace(/-/g, '') || '';

    // 안전한 파일명 생성
    const safeTitle = generateSafeFilename(title);
    const filename = `${dateStr}_${safeTitle}.md`;
    const filePath = path.join(postsDir, filename);

    // Frontmatter + 본문 형식으로 콘텐츠 생성
    const fullContent = `---
title: "${title}"
tags: ${JSON.stringify(tags || [], null, 2)}
date: ${new Date().toISOString()}
---

${body}`;

    // 파일 저장
    await fs.writeFile(filePath, fullContent, 'utf-8');

    return filePath;
  } catch (error) {
    // 파일 저장 실패해도 포스트 생성은 성공으로 처리 (non-blocking)
    console.error('Failed to save post to file:', error);
    return null;
  }
}
