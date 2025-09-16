export interface MarkdownMetadata {
  title: string;
  category: string;
  tags: string[];
}

export function parseMarkdownMetadata(content: string): {
  metadata: MarkdownMetadata;
  body: string;
} {
  /** Parse markdown and extract metadata from front matter */
  const metadata: MarkdownMetadata = {
    title: "Untitled",
    category: "general",
    tags: [],
  };
  let body = content;

  // Parse front matter
  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) {
      const front = parts[1]?.trim() || "";
      body = parts.slice(2).join("---").trim();

      for (const line of front.split("\n")) {
        if (line.includes(":")) {
          const colonIndex = line.indexOf(":");
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();

          if (key === "title") {
            metadata.title = value.replace(/^["']|["']$/g, "");
          } else if (key === "category") {
            metadata.category = value.replace(/^["']|["']$/g, "");
          } else if (key === "tags") {
            // Parse tags: [tag1, tag2] format
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

  // If no title, extract from first h1 or h2
  if (metadata.title === "Untitled") {
    // Try h1 first
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match && h1Match[1]) {
      metadata.title = h1Match[1];
    } else {
      // If no h1, try h2
      const h2Match = /^##\s+(.+)$/m.exec(body);
      if (h2Match && h2Match[1]) {
        metadata.title = h2Match[1];
      }
    }
  }

  return { metadata, body };
}

export function generateSafeFilename(title: string): string {
  /** Generate a safe filename from title */
  // Replace special characters with underscore
  let safeTitle = title.replace(/[\\/:*?"<>|\s]+/g, "_");
  // Remove consecutive underscores
  safeTitle = safeTitle.replace(/_+/g, "_");
  // Remove leading/trailing underscores
  safeTitle = safeTitle.replace(/^_+|_+$/g, "");
  // Limit length
  if (safeTitle.length > 50) {
    safeTitle = safeTitle.substring(0, 50);
  }
  return safeTitle;
}