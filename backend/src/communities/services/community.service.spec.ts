import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { CommunityService } from "./community.service";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { CommunityRule } from "../entities/community-rule.entity";
import { CommunityFlair } from "../entities/community-flair.entity";
import { CommunityModLog } from "../entities/community-mod-log.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CacheService } from "../../cache/cache.service";
import { JoinPolicy } from "../enums";

describe("CommunityService - Visibility Rules", () => {
  let service: CommunityService;
  const mockCommunityRepository = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockMemberRepository = {
    find: jest.fn(),
  };
  const mockRuleRepository = {};
  const mockFlairRepository = {};
  const mockModLogRepository = {
    save: jest.fn(),
  };
  const mockPostRepository = {};
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    deletePattern: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: getRepositoryToken(Community),
          useValue: mockCommunityRepository,
        },
        {
          provide: getRepositoryToken(CommunityMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(CommunityRule),
          useValue: mockRuleRepository,
        },
        {
          provide: getRepositoryToken(CommunityFlair),
          useValue: mockFlairRepository,
        },
        {
          provide: getRepositoryToken(CommunityModLog),
          useValue: mockModLogRepository,
        },
        {
          provide: getRepositoryToken(CommunityPost),
          useValue: mockPostRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildQueryBuilder = (items: any[] = []) => {
    const qb: any = {
      conditions: [] as Array<{ condition: any; params?: any }>,
      joins: [] as any[],
      orderBys: [] as any[],
      andWhere(condition: any, params?: any) {
        qb.conditions.push({ condition, params });
        return qb;
      },
      leftJoin(...args: any[]) {
        qb.joins.push(args);
        return qb;
      },
      orderBy(...args: any[]) {
        qb.orderBys.push(args);
        return qb;
      },
      addOrderBy(...args: any[]) {
        qb.orderBys.push(args);
        return qb;
      },
      take() {
        return qb;
      },
      getMany: jest.fn().mockResolvedValue(items),
    };
    return qb;
  };

  it("forces visibility off when creating private community", async () => {
    mockCommunityRepository.findOne.mockResolvedValue(null);

    const mockManager = {
      create: jest.fn((entity: any, data: any) => ({ ...data })),
      save: jest.fn((entityOrObj: any, maybeObj?: any) => {
        const payload = maybeObj ?? entityOrObj;
        if (payload?.memberCount !== undefined) {
          return { ...payload, id: "community-id", slug: payload.slug };
        }
        return payload;
      }),
    };

    mockDataSource.transaction.mockImplementation(async (fn: any) =>
      fn(mockManager),
    );

    await service.create("user-id", {
      name: "Private Community",
      slug: "private-community",
      joinPolicy: JoinPolicy.PRIVATE,
      isPublic: true,
      isPostDiscoverable: true,
    });

    const communityCreateCall = mockManager.create.mock.calls.find(
      ([entity]) => entity === Community,
    );
    expect(communityCreateCall).toBeTruthy();
    const createdPayload = communityCreateCall?.[1];
    expect(createdPayload.isPublic).toBe(false);
    expect(createdPayload.isPostDiscoverable).toBe(false);
  });

  it("restores default visibility when leaving private policy", async () => {
    const existingCommunity = {
      id: "community-id",
      slug: "private-community",
      joinPolicy: JoinPolicy.PRIVATE,
      isPublic: false,
      isPostDiscoverable: false,
    };

    mockCommunityRepository.findOne.mockResolvedValue(existingCommunity);
    mockCommunityRepository.save.mockImplementation(
      async (payload: any) => payload,
    );

    const updated = await service.update(
      existingCommunity.id,
      { joinPolicy: JoinPolicy.OPEN },
      "moderator-id",
    );

    expect(updated.isPublic).toBe(true);
    expect(updated.isPostDiscoverable).toBe(true);
    expect(mockCacheService.deletePattern).toHaveBeenCalledWith(
      "feed:unified:*",
    );
  });

  it("forces visibility off when switching to private policy", async () => {
    const existingCommunity = {
      id: "community-id",
      slug: "public-community",
      joinPolicy: JoinPolicy.OPEN,
      isPublic: true,
      isPostDiscoverable: true,
    };

    mockCommunityRepository.findOne.mockResolvedValue(existingCommunity);
    mockCommunityRepository.save.mockImplementation(
      async (payload: any) => payload,
    );

    const updated = await service.update(
      existingCommunity.id,
      {
        joinPolicy: JoinPolicy.PRIVATE,
        isPublic: true,
        isPostDiscoverable: true,
      },
      "moderator-id",
    );

    expect(updated.isPublic).toBe(false);
    expect(updated.isPostDiscoverable).toBe(false);
  });

  describe("Community list/search queries", () => {
    it("filters out private communities for anonymous users", async () => {
      const qb = buildQueryBuilder([
        {
          id: "community-id",
          name: "커뮤니티",
          createdAt: new Date(),
          memberCount: 1,
        },
      ]);
      mockCommunityRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 10 }, undefined);

      const conditions = qb.conditions.map((entry) => entry.condition);
      expect(conditions).toContain("community.isPublic = true");
      expect(conditions).toContain("community.joinPolicy != :privatePolicy");
    });

    it("allows joined communities even when private", async () => {
      const qb = buildQueryBuilder([
        {
          id: "community-id",
          name: "커뮤니티",
          createdAt: new Date(),
          memberCount: 1,
        },
      ]);
      mockCommunityRepository.createQueryBuilder.mockReturnValue(qb);
      mockMemberRepository.find.mockResolvedValue([]);

      await service.findAll({ limit: 10 }, "user-id");

      const conditions = qb.conditions.map((entry) => entry.condition);
      const hasVisibilityCondition = conditions.some(
        (condition) =>
          typeof condition === "string" &&
          condition.includes("community.isPublic = true") &&
          condition.includes("community.joinPolicy != :privatePolicy") &&
          condition.includes("cm.communityId IS NOT NULL"),
      );
      expect(hasVisibilityCondition).toBe(true);
      expect(qb.joins.length).toBeGreaterThan(0);
    });

    it("adds search filter for name/description", async () => {
      const qb = buildQueryBuilder([
        {
          id: "community-id",
          name: "커뮤니티",
          createdAt: new Date(),
          memberCount: 1,
        },
      ]);
      mockCommunityRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 10, search: "커뮤니티" }, undefined);

      const conditions = qb.conditions.map((entry) => entry.condition);
      expect(conditions).toContain(
        "(community.name ILIKE :search OR community.description ILIKE :search)",
      );
    });
  });
});
