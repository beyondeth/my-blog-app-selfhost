❌ **스타일 가이드 이해도 확인 필요!**

포스트를 생성하려면 다음 질문에 답변해주세요:

**질문:** {question}

**답변 찾는 방법:**
1. get_writing_style_guide 도구로 조회한 가이드를 다시 확인하세요
2. YAML front matter의 `validation_challenges` 섹션에서 위 질문의 답변을 찾으세요
3. 찾은 답변과 함께 create_post를 다시 호출하세요

**예시:**
```typescript
create_post({
  title: "{title}",
  content_markdown: "...",
  tags: {tags},
  validationToken: "{token}",
  challengeAnswer: "여기에 답변"  // ← 가이드에서 찾은 답변 추가!
})
```

💡 **힌트:** get_writing_style_guide로 조회한 내용을 다시 확인해보세요!
