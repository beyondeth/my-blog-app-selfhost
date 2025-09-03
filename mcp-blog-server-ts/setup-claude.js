#!/usr/bin/env node

/**
 * Claude Desktop MCP Server 자동 설정 스크립트
 * 
 * 이 스크립트는:
 * 1. Claude Desktop 설정 파일을 찾아서 업데이트
 * 2. 프로젝트 .claude 폴더 생성 및 설정
 * 3. 필요한 환경 변수 안내
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

async function setupClaudeDesktop() {
  console.log('🚀 Claude Desktop MCP Blog Server 설정 시작\n');

  // 1. Claude Desktop 설정 파일 경로 찾기
  const claudeConfigPath = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json'
  );

  if (!fs.existsSync(claudeConfigPath)) {
    console.error('❌ Claude Desktop 설정 파일을 찾을 수 없습니다.');
    console.log('Claude Desktop이 설치되어 있는지 확인해주세요.\n');
    process.exit(1);
  }

  // 2. 사용자 정보 입력받기
  console.log('블로그 API 정보를 입력해주세요:\n');
  
  const apiKeyId = await prompt('API Key ID (예: akid_xxx): ');
  const apiKeySecret = await prompt('API Key Secret (예: aks_xxx): ');
  const apiUrl = await prompt('API URL (기본값: http://localhost:3000/api/v1): ') || 'http://localhost:3000/api/v1';
  const projectPath = process.cwd();

  // 3. Claude Desktop 전역 설정 업데이트
  try {
    const config = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
    
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // MCP 서버 설정 추가
    config.mcpServers.codebase_blog = {
      command: 'node',
      args: [
        path.join(projectPath, 'dist', 'index.js'),
        '--transport',
        'stdio'
      ],
      cwd: projectPath,
      env: {
        BLOG_API_KEY_ID: apiKeyId,
        BLOG_API_KEY_SECRET: apiKeySecret,
        BLOG_API_URL: apiUrl,
        BLOG_POSTS_DIR: path.join(projectPath, 'posts')
      }
    };

    // 설정 파일 저장
    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Claude Desktop 전역 설정 업데이트 완료\n');
  } catch (error) {
    console.error('❌ Claude Desktop 설정 업데이트 실패:', error.message);
    process.exit(1);
  }

  // 4. 프로젝트 루트의 .claude 폴더 생성 (mcp-blog-server-ts가 아닌 상위 폴더)
  const projectRootDir = path.dirname(projectPath); // my-blog-app 폴더
  const claudeDir = path.join(projectRootDir, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // 5. 팀 공유 설정 파일 생성 (settings.json - Git에 커밋)
  const teamSettings = {
    permissions: {
      allow: [
        'mcp__codebase_blog__authenticate',
        'mcp__codebase_blog__create_post',
        'mcp__codebase_blog__create_post_from_file',
        'mcp__codebase_blog__diagnose_connection'
      ],
      defaultMode: 'acceptEdits'
    },
    enableAllProjectMcpServers: true,
    enabledMcpjsonServers: ['codebase_blog']
  };

  fs.writeFileSync(
    path.join(claudeDir, 'settings.json'),
    JSON.stringify(teamSettings, null, 2)
  );
  console.log('✅ 프로젝트 .claude/settings.json (팀 공유 설정) 생성 완료');

  // 6. 개인 설정 파일 생성 (settings.local.json - Git 무시)
  const personalSettings = {
    ...teamSettings,
    // 개인별 추가 설정이 필요한 경우 여기에 추가
  };

  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(personalSettings, null, 2)
  );
  console.log('✅ 프로젝트 .claude/settings.local.json (개인 설정) 생성 완료\n');

  // 7. .env 파일 생성
  const envContent = `# Blog API Configuration
BLOG_API_KEY_ID=${apiKeyId}
BLOG_API_KEY_SECRET=${apiKeySecret}
BLOG_API_URL=${apiUrl}
BLOG_POSTS_DIR=${path.join(projectPath, 'posts')}
`;

  fs.writeFileSync(path.join(projectPath, '.env'), envContent);
  console.log('✅ .env 파일 생성 완료\n');

  // 8. posts 폴더 생성
  const postsDir = path.join(projectPath, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
    console.log('✅ posts 폴더 생성 완료\n');
  }

  // 9. 완료 메시지
  console.log('🎉 설정이 완료되었습니다!\n');
  console.log('다음 단계:');
  console.log('1. Claude Desktop을 완전히 종료 후 재시작하세요');
  console.log('2. MCP 서버 빌드: pnpm build');
  console.log('3. Claude Desktop에서 프로젝트를 열면 MCP 서버가 자동으로 연결됩니다\n');
  
  console.log('📝 생성된 파일:');
  console.log(`  - ${claudeConfigPath} (업데이트됨)`);
  console.log(`  - ${path.join(claudeDir, 'settings.json')} (팀 공유 설정)`);
  console.log(`  - ${path.join(claudeDir, 'settings.local.json')} (개인 설정)`);
  console.log(`  - ${path.join(projectPath, '.env')}`);
  console.log(`  - ${postsDir}/ (포스트 저장 폴더)\n`);
  
  console.log('⚠️  .gitignore 확인사항:');
  console.log('  다음 항목들이 .gitignore에 포함되어 있는지 확인하세요:');
  console.log('  - .claude/settings.local.json');
  console.log('  - .env\n');

  rl.close();
}

// 메인 실행
setupClaudeDesktop().catch(console.error);