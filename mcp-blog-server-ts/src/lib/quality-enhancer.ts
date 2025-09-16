/**
 * Markdown Quality Enhancer
 * AI가 생성한 마크다운의 품질을 자동으로 개선하는 모듈
 */

export interface QualityMetrics {
  hasEmojis: boolean;
  hasBoldText: boolean;
  hasCodeBlocksWithLanguage: boolean;
  hasProperStructure: boolean;
  hasIntroduction: boolean;
  hasConclusion: boolean;
  hasSectionDividers: boolean;
  hasNaturalFlow: boolean;           // 자연스러운 흐름
  codeBlockRatio: number;             // 코드블록 비율 (퍼센트)
  hasPersonalTouch: boolean;          // 개인적 의견/경험
  hasConversationalTone: boolean;     // 대화체 사용
  score: number;
}

export interface EnhancementOptions {
  addEmojis: boolean;
  addBoldText: boolean;
  fixCodeBlocks: boolean;
  addSectionDividers: boolean;
  addConclusion: boolean;
  enforceStructure: boolean;
}

export class MarkdownQualityEnhancer {
  private readonly emojiMap: Record<string, string[]> = {
    // 기술 관련
    'react': ['⚛️', '🔵', '💙'],
    'vue': ['💚', '🟢', '🌿'],
    'javascript': ['🟨', '⚡', '🚀'],
    'typescript': ['🔷', '💙', '🔵'],
    'python': ['🐍', '🟡', '💛'],
    'api': ['🔌', '🌐', '📡'],
    'database': ['🗄️', '💾', '🗃️'],
    'security': ['🔒', '🛡️', '🔐'],
    'performance': ['⚡', '🚀', '📈'],
    'design': ['🎨', '✨', '🖌️'],
    'architecture': ['🏗️', '🏛️', '📐'],
    'testing': ['🧪', '✅', '🔍'],
    
    // 일반 섹션
    'introduction': ['📋', '🎯', '👋'],
    'introduction-ko': ['📋', '🎯', '👋'],
    '소개': ['📋', '🎯', '👋'],
    'overview': ['🔍', '📊', '🗺️'],
    '개요': ['🔍', '📊', '🗺️'],
    'installation': ['📦', '⚙️', '🔧'],
    '설치': ['📦', '⚙️', '🔧'],
    'usage': ['💡', '🔨', '📝'],
    '사용법': ['💡', '🔨', '📝'],
    'example': ['💻', '📌', '🎯'],
    '예제': ['💻', '📌', '🎯'],
    '예시': ['💻', '📌', '🎯'],
    'conclusion': ['🎯', '✨', '🎊'],
    '결론': ['🎯', '✨', '🎊'],
    'summary': ['📝', '📋', '✍️'],
    '요약': ['📝', '📋', '✍️'],
    'tips': ['💡', '✨', '🎯'],
    '팁': ['💡', '✨', '🎯'],
    'warning': ['⚠️', '🚨', '❗'],
    '주의': ['⚠️', '🚨', '❗'],
    'note': ['📌', '💡', 'ℹ️'],
    '참고': ['📌', '💡', 'ℹ️'],
    
    // 기본값
    'default': ['📋', '🔍', '💡', '🎯', '✨', '🚀', '⚡', '🔧']
  };

  /**
   * 마크다운 품질 평가
   */
  analyzeQuality(markdown: string): QualityMetrics {
    const metrics: QualityMetrics = {
      hasEmojis: this.checkEmojis(markdown),
      hasBoldText: this.checkBoldText(markdown),
      hasCodeBlocksWithLanguage: this.checkCodeBlocks(markdown),
      hasProperStructure: this.checkStructure(markdown),
      hasIntroduction: this.checkIntroduction(markdown),
      hasConclusion: this.checkConclusion(markdown),
      hasSectionDividers: this.checkSectionDividers(markdown),
      hasNaturalFlow: this.checkNaturalFlow(markdown),
      codeBlockRatio: this.checkCodeBlockRatio(markdown),
      hasPersonalTouch: this.checkPersonalTouch(markdown),
      hasConversationalTone: this.checkConversationalTone(markdown),
      score: 0
    };

    // 점수 계산 (100점 만점, 카테고리별 차등 가중치)
    let score = 0;

    // 🎯 핵심 품질 (50점)
    if (metrics.hasNaturalFlow) score += 18;           // 자연스러운 흐름
    if (metrics.hasPersonalTouch) score += 16;         // 개인적 터치
    if (metrics.hasConversationalTone) score += 16;    // 대화체 톤

    // 🏗️ 구조 (25점)
    if (metrics.hasProperStructure) score += 10;       // 적절한 구조
    if (metrics.hasIntroduction) score += 7;           // 도입부
    if (metrics.hasConclusion) score += 8;             // 결론부

    // 📖 가독성 (15점)
    if (metrics.codeBlockRatio <= 20) score += 15;     // 적절한 코드 비율

    // ✨ 부가 요소 (10점)
    if (metrics.hasEmojis) score += 2;                 // 이모지
    if (metrics.hasBoldText) score += 2;               // 굵은 텍스트
    if (metrics.hasCodeBlocksWithLanguage) score += 3; // 코드 언어 지정
    if (metrics.hasSectionDividers) score += 3;        // 섹션 구분선
    
    metrics.score = Math.round(score);
    return metrics;
  }

