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

console.log('=== Original Markdown ===');
console.log(testMarkdown);
console.log('\n=== Generated HTML ===');
const html = renderer.convertToHtml(testMarkdown);
console.log(html);

// Check for errors
console.log('\n=== Error Check ===');
if (html.includes('<p style="line-height: 1.6;">// 개선:')) {
  console.log('❌ ERROR: Code content is still being treated as paragraph!');
} else if (html.includes('<p style="line-height: 1.6;">.replace')) {
  console.log('❌ ERROR: Code content is still being treated as paragraph!');
} else {
  console.log('✅ SUCCESS: Code block is properly protected!');
}

// Check structure
console.log('\n=== Structure Check ===');
if (html.includes('<pre style=') && html.includes('</pre>')) {
  console.log('✅ Code block structure intact');
} else {
  console.log('❌ Code block structure broken');
}