const fs = require('fs');
const { spawnSync } = require('child_process');

function fail(message, detail) {
  console.error(message);
  if (detail) {
    console.error(detail);
  }
  process.exit(1);
}

function runMcporter(args) {
  const result = spawnSync('npx', ['-y', 'mcporter', ...args], {
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();

  if (result.status !== 0) {
    const error = new Error(output || `mcporter exited with code ${result.status}`);
    error.output = output;
    throw error;
  }

  return output;
}

function readPayload(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    fail('[ERROR] 게시 payload JSON을 읽지 못했습니다.', error.message);
  }
}

function summarizeStyleGuide(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => line.startsWith('# ')) || '스타일 가이드';
  const requirements = lines.find((line) => line.startsWith('**Requirements:**'));
  const workflow = lines.find((line) => line.startsWith('## Workflow'));

  return [heading, requirements, workflow].filter(Boolean).join(' | ');
}

function extractField(text, label) {
  const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s+(.+)`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

const payloadPath = process.argv[2];
const writingStyle = process.argv[3] || 'default';

if (!payloadPath) {
  fail('Usage: node scripts/mcporter_publish_with_progress.js <payload.json> [style]');
}

const payload = readPayload(payloadPath);

if (!payload.title || !payload.content_markdown || !payload.category) {
  fail('[ERROR] payload 에 title, content_markdown, category 가 모두 필요합니다.');
}

try {
  console.log('[Route] mode=skill transport=mcporter endpoint=/mcp-remote alias=codebase-blog-oauth');

  console.log('(1/3) 현재 OAuth 인증 체크 중입니다.');
  const authOutput = runMcporter([
    'call',
    'codebase-blog-oauth.check_auth',
    '--output',
    'json',
  ]);

  if (authOutput.includes('"error"')) {
    fail('[STOP] OAuth 인증 확인에 실패했습니다. 자동포스팅을 중단합니다.', authOutput);
  }

  console.log('OAuth 2.1 인증이 확인되었습니다.');

  console.log(`(2/3) 글쓰기 스타일 가이드를 확인 중입니다. style=${writingStyle}`);
  const styleOutput = runMcporter([
    'call',
    'codebase-blog-oauth.get_writing_style_guide',
    '--args',
    JSON.stringify({ style: writingStyle }),
  ]);
  console.log(`스타일 가이드 확인 완료: ${summarizeStyleGuide(styleOutput)}`);

  console.log('(3/3) 실제 자동포스팅 할 글을 작성하고 발행 중입니다.');
  const publishOutput = runMcporter([
    'call',
    'codebase-blog-oauth.create_post',
    '--args',
    JSON.stringify(payload),
  ]);

  const title = extractField(publishOutput, 'Title') || payload.title;
  const slug = extractField(publishOutput, 'Slug');
  const url = extractField(publishOutput, 'URL');

  console.log('자동포스팅이 완료되었습니다.');
  console.log(`제목: ${title}`);
  if (slug) {
    console.log(`슬러그: ${slug}`);
  }
  if (url) {
    console.log(`URL: ${url}`);
  }
} catch (error) {
  fail('[ERROR] 자동포스팅 실행 중 오류가 발생했습니다.', error.output || error.message);
}