  /**
   * 마크다운 자동 개선
   */
  enhance(markdown: string, options?: Partial<EnhancementOptions>): string {
    const defaultOptions: EnhancementOptions = {
      addEmojis: true,
      addBoldText: true,
      fixCodeBlocks: true,
      addSectionDividers: true,
      addConclusion: true,
      enforceStructure: true
    };
    
    const opts = { ...defaultOptions, ...options };
    let enhanced = markdown;

    // 1. 제목에 이모지 추가
    if (opts.addEmojis && !this.checkEmojis(enhanced)) {
      enhanced = this.addEmojisToHeadings(enhanced);
    }

    // 2. 코드 블록 언어 수정
    if (opts.fixCodeBlocks && !this.checkCodeBlocks(enhanced)) {
      enhanced = this.fixCodeBlockLanguages(enhanced);
    }

    // 3. 중요 용어 강조
    if (opts.addBoldText && !this.checkBoldText(enhanced)) {
      enhanced = this.addBoldToKeyTerms(enhanced);
    }

    // 4. 섹션 구분선 추가
    if (opts.addSectionDividers && !this.checkSectionDividers(enhanced)) {
      enhanced = this.addSectionDividers(enhanced);
    }

    // 5. 결론 추가 (없는 경우)
    if (opts.addConclusion && !this.checkConclusion(enhanced)) {
      enhanced = this.addConclusion(enhanced);
    }

    // 6. 구조 개선
    if (opts.enforceStructure && !this.checkStructure(enhanced)) {
      enhanced = this.improveStructure(enhanced);
    }

    return enhanced;
  }

  private checkEmojis(markdown: string): boolean {
    // 이모지 유니코드 범위 체크
    return /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(markdown);
  }

  private checkBoldText(markdown: string): boolean {
    return /\*\*[^*]+\*\*/g.test(markdown);
  }

