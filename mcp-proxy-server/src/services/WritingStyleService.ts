/**
 * Writing Style Service
 *
 * Writing style을 로드하고 처리하는 서비스
 * - 프리셋 스타일 (writing-styles/*.md)
 * - YAML front matter 파싱
 * - 섹션 파싱 (# === SECTION ===)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
  private readonly PRESETS = ['novel', 'tutorial', 'comedy', 'podcast', 'default', 'vibe', 'research', 'human', 'autonomy'];
  private readonly STYLES_DIR = path.join(__dirname, '../../writing-styles');
  private styleCache: Map<string, WritingStyle> = new Map();  // 스타일 캐시
  private commonInstructionsCache: string | null = null;  // 공통 지침 캐시

  /**
   * Writing style 로드
   * 프리셋 파일명을 받아서 로드
   *
   * @param style - 프리셋 스타일명 (이미 정규화된 값)
   */
  async loadStyle(style: string): Promise<string> {
    if (!this.isPreset(style)) {
      throw new Error(`유효하지 않은 프리셋 스타일: ${style}. 사용 가능: ${this.PRESETS.join(', ')}`);
    }
    return await this.loadPresetStyle(style);
  }

  /**
   * 프리셋 스타일인지 확인
   *
   * @param style - 스타일명 (undefined, "--default", "default" 등 모두 처리)
   * @returns 유효한 프리셋이면 true, 아니면 false
   */
  private isPreset(style?: string): boolean {
    // undefined나 빈 문자열은 default로 취급 (유효함)
    if (!style) return true;

    // "--default" 같은 플래그 형식도 처리
    const normalized = style.replace(/^--/, '').trim().toLowerCase();

    return this.PRESETS.includes(normalized);
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
   *
   * @param preset - 프리셋 스타일명 (--default, undefined 등도 처리)
   * @returns 프리셋이 유효하고 파일이 존재하면 true
   */
  async validatePreset(preset?: string): Promise<boolean> {
    if (!this.isPreset(preset)) {
      return false;
    }

    // 정규화 (loadAndParseStyle과 동일한 로직)
    const normalizedPreset = (preset || 'default')
      .replace(/^--/, '')
      .trim()
      .toLowerCase();

    const filePath = path.join(this.STYLES_DIR, `${normalizedPreset}.md`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 공통 지침 로드 (캐싱)
   * 모든 스타일에 공통으로 적용되는 기본 지침
   */
  private async loadCommonInstructions(): Promise<string> {
    if (this.commonInstructionsCache) {
      return this.commonInstructionsCache;
    }

    const commonPath = path.join(this.STYLES_DIR, '_common.md');

    try {
      const content = await fs.readFile(commonPath, 'utf-8');
      this.commonInstructionsCache = content;
      console.log(`✅ [WritingStyle] 공통 지침 로드 완료`);
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠️ [WritingStyle] _common.md 파일을 찾을 수 없습니다. 스타일별 파일만 사용합니다.`);
        return '';
      }
      throw error;
    }
  }

  /**
   * Writing style 로드 및 파싱
   * 프리셋/URL/인라인 마크다운에서 YAML + 섹션 파싱
   * 공통 지침(_common.md)과 스타일별 파일을 병합
   *
   * @param style - 스타일명 (--default, undefined, "" 등 모두 처리)
   * @returns 파싱된 WritingStyle 객체
   *
   * 지원 형식:
   * - undefined, null, "" → default
   * - "--default", "--novel" → default, novel
   * - "default", "novel" → default, novel
   */
  async loadAndParseStyle(style?: string): Promise<WritingStyle> {
    // ✅ 스타일 정규화: "--default" / undefined / "" → "default"
    const normalizedStyle = (style || 'default')
      .replace(/^--/, '')   // "--default" → "default"
      .trim()
      .toLowerCase();

    try {
      // 1. 공통 지침 로드 (캐싱됨)
      const commonContent = await this.loadCommonInstructions();

      // 2. 스타일별 마크다운 로드
      const styleContent = await this.loadStyle(normalizedStyle);

      // 3. YAML front matter 파싱 (스타일별 파일에서)
      const { metadata, body } = this.parseYamlFrontMatter(styleContent);

      // 4. 공통 섹션 파싱
      const commonSections = this.parseSections(commonContent);

      // 5. 스타일별 섹션 파싱
      const styleSections = this.parseSections(body);

      // 6. 섹션 병합 (스타일별 섹션이 우선, 없으면 공통 사용)
      const sections = { ...commonSections, ...styleSections };

      // 7. WritingStyle 객체 생성 (토큰 및 챌린지 포함)
      // 공통 + 스타일별 섹션을 병합하여 완전한 가이드 생성
      const writingStyle: WritingStyle = {
        metadata: {
          styleName: metadata.style_name || normalizedStyle,
          language: metadata.language || 'korean',
          minLength: metadata.min_length || 2000,
          targetLength: metadata.target_length || '3000-5000',
          codeBlockRatio: metadata.code_block_ratio || 0.2,
          aiTagRequired: metadata.ai_tag_required !== false,
        },
        // 공통 지침이 먼저, 스타일별 지침이 덮어씌움
        instructions: this.mergeInstructions(
          sections['COMMON INSTRUCTIONS'] || '',
          sections['STYLE OVERVIEW'] || '',
          sections['CORE WRITING PRINCIPLES'] || '',
          sections['CORE NARRATIVE PRINCIPLES'] || '',
          sections['CORE TUTORIAL PRINCIPLES'] || '',
          sections['CORE COMEDY PRINCIPLES'] || '',
          sections['CORE PODCAST PRINCIPLES'] || '',
          sections['CORE VIBE PRINCIPLES'] || '',
          sections['CORE PRINCIPLES (핵심 원칙)'] || ''  // human style
        ),
        createPostDescription: sections['WRITING GUIDELINES'] || '',
        qualityGuidelinesPrompt: sections['QUALITY ENHANCEMENT GUIDE'] || '',
        blogPostTemplatePrompt: sections['ENHANCEMENT TECHNIQUES'] || '',
        improveMarkdownPrompt: sections['QUALITY CHECKLIST'] || '',
      };

      console.log(`✅ [WritingStyle] 파싱 완료: ${writingStyle.metadata.styleName}`);
      return writingStyle;
    } catch (error: any) {
      console.error(`⚠️ [WritingStyle] ${normalizedStyle} 파싱 실패: ${error.message}`);

      // 무한 루프 방지: default 자체가 실패하면 에러 던지기
      if (normalizedStyle === 'default') {
        throw new Error(`default.md 로드 실패: ${error.message}`);
      }

      console.log('📝 [WritingStyle] Fallback으로 default.md 로드');
      return await this.loadAndParseStyle('default');
    }
  }

  /**
   * 사용자 제공 원본 마크다운 파싱 (커스텀 스타일용)
   * LLM이 대화에서 받은 사용자 커스텀 스타일을 파싱
   * YAML만 파싱하고 본문은 그대로 LLM에게 전달 (LLM이 알아서 해석)
   */
  async parseRawMarkdown(markdown: string): Promise<WritingStyle> {
    try {
      // YAML front matter 파싱 (있으면)
      const { metadata, body } = this.parseYamlFrontMatter(markdown);

      const writingStyle: WritingStyle = {
        metadata: {
          styleName: metadata.style_name || 'Custom Style',
          language: metadata.language || 'korean',
          minLength: metadata.min_length || 2000,
          targetLength: metadata.target_length || '3000-5000',
          codeBlockRatio: metadata.code_block_ratio || 0.2,
          aiTagRequired: metadata.ai_tag_required !== false,
        },
        // 사용자가 제공한 본문을 그대로 전달 (LLM이 알아서 해석)
        instructions: body.trim(),
        createPostDescription: '',
        qualityGuidelinesPrompt: '',
        blogPostTemplatePrompt: '',
        improveMarkdownPrompt: '',
      };

      console.log(`✅ [WritingStyle] 커스텀 마크다운 파싱 완료: ${writingStyle.metadata.styleName}`);
      return writingStyle;
    } catch (error: any) {
      console.error(`⚠️ [WritingStyle] 커스텀 마크다운 파싱 실패: ${error.message}`);
      console.log('📝 [WritingStyle] Fallback으로 default.md 로드');
      return await this.loadAndParseStyle('default');
    }
  }

  /**
   * 지침 병합 헬퍼
   * 공통 지침과 스타일별 지침을 하나로 합침
   */
  private mergeInstructions(...sections: string[]): string {
    return sections
      .filter(section => section && section.trim())
      .join('\n\n---\n\n');
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
}
