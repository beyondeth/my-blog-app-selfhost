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
 * 검증 챌린지 타입 정의
 */
export interface ValidationChallenge {
  question: string;
  answer: string;
}

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
  validationToken?: string;  // 검증 토큰 추가
  validationChallenges?: ValidationChallenge[];  // 검증 질문 추가
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
  private styleCache: Map<string, WritingStyle> = new Map();  // 스타일 캐시

  /**
   * Writing style 로드
   * 프리셋 파일명을 받아서 로드
   */
  async loadStyle(style: string): Promise<string> {
    if (!this.isPreset(style)) {
      throw new Error(`유효하지 않은 프리셋 스타일: ${style}. 사용 가능: ${this.PRESETS.join(', ')}`);
    }
    return await this.loadPresetStyle(style);
  }

  /**
   * 프리셋 스타일인지 확인
   */
  private isPreset(style: string): boolean {
    return this.PRESETS.includes(style.toLowerCase());
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

      // 4. WritingStyle 객체 생성 (토큰 및 챌린지 포함)
      const writingStyle: WritingStyle = {
        metadata: {
          styleName: metadata.style_name || 'Unknown Style',
          language: metadata.language || 'korean',
          minLength: metadata.min_length || 2000,
          targetLength: metadata.target_length || '3000-5000',
          codeBlockRatio: metadata.code_block_ratio || 0.2,
          aiTagRequired: metadata.ai_tag_required !== false,
          autoEnhance: metadata.auto_enhance !== false,
          validationToken: metadata.validation_token,  // 검증 토큰 파싱
          validationChallenges: metadata.validation_challenges,  // 검증 질문 파싱
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
   * 토큰으로 스타일 검증
   * 토큰이 유효한지 확인하고 해당 스타일 정보 반환
   */
  async validateToken(token: string): Promise<{ valid: boolean; style?: WritingStyle; styleName?: string }> {
    // 캐시된 스타일이 있는지 확인
    for (const [name, style] of this.styleCache.entries()) {
      if (style.metadata.validationToken === token) {
        return { valid: true, style, styleName: name };
      }
    }

    // 캐시에 없으면 모든 프리셋 스타일 로드하여 확인
    for (const preset of this.PRESETS) {
      try {
        const style = await this.loadAndParseStyle(preset);
        this.styleCache.set(preset, style);  // 캐시에 저장

        if (style.metadata.validationToken === token) {
          return { valid: true, style, styleName: preset };
        }
      } catch (error) {
        console.error(`[WritingStyle] Failed to load ${preset} for token validation:`, error);
      }
    }

    return { valid: false };
  }

  /**
   * 스타일에서 검증 토큰 가져오기
   * LLM이 스타일 파일을 읽고 토큰을 찾을 수 있도록 함
   */
  async getValidationToken(styleName: string): Promise<string | null> {
    try {
      const style = await this.loadAndParseStyle(styleName);
      return style.metadata.validationToken || null;
    } catch (error) {
      console.error(`[WritingStyle] Failed to get token for ${styleName}:`, error);
      return null;
    }
  }

  /**
   * 랜덤 검증 챌린지 가져오기
   * 동적 검증을 위해 스타일에서 랜덤 질문 선택
   */
  async getRandomChallenge(styleName: string): Promise<ValidationChallenge | null> {
    try {
      const style = await this.loadAndParseStyle(styleName);
      const challenges = style.metadata.validationChallenges;

      if (!challenges || challenges.length === 0) {
        return null;
      }

      // 랜덤하게 하나 선택
      const randomIndex = Math.floor(Math.random() * challenges.length);
      return challenges[randomIndex];
    } catch (error) {
      console.error(`[WritingStyle] Failed to get challenge for ${styleName}:`, error);
      return null;
    }
  }

  /**
   * 챌린지 답변 검증
   * 사용자 답변이 정답과 일치하는지 확인
   */
  async validateChallenge(
    styleName: string,
    question: string,
    userAnswer: string
  ): Promise<boolean> {
    try {
      const style = await this.loadAndParseStyle(styleName);
      const challenges = style.metadata.validationChallenges;

      if (!challenges) {
        return false;
      }

      // 질문에 해당하는 답변 찾기
      const challenge = challenges.find(c => c.question === question);
      if (!challenge) {
        return false;
      }

      // 대소문자 구분 없이 답변 비교
      return challenge.answer.toLowerCase() === userAnswer.toLowerCase();
    } catch (error) {
      console.error(`[WritingStyle] Failed to validate challenge:`, error);
      return false;
    }
  }

  /**
   * 특정 스타일의 모든 챌린지 가져오기
   * Phase 2에서 답변 검증에 사용
   */
  async getChallenges(styleName: string): Promise<ValidationChallenge[]> {
    try {
      const style = await this.loadAndParseStyle(styleName);
      return style.metadata.validationChallenges || [];
    } catch (error) {
      console.error(`[WritingStyle] Failed to get challenges for ${styleName}:`, error);
      return [];
    }
  }

  /**
   * 답변이 유효한지 검증 (모든 챌린지와 비교)
   * Phase 2: 어떤 질문의 답변이든 맞으면 통과
   */
  async validateAnswerForStyle(
    styleName: string,
    answer: string
  ): Promise<{ valid: boolean; matchedQuestion?: string }> {
    try {
      const challenges = await this.getChallenges(styleName);

      if (challenges.length === 0) {
        // 챌린지가 없으면 통과 (하위 호환성)
        return { valid: true };
      }

      // 답변 정규화: 소문자 변환 + 공백 제거
      const normalizedAnswer = answer.toLowerCase().trim();

      // 모든 챌린지와 비교하여 일치하는 것이 있는지 확인
      const match = challenges.find(c =>
        c.answer.toLowerCase().trim() === normalizedAnswer
      );

      return {
        valid: !!match,
        matchedQuestion: match?.question
      };
    } catch (error) {
      console.error(`[WritingStyle] Failed to validate answer for ${styleName}:`, error);
      return { valid: false };
    }
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
