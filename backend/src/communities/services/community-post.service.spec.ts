import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { CommunityPostService } from "./community-post.service";
import { Community } from "../entities/community.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CommunityPostLike } from "../entities/community-post-like.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityFlair } from "../entities/community-flair.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CacheService } from "../../cache/cache.service";
import { RedisLockService } from "../../redis/redis-lock.service";
import { CommunityPostViewService } from "./community-post-view.service";
import { HtmlSanitizerService } from "../../content-processing/services/html-sanitizer.service";
import { CommunityPostStatus } from "../enums";

describe("CommunityPostService content sanitization", () => {
  let service: CommunityPostService;

  const communityRepository = {
    findOne: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };
  const postRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const likeRepository = { find: jest.fn() };
  const memberRepository = { findOne: jest.fn() };
  const flairRepository = { findOne: jest.fn() };
  const modLogRepository = { save: jest.fn() };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    deletePattern: jest.fn(),
  };
  const redisLockService = { withLock: jest.fn() };
  const communityPostViewService = { bufferView: jest.fn() };
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPostService,
        HtmlSanitizerService,
        {
          provide: getRepositoryToken(Community),
          useValue: communityRepository,
        },
        {
          provide: getRepositoryToken(CommunityPost),
          useValue: postRepository,
        },
        {
          provide: getRepositoryToken(CommunityPostLike),
          useValue: likeRepository,
        },
        {
          provide: getRepositoryToken(CommunityMember),
          useValue: memberRepository,
        },
        {
          provide: getRepositoryToken(CommunityFlair),
          useValue: flairRepository,
        },
        {
          provide: getRepositoryToken(CommunityModLog),
          useValue: modLogRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: CacheService, useValue: cacheService },
        { provide: RedisLockService, useValue: redisLockService },
        {
          provide: CommunityPostViewService,
          useValue: communityPostViewService,
        },
      ],
    }).compile();

    service = module.get(CommunityPostService);
    communityRepository.findOne.mockResolvedValue({
      id: "community-id",
      slug: "security",
      isLocked: false,
    });
    postRepository.create.mockImplementation((value) => ({
      id: "post-id",
      slug: "post-slug",
      ...value,
    }));
    postRepository.save.mockImplementation(async (value) => value);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sanitizes title and HTML before creating a post", async () => {
    await service.create(
      "community-id",
      {
        title: '<img src=x onerror="alert(1)">Safe title',
        content:
          '<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>',
        isPublished: false,
      },
      "author-id",
    );

    expect(postRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Safe title",
        content: expect.not.stringContaining("<script"),
      }),
    );

    const created = postRepository.create.mock.calls[0][0];
    expect(created.content).not.toContain("onerror");
    expect(created.content).not.toContain("javascript:");
    expect(created.content).toContain("<p>Safe</p>");
  });

  it("rejects a title that becomes empty after sanitization", async () => {
    await expect(
      service.create(
        "community-id",
        {
          title: "<script>alert(1)</script>",
          content: "<p>Safe body</p>",
          isPublished: false,
        },
        "author-id",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sanitizes HTML when an author updates a post", async () => {
    postRepository.findOne.mockResolvedValue({
      id: "post-id",
      slug: "post-slug",
      communityId: "community-id",
      authorId: "author-id",
      title: "Old title",
      content: "<p>Old</p>",
      status: CommunityPostStatus.PUBLISHED,
      community: { slug: "security" },
    });

    const updated = await service.update(
      "post-id",
      {
        title: "Updated <img src=x onerror=alert(1)>",
        content:
          '<p>Updated</p><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
      },
      "author-id",
    );

    expect(updated.title).toBe("Updated");
    expect(updated.content).toContain("<p>Updated</p>");
    expect(updated.content).not.toContain("onerror");
    expect(updated.content).not.toContain("javascript:");
  });

  it("sanitizes legacy cached content before returning it", async () => {
    cacheService.get.mockResolvedValue({
      id: "post-id",
      slug: "post-slug",
      communityId: "community-id",
      authorId: "author-id",
      title: '<img src=x onerror="alert(1)">Legacy title',
      content:
        '<p>Legacy</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
      status: CommunityPostStatus.PUBLISHED,
    });
    communityPostViewService.bufferView.mockResolvedValue(undefined);

    const result = await service.findBySlug("security", "post-slug");

    expect(result.title).toBe("Legacy title");
    expect(result.content).toContain("<p>Legacy</p>");
    expect(result.content).not.toContain("<script");
    expect(result.content).not.toContain("onerror");
  });
});
