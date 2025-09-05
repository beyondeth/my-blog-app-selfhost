#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

// 마크다운 파일 경로
const mdFile = process.argv[2];

if (!mdFile) {
  console.error('❌ 사용법: node scripts/md-to-pdf.js <markdown-file-path>');
  process.exit(1);
}

if (!fs.existsSync(mdFile)) {
  console.error(`❌ 파일을 찾을 수 없습니다: ${mdFile}`);
  process.exit(1);
}

async function convertMdToPdf(mdFilePath) {
  try {
    console.log('📖 마크다운 파일 읽는 중...');
    const markdown = fs.readFileSync(mdFilePath, 'utf-8');
    
    console.log('🔄 HTML로 변환 중...');
    const html = marked(markdown);
    
    // HTML 템플릿 생성 (스타일 포함)
    const fullHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    
    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: white;
    }
    
    h1 {
      color: #1a1a1a;
      font-size: 2.5em;
      margin-bottom: 0.5em;
      border-bottom: 3px solid #000;
      padding-bottom: 0.3em;
    }
    
    h2 {
      color: #2c3e50;
      font-size: 2em;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 0.3em;
    }
    
    h3 {
      color: #34495e;
      font-size: 1.5em;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
    }
    
    h4 {
      color: #495057;
      font-size: 1.2em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    
    p {
      margin-bottom: 1em;
      text-align: justify;
    }
    
    ul, ol {
      margin-bottom: 1em;
      padding-left: 2em;
    }
    
    li {
      margin-bottom: 0.5em;
    }
    
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      padding: 15px;
      overflow-x: auto;
      margin: 1em 0;
    }
    
    pre code {
      background: none;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding-left: 20px;
      color: #666;
      font-style: italic;
    }
    
    strong {
      font-weight: 600;
      color: #1a1a1a;
    }
    
    em {
      font-style: italic;
      color: #555;
    }
    
    hr {
      border: none;
      border-top: 2px solid #e0e0e0;
      margin: 2em 0;
    }
    
    a {
      color: #3498db;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    
    th {
      background: #f4f4f4;
      font-weight: 600;
    }
    
    /* 이모지 스타일 */
    h1::before, h2::before, h3::before {
      margin-right: 0.3em;
    }
    
    @media print {
      body {
        max-width: 100%;
        padding: 20px;
      }
      
      h1, h2, h3 {
        page-break-after: avoid;
      }
      
      pre, blockquote, table {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    
    console.log('🚀 Puppeteer 브라우저 시작 중...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    console.log('📄 HTML 콘텐츠 설정 중...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // PDF 파일 이름 생성
    const pdfPath = mdFilePath.replace(/\.md$/, '.pdf');
    
    console.log('📝 PDF 생성 중...');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
          <span class="title"></span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
      printBackground: true,
      preferCSSPageSize: false
    });
    
    await browser.close();
    
    console.log(`✅ PDF 생성 완료: ${pdfPath}`);
    console.log(`📊 파일 크기: ${(fs.statSync(pdfPath).size / 1024).toFixed(2)} KB`);
    
    return pdfPath;
  } catch (error) {
    console.error('❌ PDF 변환 중 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
convertMdToPdf(mdFile)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));