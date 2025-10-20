/**
 * Post Processing Worker (BullMQ Processor)
 *
 * Fast Path 이후 백그라운드에서 실행되어 포스트 처리를 완료합니다.
 * - Content 처리: HTML sanitization, code highlighting (Prism.js), image processing
 * - File link 처리: S3 key 추출, FileContext 업데이트
 * - Status 업데이트: 'processing' → 'published' 또는 'failed'
 *
 * 참고: Search vector 생성은 search-indexing.service.ts의 배치 처리가 담당합니다 (30분마다).
 *
 * BullMQ Worker 패턴:
 * - @Processor() 데코레이터로 Queue 등록
 * - @Process() 메서드로 Job 처리
 * - Job 재시도 및 실패 처리 자동화
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { File } from '../../files/entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../../files/entities/file-context.entity';
import { MarkdownRendererService } from '../../common/services/markdown-renderer.service';
import { ContentProcessingService } from '../../content-processing/services/content-processing.service';
import {
  POST_PROCESSING_QUEUE,
  PostProcessingJobData,
  PostProcessingResult,
} from '../queues/post-processing.queue';

@Processor(POST_PROCESSING_QUEUE, {
  concurrency: 1, // 한 번에 하나의 Job만 처리 (순차 처리)
  lockDuration: 30000, // 30초 잠금 유지 (Job 처리 타임아웃)
})
export class PostProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PostProcessingProcessor.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectRepository(FileContext)
    private readonly fileContextRepository: Repository<FileContext>,
    private readonly markdownRenderer: MarkdownRendererService,
    private readonly contentProcessing: ContentProcessingService,
  ) {
    super();
  }

  /**
   * Job 처리 메인 메서드
   * BullMQ가 자동으로 호출하며, 실패 시 자동 재시도
   *
   * @param job - BullMQ Job 객체
   * @returns 처리 결과
   */
  async process(job: Job<PostProcessingJobData>): Promise<PostProcessingResult> {
    const startTime = Date.now();
    const { postId, userId, blogId, title, content, tags, category } = job.data;

    this.logger.log(`🔄 Post 처리 시작: ${postId} (attempt: ${job.attemptsMade + 1}/${job.opts.attempts})`);

    try {
      // 1. Post 조회 및 상태 확인
      const post = await this.postRepository.findOne({ where: { id: postId } });

      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }

      if (post.status !== 'processing') {
        this.logger.warn(`Post ${postId} is not in processing state: ${post.status}`);
        return {
          success: false,
          postId,
          status: 'failed',
          error: `Invalid status: ${post.status}`,
          processingTime: Date.now() - startTime,
        };
      }

      // 2. Markdown → HTML 변환
      const rawHtml = this.markdownRenderer.convertToHtml(content);

      // 3. Content 처리 (HTML sanitization, code highlighting, image processing)
      const { html: processedContent, metadata } = await this.contentProcessing.process(rawHtml, {
        sanitize: true,
        allowIframes: true,
        allowComments: true,
        preserveMermaid: true,
        processCode: true,
        processImages: true,
      });

      // 4. Excerpt 생성 (HTML에서 태그 제거 후 200자 추출)
      let excerpt = '';
      if (processedContent) {
        // HTML 태그 제거 및 공백 정리
        const textContent = processedContent
          .replace(/<[^>]+>/g, '') // HTML 태그 제거
          .replace(/\s+/g, ' ') // 연속된 공백을 하나로
          .trim();

        // 첫 200자 추출
        excerpt = textContent.length > 200
          ? textContent.substring(0, 200)
          : textContent;
      }

      // 5. File link 처리 (S3 key 추출 및 FileContext 업데이트)
      await this.processFileLinks(postId, userId, blogId, processedContent);

      // 6. Post 업데이트 (status: 'published', content, excerpt)
      // 참고: search_vector는 search-indexing.service.ts의 배치 처리가 담당 (30분마다)
      await this.postRepository
        .createQueryBuilder()
        .update(Post)
        .set({
          content: processedContent,
          excerpt: excerpt, // 실제 content 기반 excerpt로 업데이트
          status: 'published',
          processingCompletedAt: new Date(),
          processingError: null,
        })
        .where('id = :id', { id: postId })
        .execute();

      const processingTime = Date.now() - startTime;

      this.logger.log(`✅ Post 처리 완료: ${postId} (${processingTime}ms)`);

      return {
        success: true,
        postId,
        status: 'published',
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`❌ Post 처리 실패: ${postId}`, error.stack);

      // Post status를 'failed'로 업데이트 (최대 재시도 횟수 초과 시에만)
      if (job.attemptsMade + 1 >= job.opts.attempts) {
        await this.postRepository.update(
          { id: postId },
          {
            status: 'failed',
            processingError: error.message,
            processingCompletedAt: new Date(),
          },
        );

        this.logger.error(`💥 Post 처리 최종 실패: ${postId} (재시도 ${job.attemptsMade + 1}/${job.opts.attempts})`);
      } else {
        this.logger.warn(`⚠️  Post 처리 실패, 재시도 예정: ${postId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
      }

      return {
        success: false,
        postId,
        status: 'failed',
        error: error.message,
        processingTime,
      };
    }
  }

  /**
   * File link 처리 (S3 key 추출 및 FileContext 업데이트)
   *
   * 처리 과정:
   * 1. Content에서 S3 URL 패턴 추출 (/uploads/xxx.jpg, https://s3.../xxx.jpg)
   * 2. S3 key로 File 엔티티 조회
   * 3. FileContext 생성/업데이트 (postId, userId, blogId 연결)
   *
   * @param postId - 포스트 ID
   * @param userId - 사용자 ID
   * @param blogId - 블로그 ID
   * @param content - 처리된 HTML 컨텐츠
   */
  private async processFileLinks(
    postId: string,
    userId: string,
    blogId: string,
    content: string,
  ): Promise<void> {
    try {
      // S3 URL 패턴 추출 (img src, a href)
      const s3UrlPattern =
        /(?:src|href)="([^"]*(?:\/uploads\/[^"]+|https:\/\/[^"]*\.s3\.[^"]*\/[^"]+))"/gi;
      const matches = content.matchAll(s3UrlPattern);

      const s3Keys = new Set<string>();
      for (const match of matches) {
        const url = match[1];
        // URL에서 S3 key 추출 (uploads/ 이후 경로)
        const keyMatch = url.match(/uploads\/(.+?)(?:\?|$)/);
        if (keyMatch) {
          s3Keys.add(keyMatch[1]);
        }
      }

      if (s3Keys.size === 0) {
        this.logger.debug(`No S3 files found in post ${postId}`);
        return;
      }

      this.logger.debug(`Found ${s3Keys.size} S3 files in post ${postId}`);

      // 1. Post용 FileContext 찾기 또는 생성
      let postContext = await this.fileContextRepository.findOne({
        where: {
          contextType: FileContextType.POST,
          contextId: postId,
          ownerId: userId,
        },
      });

      if (!postContext) {
        // Post용 FileContext 생성
        postContext = this.fileContextRepository.create({
          contextType: FileContextType.POST,
          contextId: postId,
          ownerId: userId,
          purpose: FilePurpose.CONTENT,
          isActive: true,
        });
        await this.fileContextRepository.save(postContext);
        this.logger.debug(`Created FileContext for post ${postId}`);
      }

      // 2. File 엔티티 조회 및 contextId 업데이트
      for (const s3Key of s3Keys) {
        const file = await this.fileRepository.findOne({
          where: { fileKey: s3Key },
        });

        if (!file) {
          this.logger.warn(`File not found for S3 key: ${s3Key}`);
          continue;
        }

        // File의 contextId를 Post Context로 업데이트
        if (file.contextId !== postContext.id) {
          await this.fileRepository.update(
            { id: file.id },
            { contextId: postContext.id, updatedAt: new Date() },
          );
          this.logger.debug(`Updated File ${file.id} to context ${postContext.id}`);
        }
      }

      // 3. FileContext의 fileCount와 totalSize 업데이트
      const contextFiles = await this.fileRepository.find({
        where: { contextId: postContext.id },
      });

      await this.fileContextRepository.update(
        { id: postContext.id },
        {
          fileCount: contextFiles.length,
          totalSize: contextFiles.reduce((sum, f) => sum + f.fileSize, 0),
          updatedAt: new Date(),
        },
      );

      this.logger.log(`✅ File link 처리 완료: ${s3Keys.size}개 파일 (post: ${postId})`);
    } catch (error) {
      this.logger.error(`File link 처리 실패 (post: ${postId}):`, error);
      // File link 처리 실패는 전체 처리를 중단하지 않음 (warning으로 처리)
    }
  }

  /**
   * Job 완료 이벤트 핸들러
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PostProcessingJobData>) {
    this.logger.debug(`Job ${job.id} completed for post ${job.data.postId}`);
  }

  /**
   * Job 실패 이벤트 핸들러
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<PostProcessingJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed for post ${job.data.postId}:`, error.message);
  }

  /**
   * Job 활성화 이벤트 핸들러
   */
  @OnWorkerEvent('active')
  onActive(job: Job<PostProcessingJobData>) {
    this.logger.debug(`Job ${job.id} activated for post ${job.data.postId}`);
  }
}
