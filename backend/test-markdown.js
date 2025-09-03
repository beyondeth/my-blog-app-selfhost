const { MarkdownRendererService } = require('./dist/src/common/services/markdown-renderer.service');

const testMarkdown = `### 1. Backend 마크다운 렌더러 개선

\`\`\`typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/\`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\\\\`/g, '[[ESCAPED_BACKTICK]]')  // 임시 보호
.replace(/\`/g, '&#96;')                    // 일반 백틱만 이스케이프
.replace(/\\[\\[ESCAPED_BACKTICK\\]\\]/g, '\`'); // 복원
\`\`\`

위 코드는 이스케이프 충돌을 방지하는 로직입니다. 이제 코드 블록 직후에 불필요한 공백이 없어야 합니다.`;

const renderer = new MarkdownRendererService();
const html = renderer.convertToHtml(testMarkdown);

console.log('=== Generated HTML ===');
console.log(html);
console.log('=== END ===');