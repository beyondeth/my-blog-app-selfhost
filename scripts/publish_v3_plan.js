const fs = require('fs');
const { execSync } = require('child_process');

const contentMarkdown = fs.readFileSync('/Users/sihyungpark/Desktop/code/my-blog-app-integ/docs/BACKEND_REFACTORING_PLAN_V3.md', 'utf8');
const title = "NestJS 백엔드 리팩토링 계획서 v3 (구조 유지 + 성능 확장 대비)";
const category = "Architecture";
const tags = ["nestjs", "refactoring", "architecture", "cqs", "read-replica"];

const argsStr = `title: ${JSON.stringify(title)}, content_markdown: ${JSON.stringify(contentMarkdown)}, category: ${JSON.stringify(category)}, tags: ${JSON.stringify(tags)}`;
const cmd = `npx -y mcporter call 'codebase-blog-oauth.create_post(${argsStr})'`;

try {
  console.log("[Route] mode=skill transport=mcporter endpoint=/mcp-remote alias=codebase-blog-oauth");
  const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
  console.log(output);
} catch (err) {
  console.error(err.stdout || err.message);
  process.exit(1);
}
