import { promises as fs } from 'fs';
import path from 'path';

export interface WritingStyleMetadata {
  styleName: string;
  language: string;
  minLength: number;
  targetLength: string;
  codeBlockRatio: number;
  aiTagRequired: boolean;
  autoEnhance: boolean;
}

export interface WritingStyle {
  metadata: WritingStyleMetadata;
  instructions: string;
  createPostDescription: string;
  qualityGuidelinesPrompt: string;
  blogPostTemplatePrompt: string;
  improveMarkdownPrompt: string;
}

/**
 * Parse YAML front matter from markdown content
 */
function parseYamlFrontMatter(content: string): { metadata: any; body: string } {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!yamlMatch || !yamlMatch[1] || !yamlMatch[2]) {
    return { metadata: {}, body: content };
  }

  const yamlContent = yamlMatch[1];
  const body = yamlMatch[2];

  // Simple YAML parser for our specific use case
  const metadata: any = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      let value: any = match[2];

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Convert to appropriate type
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value))) value = Number(value);

      metadata[key] = value;
    }
  }

  return { metadata, body };
}

/**
 * Parse sections from markdown content based on section headers
 */
function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Split by section headers (=== SECTION NAME ===)
  const sectionRegex = /^# === (.+?) ===$/gm;
  const matches = [...content.matchAll(sectionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match || !match[1] || match.index === undefined) continue;

    const sectionName = match[1];
    const startIndex = match.index + match[0].length;
    const endIndex = i < matches.length - 1 ?
      (matches[i + 1]?.index ?? content.length) :
      content.length;

    const sectionContent = content.slice(startIndex, endIndex).trim();

    // Remove the comment line and extract actual content
    const lines = sectionContent.split('\n');
    const contentLines = lines.filter(line =>
      !line.startsWith('#') ||
      (!line.includes('This section becomes') && !line.includes('content'))
    );

    sections[sectionName] = contentLines.join('\n').trim();
  }

  return sections;
}

/**
 * Default fallback writing style (minimal emergency fallback only)
 */
function getDefaultWritingStyle(): WritingStyle {
  return {
    metadata: {
      styleName: "Emergency Fallback (default.md not found)",
      language: "korean",
      minLength: 2000,
      targetLength: "3000-5000",
      codeBlockRatio: 0.2,
      aiTagRequired: true,
      autoEnhance: true,
    },
    instructions: "MCP Blog Server - Fallback Mode. Please ensure default.md exists.",
    createPostDescription: "Create a blog post (fallback mode - default.md missing)",
    qualityGuidelinesPrompt: "Write quality content following best practices",
    blogPostTemplatePrompt: "Use standard blog structure with introduction, body, and conclusion",
    improveMarkdownPrompt: "Improve markdown content for better readability",
  };
}

/**
 * Load writing style from markdown file
 */
export async function loadWritingStyle(filePath?: string): Promise<WritingStyle> {
  try {
    // Determine file path
    const styleFile = filePath || process.env['WRITING_STYLE_FILE'] || 'writing-styles/default.md';
    const fullPath = path.resolve(styleFile);

    console.error(`📝 Loading writing style from: ${fullPath}`);

    // Read file
    const fileContent = await fs.readFile(fullPath, 'utf-8');

    // Parse YAML front matter
    const { metadata, body } = parseYamlFrontMatter(fileContent);

    // Parse sections
    const sections = parseSections(body);

    // Build WritingStyle object
    const writingStyle: WritingStyle = {
      metadata: {
        styleName: metadata.style_name || "Unknown Style",
        language: metadata.language || "korean",
        minLength: metadata.min_length || 2000,
        targetLength: metadata.target_length || "3000-5000",
        codeBlockRatio: metadata.code_block_ratio || 0.2,
        aiTagRequired: metadata.ai_tag_required !== false,
        autoEnhance: metadata.auto_enhance !== false,
      },
      instructions: sections['MCP SERVER INSTRUCTIONS'] || '',
      createPostDescription: sections['CREATE_POST TOOL DESCRIPTION'] || '',
      qualityGuidelinesPrompt: sections['QUALITY GUIDELINES PROMPT'] || '',
      blogPostTemplatePrompt: sections['BLOG POST TEMPLATE PROMPT'] || '',
      improveMarkdownPrompt: sections['IMPROVE MARKDOWN PROMPT'] || '',
    };

    console.error(`✅ Writing style loaded: ${writingStyle.metadata.styleName}`);
    return writingStyle;

  } catch (error) {
    console.error(`⚠️ Failed to load writing style: ${error instanceof Error ? error.message : String(error)}`);
    console.error('📝 Using default fallback writing style');
    return getDefaultWritingStyle();
  }
}