#!/usr/bin/env node

/**
 * 스타일 파일 검증 스크립트
 * 5개 섹션이 모두 정상적으로 로드되는지 확인
 */

const { loadWritingStyle } = require('./dist/lib/style-loader.js');
const path = require('path');

const STYLES = ['default', 'novel', 'comedy', 'tutorial', 'podcast'];
const REQUIRED_SECTIONS = [
  'instructions',
  'createPostDescription',
  'qualityGuidelinesPrompt',
  'blogPostTemplatePrompt',
  'improveMarkdownPrompt'
];

async function verifyStyles() {
  console.log('🔍 스타일 파일 검증 시작...\n');

  let allPassed = true;

  for (const styleName of STYLES) {
    try {
      const styleDir = path.join(__dirname, 'writing-styles');
      const style = await loadWritingStyle(styleName, styleDir);

      console.log(`✅ ${styleName}.md 로드 성공`);

      // 메타데이터 확인
      console.log(`   - 스타일명: ${style.metadata.style_name}`);
      console.log(`   - 언어: ${style.metadata.language}`);
      console.log(`   - 최소길이: ${style.metadata.min_length}자`);
      console.log(`   - 목표길이: ${style.metadata.target_length}자`);

      // 5개 섹션 확인
      const missingSections = [];
      for (const section of REQUIRED_SECTIONS) {
        if (!style[section] || style[section].trim().length === 0) {
          missingSections.push(section);
        }
      }

      if (missingSections.length > 0) {
        console.log(`   ⚠️  누락된 섹션: ${missingSections.join(', ')}`);
        allPassed = false;
      } else {
        console.log(`   ✅ 5개 섹션 모두 존재`);
        console.log(`   - instructions: ${style.instructions.length}자`);
        console.log(`   - createPostDescription: ${style.createPostDescription.length}자`);
        console.log(`   - qualityGuidelinesPrompt: ${style.qualityGuidelinesPrompt.length}자`);
        console.log(`   - blogPostTemplatePrompt: ${style.blogPostTemplatePrompt.length}자`);
        console.log(`   - improveMarkdownPrompt: ${style.improveMarkdownPrompt.length}자`);
      }

      console.log();

    } catch (error) {
      console.log(`❌ ${styleName}.md 로드 실패`);
      console.log(`   에러: ${error.message}\n`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('🎉 모든 스타일 파일 검증 완료!\n');
    process.exit(0);
  } else {
    console.log('❌ 일부 스타일 파일에 문제가 있습니다.\n');
    process.exit(1);
  }
}

verifyStyles();
