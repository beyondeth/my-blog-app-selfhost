import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, DataSource } from "typeorm";
import { Bookmark } from "./entities/bookmark.entity";
import { Post } from "../posts/entities/post.entity";
import {
  BookmarkedPostDto,
  BookmarksResponseDto,
  ToggleBookmarkResponseDto,
} from "./dto/bookmark-response.dto";
import { plainToClass } from "class-transformer";
import { OutboxService } from "../common/services/outbox.service";

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
    private dataSource: DataSource,
    private outboxService: OutboxService,
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
      relations: ["blog"],
    });

    if (!post) {
      throw new NotFoundException("포스트를 찾을 수 없습니다.");
    }

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

        const result = {
          bookmarked: false,
          message: "북마크가 제거되었습니다.",
        };

        await this.enqueueBookmarkEvent(
          manager,
          postId,
          userId,
          result.bookmarked,
          post,
        );
        return result;
      } else {
        // 북마크 추가
        try {
          const bookmark = bookmarkRepo.create({ userId, postId });
          await bookmarkRepo.save(bookmark);
          this.logger.log(`Bookmark added: user=${userId}, post=${postId}`);

          const result = {
            bookmarked: true,
            message: "북마크에 추가되었습니다.",
          };
          await this.enqueueBookmarkEvent(
            manager,
            postId,
            userId,
            result.bookmarked,
            post,
          );
          return result;
        } catch (error) {
          // 동시에 같은 북마크를 추가하려고 시도한 경우 (unique constraint violation)
          if (error.code === "23505") {
            this.logger.warn(
              `Duplicate bookmark attempt: user=${userId}, post=${postId}`,
            );
            const result = {
              bookmarked: true,
              message: "이미 북마크에 추가되어 있습니다.",
            };
            return result;
          }
          throw error;
        }
      }
    });

    return result;
  }

  private async enqueueBookmarkEvent(
    manager: EntityManager,
    postId: string,
    userId: string,
    bookmarked: boolean,
    post: Post,
  ): Promise<void> {
    await this.outboxService.enqueue(manager, {
      eventType: "post.bookmark.toggled",
      aggregateType: "post",
      aggregateId: postId,
      organizationId: post.blog?.organizationId || null,
      payload: {
        postId,
        userId,
        bookmarked,
        timestamp: new Date(),
      },
    });
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

    // 북마크와 포스트 정보를 함께 조회
    const [bookmarks, total] = await this.bookmarkRepository.findAndCount({
      where: { userId },
      relations: {
        post: {
          author: true,
          blog: true,
        },
      },
      order: { createdAt: "DESC" }, // 최신 북마크순
      skip,
      take: pageSize,
    });

    // DTO로 변환
    const items = bookmarks.map((bookmark) => {
      const dto = plainToClass(
        BookmarkedPostDto,
        {
          ...bookmark.post,
          bookmarkedAt: bookmark.createdAt,
        },
        { excludeExtraneousValues: true },
      );
      return dto;
    });

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
    const count = await this.bookmarkRepository.count({
      where: { userId, postId },
    });
    return count > 0;
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

    if (result.affected === 0) {
      throw new NotFoundException("북마크를 찾을 수 없습니다.");
    }
  }

  /**
   * 사용자의 모든 북마크 삭제
   */
  async removeAll(userId: string): Promise<void> {
    await this.bookmarkRepository.delete({ userId });
    this.logger.log(`All bookmarks removed for user: ${userId}`);
  }

  /**
   * 북마크 통계
   */
  async getStats(
    userId: string,
  ): Promise<{ total: number; recentCount: number }> {
    const total = await this.bookmarkRepository.count({ where: { userId } });

    // 최근 7일간 북마크 수
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await this.bookmarkRepository
      .createQueryBuilder("bookmark")
      .where("bookmark.userId = :userId", { userId })
      .andWhere("bookmark.createdAt > :date", { date: sevenDaysAgo })
      .getCount();

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
}
