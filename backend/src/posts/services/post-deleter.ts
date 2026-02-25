import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager } from "typeorm";
import { Post } from "../entities/post.entity";
import { PostStats } from "../entities/post-stats.entity";
import { PostMetadata } from "../entities/post-metadata.entity";
import { User } from "../../users/entities/user.entity";
import { Role } from "../../common/enums/role.enum";
import { UpdatePostDto } from "../dto/update-post.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TransactionEventBuffer } from "../../common/utils/transaction-event-buffer";
import {
  PostLifecycleEvents,
  PostLifecyclePayload,
} from "../events/post-lifecycle.events";

/**
 * 포스트 삭제/복원/발행 전담 서비스
 *
 * 책임:
 * - 포스트 삭제 (소프트 삭제, 영구 삭제)
 * - 포스트 복원
 * - 포스트 발행 / 발행 취소
 *
 * ⚠️ 캐시 무효화: CacheInvalidationListener가 PostLifecycleEvents 구독으로 전담 (단일 경로 정책)
 */
@Injectable()
export class PostDeleter {
  private readonly logger = new Logger(PostDeleter.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 포스트 삭제 (소프트 삭제)
   *
   * @param id 포스트 ID
   * @param user 사용자
   */
  async delete(id: string, user: User): Promise<void> {
    const eventBuffer = new TransactionEventBuffer();

    await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Deleting post: ${id} by user: ${user.id}`);

      // 1. 포스트 조회
      const post = await manager.findOne(Post, {
        where: { id },
        relations: ["blog", "stats", "metadata"],
      });

      if (!post) {
        throw new NotFoundException("포스트를 찾을 수 없습니다.");
      }

      // 2. 권한 확인
      if (
        post.authorId !== user.id &&
        post.blog.userId !== user.id &&
        user.role !== Role.ADMIN
      ) {
        throw new ForbiddenException("삭제 권한이 없습니다.");
      }

      // 3. 이미 삭제된 포스트 확인
      if (post.isDeleted) {
        throw new BadRequestException("이미 삭제된 포스트입니다.");
      }

      const wasEditorPick =
        post.metadata?.isEditorPick ?? post.isEditorPick ?? false;

      // 4. 소프트 삭제
      await manager.update(Post, id, {
        isDeleted: true,
        deletedAt: new Date(),
        slug: `deleted-${post.slug}-${Date.now()}`,
        isEditorPick: false,
        editorPickedAt: null,
      });

      if (wasEditorPick && post.metadata) {
        post.metadata.removeEditorPick();
        await manager.save(PostMetadata, post.metadata);
      }

      // 5. 라이프사이클 이벤트 버퍼 (커밋 후 발행)
      eventBuffer.add(PostLifecycleEvents.DELETED, {
        postId: id,
        blogId: post.blogId,
        blogSlug: post.blog?.slug,
        authorId: user.id,
        wasPublished: post.isPublished,
        wasEditorPick,
      } as PostLifecyclePayload);

      this.logger.log(`Post deleted successfully: ${id}`);
    });

    // 트랜잭션 커밋 성공 후 이벤트 발행 (best-effort)
    eventBuffer.flush(this.eventEmitter, this.logger);
  }

  /**
   * 포스트 복원 (삭제 취소)
   *
   * @param id 포스트 ID
   * @param user 사용자
   */
  async restore(id: string, user: User): Promise<Post> {
    const eventBuffer = new TransactionEventBuffer();

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        this.logger.log(`Restoring post: ${id} by user: ${user.id}`);

        // 1. 포스트 조회
        const post = await manager.findOne(Post, {
          where: { id, isDeleted: true },
          relations: ["blog"],
        });

        if (!post) {
          throw new NotFoundException("삭제된 포스트를 찾을 수 없습니다.");
        }

        // 2. 권한 확인
        if (
          post.authorId !== user.id &&
          post.blog.userId !== user.id &&
          user.role !== Role.ADMIN
        ) {
          throw new ForbiddenException("복원 권한이 없습니다.");
        }

        // 3. slug 복원 (중복 확인)
        const originalSlug = post.slug
          .replace(/^deleted-/, "")
          .split("-")
          .slice(0, -1)
          .join("-");
        const slugExists = await manager.findOne(Post, {
          where: { slug: originalSlug, isDeleted: false },
          select: ["id"],
        });

        if (slugExists) {
          post.slug = `${originalSlug}-restored-${Date.now()}`;
        } else {
          post.slug = originalSlug;
        }

        // 4. 복원
        post.isDeleted = false;
        post.deletedAt = null;
        await manager.save(post);

        // 5. 라이프사이클 이벤트 버퍼 (커밋 후 발행)
        eventBuffer.add(PostLifecycleEvents.RESTORED, {
          postId: id,
          blogId: post.blogId,
          blogSlug: post.blog?.slug,
          authorId: user.id,
          isPublished: post.isPublished,
        } as PostLifecyclePayload);

        this.logger.log(`Post restored successfully: ${id}`);
        return post;
      },
    );

    // 트랜잭션 커밋 성공 후 이벤트 발행 (best-effort)
    eventBuffer.flush(this.eventEmitter, this.logger);
    return result;
  }

  /**
   * 포스트 영구 삭제 (관리자용)
   *
   * @param id 포스트 ID
   * @param user 관리자
   */
  async permanentDelete(id: string, user: User): Promise<void> {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException("관리자만 영구 삭제할 수 있습니다.");
    }

    const eventBuffer = new TransactionEventBuffer();

    await this.dataSource.transaction(async (manager: EntityManager) => {
      this.logger.log(`Permanently deleting post: ${id} by admin: ${user.id}`);

      // 1. 관련 데이터 삭제
      await manager.delete(PostStats, { postId: id });
      await manager.delete(PostMetadata, { postId: id });

      // 2. 포스트 삭제
      await manager.delete(Post, { id });

      // 3. 커밋 후 캐시 무효화를 위한 이벤트 버퍼링
      eventBuffer.add(PostLifecycleEvents.DELETED, {
        postId: id,
        blogId: null,
        authorId: user.id,
        wasPublished: true, // 영구 삭제는 게시 상태 무관하게 캐시 정리
      } as PostLifecyclePayload);

      this.logger.log(`Post permanently deleted: ${id}`);
    });

    // 트랜잭션 커밋 성공 후 이벤트 발행 (best-effort)
    eventBuffer.flush(this.eventEmitter, this.logger);
  }

  /**
   * 포스트 발행
   *
   * @param id 포스트 ID
   * @param user 사용자
   * @param updateFn update 메서드 위임 함수 (PostUpdater.update)
   * @returns 발행된 포스트
   */
  async publish(
    id: string,
    user: User,
    updateFn: (id: string, dto: UpdatePostDto, user: User) => Promise<Post>,
  ): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (
      post.authorId !== user.id &&
      post.blog.userId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException("발행 권한이 없습니다.");
    }

    if (post.isPublished) {
      throw new BadRequestException("이미 발행된 포스트입니다.");
    }

    return updateFn(id, { isPublished: true, version: post.version }, user);
  }

  /**
   * 발행 취소
   *
   * @param id 포스트 ID
   * @param user 사용자
   * @param updateFn update 메서드 위임 함수 (PostUpdater.update)
   * @returns 발행 취소된 포스트
   */
  async unpublish(
    id: string,
    user: User,
    updateFn: (id: string, dto: UpdatePostDto, user: User) => Promise<Post>,
  ): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    if (
      post.authorId !== user.id &&
      post.blog.userId !== user.id &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException("발행 취소 권한이 없습니다.");
    }

    if (!post.isPublished) {
      throw new BadRequestException("발행되지 않은 포스트입니다.");
    }

    return updateFn(id, { isPublished: false, version: post.version }, user);
  }
}
