const testMarkdown = `\`\`\`typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/\`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\\\\`/g, '[[ESCAPED_BACKTICK]]')
\`\`\``;

console.log('Original:');
console.log(testMarkdown);
console.log('\n---\n');

// 정규식 테스트
const regex = /```([^\n]*)\n([\s\S]*?)```/gm;
const matches = testMarkdown.match(regex);
console.log('Regex match result:');
console.log(matches);

const result = testMarkdown.replace(regex, (match, lang, code) => {
  console.log('\nMatch found:');
  console.log('Language:', lang);
  console.log('Code:');
  console.log(code);
  console.log('---');
  return `[[CODEBLOCK]]`;
});

console.log('\nResult:');
console.log(result);