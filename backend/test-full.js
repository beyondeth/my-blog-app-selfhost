const testText = `텍스트 앞

[[CODEBLOCK0]]

텍스트 뒤`;

// 단락 처리
const paragraphs = testText.split('\n\n');
const formatted = [];

for (let para of paragraphs) {
  para = para.trim();
  if (para) {
    // 코드 블록 플레이스홀더인지 확인
    const isCodeBlock = /^\[\[CODEBLOCK\d+\]\]$/.test(para);
    
    console.log(`처리 중: "${para}"`);
    console.log(`코드 블록인가? ${isCodeBlock}`);
    
    if (!isCodeBlock && !/^</.test(para)) {
      para = `<p>${para}</p>`;
    }
    formatted.push(para);
  }
}

console.log('\n결과:');
console.log(formatted.join('\n'));

// 코드 블록 복원
let result = formatted.join('\n');
result = result.replace('[[CODEBLOCK0]]', '<pre><code>코드 내용</code></pre>');

console.log('\n복원 후:');
console.log(result);