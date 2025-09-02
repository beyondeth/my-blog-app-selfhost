import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateSafeFilename } from "./markdown.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function savePostToFile(
  title: string,
  body: string,
  tags?: string[]
): Promise<string | null> {
  /** Save markdown post to file in posts directory */
  try {
    // Create posts directory
    const postsDir = path.join(__dirname, "../../../posts");
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