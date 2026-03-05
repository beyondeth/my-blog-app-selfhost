import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CommentsQueryService } from "./comments-query.service";
import { Comment } from "../entities/comment.entity";
import { Post } from "../../posts/entities/post.entity";
import { CommentsReadRepository } from "../repositories/comments-read.repository";
import { CommentsCacheService } from "./comments-cache.service";
import { CommentsMapperService } from "./comments-mapper.service";
import { BlogResolverService } from "../../common/services/blog-resolver.service";
import { Role } from "../../common/enums/role.enum";
import { NotFoundException } from "@nestjs/common";
import { PostAccessPolicyService } from "../../posts/services/post-access-policy.service";

describe("CommentsQueryService", () => {
  let service: CommentsQueryService;

  const mockCommentsReadRepository = {
    findById: jest.fn(),
    countParentComments: jest.fn(),
    getParentCommentsPaginated: jest.fn(),
    getRepliesPaginated: jest.fn(),
    getUserLikes: jest.fn(),
  };

  const mockCommentsCacheService = {
    getCachedFirstPage: jest.fn(),
    setCachedFirstPage: jest.fn(),
  };

  const mockCommentsRepository = {
    findOne: jest.fn(),
  };

  const mockPostsRepository = {
    findOne: jest.fn(),
  };

  const mockBlogResolverService = {
    findBlogById: jest.fn(),
  };

  const mockCommentsMapperService = {
    mapLikesToComments: jest.fn(),
    toCommentDto: jest.fn(),
  };

  const mockPostAccessPolicyService = {
    canReadPost: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsQueryService,
        {
          provide: CommentsReadRepository,
          useValue: mockCommentsReadRepository,
        },
        {
          provide: CommentsCacheService,
          useValue: mockCommentsCacheService,
        },
        {
          provide: CommentsMapperService,
          useValue: mockCommentsMapperService,
        },

        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentsRepository,
        },
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostsRepository,
        },
        {
          provide: BlogResolverService,
          useValue: mockBlogResolverService,
        },
        {
          provide: PostAccessPolicyService,
          useValue: mockPostAccessPolicyService,
        },
      ],
    }).compile();

    service = module.get<CommentsQueryService>(CommentsQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePostAccess (via getRepliesPaginated)", () => {
    it("should throw NotFoundException when non-owner accessing replies of a private blog post", async () => {
      // 1. CommentsRepository(not ReadRepository) findOne mock
      mockCommentsRepository.findOne.mockResolvedValue({
        id: "parent-comment",
        postId: "private-post",
      });

      // 2. 포스트 정보 반환 (작성자: author-1)
      mockPostsRepository.findOne.mockResolvedValue({
        id: "private-post",
        blogId: "blog-1",
        authorId: "author-1",
      });

      // 3. 블로그 정보 반환 (소유자: author-1, 비공개)
      mockBlogResolverService.findBlogById.mockResolvedValue({
        id: "blog-1",
        userId: "author-1",
        isPublic: false,
      });
      mockPostAccessPolicyService.canReadPost.mockReturnValue(false);

      const nonOwnerUser = { id: "user-2", role: "user" } as any;

      await expect(
        service.getRepliesPaginated(
          "parent-comment",
          { limit: 10 },
          nonOwnerUser,
        ),
      ).rejects.toThrow(new NotFoundException("포스트를 찾을 수 없습니다."));
    });

    it("should allow ADMIN to access replies even if the blog is private", async () => {
      // 1. CommentsRepository(not ReadRepository) findOne mock
      mockCommentsRepository.findOne.mockResolvedValue({
        id: "parent-comment",
        postId: "private-post",
      });

      mockPostsRepository.findOne.mockResolvedValue({
        id: "private-post",
        blogId: "blog-1",
        authorId: "author-1",
      });

      mockBlogResolverService.findBlogById.mockResolvedValue({
        id: "blog-1",
        userId: "author-1",
        isPublic: false,
      });
      mockPostAccessPolicyService.canReadPost.mockReturnValue(true);

      mockCommentsReadRepository.getRepliesPaginated.mockResolvedValue({
        comments: [{ id: "reply-1" }],
        hasMore: false,
        totalCount: 1,
      });

      mockCommentsReadRepository.getUserLikes.mockResolvedValue([]);
      mockCommentsMapperService.mapLikesToComments.mockReturnValue([
        { id: "reply-1" },
      ]);
      mockCommentsMapperService.toCommentDto.mockImplementation(
        (comment) => comment,
      );

      const adminUser = { id: "admin-1", role: Role.ADMIN } as any;

      const result = await service.getRepliesPaginated(
        "parent-comment",
        { limit: 10 },
        adminUser,
      );

      // 예외없이 데이터가 반환되어야 함.
      expect(result.comments.length).toBe(1);
      expect(result.comments[0].id).toBe("reply-1");
    });

    it("should throw NotFoundException if parent comment is not found", async () => {
      // 1. CommentsRepository(not ReadRepository) findOne mock
      mockCommentsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getRepliesPaginated("non-existent", { limit: 10 }),
      ).rejects.toThrow(new NotFoundException("부모 댓글을 찾을 수 없습니다."));
    });
  });
});