  private checkCodeBlocks(markdown: string): boolean {
    // 언어가 지정된 코드 블록 체크
    return /```\w+/g.test(markdown);
  }

  private checkStructure(markdown: string): boolean {
    // H2와 H3 제목이 있는지 체크
    const hasH2 = /^##\s+/m.test(markdown);
    const hasH3 = /^###\s+/m.test(markdown);
    return hasH2 && hasH3;
  }

  private checkIntroduction(markdown: string): boolean {
    return /소개|introduction|개요|overview|시작/i.test(markdown);
  }

  private checkConclusion(markdown: string): boolean {
    return /결론|conclusion|마무리|summary|요약|정리/i.test(markdown);
  }

  private checkSectionDividers(markdown: string): boolean {
    return /^---$/m.test(markdown);
  }

  private checkNaturalFlow(markdown: string): boolean {
    // 자연스러운 전환구 체크
    const transitions = [
      '그런데', '하지만', '예를 들어', '제 경험상', '개인적으로',
      '흥미롭게도', '사실', '놀랍게도', '재미있는 것은', '그래서',
      '이렇게', '그리고', '그렇다면', '여기서', '먼저'
    ];
    const transitionCount = transitions.filter(t => markdown.includes(t)).length;
    return transitionCount >= 3;  // 최소 3개 이상의 전환구 사용
  }

  private checkCodeBlockRatio(markdown: string): number {
    const totalLength = markdown.length;
    if (totalLength === 0) return 0;
    
    const codeBlockMatches = markdown.match(/```[\s\S]*?```/g) || [];
    const codeBlockLength = codeBlockMatches.join('').length;
    
    return Math.round((codeBlockLength / totalLength) * 100);
  }

  private checkPersonalTouch(markdown: string): boolean {
    // 개인적 의견이나 경험을 나타내는 표현 체크
    const personalExpressions = [
      '제 생각에는', '제 경험상', '저는', '제가', '우리는', '우리가',
      '개인적으로', '저의 경우', '제 의견으로는', '경험해보니',
      '느꼈습니다', '생각합니다', '보입니다', '같습니다'
    ];
    const personalCount = personalExpressions.filter(expr => markdown.includes(expr)).length;
    return personalCount >= 2;  // 최소 2개 이상의 개인적 표현
  }

  private checkConversationalTone(markdown: string): boolean {
    // 대화체와 질문형 표현 체크
    const conversationalPatterns = [
      /\?/g,  // 질문 표시
      /어떻게/g,
      /왜/g,
      /무엇/g,
      /~요[.!?\s]/g,  // 존댓말 종결어미
      /~죠[.!?\s]/g,
      /~네요[.!?\s]/g,
      /~는데요[.!?\s]/g
    ];
    
    let matchCount = 0;
    conversationalPatterns.forEach(pattern => {
      const matches = markdown.match(pattern);
      if (matches) matchCount += matches.length;
    });
    
    return matchCount >= 5;  // 최소 5개 이상의 대화체 표현
  }

  private addEmojisToHeadings(markdown: string): string {
    let enhanced = markdown;

    // H2 제목에 이모지 추가
    enhanced = enhanced.replace(/^##\s+([^#\n]+)$/gm, (match, title) => {
      const trimmedTitle = title.trim();
      if (this.hasEmoji(trimmedTitle)) return match;
      
      const emoji = this.selectEmoji(trimmedTitle);
      return `## ${emoji} ${trimmedTitle}`;
    });

    // H3 제목에 이모지 추가
    enhanced = enhanced.replace(/^###\s+([^#\n]+)$/gm, (match, title) => {
      const trimmedTitle = title.trim();
      if (this.hasEmoji(trimmedTitle)) return match;
      
      const emoji = this.selectEmoji(trimmedTitle);
      return `### ${emoji} ${trimmedTitle}`;
    });

    return enhanced;
  }

  private hasEmoji(text: string): boolean {
    return /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(text);
  }

  private selectEmoji(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    // 키워드 매칭
    for (const [keyword, emojis] of Object.entries(this.emojiMap)) {
      if (lowerTitle.includes(keyword) && emojis && emojis.length > 0) {
        const selectedEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        if (selectedEmoji) return selectedEmoji;
      }
    }
    
    // 기본 이모지
    const defaultEmojis = this.emojiMap['default'];
    if (defaultEmojis && defaultEmojis.length > 0) {
      const selectedEmoji = defaultEmojis[Math.floor(Math.random() * defaultEmojis.length)];
      if (selectedEmoji) return selectedEmoji;
    }
    
    // 최후의 기본값
    return '📋';
  }

  private fixCodeBlockLanguages(markdown: string): string {
    let enhanced = markdown;
    
    // 언어가 지정되지 않은 코드 블록 찾기
    enhanced = enhanced.replace(/^```\s*\n([\s\S]*?)\n```$/gm, (_match, code) => {
      // 코드 내용으로 언어 추측
      const language = this.detectLanguage(code);
      // 백틱 대신 물결표 사용하는 경우도 처리
      return `\`\`\`${language}\n${code}\n\`\`\``;
    });
    
    // 물결표(~~~) 코드 블록도 백틱으로 통일
    enhanced = enhanced.replace(/^~~~(\w*)\n([\s\S]*?)\n~~~$/gm, (_match, lang, code) => {
      const language = lang || this.detectLanguage(code);
      return `\`\`\`${language}\n${code}\n\`\`\``;
    });
    
    return enhanced;
  }

  private detectLanguage(code: string): string {
    // 간단한 언어 감지 로직
    if (code.includes('import React') || code.includes('useState') || code.includes('useEffect')) {
      return 'javascript';
    }
    if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
      return 'typescript';
    }
    if (code.includes('def ') || code.includes('import numpy') || code.includes('print(')) {
      return 'python';
    }
    if (code.includes('SELECT') || code.includes('FROM') || code.includes('WHERE')) {
      return 'sql';
    }
    if (code.includes('<!DOCTYPE') || code.includes('<html>') || code.includes('<div>')) {
      return 'html';
    }
    if (code.includes('{') && code.includes('}') && code.includes(';')) {
      return 'javascript';
    }
    
    return 'javascript'; // 기본값
  }

  private addBoldToKeyTerms(markdown: string): string {
    // 중요 용어 목록
    const keyTerms = [
      'important', 'critical', 'essential', 'key point', 'note',
      '중요', '핵심', '필수', '주의', '참고', '요점'
    ];
    
    let enhanced = markdown;
    
    // 각 용어를 찾아서 굵게 표시 (이미 굵게 표시되지 않은 경우)
    keyTerms.forEach(term => {
      const regex = new RegExp(`(?<!\\\*\\\*)\\b(${term})\\b(?!\\\*\\\*)`, 'gi');
      enhanced = enhanced.replace(regex, '**$1**');
    });
    
    return enhanced;
  }

  private addSectionDividers(markdown: string): string {
    // H2 제목 앞에 구분선 추가 (첫 번째 H2 제외)
    let enhanced = markdown;
    let firstH2Found = false;
    
    enhanced = enhanced.split('\n').map(line => {
      if (/^##\s+/.test(line)) {
        if (!firstH2Found) {
          firstH2Found = true;
          return line;
        } else {
          // 이전 줄이 이미 구분선이 아닌 경우에만 추가
          return `\n---\n\n${line}`;
        }
      }
      return line;
    }).join('\n');
    
    // 중복 구분선 제거
    enhanced = enhanced.replace(/(\n---\n){2,}/g, '\n---\n');
    
    return enhanced;
  }

  private addConclusion(markdown: string): string {
    // 이미 결론이 있는지 체크
    if (this.checkConclusion(markdown)) {
      return markdown;
    }
    
    // 결론 섹션 추가
    const conclusion = `

---

## 🎯 결론

이 포스트가 도움이 되셨기를 바랍니다. 추가적인 질문이나 의견이 있으시다면 댓글로 알려주세요!

더 많은 유용한 콘텐츠를 위해 블로그를 구독해주시면 감사하겠습니다. 😊`;
    
    return markdown + conclusion;
  }

  private improveStructure(markdown: string): string {
    // 구조 개선: 제목 레벨 정리
    let enhanced = markdown;
    
    // H1이 있으면 H2로 변경 (블로그 포스트는 보통 H2부터 시작)
    enhanced = enhanced.replace(/^#\s+/gm, '## ');
    
    // 너무 깊은 제목 레벨 조정 (H5, H6 -> H4)
    enhanced = enhanced.replace(/^#{5,}\s+/gm, '#### ');
    
    return enhanced;
  }

  /**
   * 품질 리포트 생성
   */
  generateReport(markdown: string): string {
    const metrics = this.analyzeQuality(markdown);
    
    let report = '### 📊 마크다운 품질 분석 리포트\n\n';
    report += `**전체 점수**: ${metrics.score}/100\n\n`;
    report += '**세부 항목**:\n';
    report += `- 이모지 사용: ${metrics.hasEmojis ? '✅' : '❌'}\n`;
    report += `- 굵은 텍스트: ${metrics.hasBoldText ? '✅' : '❌'}\n`;
    report += `- 코드 블록 언어 지정: ${metrics.hasCodeBlocksWithLanguage ? '✅' : '❌'}\n`;
    report += `- 적절한 구조: ${metrics.hasProperStructure ? '✅' : '❌'}\n`;
    report += `- 도입부: ${metrics.hasIntroduction ? '✅' : '❌'}\n`;
    report += `- 결론: ${metrics.hasConclusion ? '✅' : '❌'}\n`;
    report += `- 섹션 구분선: ${metrics.hasSectionDividers ? '✅' : '❌'}\n`;
    report += `- 자연스러운 흐름: ${metrics.hasNaturalFlow ? '✅' : '❌'}\n`;
    report += `- 코드블록 비율: ${metrics.codeBlockRatio}% ${metrics.codeBlockRatio <= 20 ? '✅' : '❌ (20% 이하 권장)'}\n`;
    report += `- 개인적 의견/경험: ${metrics.hasPersonalTouch ? '✅' : '❌'}\n`;
    report += `- 대화체 사용: ${metrics.hasConversationalTone ? '✅' : '❌'}\n`;
    
    if (metrics.score < 70) {
      report += '\n**권장사항**: 자동 개선 기능을 사용하여 품질을 향상시킬 수 있습니다.';
    }
    
    if (metrics.codeBlockRatio > 20) {
      report += '\n⚠️ **주의**: 코드블록 비율이 너무 높습니다. 설명 위주로 변경해주세요.';
    }
    
    return report;
  }
}

// Export singleton instance
export const qualityEnhancer = new MarkdownQualityEnhancer();