/**
 * 평판 시스템 - LedgerService 단위 테스트
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LedgerService } from "../services/ledger.service";
import { ReputationLedger } from "../entities/reputation-ledger.entity";
import { UnifiedRedisService } from "../../redis/unified-redis.service";
import {
  ReputationAction,
  REPUTATION_ACTION_SCORES,
} from "../enums/reputation-action.enum";

describe("LedgerService", () => {
  let service: LedgerService;
  let ledgerRepository: jest.Mocked<Repository<ReputationLedger>>;
  let redisService: jest.Mocked<UnifiedRedisService>;

  const mockLedgerRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    setWithExpiry: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getRepositoryToken(ReputationLedger),
          useValue: mockLedgerRepository,
        },
        {
          provide: UnifiedRedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    ledgerRepository = module.get(getRepositoryToken(ReputationLedger));
    redisService = module.get(UnifiedRedisService);

    jest.clearAllMocks();
  });

  describe("record", () => {
    const userId = "user-123";
    const targetId = "post-456";

    it("POST_PUBLISHED 액션에 기본 점수가 적용되어야 함", async () => {
      const dto = {
        userId,
        actionType: ReputationAction.POST_PUBLISHED,
        targetType: "post",
        targetId,
        delta: 0, // 기본 점수 사용
      };

      const expectedDelta =
        REPUTATION_ACTION_SCORES[ReputationAction.POST_PUBLISHED];
      const mockLedger = { id: "ledger-1", ...dto, delta: expectedDelta };

      mockRedisService.get.mockResolvedValue(null); // 쿨다운 없음
      mockLedgerRepository.create.mockReturnValue(mockLedger);
      mockLedgerRepository.save.mockResolvedValue(mockLedger);

      const result = await service.record(dto);

      expect(result).toBeDefined();
      expect(result.delta).toBe(expectedDelta);
      expect(mockLedgerRepository.save).toHaveBeenCalled();
    });

    it("셀프 반응은 차단되어야 함", async () => {
      const dto = {
        userId,
        actionType: ReputationAction.LIKE_RECEIVED,
        targetType: "post",
        targetId,
        delta: 0,
        actorId: userId, // 자기 자신에게 좋아요
      };

      const result = await service.record(dto);

      expect(result).toBeNull();
      expect(mockLedgerRepository.save).not.toHaveBeenCalled();
    });

    it("쿨다운 중인 액션은 차단되어야 함", async () => {
      const dto = {
        userId,
        actionType: ReputationAction.COMMENT_ADDED,
        targetType: "comment",
        targetId: "comment-789",
        delta: 0,
      };

      mockRedisService.get.mockResolvedValue("1"); // 쿨다운 활성

      const result = await service.record(dto);

      expect(result).toBeNull();
      expect(mockLedgerRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("REPUTATION_ACTION_SCORES (exported constant)", () => {
    it("각 액션에 올바른 점수가 매핑되어야 함", () => {
      // Public constant를 테스트
      expect(REPUTATION_ACTION_SCORES[ReputationAction.POST_PUBLISHED]).toBe(
        10,
      );
      expect(REPUTATION_ACTION_SCORES[ReputationAction.COMMENT_ADDED]).toBe(3);
      expect(REPUTATION_ACTION_SCORES[ReputationAction.LIKE_RECEIVED]).toBe(2);
      expect(REPUTATION_ACTION_SCORES[ReputationAction.BOOKMARK_RECEIVED]).toBe(
        1,
      );
    });
  });
});
