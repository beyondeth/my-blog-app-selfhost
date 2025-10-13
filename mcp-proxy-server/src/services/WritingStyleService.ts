/**
 * Writing Style Service
 *
 * Writing style을 로드하고 처리하는 서비스
 * - 프리셋 스타일 (writing-styles/*.md)
 * - URL에서 fetch
 * - 인라인 마크다운
 * - YAML front matter 파싱
 * - 섹션 파싱 (# === SECTION ===)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Writing Style Metadata (YAML front matter)
 */
export interface WritingStyleMetadata {
  styleName: string;
  language: string;
  minLength: number;
  targetLength: string;
  codeBlockRatio: number;
  aiTagRequired: boolean;
  autoEnhance: boolean;
}

/**
 * Parsed Writing Style (metadata + sections)
 */
export interface WritingStyle {
  metadata: WritingStyleMetadata;
  instructions: string;
  createPostDescription: string;
  qualityGuidelinesPrompt: string;
  blogPostTemplatePrompt: string;
  improveMarkdownPrompt: string;
}

export class WritingStyleService {
  private readonly PRESETS = ['novel', 'tutorial', 'comedy', 'podcast', 'default'];
  private readonly STYLES_DIR = path.join(__dirname, '../../writing-styles');

  /**
   * Writing style 로드
   * 자동으로 프리셋/URL/인라인을 판별하여 처리
   */
  async loadStyle(style: string): Promise<string> {
    // 1. 프리셋 이름인지 확인
    if (this.isPreset(style)) {
      return await this.loadPresetStyle(style);
    }

    // 2. URL인지 확인
    if (this.isUrl(style)) {
      return await this.loadStyleFromUrl(style);
    }

    // 3. 인라인 마크다운으로 간주
    return style;
  }

  /**
   * 프리셋 스타일인지 확인
   */
  private isPreset(style: string): boolean {
    return this.PRESETS.includes(style.toLowerCase());
  }

  /**
   * URL인지 확인
   */
  private isUrl(style: string): boolean {
    try {
      const url = new URL(style);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 프리셋 스타일 로드
   */
  private async loadPresetStyle(preset: string): Promise<string> {
    const filePath = path.join(this.STYLES_DIR, `${preset.toLowerCase()}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`✅ [WritingStyle] 프리셋 로드 성공: ${preset}`);
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`프리셋 스타일을 찾을 수 없습니다: ${preset}`);
      }
      throw new Error(`프리셋 스타일 로드 실패: ${error.message}`);
    }
  }

  /**
   * URL에서 스타일 로드
   */
  private async loadStyleFromUrl(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10초 타임아웃
        responseType: 'text',
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ [WritingStyle] URL 로드 성공: ${url}`);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('URL 로드 시간 초과 (10초)');
      }
      throw new Error(`URL에서 스타일 로드 실패: ${error.message}`);
    }
  }

  /**
   * 사용 가능한 프리셋 목록 조회
   */
  async getAvailablePresets(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.STYLES_DIR);
      const presets = files
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace('.md', ''));
      return presets;
    } catch (error: any) {
      console.error(`[WritingStyle] 프리셋 목록 조회 실패: ${error.message}`);
      return this.PRESETS; // 기본 프리셋 반환
    }
  }

  /**
   * 프리셋 유효성 검증
   */
  async validatePreset(preset: string): Promise<boolean> {
    if (!this.isPreset(preset)) {
      return false;
    }

    const filePath = path.join(this.STYLES_DIR, `${preset.toLowerCase()}.md`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Writing style 로드 및 파싱
   * 프리셋/URL/인라인 마크다운에서 YAML + 섹션 파싱
   */
  async loadAndParseStyle(style: string): Promise<WritingStyle> {
    try {
      // 1. 원본 마크다운 로드
      const rawContent = await this.loadStyle(style);

      // 2. YAML front matter 파싱
      const { metadata, body } = this.parseYamlFrontMatter(rawContent);

      // 3. 섹션 파싱
      const sections = this.parseSections(body);

      // 4. WritingStyle 객체 생성
      const writingStyle: WritingStyle = {
        metadata: {
          styleName: metadata.style_name || 'Unknown Style',
          language: metadata.language || 'korean',
          minLength: metadata.min_length || 2000,
          targetLength: metadata.target_length || '3000-5000',
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

      console.log(`✅ [WritingStyle] 파싱 완료: ${writingStyle.metadata.styleName}`);
      return writingStyle;
    } catch (error: any) {
      console.error(`⚠️ [WritingStyle] 파싱 실패: ${error.message}`);
      console.log('📝 [WritingStyle] Fallback 스타일 사용');
      return this.getDefaultWritingStyle();
    }
  }

  /**
   * YAML front matter 파싱 (private)
   * 마크다운 파일 상단의 ---로 감싸진 메타데이터 추출
   */
  private parseYamlFrontMatter(content: string): { metadata: any; body: string } {
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!yamlMatch || !yamlMatch[1] || !yamlMatch[2]) {
      return { metadata: {}, body: content };
    }

    const yamlContent = yamlMatch[1];
    const body = yamlMatch[2];

    // 간단한 YAML 파서 (key: value 형식)
    const metadata: any = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match && match[1] && match[2]) {
        const key = match[1];
        let value: any = match[2];

        // 따옴표 제거
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        // 타입 변환
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(Number(value))) value = Number(value);

        metadata[key] = value;
      }
    }

    return { metadata, body };
  }

  /**
   * 섹션 파싱 (private)
   * # === SECTION NAME === 형식으로 구분된 섹션 추출
   */
  private parseSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /^# === (.+?) ===$/gm;
    const matches = [...content.matchAll(sectionRegex)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (!match || !match[1] || match.index === undefined) continue;

      const sectionName = match[1];
      const startIndex = match.index + match[0].length;
      const endIndex =
        i < matches.length - 1 ? (matches[i + 1]?.index ?? content.length) : content.length;

      const sectionContent = content.slice(startIndex, endIndex).trim();

      // 주석 라인 제거 (설명용 주석 필터링)
      const lines = sectionContent.split('\n');
      const contentLines = lines.filter(
        (line) =>
          !line.startsWith('#') ||
          (!line.includes('This section becomes') && !line.includes('content'))
      );

      sections[sectionName] = contentLines.join('\n').trim();
    }

    return sections;
  }

  /**
   * 기본 Fallback 스타일 (private)
   * 파싱 실패 시 사용되는 기본 스타일
   */
  private getDefaultWritingStyle(): WritingStyle {
    return {
      metadata: {
        styleName: '⚠️ Fallback Mode (스타일 파일 없음)',
        language: 'korean',
        minLength: 2000,
        targetLength: '3000-5000',
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
      createPostDescription: '⚠️ Fallback: 블로그 포스트 생성 (제한된 기능)',
      qualityGuidelinesPrompt: 'Write quality content (Fallback mode)',
      blogPostTemplatePrompt: 'Basic blog post template (Fallback mode)',
      improveMarkdownPrompt: 'Improve your markdown content (Fallback mode)',
    };
  }
}
