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

  // Simple YAML parser
  const metadata: any = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      let value: any = match[2];

      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Convert types
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value))) value = Number(value);

      metadata[key] = value;
    }
  }

  return { metadata, body };
}

/**
 * Parse sections from markdown content
 */
function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
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

    // Remove comment lines
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
 * Default fallback writing style
 */
function getDefaultWritingStyle(): WritingStyle {
  return {
    metadata: {
      styleName: "⚠️ Fallback Mode (스타일 파일 없음)",
      language: "korean",
      minLength: 2000,
      targetLength: "3000-5000",
      codeBlockRatio: 0.2,
      aiTagRequired: true,
      autoEnhance: true,
    },
    instructions: `
⚠️ FALLBACK MODE
스타일 파일을 찾을 수 없습니다.
.env에 WRITING_STYLE 설정을 확인하세요.

기본 규칙:
- AI 태그 필수 (ai:claude/chatgpt/gemini)
- 한국어 작성 (요청 시 영어)
- 2000자 이상
`,
    createPostDescription: "⚠️ Fallback: 블로그 포스트 생성 (제한된 기능)",
    qualityGuidelinesPrompt: "Write quality content (Fallback mode)",
    blogPostTemplatePrompt: "Basic blog post template (Fallback mode)",
    improveMarkdownPrompt: "Improve your markdown content (Fallback mode)",
  };
}

/**
 * Load writing style from markdown file
 * Reads WRITING_STYLE env var (e.g., "default") and loads writing-styles/{style}.md
 */
export async function loadWritingStyle(): Promise<WritingStyle> {
  try {
    // Get style from env (just the name, e.g., "default")
    const styleName = process.env['WRITING_STYLE'] || 'default';
    const styleFile = `writing-styles/${styleName}.md`;

    // Resolve path relative to package root
    // __dirname = dist/lib, so we need to go up two levels
    const packageRoot = path.join(__dirname, '..', '..');
    const fullPath = path.resolve(packageRoot, styleFile);

    console.error(`📝 Loading style: ${styleName} from ${fullPath}`);

    // Read and parse file
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const { metadata, body } = parseYamlFrontMatter(fileContent);
    const sections = parseSections(body);

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

    console.error(`✅ Style loaded: ${writingStyle.metadata.styleName}`);
    return writingStyle;

  } catch (error) {
    console.error(`⚠️ Failed to load style: ${error instanceof Error ? error.message : String(error)}`);
    console.error('📝 Using fallback style');
    return getDefaultWritingStyle();
  }
}
