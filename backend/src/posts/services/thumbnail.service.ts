import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { Post } from "../entities/post.entity";
import { File } from "../../files/entities/file.entity";
import {
  FilePurpose,
  FileContextType,
} from "../../files/entities/file-context.entity";

/**
 * 썸네일 관리 전용 서비스
 *
 * 책임:
 * - 포스트 썸네일 선택 및 변경
 * - 썸네일 유효성 검증
 * - 썸네일 파일 관리
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(File)
    private readonly filesRepository: Repository<File>,
  ) {}

  /**
   * 포스트의 썸네일 설정
   *
   * @param postId 포스트 ID
   * @param fileId 썸네일로 사용할 파일 ID
   * @param userId 요청자 ID (권한 확인용)
   * @param manager 트랜잭션 매니저 (선택적)
   * @returns 업데이트된 포스트
   */
  async setThumbnail(
    postId: string,
    fileId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<Post> {
    const postRepository = manager
      ? manager.getRepository(Post)
      : this.postsRepository;
    const fileRepository = manager
      ? manager.getRepository(File)
      : this.filesRepository;

    this.logger.log(
      `[SET_THUMBNAIL] Setting thumbnail for post: ${postId}, file: ${fileId}`,
    );

    // 1. 포스트 조회 및 권한 확인
    const post = await postRepository.findOne({
      where: { id: postId },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    // 권한 확인: 작성자 또는 블로그 소유자만 가능
    if (post.authorId !== userId && post.blog?.userId !== userId) {
      throw new ForbiddenException("썸네일을 수정할 권한이 없습니다.");
    }

    // 2. 파일 조회 및 소유권 확인
    const file = await fileRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException(
        "파일을 찾을 수 없거나 접근 권한이 없습니다.",
      );
    }

    // 3. 이미지 파일인지 확인
    if (!file.fileType || file.fileType !== "image") {
      throw new NotFoundException("이미지 파일만 썸네일로 지정할 수 있습니다.");
    }

    // 4. 파일이 포스트에 연결되어 있는지 확인
    const isFileAttachedToPost =
      (await postRepository
        .createQueryBuilder("post")
        .leftJoin("post.attachedFiles", "file")
        .where("post.id = :postId", { postId })
        .andWhere("file.id = :fileId", { fileId })
        .getCount()) > 0;

    if (!isFileAttachedToPost) {
      // 포스트에 파일이 연결되어 있지 않다면 연결
      await postRepository
        .createQueryBuilder()
        .relation(Post, "attachedFiles")
        .of(postId)
        .add(fileId);

      this.logger.log(
        `[SET_THUMBNAIL] Attached file ${fileId} to post ${postId}`,
      );
    }

    // 5. 썸네일 업데이트
    await postRepository.update(postId, {
      thumbnailImageId: fileId,
      updatedAt: new Date(),
    });

    this.logger.log(
      `[SET_THUMBNAIL] Successfully set thumbnail: postId=${postId}, fileId=${fileId}`,
    );

    // 6. 업데이트된 포스트 반환
    const updatedPost = await postRepository.findOne({
      where: { id: postId },
      relations: ["thumbnailImage"],
    });

    return updatedPost!;
  }

  /**
   * 포스트 생성 시 썸네일 자동 설정
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param manager 트랜잭션 매니저
   * @returns 설정된 썸네일 파일 ID (없으면 null)
   */
  async autoSetThumbnailForNewPost(
    postId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<string | null> {
    this.logger.debug(
      `[AUTO_SET_THUMBNAIL] Auto-setting thumbnail for new post: ${postId}`,
    );

    // 포스트에 연결된 이미지 파일들 조회
    const imageFiles = await manager
      .getRepository(File)
      .createQueryBuilder("file")
      .innerJoin("file.posts", "post")
      .where("post.id = :postId", { postId })
      .andWhere("file.fileType = :fileType", { fileType: "image" })
      .andWhere("file.userId = :userId", { userId })
      .orderBy("file.createdAt", "ASC") // 첫 번째 이미지를 썸네일로
      .limit(1)
      .getMany();

    if (imageFiles.length > 0) {
      const thumbnailFile = imageFiles[0];

      // 포스트 업데이트
      await manager
        .getRepository(Post)
        .createQueryBuilder()
        .update(Post)
        .set({ thumbnailImageId: thumbnailFile.id })
        .where("id = :postId", { postId })
        .execute();

      this.logger.log(
        `[AUTO_SET_THUMBNAIL] Auto-selected thumbnail: ${thumbnailFile.id} for post: ${postId}`,
      );
      return thumbnailFile.id;
    }

    this.logger.debug(
      `[AUTO_SET_THUMBNAIL] No image files found for post: ${postId}`,
    );
    return null;
  }

  /**
   * 포스트에서 사용 가능한 썸네일 후보 이미지들 조회
   *
   * @param postId 포스트 ID
   * @param userId 요청자 ID
   * @returns 썸네일 후보 파일 목록
   */
  async getThumbnailCandidates(
    postId: string,
    userId: string,
  ): Promise<File[]> {
    this.logger.debug(
      `[GET_THUMBNAIL_CANDIDATES] Getting candidates for post: ${postId}`,
    );

    // 포스트 조회
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    // 권한 확인
    if (post.authorId !== userId && post.blog?.userId !== userId) {
      throw new ForbiddenException("접근 권한이 없습니다.");
    }

    // 포스트에 연결된 이미지 파일들 조회
    const imageFiles = await this.filesRepository
      .createQueryBuilder("file")
      .innerJoin("file.posts", "post")
      .where("post.id = :postId", { postId })
      .andWhere("file.fileType = :fileType", { fileType: "image" })
      .orderBy("file.createdAt", "ASC")
      .getMany();

    this.logger.debug(
      `[GET_THUMBNAIL_CANDIDATES] Found ${imageFiles.length} image candidates`,
    );
    return imageFiles;
  }

  /**
   * 썸네일 제거
   *
   * @param postId 포스트 ID
   * @param userId 요청자 ID
   * @param manager 트랜잭션 매니저 (선택적)
   */
  async removeThumbnail(
    postId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const postRepository = manager
      ? manager.getRepository(Post)
      : this.postsRepository;

    // 포스트 조회 및 권한 확인
    const post = await postRepository.findOne({
      where: { id: postId },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (post.authorId !== userId && post.blog?.userId !== userId) {
      throw new ForbiddenException("썸네일을 제거할 권한이 없습니다.");
    }

    // 썸네일 제거
    await postRepository.update(postId, {
      thumbnailImageId: null,
      updatedAt: new Date(),
    });

    this.logger.log(
      `[REMOVE_THUMBNAIL] Removed thumbnail from post: ${postId}`,
    );
  }

  /**
   * 썸네일 유효성 검증
   *
   * @param postId 포스트 ID
   * @param fileId 썸네일 파일 ID
   * @returns 유효하면 true, 아니면 false
   */
  async validateThumbnail(postId: string, fileId: string): Promise<boolean> {
    try {
      // 파일이 존재하는지
      const file = await this.filesRepository.findOne({
        where: { id: fileId },
      });

      if (!file || file.fileType !== "image") {
        return false;
      }

      // 파일이 포스트에 연결되어 있는지
      const isAttached =
        (await this.postsRepository
          .createQueryBuilder("post")
          .leftJoin("post.attachedFiles", "file")
          .where("post.id = :postId", { postId })
          .andWhere("file.id = :fileId", { fileId })
          .getCount()) > 0;

      return isAttached;
    } catch (error) {
      this.logger.error(
        `[VALIDATE_THUMBNAIL] Error validating thumbnail:`,
        error,
      );
      return false;
    }
  }
}
