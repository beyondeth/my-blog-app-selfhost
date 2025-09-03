const { MarkdownRendererService } = require('./dist/src/common/services/markdown-renderer.service');

const testMarkdown = `텍스트 앞

\`\`\`typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/\`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\\\\`/g, '[[ESCAPED_BACKTICK]]')
\`\`\`

텍스트 뒤`;

const renderer = new MarkdownRendererService();

// 코드 블록 처리 전
console.log('=== Original ===');
console.log(testMarkdown);

// Step 1: 코드 블록 매칭 테스트
const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/gm;
const matches = testMarkdown.match(codeBlockRegex);
console.log('\n=== Code Block Matches ===');
console.log(matches);

// HTML 변환
const html = renderer.convertToHtml(testMarkdown);
console.log('\n=== Final HTML ===');
console.log(html);

// HTML에서 문제 부분 찾기
if (html.includes('<p style="line-height: 1.6;">// 개선:')) {
  console.log('\n⚠️ ERROR: Code content is being treated as paragraph!');
}