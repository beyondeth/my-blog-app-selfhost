const testMarkdown = `텍스트 앞

\`\`\`typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/\`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\\\\`/g, '[[ESCAPED_BACKTICK]]')
\`\`\`

텍스트 뒤`;

// Step 1: Test code block regex
const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/gm;
const matches = [...testMarkdown.matchAll(codeBlockRegex)];

console.log('=== Code Block Detection ===');
console.log('Found matches:', matches.length);
if (matches.length > 0) {
  console.log('Language:', matches[0][1]);
  console.log('Code content:');
  console.log(matches[0][2]);
}

// Step 2: Simulate protection
let processed = testMarkdown;
let blockIndex = 0;
processed = processed.replace(codeBlockRegex, (match, lang, code) => {
  console.log('\n=== Processing Code Block ===');
  console.log('Block index:', blockIndex);
  console.log('Language:', lang);
  console.log('Code (first 100 chars):', code.substring(0, 100));
  const placeholder = `[[CODEBLOCK${blockIndex}]]`;
  blockIndex++;
  return placeholder;
});

console.log('\n=== After Code Block Protection ===');
console.log(processed);

// Step 3: Check paragraph split
const paragraphs = processed.split('\n\n');
console.log('\n=== Paragraph Split ===');
paragraphs.forEach((p, i) => {
  console.log(`Paragraph ${i}: "${p.trim()}"`);
});