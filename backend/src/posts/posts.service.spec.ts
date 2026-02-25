import { Test, TestingModule } from "@nestjs/testing";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PostsService } from "./posts.service";
import { Post } from "./entities/post.entity";
import { PostStats } from "./entities/post-stats.entity";
import { PostMetadata } from "./entities/post-metadata.entity";
import { File } from "../files/entities/file.entity";
import { FileContext } from "../files/entities/file-context.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { User } from "../users/entities/user.entity";
import { FilesService } from "../files/files.service";
import { CdnService } from "../files/services/cdn.service";
import { MarkdownRendererService } from "../common/services/markdown-renderer.service";
import { ContentProcessingService } from "../content-processing/services/content-processing.service";
import { CacheService } from "../cache/cache.service";
import { CacheMetricsService } from "../metrics/cache-metrics.service";
import { BookmarksService } from "../bookmarks/bookmarks.service";
import { LikeService } from "./services/like.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RedisLockService } from "../redis/redis-lock.service";
import { PostMapperService } from "./services/post-mapper.service";
import { PostCacheService } from "./services/post-cache.service";
import { PostFileService } from "./services/post-file.service";
import { PostContentService } from "./services/post-content.service";
import { PostReadService } from "./services/post-read.service";
import { PostInteractionService } from "./services/post-interaction.service";
import { PostCreationService } from "./services/post-creation.service";
import { ThumbnailService } from "./services/thumbnail.service";
import { CloudflareService } from "../cloudflare/cloudflare.service";
import { DataSource } from "typeorm";
import { getQueueToken } from "@nestjs/bullmq";
import { POST_PROCESSING_QUEUE } from "./queues/post-processing.queue";

describe("PostsService - Facade", () => {
  let service: PostsService;
  let postCreationService: jest.Mocked<PostCreationService>;
  let postMapperService: jest.Mocked<PostMapperService>;

  beforeEach(async () => {
    const mockPostCreationService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockPostMapperService = {
      toPostDto: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Post), useValue: {} },
        { provide: getRepositoryToken(PostStats), useValue: {} },
        { provide: getRepositoryToken(PostMetadata), useValue: {} },
        { provide: getRepositoryToken(File), useValue: {} },
        { provide: getRepositoryToken(FileContext), useValue: {} },
        { provide: getRepositoryToken(Blog), useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: CdnService, useValue: {} },
        { provide: MarkdownRendererService, useValue: {} },
        { provide: ContentProcessingService, useValue: {} },
        { provide: CacheService, useValue: {} },
        { provide: CacheMetricsService, useValue: {} },
        { provide: BookmarksService, useValue: {} },
        { provide: LikeService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
        { provide: RedisLockService, useValue: {} },
        { provide: PostMapperService, useValue: mockPostMapperService },
        { provide: PostCacheService, useValue: {} },
        { provide: PostFileService, useValue: {} },
        { provide: PostContentService, useValue: {} },
        { provide: PostReadService, useValue: {} },
        { provide: PostInteractionService, useValue: {} },
        { provide: PostCreationService, useValue: mockPostCreationService },
        { provide: ThumbnailService, useValue: {} },
        { provide: CloudflareService, useValue: {} },
        { provide: getQueueToken(POST_PROCESSING_QUEUE), useValue: {} },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postCreationService = module.get(
      PostCreationService,
    ) as jest.Mocked<PostCreationService>;
    postMapperService = module.get(
      PostMapperService,
    ) as jest.Mocked<PostMapperService>;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should delegate to PostCreationService and map to DTO", async () => {
      const mockDto: any = { title: "Test" };
      const mockUser: any = { id: "user1" };
      const mockPost: any = { id: "post1", blog: {} };
      const mockResponseDto: any = { id: "post1", title: "Test" };

      postCreationService.create.mockResolvedValue(mockPost);
      postMapperService.toPostDto.mockResolvedValue(mockResponseDto);

      const result = await service.create(mockDto, mockUser);

      expect(postCreationService.create).toHaveBeenCalledWith(
        mockDto,
        mockUser,
        undefined,
        undefined,
      );
      expect(postMapperService.toPostDto).toHaveBeenCalledWith(mockPost, {
        user: mockUser,
        blog: mockPost.blog,
      });
      expect(result).toEqual(mockResponseDto);
    });
  });
});
