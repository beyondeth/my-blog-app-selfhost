import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Bookmark } from "./entities/bookmark.entity";
import { Post } from "../posts/entities/post.entity";
import { CommunityBookmark } from "../communities/entities/community-bookmark.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { CommunityPostStatus } from "../communities/enums";
import {
  BookmarkedPostDto,
  BookmarksResponseDto,
  ToggleBookmarkResponseDto,
} from "./dto/bookmark-response.dto";
import { plainToClass } from "class-transformer";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * 북마크 서비스 - 북마크 CRUD 및 동시성 처리
 */
@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    @InjectRepository(Bookmark)
    private bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(CommunityBookmark)
    private communityBookmarkRepository: Repository<CommunityBookmark>,
    @InjectRepository(CommunityPost)
    private communityPostRepository: Repository<CommunityPost>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 북마크 토글 (추가/제거) - 트랜잭션과 동시성 처리
   */
  async toggle(
    userId: string,
    postId: string,
  ): Promise<ToggleBookmarkResponseDto> {
    // 먼저 포스트가 존재하는지 확인
    const post = await this.postRepository.findOne({
      where: { id: postId, isPublished: true },
    });

    if (post) {
      // 트랜잭션으로 동시성 처리
      const result = await this.dataSource.transaction(async (manager) => {
        const bookmarkRepo = manager.getRepository(Bookmark);

        // 기존 북마크 확인
        const existingBookmark = await bookmarkRepo.findOne({
          where: { userId, postId },
        });

        if (existingBookmark) {
          // 북마크 제거
          await bookmarkRepo.remove(existingBookmark);
          this.logger.log(`Bookmark removed: user=${userId}, post=${postId}`);

          return {
            bookmarked: false,
            message: "북마크가 제거되었습니다.",
          };
        } else {
          // 북마크 추가
          try {
            const bookmark = bookmarkRepo.create({ userId, postId });
            await bookmarkRepo.save(bookmark);
            this.logger.log(`Bookmark added: user=${userId}, post=${postId}`);

            return {
              bookmarked: true,
              message: "북마크에 추가되었습니다.",
            };
          } catch (error) {
            // 동시에 같은 북마크를 추가하려고 시도한 경우 (unique constraint violation)
            if (error.code === "23505") {
              this.logger.warn(
                `Duplicate bookmark attempt: user=${userId}, post=${postId}`,
              );
              return {
                bookmarked: true,
                message: "이미 북마크에 추가되어 있습니다.",
              };
            }
            throw error;
          }
        }
      });

      // 평판 시스템용 이벤트 발행 (BOOKMARK_TOGGLED)
      this.eventEmitter.emit("post.bookmark.toggled", {
        postId,
        userId,
        bookmarked: result.bookmarked,
        timestamp: new Date(),
      });

      return result;
    }

    const communityPost = await this.communityPostRepository.findOne({
      where: { id: postId, status: CommunityPostStatus.PUBLISHED },
    });

    if (!communityPost) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const communityBookmarkRepo = manager.getRepository(CommunityBookmark);

      const existingBookmark = await communityBookmarkRepo.findOne({
        where: { userId, postId },
      });

      if (existingBookmark) {
        await communityBookmarkRepo.remove(existingBookmark);
        this.logger.log(
          `Community bookmark removed: user=${userId}, post=${postId}`,
        );
        return {
          bookmarked: false,
          message: "북마크가 제거되었습니다.",
        };
      }

      try {
        const bookmark = communityBookmarkRepo.create({ userId, postId });
        await communityBookmarkRepo.save(bookmark);
        this.logger.log(
          `Community bookmark added: user=${userId}, post=${postId}`,
        );
        return {
          bookmarked: true,
          message: "북마크에 추가되었습니다.",
        };
      } catch (error) {
        if (error.code === "23505") {
          this.logger.warn(
            `Duplicate community bookmark attempt: user=${userId}, post=${postId}`,
          );
          return {
            bookmarked: true,
            message: "이미 북마크에 추가되어 있습니다.",
          };
        }
        throw error;
      }
    });

    return result;
  }

  /**
   * 사용자의 북마크 목록 조회 (페이지네이션)
   */
  async findAll(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<BookmarksResponseDto> {
    const skip = (page - 1) * pageSize;
    const take = page * pageSize;

    const [postTotal, communityTotal, postBookmarks, communityBookmarks] =
      await Promise.all([
        this.bookmarkRepository.count({ where: { userId } }),
        this.communityBookmarkRepository.count({ where: { userId } }),
        this.bookmarkRepository.find({
          where: { userId },
          relations: {
            post: {
              author: true,
              blog: true,
            },
          },
          order: { createdAt: "DESC" },
          take,
        }),
        this.communityBookmarkRepository.find({
          where: { userId },
          relations: {
            post: {
              author: { profile: true },
              community: true,
              thumbnailImage: true,
            },
          },
          order: { createdAt: "DESC" },
          take,
        }),
      ]);

    const postItems = postBookmarks.map((bookmark) =>
      plainToClass(
        BookmarkedPostDto,
        {
          ...bookmark.post,
          sourceType: "blog",
          bookmarkedAt: bookmark.createdAt,
        },
        { excludeExtraneousValues: true },
      ),
    );

    const communityItems = communityBookmarks.map((bookmark) => {
      const post = bookmark.post;
      const author = post?.author;
      const authorProfileImage =
        author?.profileImage ?? author?.profile?.profileImage ?? null;
      const thumbnail =
        post?.thumbnailImage?.fileUrl ??
        (post as any)?.thumbnailUrl ??
        (post as any)?.thumbnailImageUrl ??
        null;
      const excerpt = this.createExcerptFromHtml(
        post?.content || post?.content_markdown || "",
      );
      const likeCount = post?.upvoteCount ?? post?.likeCount ?? 0;

      return plainToClass(
        BookmarkedPostDto,
        {
          id: post?.id,
          title: post?.title,
          slug: post?.slug,
          excerpt,
          thumbnail,
          viewCount: post?.viewCount ?? 0,
          likeCount,
          commentCount: post?.commentCount ?? 0,
          author: author
            ? {
                id: author.id,
                username: author.username,
                profileImage: authorProfileImage,
              }
            : undefined,
          community: post?.community
            ? {
                id: post.community.id,
                slug: post.community.slug,
                name: post.community.name,
                iconUrl: post.community.iconUrl ?? null,
              }
            : undefined,
          publishedAt: post?.createdAt,
          bookmarkedAt: bookmark.createdAt,
          sourceType: "community",
        },
        { excludeExtraneousValues: true },
      );
    });

    const mergedItems = [...postItems, ...communityItems].sort((a, b) => {
      const aTime = new Date(a.bookmarkedAt).getTime();
      const bTime = new Date(b.bookmarkedAt).getTime();
      return bTime - aTime;
    });

    const total = postTotal + communityTotal;
    const items = mergedItems.slice(skip, skip + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 특정 포스트가 북마크되어 있는지 확인
   */
  async isBookmarked(userId: string, postId: string): Promise<boolean> {
    const [postBookmarks, communityBookmarks] = await Promise.all([
      this.bookmarkRepository.count({ where: { userId, postId } }),
      this.communityBookmarkRepository.count({ where: { userId, postId } }),
    ]);
    return postBookmarks > 0 || communityBookmarks > 0;
  }

  /**
   * 여러 포스트의 북마크 여부 확인 (벌크 조회)
   */
  async areBookmarked(
    userId: string,
    postIds: string[],
  ): Promise<Map<string, boolean>> {
    if (!postIds.length) return new Map();

    const bookmarks = await this.bookmarkRepository
      .createQueryBuilder("bookmark")
      .where("bookmark.userId = :userId", { userId })
      .andWhere("bookmark.postId IN (:...postIds)", { postIds })
      .select(["bookmark.postId"])
      .getMany();

    const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));
    const result = new Map<string, boolean>();

    postIds.forEach((postId) => {
      result.set(postId, bookmarkedSet.has(postId));
    });

    return result;
  }

  /**
   * 북마크 삭제 (직접 삭제)
   */
  async remove(userId: string, postId: string): Promise<void> {
    const result = await this.bookmarkRepository.delete({ userId, postId });

    if (result.affected && result.affected > 0) {
      return;
    }

    const communityResult = await this.communityBookmarkRepository.delete({
      userId,
      postId,
    });

    if (communityResult.affected && communityResult.affected > 0) {
      return;
    }

    throw new NotFoundException("북마크를 찾을 수 없습니다.");
  }

  /**
   * 사용자의 모든 북마크 삭제
   */
  async removeAll(userId: string): Promise<void> {
    await this.bookmarkRepository.delete({ userId });
    await this.communityBookmarkRepository.delete({ userId });
    this.logger.log(`All bookmarks removed for user: ${userId}`);
  }

  /**
   * 북마크 통계
   */
  async getStats(
    userId: string,
  ): Promise<{ total: number; recentCount: number }> {
    const [postTotal, communityTotal] = await Promise.all([
      this.bookmarkRepository.count({ where: { userId } }),
      this.communityBookmarkRepository.count({ where: { userId } }),
    ]);
    const total = postTotal + communityTotal;

    // 최근 7일간 북마크 수
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [postRecentCount, communityRecentCount] = await Promise.all([
      this.bookmarkRepository
        .createQueryBuilder("bookmark")
        .where("bookmark.userId = :userId", { userId })
        .andWhere("bookmark.createdAt > :date", { date: sevenDaysAgo })
        .getCount(),
      this.communityBookmarkRepository
        .createQueryBuilder("bookmark")
        .where("bookmark.userId = :userId", { userId })
        .andWhere("bookmark.createdAt > :date", { date: sevenDaysAgo })
        .getCount(),
    ]);
    const recentCount = postRecentCount + communityRecentCount;

    return { total, recentCount };
  }

  /**
   * 단일 포스트 북마크 상태 확인
   */
  async findBookmark(postId: string, userId: string): Promise<Bookmark | null> {
    return this.bookmarkRepository.findOne({
      where: { postId, userId },
    });
  }

  /**
   * 여러 포스트의 북마크 상태 한번에 조회 (최적화)
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns 상태 맵 { postId: bookmarked }
   */
  async getMultipleBookmarkStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (postIds.length === 0) {
      return new Map<string, boolean>();
    }

    // TypeORM Query Builder 사용하여 최적화된 쿼리 실행
    const bookmarks = await this.bookmarkRepository
      .createQueryBuilder("bookmark")
      .select("bookmark.postId")
      .where("bookmark.userId = :userId", { userId })
      .andWhere("bookmark.postId IN (:...postIds)", { postIds })
      .getMany();

    // 결과를 Set으로 변환하여 O(1) 조회 가능
    const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

    // 모든 포스트 ID에 대해 상태 맵 생성
    const statusMap = new Map<string, boolean>();
    postIds.forEach((postId) => {
      statusMap.set(postId, bookmarkedSet.has(postId));
    });

    return statusMap;
  }

  private createExcerptFromHtml(html: string, maxLength = 200): string {
    const text = this.stripHtmlTags(html);
    if (!text) {
      return "";
    }
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  }

  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
}
