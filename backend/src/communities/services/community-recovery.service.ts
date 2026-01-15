import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  Community,
  CommunityComment,
  CommunityPost,
  CommunityRecoverySnapshot,
  CommunityModLog,
} from "../entities";
import { ModAction } from "../enums";

interface SnapshotMetadata {
  triggeredBy?: string;
  note?: string;
  [key: string]: any;
}

@Injectable()
export class CommunityRecoveryService {
  private readonly logger = new Logger(CommunityRecoveryService.name);

  constructor(
    @InjectRepository(CommunityRecoverySnapshot)
    private readonly snapshotRepository: Repository<CommunityRecoverySnapshot>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityComment)
    private readonly commentRepository: Repository<CommunityComment>,
    @InjectRepository(CommunityModLog)
    private readonly modLogRepository: Repository<CommunityModLog>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 커뮤니티 복구 스냅샷 생성
   */
  async captureSnapshot(
    communityId: string,
    createdById: string | null,
    reason: string,
    metadata?: SnapshotMetadata,
  ): Promise<CommunityRecoverySnapshot> {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    const posts = await this.postRepository
      .createQueryBuilder("post")
      .withDeleted()
      .where("post.communityId = :communityId", { communityId })
      .getMany();

    const comments = await this.commentRepository
      .createQueryBuilder("comment")
      .leftJoin(CommunityPost, "post", "post.id = comment.postId")
      .withDeleted()
      .where("post.communityId = :communityId", { communityId })
      .getMany();

    const snapshot = this.snapshotRepository.create({
      communityId,
      createdById,
      reason,
      postsSnapshot: posts.map((post) => ({
        id: post.id,
        communityId: post.communityId,
        authorId: post.authorId,
        title: post.title,
        content: post.content,
        content_markdown: post.content_markdown,
        status: post.status,
        slug: post.slug,
        isPinned: post.isPinned,
        isLocked: post.isLocked,
        removalReason: post.removalReason,
        deletedAt: (post as any).deletedAt || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
      commentsSnapshot: comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        parentCommentId: comment.parentCommentId,
        content: comment.content,
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        isDeleted: comment.isDeleted,
        removedAt: comment.removedAt || null,
        updatedAt: comment.updatedAt,
      })),
      settingsSnapshot: {
        description: community.description,
        joinPolicy: community.joinPolicy,
        isPublic: community.isPublic,
        isPostDiscoverable: community.isPostDiscoverable,
        isNsfw: community.isNsfw,
        iconUrl: community.iconUrl,
        bannerUrl: community.bannerUrl,
        isLocked: (community as any).isLocked ?? false,
        lockedAt: (community as any).lockedAt ?? null,
      },
      metadata,
    });

    const saved = await this.snapshotRepository.save(snapshot);
    this.logger.log(`Community snapshot captured: ${communityId} (${reason})`);
    return saved;
  }

  /**
   * 스냅샷을 기반으로 커뮤니티 상태 복원
   */
  async restoreSnapshot(snapshotId: string, operatorId: string): Promise<void> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException("스냅샷을 찾을 수 없습니다");
    }

    await this.dataSource.transaction(async (manager) => {
      const postRepository = manager.getRepository(CommunityPost);
      const commentRepository = manager.getRepository(CommunityComment);

      const existingPosts = await postRepository
        .createQueryBuilder("post")
        .withDeleted()
        .where("post.communityId = :communityId", {
          communityId: snapshot.communityId,
        })
        .getMany();
      const existingPostMap = new Map(
        existingPosts.map((post) => [post.id, post]),
      );

      const commentIds = snapshot.commentsSnapshot.map((comment) => comment.id);
      const existingCommentMap =
        commentIds.length > 0
          ? new Map(
              (
                await commentRepository
                  .createQueryBuilder("comment")
                  .withDeleted()
                  .where("comment.id IN (:...ids)", { ids: commentIds })
                  .getMany()
              ).map((comment) => [comment.id, comment]),
            )
          : new Map<string, CommunityComment>();

      // 게시물 복원
      for (const postPayload of snapshot.postsSnapshot) {
        const existingPost = existingPostMap.get(postPayload.id);
        const communityId =
          postPayload.communityId ??
          existingPost?.communityId ??
          snapshot.communityId;
        const authorId = postPayload.authorId ?? existingPost?.authorId;

        if (!communityId || !authorId) {
          this.logger.warn(
            `Skip restoring post ${postPayload.id} due to missing communityId/authorId`,
          );
          continue;
        }

        await postRepository.save({
          id: postPayload.id,
          communityId,
          authorId,
          title: postPayload.title,
          content: postPayload.content,
          content_markdown: postPayload.content_markdown,
          status: postPayload.status,
          slug: postPayload.slug,
          isPinned: postPayload.isPinned,
          isLocked: postPayload.isLocked,
          removalReason: postPayload.removalReason,
          deletedAt: postPayload.deletedAt,
        });
      }

      // 댓글 복원
      for (const commentPayload of snapshot.commentsSnapshot) {
        const existingComment = existingCommentMap.get(commentPayload.id);
        const authorId = commentPayload.authorId ?? existingComment?.authorId;
        if (!authorId) {
          this.logger.warn(
            `Skip restoring comment ${commentPayload.id} due to missing authorId`,
          );
          continue;
        }

        await commentRepository.save({
          id: commentPayload.id,
          postId: commentPayload.postId,
          authorId,
          parentCommentId: commentPayload.parentCommentId,
          content: commentPayload.content,
          likeCount: commentPayload.likeCount,
          dislikeCount: commentPayload.dislikeCount,
          isDeleted: commentPayload.isDeleted,
          removedAt: commentPayload.removedAt ?? null,
        });
      }

      // 커뮤니티 설정 복원
      const settings = snapshot.settingsSnapshot || {};
      await manager.getRepository(Community).update(snapshot.communityId, {
        description: settings.description ?? null,
        joinPolicy: settings.joinPolicy,
        isPublic: settings.isPublic,
        isPostDiscoverable: settings.isPostDiscoverable,
        isNsfw: settings.isNsfw,
        iconUrl: settings.iconUrl ?? null,
        bannerUrl: settings.bannerUrl ?? null,
        ...(settings.isLocked !== undefined
          ? { isLocked: settings.isLocked, lockedAt: settings.lockedAt ?? null }
          : {}),
      });

      await manager.getRepository(CommunityModLog).save({
        communityId: snapshot.communityId,
        moderatorId: operatorId,
        action: ModAction.RESTORE_COMMUNITY,
        reason: `Snapshot restored (${snapshot.reason})`,
        metadata: {
          snapshotId: snapshot.id,
          totalPosts: snapshot.postsSnapshot.length,
          totalComments: snapshot.commentsSnapshot.length,
        },
      });
    });

    this.logger.warn(
      `Community ${snapshot.communityId} restored from snapshot ${snapshot.id} by ${operatorId}`,
    );
  }

  async listSnapshots(communityId: string, limit = 20) {
    return this.snapshotRepository.find({
      where: { communityId },
      order: { createdAt: "DESC" },
      take: limit,
      relations: ["createdBy"],
    });
  }
}
