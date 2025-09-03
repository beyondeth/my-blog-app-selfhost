const testText = `텍스트 앞

\`\`\`typescript
// 이전: 모든 백틱을 무조건 이스케이프
.replace(/\`/g, '&#96;');

// 개선: 이미 이스케이프된 백틱 보호
.replace(/\\\\\`/g, '[[ESCAPED_BACKTICK]]')
\`\`\`

텍스트 뒤`;

// Step 1: 코드 블록을 플레이스홀더로 치환
let step1 = testText.replace(/```([^\n]*)\n([\s\S]*?)```/gm, (match, lang, code) => {
  console.log('코드 블록 찾음:', lang);
  return `[[CODEBLOCK0]]`;
});

console.log('Step 1 결과:');
console.log(step1);
console.log('\n---\n');

// Step 2: 단락 처리
const paragraphs = step1.split('\n\n');
console.log('단락 분리 결과:');
paragraphs.forEach((p, i) => {
  console.log(`단락 ${i}: "${p.trim()}"`);
});

// Step 3: 단락 처리 로직
const formatted = [];
for (let para of paragraphs) {
  para = para.trim();
  if (para) {
    if (!/^\[\[CODEBLOCK\d+\]\]$/.test(para) && !/^</.test(para)) {
      para = `<p>${para}</p>`;
    }
    formatted.push(para);
  }
}

console.log('\n최종 결과:');
console.log(formatted.join('\n'));