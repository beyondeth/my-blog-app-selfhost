jest.mock("./queues/post-processing.queue", () => ({
  POST_PROCESSING_QUEUE: "post-processing",
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Blog } from "../blogs/entities/blog.entity";
import { Role } from "../common/enums/role.enum";
import { FileContext } from "../files/entities/file-context.entity";
import { File } from "../files/entities/file.entity";
import { User } from "../users/entities/user.entity";
import { Post } from "./entities/post.entity";
import { PostMetadata } from "./entities/post-metadata.entity";
import { PostStats } from "./entities/post-stats.entity";
import { PostsService } from "./posts.service";
import { PostCreationService } from "./services/post-creation.service";
import { PostMapperService } from "./services/post-mapper.service";

describe("PostsService facade", () => {
  let service: PostsService;

  const postCreationService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const postMapperService = {
    toPostDto: jest.fn(),
  };

  const user = {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    role: Role.USER,
  } as User;

  beforeEach(async () => {
    const repositoryTokens = [
      Post,
      PostStats,
      PostMetadata,
      File,
      FileContext,
      Blog,
    ].map((entity) => ({
      provide: getRepositoryToken(entity),
      useValue: {},
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [PostsService, ...repositoryTokens],
    })
      .useMocker((token) => {
        if (token === PostCreationService) {
          return postCreationService;
        }
        if (token === PostMapperService) {
          return postMapperService;
        }
        return {};
      })
      .compile();

    service = module.get(PostsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("delegates post creation and maps the resulting post", async () => {
    const createPostDto = {
      title: "Test Post",
      content: "<p>Test content</p>",
      category: "Test Category",
    } as any;
    const files = [{ id: "file-1" }] as File[];
    const post = {
      id: "post-1",
      blog: { id: "blog-1", slug: "test-blog" },
    } as Post;
    const mappedPost = { id: "post-1", title: "Test Post" } as any;
    postCreationService.create.mockResolvedValue(post);
    postMapperService.toPostDto.mockResolvedValue(mappedPost);

    await expect(
      service.create(createPostDto, user, files, "127.0.0.1", "organization-1"),
    ).resolves.toBe(mappedPost);

    expect(postCreationService.create).toHaveBeenCalledWith(
      createPostDto,
      user,
      files,
      "127.0.0.1",
      "organization-1",
    );
    expect(postMapperService.toPostDto).toHaveBeenCalledWith(post, {
      user,
      blog: post.blog,
    });
  });

  it("uses the same creation contract for the MCP fast path", async () => {
    const createPostDto = {
      title: "Fast Post",
      content: "<p>Fast content</p>",
      category: "Test Category",
    } as any;
    const post = {
      id: "post-fast",
      blog: { id: "blog-1", slug: "test-blog" },
    } as Post;
    const mappedPost = { id: "post-fast" } as any;
    postCreationService.create.mockResolvedValue(post);
    postMapperService.toPostDto.mockResolvedValue(mappedPost);

    await expect(
      service.createFast(createPostDto, user, "organization-1"),
    ).resolves.toBe(mappedPost);

    expect(postCreationService.create).toHaveBeenCalledWith(
      createPostDto,
      user,
      undefined,
      undefined,
      "organization-1",
    );
  });

  it("delegates updates and maps the updated post", async () => {
    const updatePostDto = { title: "Updated Post" } as any;
    const post = {
      id: "post-1",
      blog: { id: "blog-1", slug: "test-blog" },
    } as Post;
    const mappedPost = { id: "post-1", title: "Updated Post" } as any;
    postCreationService.update.mockResolvedValue(post);
    postMapperService.toPostDto.mockResolvedValue(mappedPost);

    await expect(
      service.update(
        "post-1",
        updatePostDto,
        user,
        undefined,
        "organization-1",
      ),
    ).resolves.toBe(mappedPost);

    expect(postCreationService.update).toHaveBeenCalledWith(
      "post-1",
      updatePostDto,
      user,
      undefined,
      "organization-1",
    );
    expect(postMapperService.toPostDto).toHaveBeenCalledWith(post, {
      user,
      blog: post.blog,
    });
  });
});
