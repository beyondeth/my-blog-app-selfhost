import { WritingStyleService } from '../../services/WritingStyleService.js';
import { logger } from '../../utils/logger.js';
import type { ToolContext } from '../types.js';

/**
 * get_writing_style_guide 핸들러
 */
export async function handleGetWritingStyleGuide(
  args: { style?: string; customMarkdown?: string; styleAlias?: string },
  context: ToolContext
): Promise<any> {
  const styleService = new WritingStyleService();
  let styleData;
  let resolvedStyleId = args.style || 'default';
  let resolvedStyleSource: 'preset' | 'custom' = 'preset';

  // 우선순위 1: 사용자 제공 커스텀 마크다운 (최우선)
  if (args.customMarkdown) {
    resolvedStyleId = args.styleAlias || 'custom';
    resolvedStyleSource = 'custom';
    logger.info(
      {
        userId: context.userData.userId.substring(0, 8),
        source: 'custom-markdown',
        styleAlias: resolvedStyleId,
      },
      '📖 Using user-provided custom markdown style'
    );
    styleData = await styleService.parseRawMarkdown(args.customMarkdown);
  } else {
    // 우선순위 2: 프리셋 스타일 (플래그 없으면 default)
    const style = args.style || 'default';
    logger.info(
      {
        style,
        userId: context.userData.userId.substring(0, 8),
        source: 'preset',
      },
      '📖 Writing style guide retrieved'
    );
    styleData = await styleService.loadAndParseStyle(style);
    resolvedStyleId = style;
  }

  const fullGuide = [
    `# ${styleData.metadata.styleName}`,
    '',
    `**Requirements:** ${styleData.metadata.minLength}+ chars (target: ${styleData.metadata.targetLength}) | Language: ${styleData.metadata.language} | AI tag: ${styleData.metadata.aiTagRequired ? 'required' : 'optional'}`,
    '',
    styleData.instructions,
  ].join('\n');

  return {
    content: [
      {
        type: 'text',
        text: fullGuide,
      },
    ],
    structuredContent: {
      resolvedStyleId,
      resolvedStyleSource,
      styleName: styleData.metadata.styleName,
      minLength: styleData.metadata.minLength,
      targetLength: styleData.metadata.targetLength,
      language: styleData.metadata.language,
      aiTagRequired: styleData.metadata.aiTagRequired,
      compactBrief: styleData.compactBrief,
    },
  };
}
