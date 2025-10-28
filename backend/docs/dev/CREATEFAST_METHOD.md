# createFast() Method Implementation

This method should be inserted after the `create()` method in posts.service.ts (after line 413).

```typescript
  /**
   * Fast Path 포스트 생성 (MCP 최적화용)
   *
   * 목표: 150-200ms 응답 시간으로 즉시 응답 반환
   * 전략: 최소 처리 + 백그라운드 Queue 사용
   *
   * 처리 흐름:
   * 1. 최소 검증 (블로그 존재, 컨텐츠 비어있지 않음)
   * 2. 포스트 생성 (status='processing', 원본 markdown만 저장)
   * 3. 백그라운드 Job Queue에 추가
   * 4. 즉시 202 Accepted 응답 반환
   *
   * 백그라운드 Worker가 처리:
   * - Markdown → HTML 변환
   * - Content 처리 (HTML sanitization, code highlighting, image processing)
   * - File link 처리 (S3 key 추출, FileContext 업데이트)
   * - Status 업데이트 ('processing' → 'published' 또는 'failed')
   *
   * Search vector 생성은 별도 배치 처리 (search-indexing.service.ts, 30분마다)
   *
   * @param createPostDto - 포스트 생성 DTO
   * @param user - 작성자 정보
   * @returns 생성된 포스트 정보 (status='processing' 상태)
   */
  async createFast(createPostDto: CreatePostDto, user: User): Promise<any> {
    const startTime = Date.now();

    // 1. 블로그 존재 확인 (필수)
    const blog = await this.blogsRepository.findOne({
      where: { userId: user.id },
    });

    if (!blog) {
      throw new BadRequestException('블로그를 먼저 생성해주세요.');
    }

    // 2. 컨텐츠 검증 (content_markdown 또는 content 필수)
    const markdownContent = createPostDto.content_markdown || createPostDto.content;
    if (!markdownContent) {
      throw new BadRequestException('게시글 내용이 필요합니다.');
    }

    // 3. 태그 처리
    const tagList = createPostDto.tags || [];

    // 4. 간단한 excerpt 생성 (제목 기반, 빠른 처리)
    // Worker에서 content 기반 excerpt로 교체됨
    const quickExcerpt = createPostDto.title.substring(0, 200);

    // 5. 포스트 생성 (status='processing')
    const post = this.postsRepository.create({
      title: createPostDto.title,
      category: createPostDto.category,
      content: null, // Worker에서 처리
      content_markdown: markdownContent, // 원본 저장
      excerpt: quickExcerpt, // 임시 excerpt (Worker에서 교체)
      content_type: 'markdown',
      content_rendered_at: null, // Worker에서 설정
      thumbnail: createPostDto.thumbnail,
      author: user,
      blog: blog,
      blogId: blog.id,
      isPublished: true, // 공개 상태 (하지만 status='processing'이므로 목록에 안 보임)
      publishedAt: new Date(),
      tagList: tagList,
      qualityScore: createPostDto.qualityScore || null,
      status: 'processing', // 핵심: 백그라운드 처리 대기 중
      processingError: null,
      processingCompletedAt: null,
    });

    // 6. DB 저장 (빠른 저장, content 처리 스킵)
    await this.postsRepository.save(post);

    // 7. 백그라운드 Job Queue에 추가
    await this.postProcessingQueue.add('process-post', {
      postId: post.id,
      userId: user.id,
      blogId: blog.id,
      title: post.title,
      content: markdownContent,
      tags: tagList,
      category: post.category,
    });

    const processingTime = Date.now() - startTime;
    this.logger.log(`✅ Fast Path 완료: ${post.id} (${processingTime}ms) - Worker 처리 대기 중`);

    // 8. 202 Accepted 응답 반환 (즉시 응답)
    return {
      ...this.toPostDto(post, {
        user: user,
        blog: blog,
      }),
      // 추가 메타데이터
      _meta: {
        processingStatus: 'queued',
        message: '포스트가 생성되었습니다. 백그라운드에서 처리 중입니다.',
        estimatedCompletion: '2-3초 후 완료 예상',
        processingTime: `${processingTime}ms`,
      },
    };
  }
```

This method should be added to posts.service.ts after line 413 (after the create() method).
