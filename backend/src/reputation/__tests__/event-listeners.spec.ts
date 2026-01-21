/**
 * 평판 시스템 - 이벤트 리스너 통합 테스트
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PostEventsListener } from "../listeners/post.events.listener";
import { CommentEventsListener } from "../listeners/comment.events.listener";
import { ReactionEventsListener } from "../listeners/reaction.events.listener";
import { LedgerService } from "../services/ledger.service";
import { Post } from "../../posts/entities/post.entity";
import { ReputationAction } from "../enums/reputation-action.enum";

describe("Event Listeners", () => {
  let postListener: PostEventsListener;
  let commentListener: CommentEventsListener;
  let reactionListener: ReactionEventsListener;
  let ledgerService: jest.Mocked<LedgerService>;
  let postRepository: jest.Mocked<any>;

  const mockLedgerService = {
    record: jest.fn(),
  };

  const mockPostRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostEventsListener,
        CommentEventsListener,
        ReactionEventsListener,
        {
          provide: LedgerService,
          useValue: mockLedgerService,
        },
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostRepository,
        },
      ],
    }).compile();

    postListener = module.get<PostEventsListener>(PostEventsListener);
    commentListener = module.get<CommentEventsListener>(CommentEventsListener);
    reactionListener = module.get<ReactionEventsListener>(
      ReactionEventsListener,
    );
    ledgerService = module.get(LedgerService) as jest.Mocked<LedgerService>;
    postRepository = module.get(getRepositoryToken(Post));

    jest.clearAllMocks();
  });

  describe("PostEventsListener", () => {
    it("포스트 생성 시 POST_PUBLISHED 점수가 기록되어야 함", async () => {
      // BlogPostEvent 타입에 맞게 payload 구성
      const payload = {
        postId: "post-123",
        userId: "author-456", // authorId 대신 userId 사용 (BlogPostEvent 요구사항)
        title: "테스트 포스트",
        blogId: "blog-789",
      } as any;

      await postListener.handlePostCreated(payload);

      expect(mockLedgerService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: payload.userId,
          actionType: ReputationAction.POST_PUBLISHED,
          targetType: "post",
          targetId: payload.postId,
        }),
      );
    });
  });

  describe("CommentEventsListener", () => {
    it("댓글 작성 시 COMMENT_ADDED 점수가 기록되어야 함", async () => {
      const payload = {
        commentId: "comment-123",
        postId: "post-456",
        authorId: "author-789",
        content: "테스트 댓글",
        timestamp: new Date(),
      };

      await commentListener.handleCommentAdded(payload);

      expect(mockLedgerService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: payload.authorId,
          actionType: ReputationAction.COMMENT_ADDED,
          targetType: "comment",
          targetId: payload.commentId,
        }),
      );
    });
  });

  describe("ReactionEventsListener", () => {
    it("좋아요 추가 시 포스트 작성자에게 LIKE_RECEIVED 점수가 기록되어야 함", async () => {
      const payload = {
        postId: "post-123",
        userId: "liker-456",
        liked: true,
        likeCount: 10,
        timestamp: new Date(),
      };

      mockPostRepository.findOne.mockResolvedValue({
        id: payload.postId,
        authorId: "author-789",
      });

      await reactionListener.handleLikeToggled(payload);

      expect(mockLedgerService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "author-789", // 포스트 작성자
          actionType: ReputationAction.LIKE_RECEIVED,
          actorId: payload.userId,
        }),
      );
    });

    it("좋아요 취소 시 점수가 기록되지 않아야 함", async () => {
      const payload = {
        postId: "post-123",
        userId: "liker-456",
        liked: false, // 좋아요 취소
        likeCount: 9,
        timestamp: new Date(),
      };

      await reactionListener.handleLikeToggled(payload);

      expect(mockLedgerService.record).not.toHaveBeenCalled();
    });
  });
});
