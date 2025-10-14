/**
 * Markdown 파싱 유틸리티
 *
 * Frontmatter 메타데이터 추출 및 본문 파싱
 */

export interface MarkdownMetadata {
  title: string;
  category?: string;
  tags: string[];
}

/**
 * Markdown 파일에서 Frontmatter 메타데이터와 본문을 추출
 *
 * Frontmatter 형식:
 * ---
 * title: "제목"
 * tags: [tag1, tag2]
 * category: "카테고리"
 * ---
 * 본문 내용...
 *
 * @param content - 전체 Markdown 문자열
 * @returns 메타데이터와 본문
 */
export function parseMarkdownMetadata(content: string): {
  metadata: MarkdownMetadata;
  body: string;
} {
  // 기본값 설정
  const metadata: MarkdownMetadata = {
    title: "Untitled",
    tags: [],
  };
  let body = content;

  // Frontmatter 파싱 (--- ... ---)
  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) {
      const front = parts[1]?.trim() || "";
      body = parts.slice(2).join("---").trim();

      // Frontmatter 각 줄 파싱
      for (const line of front.split("\n")) {
        if (line.includes(":")) {
          const colonIndex = line.indexOf(":");
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();

          if (key === "title") {
            // 따옴표 제거
            metadata.title = value.replace(/^["']|["']$/g, "");
          } else if (key === "category") {
            metadata.category = value.replace(/^["']|["']$/g, "");
          } else if (key === "tags") {
            // 배열 형식 파싱: [tag1, tag2] 또는 ["tag1", "tag2"]
            const cleanValue = value.replace(/^\[|\]$/g, "");
            metadata.tags = cleanValue
              .split(",")
              .map((t) => t.trim().replace(/^["']|["']$/g, ""))
              .filter((t) => t.length > 0);
          }
        }
      }
    }
  }

  // Title이 없으면 본문에서 H1 또는 H2 추출
  if (metadata.title === "Untitled") {
    // H1 우선 시도
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match && h1Match[1]) {
      metadata.title = h1Match[1].trim();
    } else {
      // H1이 없으면 H2 시도
      const h2Match = /^##\s+(.+)$/m.exec(body);
      if (h2Match && h2Match[1]) {
        metadata.title = h2Match[1].trim();
      }
    }
  }

  return { metadata, body };
}

/**
 * 제목에서 안전한 파일명 생성
 *
 * @param title - 원본 제목
 * @returns 안전한 파일명 (특수문자 제거, 길이 제한)
 */
export function generateSafeFilename(title: string): string {
  // 특수문자를 언더스코어로 치환
  let safeTitle = title.replace(/[\\/:*?"<>|\s]+/g, "_");
  // 연속된 언더스코어 하나로 축약
  safeTitle = safeTitle.replace(/_+/g, "_");
  // 앞뒤 언더스코어 제거
  safeTitle = safeTitle.replace(/^_+|_+$/g, "");
  // 길이 제한 (50자)
  if (safeTitle.length > 50) {
    safeTitle = safeTitle.substring(0, 50);
  }
  return safeTitle;
}
