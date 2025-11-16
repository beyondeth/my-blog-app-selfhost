import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Post } from '../entities/post.entity';
import { File } from '../../files/entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../../files/entities/file-context.entity';
import { FilesService } from '../../files/files.service';
import { extractImageUrlsFromContent, extractS3KeyFromUrl } from '../utils/post.utils';
import { CacheInvalidationEvents } from '../../common/events/cache.events';

/**
 * 포스트 파일 관리 서비스
 *
 * 책임:
 * - 썸네일 이미지 설정
 * - 포스트 내용에서 파일 링크
 * - 파일 용량 검증
 * - 파일 컨텍스트 관리
 */
@Injectable()
export class PostFileService {
  private readonly logger = new Logger(PostFileService.name);
  private readonly MAX_POST_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB
  private readonly MAX_FILES_PER_POST = 10; // Maximum 10 files per post

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(File)
    private readonly filesRepository: Repository<File>,
    @InjectRepository(FileContext)
    private readonly fileContextRepository: Repository<FileContext>,
    private readonly filesService: FilesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 게시글 썸네일 설정/제거
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param setThumbnailDto 썸네일 설정 DTO
   */
  async setThumbnail(postId: string, userId: string, setThumbnailDto: { thumbnailFileId?: string, thumbnailUrl?: string }) {
    const { thumbnailFileId, thumbnailUrl: providedThumbnailUrl } = setThumbnailDto;

    try {
      // 🎯 [THUMBNAIL_TRACK] DEBUG: 수신된 파라미터
      this.logger.log(`🎯 [THUMBNAIL_TRACK] PostFileService.setThumbnail called with:`, {
        postId,
        userId,
        thumbnailFileId,
        thumbnailUrl: providedThumbnailUrl,
        hasThumbnailFileId: !!thumbnailFileId,
        hasThumbnailUrl: !!providedThumbnailUrl
      });

      // 게시글 소유권 확인 (blog 정보도 함께 조회)
      const post = await this.postsRepository.findOne({
        where: { id: postId, authorId: userId },
        relations: ['thumbnailImage', 'blog'],
      });

      if (!post) {
        throw new NotFoundException('게시글을 찾을 수 없거나 권한이 없습니다.');
      }

      // 변경 전 원본 썸네일 값 저장
      const oldThumbnailImageId = post.thumbnailImageId;
      const oldThumbnailUrl = post.thumbnail;

      let thumbnailImageId = null;
      let thumbnailUrl = providedThumbnailUrl || null;

      // 썸네일 파일 ID가 제공된 경우
      if (thumbnailFileId) {
        // 🎯 [THUMBNAIL_TRACK] DEBUG: 파일 검색 정보
        this.logger.log(`🎯 [THUMBNAIL_TRACK] PostFileService searching for file: ${thumbnailFileId}, userId: ${userId}`);

        // 파일 소유권 확인
        const thumbnailFile = await this.filesRepository.findOne({
          where: { id: thumbnailFileId, userId },
        });

        // 🎯 [THUMBNAIL_TRACK] DEBUG: 검색 결과
        this.logger.log(`🎯 [THUMBNAIL_TRACK] File search result: ${thumbnailFile ? 'FOUND' : 'NOT FOUND'}`);

        if (thumbnailFile) {
          thumbnailImageId = thumbnailFileId;
          thumbnailUrl = thumbnailFile.fileUrl;

          // 파일 컨텍스트 업데이트 제거 - posts 테이블에서만 썸네일 정보 관리
          // await this.updateOrCreateFileContext(
          //   thumbnailFile.id,
          //   FilePurpose.THUMBNAIL,
          //   postId,
          //   FileContextType.POST
          // );

          this.logger.log(`썸네일 설정 완료: postId=${postId}, fileId=${thumbnailFileId}`);
        } else {
          // 파일이 없지만 CDN URL이 있는 경우 (기존 이미지 처리)
          if (providedThumbnailUrl) {
            this.logger.warn(`🎯 [THUMBNAIL_TRACK] File not found in DB, using provided CDN URL: ${providedThumbnailUrl}`);
            this.logger.log(`🎯 [THUMBNAIL_TRACK] Using CDN URL as thumbnail: postId=${postId}`);
            // 🔧 FIX: 파일이 없으면 thumbnailImageId는 null로 설정 (FK 제약 조건 위반 방지)
            this.logger.log(`🎯 [THUMBNAIL_TRACK] File does not exist in DB, setting thumbnailImageId to null to avoid FK constraint violation`);
            thumbnailImageId = null; // FK 제약 조건 때문에 null로 설정
          } else {
            // 추가 디버깅: 파일이 있는지 전체로 검색
            const anyFile = await this.filesRepository.findOne({
              where: { id: thumbnailFileId }
            });

            this.logger.error(`🎯 [THUMBNAIL_TRACK] ERROR: File not found for user and no CDN URL provided. File exists in DB: ${!!anyFile}`);
            if (anyFile) {
              this.logger.error(`  - File belongs to userId: ${anyFile.userId}`);
              this.logger.error(`  - Requesting userId: ${userId}`);
            }

            // CDN URL도 없는 경우에만 에러 발생
            if (!providedThumbnailUrl) {
              throw new NotFoundException('썸네일 파일을 찾을 수 없거나 권한이 없습니다.');
            }
          }
        }
      } else if (providedThumbnailUrl) {
        // CDN URL만 제공된 경우 (기존 이미지)
        this.logger.log(`🎯 [THUMBNAIL_TRACK] Using provided CDN URL: ${providedThumbnailUrl}`);
      } else {
        // 썸네일 제거
        this.logger.log(`🎯 [THUMBNAIL_TRACK] 썸네일 제거 완료: postId=${postId}`);
      }

      // 포스트 업데이트
      // 🎯 [THUMBNAIL_TRACK] DEBUG: DB 업데이트 전 값 확인
      this.logger.log(`🎯 [THUMBNAIL_TRACK] Before DB update - thumbnailImageId: ${thumbnailImageId}, thumbnailUrl: ${thumbnailUrl}`);

      await this.postsRepository.update(postId, {
        thumbnailImageId,
        thumbnail: thumbnailUrl,
      });

      // 🎯 [THUMBNAIL_TRACK] DEBUG: DB 업데이트 후 확인
      const updatedPost = await this.postsRepository.findOne({
        where: { id: postId },
        select: ['id', 'thumbnailImageId', 'thumbnail']
      });
      this.logger.log(`🎯 [THUMBNAIL_TRACK] After DB update - saved thumbnailImageId: ${updatedPost?.thumbnailImageId}, saved thumbnail: ${updatedPost?.thumbnail}`);

      // 썸네일 변경 감지 및 이벤트 발행
      if (oldThumbnailImageId !== thumbnailImageId || oldThumbnailUrl !== thumbnailUrl) {
        // 🎯 [THUMBNAIL_TRACK] STEP_5_DB_UPDATE_COMPLETE
        this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_5_DB_UPDATE_COMPLETE: DB update successful');
        this.logger.debug(`  - Post ID: ${postId}`);
        this.logger.debug(`  - Blog Slug: ${post.blog?.slug || post.blogId}`);
        this.logger.debug(`  - Old thumbnailImageId: ${oldThumbnailImageId} -> New: ${thumbnailImageId}`);
        this.logger.debug(`  - Old thumbnailUrl: ${oldThumbnailUrl} -> New: ${thumbnailUrl}`);
        this.logger.debug(`  - Timestamp: ${new Date().toISOString()}`);

        // 🎯 [THUMBNAIL_TRACK] STEP_6_EVENT_EMITTED
        this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_6_EVENT_EMITTED: Emitting POST_THUMBNAIL_UPDATED event');

        // 썸네일 변경 이벤트 발행
        this.eventEmitter.emit(CacheInvalidationEvents.POST_THUMBNAIL_UPDATED, {
          postId,
          blogSlug: post.blog?.slug || post.blogId,
          oldThumbnailImageId,
          newThumbnailImageId: thumbnailImageId,
          oldThumbnailUrl,
          newThumbnailUrl: thumbnailUrl,
          authorId: userId,
        });

        this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_6_EVENT_EMITTED_COMPLETE: Event emitted successfully');
      } else {
        this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_5_NO_CHANGE: No thumbnail change detected');
      }

      return { success: true, thumbnailUrl };
    } catch (error) {
      this.logger.error(`썸네일 설정 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 포스트 내용에서 이미지 URL 추출 후 파일 링크
   *
   * @param post 포스트 엔티티
   * @param userId 사용자 ID (선택사항)
   */
  async linkFilesFromContent(post: Post, userId?: string): Promise<void> {
    try {
      const imageUrls = this.extractImageUrlsFromContent(post.content);
      if (imageUrls.length === 0) return;

      const s3Keys = imageUrls.map(url => this.extractS3KeyFromUrl(url)).filter(Boolean) as string[];
      if (s3Keys.length === 0) return;

      // Lazy loading 방지: userId를 직접 받거나 post.authorId 사용
      const authorUserId = userId || post.authorId;
      const files = await this.filesRepository.find({
        where: { fileKey: In(s3Keys), userId: authorUserId }
      });

      if (files.length > 0) {
        const existingFileIds = post.attachedFiles?.map(f => f.id) || [];
        const newFiles = files.filter(f => !existingFileIds.includes(f.id));

        if (newFiles.length > 0) {
          // 임시 context를 POST context로 변환
          for (const file of newFiles) {
            await this.updateOrCreateFileContext(
              file.id,
              FilePurpose.CONTENT,
              post.id,
              FileContextType.POST
            );
          }

          // 포스트에 파일 연결
          post.attachedFiles = [...(post.attachedFiles || []), ...newFiles];
          await this.postsRepository.save(post);

          this.logger.log(
            `Content에서 파일 링크 완료: postId=${post.id}, linkedCount=${newFiles.length}`
          );
        }
      }
    } catch (error) {
      this.logger.error(`Content 파일 링크 실패 (postId: ${post.id}):`, error.message);
    }
  }

  /**
   * 사용되지 않는 파일 연결 해제
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param fileIds 유지할 파일 ID 목록
   */
  async unlinkUnusedFiles(postId: string, userId: string, fileIds?: string[]): Promise<void> {
    try {
      const post = await this.postsRepository.findOne({
        where: { id: postId, authorId: userId },
        relations: ['attachedFiles'],
      });

      if (!post) {
        throw new NotFoundException('게시글을 찾을 수 없거나 권한이 없습니다.');
      }

      // 유지할 파일이 지정되지 않은 경우, 모든 파일을 해제
      const filesToKeep = fileIds || [];

      // 현재 연결된 파일들 중 유지할 파일이 아닌 것들 찾기
      const filesToUnlink = post.attachedFiles?.filter(file => !filesToKeep.includes(file.id)) || [];

      if (filesToUnlink.length > 0) {
        // 파일 컨텍스트 삭제
        for (const file of filesToUnlink) {
          await this.deleteFileContext(file.id, FileContextType.POST);
        }

        // 포스트에서 파일 연결 해제
        post.attachedFiles = post.attachedFiles?.filter(file => filesToKeep.includes(file.id)) || [];
        await this.postsRepository.save(post);

        this.logger.log(
          `파일 연결 해제 완료: postId=${postId}, unlinkedCount=${filesToUnlink.length}`
        );
      }
    } catch (error) {
      this.logger.error(`파일 연결 해제 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 포스트당 총 파일 용량 검증
   *
   * @param files 업로드할 파일들
   * @param existingPostId 기존 포스트 ID (수정 시)
   */
  async validatePostTotalSize(files: File[], existingPostId?: string): Promise<void> {
    let totalSize = 0;

    // 신규 파일들의 총 크기 계산
    for (const file of files) {
      totalSize += file.fileSize || 0;
    }

    // 기존 포스트 수정인 경우, 이미 업로드된 파일들의 크기도 포함
    if (existingPostId) {
      // Post와 연관된 파일들을 찾기 위해 FileContext를 통해 조회
      const existingFileContexts = await this.fileContextRepository.find({
        where: {
          contextId: existingPostId,
          contextType: FileContextType.POST,
        },
        relations: ['files'],
      });

      for (const context of existingFileContexts) {
        if (context.files && context.files.length > 0) {
          for (const file of context.files) {
            totalSize += file.fileSize || 0;
          }
        }
      }
    }

    // 파일 개수 제한 검증
    const totalFileCount = files.length + (existingPostId ?
      await this.fileContextRepository.count({
        where: { contextId: existingPostId, contextType: FileContextType.POST }
      }) : 0);

    if (totalFileCount > this.MAX_FILES_PER_POST) {
      throw new BadRequestException(
        `포스트당 최대 ${this.MAX_FILES_PER_POST}개까지 파일을 첨부할 수 있습니다. (현재: ${totalFileCount}개)`
      );
    }

    // 용량 제한 검증
    if (totalSize > this.MAX_POST_TOTAL_SIZE) {
      const sizeInMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
      const maxSizeInMB = Math.round(this.MAX_POST_TOTAL_SIZE / (1024 * 1024) * 100) / 100;
      throw new BadRequestException(
        `포스트당 총 파일 용량은 ${maxSizeInMB}MB를 초과할 수 없습니다. (현재: ${sizeInMB}MB)`
      );
    }

    this.logger.debug(
      `파일 용량 검증 통과: postId=${existingPostId}, size=${totalSize}, count=${totalFileCount}`
    );
  }

  /**
   * 신규 파일 업로드 시 포스트 용량 체크
   *
   * @param postId 포스트 ID
   * @param newFileSize 새로 추가할 파일 크기
   */
  async validateNewFileForPost(postId: string, newFileSize: number): Promise<void> {
    // Post와 연관된 파일들을 찾기
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ['attachedFiles'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let currentTotalSize = 0;
    let currentFileCount = 0;

    // 현재 연결된 파일들의 크기 계산
    if (post.attachedFiles) {
      for (const file of post.attachedFiles) {
        currentTotalSize += file.fileSize || 0;
      }
      currentFileCount = post.attachedFiles.length;
    }

    // 파일 개수 제한 검증
    if (currentFileCount >= this.MAX_FILES_PER_POST) {
      throw new BadRequestException(
        `포스트당 최대 ${this.MAX_FILES_PER_POST}개까지 파일을 첨부할 수 있습니다.`
      );
    }

    // 용량 제한 검증
    const newTotalSize = currentTotalSize + newFileSize;
    if (newTotalSize > this.MAX_POST_TOTAL_SIZE) {
      const sizeInMB = Math.round(newTotalSize / (1024 * 1024) * 100) / 100;
      const maxSizeInMB = Math.round(this.MAX_POST_TOTAL_SIZE / (1024 * 1024) * 100) / 100;
      throw new BadRequestException(
        `포스트당 총 파일 용량은 ${maxSizeInMB}MB를 초과할 수 없습니다.`
      );
    }
  }

  /**
   * 여러 포스트의 파일 링크 재구성
   *
   * @param posts 포스트 배열
   */
  async relinkContentFiles(posts: Post[]): Promise<void> {
    this.logger.log(`Starting to relink content files for ${posts.length} posts`);

    for (const post of posts) {
      try {
        // Lazy loading 방지: authorId 직접 사용
        await this.linkFilesFromContent(post, post.authorId);
        this.logger.log(`✅ Relinked files for post: ${post.title}`);
      } catch (error) {
        this.logger.error(`❌ Failed to relink files for post ${post.id}:`, error.message);
      }
    }

    this.logger.log('Finished relinking content files');
  }

  /**
   * 포스트에 연결된 파일들 가져오기
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID (권한 확인용)
   */
  async getAttachedFiles(postId: string, userId?: string): Promise<File[]> {
    const whereCondition: any = { contextId: postId, contextType: FileContextType.POST };

    const fileContexts = await this.fileContextRepository.find({
      where: whereCondition,
      relations: ['files'],
    });

    // userId가 있는 경우, 파일 소유권 확인
    if (userId) {
      const files: File[] = [];
      for (const fc of fileContexts) {
        if (fc.files) {
          files.push(...fc.files.filter(file => file.userId === userId));
        }
      }
      return files;
    }

    const files: File[] = [];
    for (const fc of fileContexts) {
      if (fc.files) {
        files.push(...fc.files);
      }
    }
    return files;
  }

  /**
   * 파일 컨텍스트 업데이트 또는 생성
   *
   * @param fileId 파일 ID
   * @param purpose 파일 용도
   * @param contextId 컨텍스트 ID
   * @param contextType 컨텍스트 타입
   */
  private async updateOrCreateFileContext(
    fileId: string,
    purpose: FilePurpose,
    contextId: string,
    contextType: FileContextType
  ): Promise<void> {
    // 파일의 contextId 업데이트 제거 - foreign key constraint 위반 방지
    // 썸네일 정보는 posts 테이블에서만 관리하면 충분함

    // 컨텍스트가 없으면 생성
    const existingContext = await this.fileContextRepository.findOne({
      where: { contextId, contextType },
    });

    if (!existingContext) {
      const fileContext = this.fileContextRepository.create({
        contextId,
        contextType,
        purpose,
        ownerId: '', // TODO: 실제 owner ID 설정 필요
      });
      await this.fileContextRepository.save(fileContext);
    }
  }

  /**
   * 파일 컨텍스트 삭제
   *
   * @param fileId 파일 ID
   * @param contextType 컨텍스트 타입
   */
  private async deleteFileContext(fileId: string, contextType: FileContextType): Promise<void> {
    // 파일의 contextId 업데이트 제거 - foreign key constraint 위반 방지
    // 썸네일 정보는 posts 테이블에서만 관리하면 충분함
    // await this.filesRepository.update(fileId, {
    //   contextId: null,
    // });
  }

  /**
   * UUID 기반 S3 키 추출
   *
   * @param url 파일 URL
   * @returns S3 키 또는 null
   */
  private extractS3KeyFromUrl(url: string): string | null {
    return extractS3KeyFromUrl(url);
  }

  /**
   * 콘텐츠에서 이미지 URL 추출
   *
   * @param content 포스트 콘텐츠
   * @returns 이미지 URL 배열
   */
  extractImageUrlsFromContent(content: string): string[] {
    return extractImageUrlsFromContent(content);
  }

  /**
   * 포스트의 총 파일 크기 계산
   *
   * @param postId 포스트 ID
   * @returns 총 파일 크기 (bytes)
   */
  async calculatePostFileSize(postId: string): Promise<number> {
    const fileContexts = await this.fileContextRepository.find({
      where: { contextId: postId, contextType: FileContextType.POST },
      relations: ['files'],
    });

    let totalSize = 0;
    for (const context of fileContexts) {
      if (context.files) {
        for (const file of context.files) {
          totalSize += file.fileSize || 0;
        }
      }
    }

    return totalSize;
  }
}