import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CommentsService } from "./comments.service";
import { Comment } from "./entities/comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { PostsService } from "../posts/posts.service";
import { BlogResolverService } from "../common/services/blog-resolver.service";
import { CacheService } from "../cache/cache.service";
import { CacheMetricsService } from "../metrics/cache-metrics.service";
import { CdnService } from "../files/services/cdn.service";
import { IpSecurityService } from "../common/services/ip-security.service";
import { User } from "../users/entities/user.entity";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Role } from "../common/enums/role.enum";

// Fix for ESM module 'marked' causing Jest syntax error
jest.mock("marked", () => ({
  marked: { parse: jest.fn() },
}));

describe("CommentsService", () => {
  let service: CommentsService;
  let commentsRepository: Repository<Comment>;
  let postsService: PostsService;
  let blogResolverService: BlogResolverService;
  
  const mockComment = {
    id: "comment-uuid",
    author: { id: "user-uuid" },
    post: { id: "post-uuid" },
    postId: "post-uuid",
    isDeleted: false,
    parentCommentId: null,
  } as unknown as Comment;

  const mockCommentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const mockCommentLikesRepository = {};
  const mockPostsService = {
    findOne: jest.fn(),
    incrementCommentCount: jest.fn(),
    decrementCommentCount: jest.fn(),
  };
  const mockBlogResolverService = {
    findBlogById: jest.fn(),
  };
  const mockCacheService = {
    get: jest.fn(),
    del: jest.fn(),
    deletePattern: jest.fn(),
  };
  const mockCacheMetricsService = {
    recordCacheMiss: jest.fn(),
    recordCacheHit: jest.fn(),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };
  const mockCdnService = {};
  const mockIpSecurityService = {
    checkIpStatus: jest.fn().mockResolvedValue(true),
    encrypt: jest.fn().mockReturnValue("encrypted-ip"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentsRepository,
        },
        {
          provide: getRepositoryToken(CommentLike),
          useValue: mockCommentLikesRepository,
        },
        { provide: PostsService, useValue: mockPostsService },
        { provide: BlogResolverService, useValue: mockBlogResolverService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: CacheMetricsService, useValue: mockCacheMetricsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: CdnService, useValue: mockCdnService },
        { provide: IpSecurityService, useValue: mockIpSecurityService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentsRepository = module.get(getRepositoryToken(Comment));
    postsService = module.get(PostsService);
    blogResolverService = module.get(BlogResolverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createCommentDto = {
      content: "Test comment",
      postId: "post-uuid",
      parentCommentId: undefined,
    };

    const mockUser = {
      id: "user-uuid",
      username: "testuser",
      role: Role.USER,
    } as unknown as User;
    const blogId = "blog-uuid";

    it("should create a comment with populated blogId", async () => {
      // Arrange
      const mockPost = {
        id: createCommentDto.postId,
        blogId: blogId,
      };
      const mockBlog = {
        id: blogId,
        allowComments: true,
      };

      mockPostsService.findOne.mockResolvedValue(mockPost);
      mockBlogResolverService.findBlogById.mockResolvedValue(mockBlog);
      mockCommentsRepository.create.mockImplementation((data) => data);
      
      const savedComment = {
        id: "comment-uuid",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...createCommentDto,
        blogId,
        author: mockUser,
      };

      mockCommentsRepository.save.mockResolvedValue(savedComment);
      mockCommentsRepository.findOne.mockResolvedValue(savedComment); // Return saved comment for re-fetch

      // Act
      const result = await service.create(createCommentDto, mockUser);

      // Assert
      expect(mockPostsService.findOne).toHaveBeenCalledWith(createCommentDto.postId);
      expect(mockBlogResolverService.findBlogById).toHaveBeenCalledWith(blogId);
      
      expect(mockCommentsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        content: createCommentDto.content,
        post: { id: createCommentDto.postId },
        blogId: blogId, // Critical assertion: blogId must be populated
        author: mockUser,
      }));
      expect(mockCommentsRepository.findOne).toHaveBeenCalledWith({
        where: { id: savedComment.id },
        relations: ["author", "author.profile"],
      });
    });

    it("should throw NotFoundException if post not found", async () => {
      mockPostsService.findOne.mockResolvedValue(null);

      await expect(service.create(createCommentDto, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw ForbiddenException if blog does not allow comments", async () => {
      const mockPost = {
        id: createCommentDto.postId,
        blogId: blogId,
      };
      const mockBlog = {
        id: blogId,
        allowComments: false,
      };

      mockPostsService.findOne.mockResolvedValue(mockPost);
      mockBlogResolverService.findBlogById.mockResolvedValue(mockBlog);

      await expect(service.create(createCommentDto, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });
  describe("remove", () => {
    it("should remove a comment and decrement counts", async () => {
      const commentId = "comment-uuid";
      const user = { id: "user-uuid" } as User;

      mockCommentsRepository.findOne.mockResolvedValue(mockComment);

      await service.remove(commentId, user);

      expect(mockCommentsRepository.findOne).toHaveBeenCalledWith({
        where: { id: commentId },
        relations: ["author"],
      });
      expect(mockCommentsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true })
      );
      expect(mockPostsService.decrementCommentCount).toHaveBeenCalledWith(
        mockComment.postId
      );
    });

    it("should throw ForbiddenException if user is not author", async () => {
      const commentId = "comment-uuid";
      const user = { id: "other-user-uuid" } as User;

      mockCommentsRepository.findOne.mockResolvedValue(mockComment);

      await expect(service.remove(commentId, user)).rejects.toThrow(
        ForbiddenException
      );
    });
  });
});
