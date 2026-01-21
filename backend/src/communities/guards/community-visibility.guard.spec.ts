import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException } from "@nestjs/common";
import { CommunityVisibilityGuard } from "./community-visibility.guard";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { JoinPolicy, MembershipStatus } from "../enums";

describe("CommunityVisibilityGuard", () => {
  let guard: CommunityVisibilityGuard;

  const mockCommunityRepository = {
    findOne: jest.fn(),
  };
  const mockMemberRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityVisibilityGuard,
        {
          provide: getRepositoryToken(Community),
          useValue: mockCommunityRepository,
        },
        {
          provide: getRepositoryToken(CommunityMember),
          useValue: mockMemberRepository,
        },
      ],
    }).compile();

    guard = module.get<CommunityVisibilityGuard>(CommunityVisibilityGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createContext = (request: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  it("allows access to public community without login", async () => {
    mockCommunityRepository.findOne.mockResolvedValue({
      id: "community-id",
      slug: "public-community",
      joinPolicy: JoinPolicy.OPEN,
    });

    const result = await guard.canActivate(
      createContext({ params: { slug: "public-community" } }),
    );

    expect(result).toBe(true);
  });

  it("blocks non-member access to private community", async () => {
    mockCommunityRepository.findOne.mockResolvedValue({
      id: "community-id",
      slug: "private-community",
      joinPolicy: JoinPolicy.PRIVATE,
    });
    mockMemberRepository.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({
          params: { slug: "private-community" },
          user: { id: "user-id" },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows active member access to private community", async () => {
    mockCommunityRepository.findOne.mockResolvedValue({
      id: "community-id",
      slug: "private-community",
      joinPolicy: JoinPolicy.PRIVATE,
    });
    mockMemberRepository.findOne.mockResolvedValue({
      id: "member-id",
      status: MembershipStatus.ACTIVE,
    });

    const result = await guard.canActivate(
      createContext({
        params: { slug: "private-community" },
        user: { id: "user-id" },
      }),
    );

    expect(result).toBe(true);
  });
});
