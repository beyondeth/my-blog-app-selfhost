import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Brackets, In } from "typeorm";
import { Comment } from "../entities/comment.entity";
import { CommentLike } from "../entities/comment-like.entity";
import { UserResponseDto } from "../../users/dto/user-response.dto";
import { plainToInstance } from "class-transformer";
import { CdnService } from "../../files/services/cdn.service";

@Injectable()
export class CommentsReadRepository {
  private readonly logger = new Logger(CommentsReadRepository.name);

  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikesRepository: Repository<CommentLike>,
    private cdnService: CdnService,
  ) {}

  async findAllByPost(postId: string, userId?: string) {
    const queryBuilder = this.commentsRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false })
      .orderBy("comment.createdAt", "ASC");

    if (userId) {
      queryBuilder.leftJoinAndSelect(
        "comment.commentLikes",
        "userLike",
        "userLike.userId = :userId",
        { userId },
      );
    }

    return queryBuilder.getMany();
  }

  async getParentCommentsPaginated(
    postId: string,
    limit: number,
    decodedCursor: any,
    snapshotTimestamp: Date | null,
    sort: string,
    userId?: string,
  ) {
    const queryBuilder = this.commentsRepository
      .createQueryBuilder("comment")
      .leftJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("author.profile", "profile")
      .where("comment.postId = :postId", { postId })
      .andWhere("comment.parentCommentId IS NULL")
      .andWhere("comment.isDeleted = :isDeleted", { isDeleted: false });

    if (snapshotTimestamp && sort === "popular") {
      queryBuilder.andWhere("comment.createdAt <= :snapshot", {
        snapshot: snapshotTimestamp,
      });
    }

    if (userId) {
      queryBuilder.leftJoinAndSelect(
        "comment.commentLikes",
        "userLike",
        "userLike.userId = :userId",
        { userId },
      );
    }

    if (sort === "popular") {
      queryBuilder
        .orderBy("comment.likesCount", "DESC")
        .addOrderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where("comment.likesCount < :likesCount", {
              likesCount: decodedCursor.likesCount || 0,
            })
              .orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where("comment.likesCount = :likesCount", {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere("comment.createdAt < :createdAt", {
                      createdAt: decodedCursor.createdAt,
                    });
                }),
              )
              .orWhere(
                new Brackets((qb3) => {
                  qb3
                    .where("comment.likesCount = :likesCount", {
                      likesCount: decodedCursor.likesCount || 0,
                    })
                    .andWhere("comment.createdAt = :createdAt", {
                      createdAt: decodedCursor.createdAt,
                    })
                    .andWhere("comment.id < :id", { id: decodedCursor.id });
                }),
              );
          }),
        );
      }
    } else {
      queryBuilder
        .orderBy("comment.createdAt", "DESC")
        .addOrderBy("comment.id", "DESC");

      if (decodedCursor) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where("comment.createdAt < :createdAt", {
              createdAt: decodedCursor.createdAt,
            }).orWhere(
              new Brackets((qb2) => {
                qb2
                  .where("comment.createdAt = :createdAt", {
                    createdAt: decodedCursor.createdAt,
                  })
                  .andWhere("comment.id < :id", { id: decodedCursor.id });
              }),
            );
          }),
        );
      }
    }

    queryBuilder.take(limit + 1);

    return queryBuilder.getMany();
  }

  async getRepliesPaginated(
    parentCommentId: string,
    limit: number,
    decodedCursor: any,
    userId?: string,
  ): Promise<{ comments: Comment[]; hasMore: boolean; totalCount: number }> {
    const queryParams: any[] = [parentCommentId];
    let cursorWhereClause = "";
    let paramIndex = 2;

    if (decodedCursor) {
      cursorWhereClause = `AND (ct."createdAt" > $${paramIndex} OR (ct."createdAt" = $${paramIndex} AND ct.id > $${paramIndex + 1}))`;
      queryParams.push(decodedCursor.createdAt);
      queryParams.push(decodedCursor.id);
      paramIndex += 2;
    }

    const rawQuery = `
      WITH RECURSIVE comment_tree AS (
        SELECT c.*, 0 as depth
        FROM comments c
        WHERE c."parentCommentId" = $1 AND c."isDeleted" = false
        ${cursorWhereClause}

        UNION ALL

        SELECT c.*, ct.depth + 1
        FROM comments c
        INNER JOIN comment_tree ct ON c."parentCommentId" = ct.id
        WHERE c."isDeleted" = false AND ct.depth < 10
      )
      SELECT
        ct.*,
        u.id as author_id,
        u.username as author_username,
        u.email as author_email,
        p."profileImage" as author_profileImage
      FROM comment_tree ct
      LEFT JOIN users u ON ct."authorId" = u.id
      LEFT JOIN profiles p ON u.id = p."userId"
      ORDER BY ct."createdAt" ASC, ct.id ASC
      LIMIT ${limit + 1}
    `;

    const rawResults = await this.commentsRepository.query(
      rawQuery,
      queryParams,
    );

    const comments = rawResults.slice(0, limit).map((row: any) => {
      const comment = new Comment();
      comment.id = row.id;
      comment.content = row.content;
      comment.postId = row.postId || row.postid;
      comment.authorId = row.authorId || row.authorid;
      comment.parentCommentId = row.parentCommentId || row.parentcommentid;
      comment.likesCount = parseInt(
        row.likesCount || row.likescount || "0",
        10,
      );
      comment.dislikesCount = parseInt(
        row.dislikesCount || row.dislikescount || "0",
        10,
      );
      comment.repliesCount = parseInt(
        row.repliesCount || row.repliescount || "0",
        10,
      );
      comment.isDeleted = row.isDeleted || row.isdeleted;
      comment.createdAt = row.createdAt || row.createdat;
      comment.updatedAt = row.updatedAt || row.updatedat;

      let profileImage = row.author_profileImage || row.author_profileimage;
      if (
        profileImage &&
        (profileImage.startsWith("v2/") || profileImage.startsWith("uploads/"))
      ) {
        profileImage = this.cdnService.generateCdnUrlFromKey(profileImage);
      }

      comment.author = plainToInstance(UserResponseDto, {
        id: row.author_id,
        username: row.author_username,
        profileImage: profileImage,
        email: row.author_email,
      }) as any;

      return comment;
    });

    const hasMore = rawResults.length > limit;

    const totalCountQuery = `
      WITH RECURSIVE comment_tree AS (
        SELECT id FROM comments
        WHERE "parentCommentId" = $1 AND "isDeleted" = false

        UNION ALL

        SELECT c.id FROM comments c
        INNER JOIN comment_tree ct ON c."parentCommentId" = ct.id
        WHERE c."isDeleted" = false
      )
      SELECT COUNT(*) as count FROM comment_tree
    `;

    const countResult = await this.commentsRepository.query(totalCountQuery, [
      parentCommentId,
    ]);
    const totalCount = parseInt(countResult[0]?.count || "0", 10);

    return { comments, hasMore, totalCount };
  }

  async countParentComments(postId: string): Promise<number> {
    return this.commentsRepository.count({
      where: {
        postId,
        parentCommentId: null,
        isDeleted: false,
      },
    });
  }

  async getUserLikes(commentIds: string[], userId: string) {
    if (commentIds.length === 0) return [];
    return this.commentLikesRepository.find({
      where: {
        commentId: In(commentIds),
        userId,
      },
    });
  }
}
