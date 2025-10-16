❌ **스타일 검증 토큰이 필요합니다!**

포스트를 생성하려면 먼저 get_writing_style_guide 도구를 호출하여 스타일 가이드를 조회해야 합니다.

**STEP 1: 스타일 가이드 조회**
get_writing_style_guide 도구를 호출하세요:
```typescript
get_writing_style_guide({ style: "{style}" })
```

**STEP 2: 토큰 추출**
반환된 마크다운 상단의 YAML 메타데이터에서 `validation_token`을 찾으세요

**STEP 3: create_post 호출**
찾은 토큰을 `validationToken` 파라미터로 전달하세요:
```typescript
create_post({
  title: "제목",
  content_markdown: "내용...",
  tags: ["태그", "ai:claude"],
  validationToken: "찾은-토큰-값-여기에"  // ← 이 부분 추가!
})
```

⚠️ **중요:** 로컬 파일을 직접 읽지 마세요! 반드시 get_writing_style_guide 도구를 사용하세요.
💡 **힌트:** 도구를 사용하면 스타일 가이드라인도 함께 학습할 수 있습니다!
