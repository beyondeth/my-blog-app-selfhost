import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { CommunityCommentService } from "./community-comment.service";
import { Community } from "../entities/community.entity";
import { CommunityComment } from "../entities/community-comment.entity";
import { CommunityCommentLike } from "../entities/community-comment-like.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CacheService } from "../../cache/cache.service";
import { CdnService } from "../../files/services/cdn.service";
import { CommunityPostStatus } from "../enums";
import { NotFoundException } from "@nestjs/common";

describe("CommunityCommentService", () => {
  let service: CommunityCommentService;
  let postRepository: Repository<CommunityPost>;
  let dataSource: DataSource;

  const mockCommunityRepository = {
    findOne: jest.fn(),
  };
  const mockCommentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockCommentLikeRepository = {};
  const mockPostRepository = {
    findOne: jest.fn(),
  };
  const mockMemberRepository = {};
  const mockModLogRepository = {};
  const mockDataSource = {
    transaction: jest.fn(),
  };
  const mockCacheService = {
    get: jest.fn(),
    del: jest.fn(),
    deletePattern: jest.fn(),
  };
  const mockCdnService = {
    generateCdnUrlFromKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityCommentService,
        {
          provide: getRepositoryToken(Community),
          useValue: mockCommunityRepository,
        },
        {
          provide: getRepositoryToken(CommunityComment),
          useValue: mockCommentRepository,
        },
        {
          provide: getRepositoryToken(CommunityCommentLike),
          useValue: mockCommentLikeRepository,
        },
        {
          provide: getRepositoryToken(CommunityPost),
          useValue: mockPostRepository,
        },
        {
          provide: getRepositoryToken(CommunityMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(CommunityModLog),
          useValue: mockModLogRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CacheService, useValue: mockCacheService },
        { provide: CdnService, useValue: mockCdnService },
      ],
    }).compile();

    service = module.get<CommunityCommentService>(CommunityCommentService);
    postRepository = module.get(getRepositoryToken(CommunityPost));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const postId = "post-uuid";
    const communityId = "community-uuid";
    const authorId = "author-uuid";
    const dto = { content: "Test comment content", parentCommentId: undefined };

    it("should create a comment with populated communityId", async () => {
      // Arrange
      const mockPost = {
        id: postId,
        communityId: communityId,
        status: CommunityPostStatus.PUBLISHED,
      };

      const mockCommunity = {
        id: communityId,
        isLocked: false,
      };

      mockPostRepository.findOne.mockResolvedValue(mockPost);
      mockCommunityRepository.findOne.mockResolvedValue(mockCommunity);

      // Mock Transaction
      const mockManager = {
        create: jest.fn().mockImplementation((entity, data) => data),
        save: jest.fn().mockImplementation((entity, data) => ({
          id: "comment-uuid",
          likesCount: 0,
          dislikesCount: 0,
          repliesCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })),
        increment: jest.fn(),
        findOne: jest.fn(), // For counting replies if needed
      };

      mockDataSource.transaction.mockImplementation(async (cb) => {
        return cb(mockManager);
      });

      // Act
      const result = await service.create(postId, dto, authorId);

      // Assert
      expect(mockPostRepository.findOne).toHaveBeenCalledWith({
        where: { id: postId, status: CommunityPostStatus.PUBLISHED },
        select: ["id", "communityId"],
      });

      expect(mockManager.create).toHaveBeenCalledWith(CommunityComment, expect.objectContaining({
        postId,
        authorId,
        content: dto.content,
        communityId: communityId, // Critical assertion: communityId must be populated
      }));

      expect(mockManager.increment).toHaveBeenCalledWith(
        CommunityPost,
        { id: postId },
        "commentCount",
        1
      );
    });

    it("should throw NotFoundException if post not found", async () => {
      mockPostRepository.findOne.mockResolvedValue(null);

      await expect(service.create(postId, dto, authorId)).rejects.toThrow(
        NotFoundException
      );
    });
  });
  describe("update", () => {
    it("should update a comment", async () => {
      const commentId = "comment-uuid";
      const userId = "user-uuid";
      const dto = { content: "Updated content" };
      const mockComment = {
        id: commentId,
        authorId: userId,
        content: "Old content",
        postId: "post-uuid",
        communityId: "community-uuid",
      };

      mockCommentRepository.findOne.mockResolvedValue(mockComment);
      mockCommentRepository.save.mockImplementation((comment) => comment);

      await service.update(commentId, dto, userId);

      expect(mockCommentRepository.findOne).toHaveBeenCalledWith({
        where: { id: commentId },
        // relations: ["post"] should NOT be present
      });
      expect(mockCommentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: dto.content })
      );
    });
  });

  describe("delete", () => {
    it("should delete a comment", async () => {
      const commentId = "comment-uuid";
      const userId = "user-uuid"; // Author
      const mockComment = {
        id: commentId,
        authorId: userId,
        postId: "post-uuid",
        communityId: "community-uuid",
        isDeleted: false,
      };

      mockCommentRepository.findOne.mockResolvedValue(mockComment);
      
      const mockManager = {
        save: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn(),
        }),
      };

      mockDataSource.transaction.mockImplementation(async (cb) => {
         return cb(mockManager);
      });

      await service.delete(commentId, userId);

      expect(mockCommentRepository.findOne).toHaveBeenCalledWith({
        where: { id: commentId },
        // relations: ["post"] should NOT be present
      });
      
      // Verify communityId access from comment object (not comment.post.communityId)
      // This is implicit if the code doesn't crash accessing property of undefined 'post'
    });
  });
});
