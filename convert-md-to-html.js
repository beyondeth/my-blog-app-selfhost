const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configure marked options
marked.setOptions({
  headerIds: true,
  mangle: false,
  gfm: true,
  breaks: true,
  highlight: function(code, lang) {
    return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
  }
});

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// HTML template with Korean content
const createHtmlTemplate = (title, content) => `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        
        h2 {
            color: #1e40af;
            margin-top: 40px;
            margin-bottom: 20px;
            padding-left: 10px;
            border-left: 4px solid #3b82f6;
            font-size: 1.8em;
        }
        
        h3 {
            color: #1e3a8a;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.4em;
        }
        
        h4 {
            color: #1e3a8a;
            margin-top: 25px;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        p {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        
        ul, ol {
            margin-bottom: 20px;
            margin-left: 30px;
        }
        
        li {
            margin-bottom: 8px;
            line-height: 1.7;
        }
        
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
            font-size: 0.9em;
            color: #e11d48;
        }
        
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
            font-size: 0.9em;
            line-height: 1.5;
        }
        
        pre code {
            background: none;
            color: inherit;
            padding: 0;
            font-size: inherit;
        }
        
        blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 20px;
            margin: 20px 0;
            color: #4b5563;
            font-style: italic;
            background: #f9fafb;
            padding: 15px 20px;
            border-radius: 0 8px 8px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            overflow-x: auto;
            display: block;
        }
        
        th {
            background: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        tr:nth-child(even) {
            background: #f9fafb;
        }
        
        tr:hover {
            background: #f3f4f6;
        }
        
        strong {
            color: #1e293b;
            font-weight: 600;
        }
        
        em {
            color: #475569;
        }
        
        hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 30px 0;
        }
        
        a {
            color: #2563eb;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s;
        }
        
        a:hover {
            border-bottom-color: #2563eb;
        }
        
        .toc {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .toc h2 {
            margin-top: 0;
            font-size: 1.3em;
            color: #1e293b;
            border: none;
            padding: 0;
        }
        
        .toc ul {
            margin-left: 20px;
            margin-bottom: 0;
        }
        
        .toc a {
            color: #475569;
        }
        
        .toc a:hover {
            color: #2563eb;
        }
        
        /* Mermaid diagram styles */
        .language-mermaid {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            overflow-x: auto;
        }
        
        /* Syntax highlighting */
        .language-typescript,
        .language-javascript,
        .language-python,
        .language-sql,
        .language-bash,
        .language-json,
        .language-yaml {
            position: relative;
        }
        
        .language-typescript::before,
        .language-javascript::before,
        .language-python::before,
        .language-sql::before,
        .language-bash::before,
        .language-json::before,
        .language-yaml::before {
            position: absolute;
            top: 0;
            right: 0;
            padding: 4px 8px;
            background: rgba(255,255,255,0.1);
            color: #94a3b8;
            font-size: 0.8em;
            border-radius: 0 8px 0 4px;
        }
        
        .language-typescript::before { content: 'TypeScript'; }
        .language-javascript::before { content: 'JavaScript'; }
        .language-python::before { content: 'Python'; }
        .language-sql::before { content: 'SQL'; }
        .language-bash::before { content: 'Bash'; }
        .language-json::before { content: 'JSON'; }
        .language-yaml::before { content: 'YAML'; }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .container {
                padding: 20px;
            }
            
            h1 {
                font-size: 1.8em;
            }
            
            h2 {
                font-size: 1.4em;
            }
            
            h3 {
                font-size: 1.2em;
            }
            
            table {
                font-size: 0.9em;
            }
        }
        
        /* Print styles */
        @media print {
            body {
                background: white;
                color: black;
            }
            
            .container {
                box-shadow: none;
                padding: 0;
            }
            
            pre {
                background: #f5f5f5;
                color: black;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;

// Convert markdown files to HTML
function convertMarkdownToHtml(inputPath, outputPath, title) {
  try {
    // Read markdown file
    const markdown = fs.readFileSync(inputPath, 'utf8');
    
    // Convert to HTML
    const htmlContent = marked(markdown);
    
    // Create full HTML document
    const fullHtml = createHtmlTemplate(title, htmlContent);
    
    // Write HTML file
    fs.writeFileSync(outputPath, fullHtml, 'utf8');
    
    console.log(`✅ Converted: ${inputPath} → ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error converting ${inputPath}:`, error.message);
  }
}

// Convert both files
const files = [
  {
    input: '/Users/sihyungpark/Desktop/code/my-blog-app/MCP_지능형_검색_시스템_설계서.md',
    output: '/Users/sihyungpark/Desktop/code/my-blog-app/MCP_지능형_검색_시스템_설계서.html',
    title: 'Codebase.blog 지능형 MCP 시스템 - 종합 설계서'
  }
];

files.forEach(file => {
  if (fs.existsSync(file.input)) {
    convertMarkdownToHtml(file.input, file.output, file.title);
  } else {
    console.error(`❌ File not found: ${file.input}`);
  }
});

console.log('\n변환 완료! 생성된 HTML 파일을 브라우저에서 열어보세요.');