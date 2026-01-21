/**
 * 평판 시스템 - AggregatorService 단위 테스트
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AggregatorService } from "../services/aggregator.service";
import { ReputationLedger } from "../entities/reputation-ledger.entity";
import { ReputationTotal } from "../entities/reputation-total.entity";
import { ReputationPeriod, PERIOD_DAYS } from "../enums/reputation-period.enum";

describe("AggregatorService", () => {
  let service: AggregatorService;
  let ledgerRepository: jest.Mocked<Repository<ReputationLedger>>;
  let totalRepository: jest.Mocked<Repository<ReputationTotal>>;

  const mockLedgerRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockTotalRepository = {
    findOne: jest.fn(),
    upsert: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregatorService,
        {
          provide: getRepositoryToken(ReputationLedger),
          useValue: mockLedgerRepository,
        },
        {
          provide: getRepositoryToken(ReputationTotal),
          useValue: mockTotalRepository,
        },
      ],
    }).compile();

    service = module.get<AggregatorService>(AggregatorService);
    ledgerRepository = module.get(getRepositoryToken(ReputationLedger));
    totalRepository = module.get(getRepositoryToken(ReputationTotal));

    jest.clearAllMocks();
  });

  describe("getUserScore", () => {
    const userId = "user-123";

    it("사용자 점수가 정상적으로 조회되어야 함", async () => {
      const mockTotal = {
        userId,
        period: ReputationPeriod.L7,
        score: 100,
        decayedScore: 85,
      };

      mockTotalRepository.findOne.mockResolvedValue(mockTotal);

      const result = await service.getUserScore(userId, ReputationPeriod.L7);

      expect(result).toEqual(mockTotal);
      expect(mockTotalRepository.findOne).toHaveBeenCalledWith({
        where: { userId, period: ReputationPeriod.L7 },
      });
    });

    it("점수가 없는 사용자는 null을 반환해야 함", async () => {
      mockTotalRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserScore(userId, ReputationPeriod.L7);

      expect(result).toBeNull();
    });
  });

  describe("getTopUsersByPeriod", () => {
    it("상위 사용자 목록을 반환해야 함", async () => {
      const mockUsers = [
        { userId: "user-1", period: ReputationPeriod.L7, decayedScore: 100 },
        { userId: "user-2", period: ReputationPeriod.L7, decayedScore: 80 },
      ];

      mockTotalRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getTopUsersByPeriod(ReputationPeriod.L7, 10);

      expect(result).toEqual(mockUsers);
      expect(mockTotalRepository.find).toHaveBeenCalledWith({
        where: { period: ReputationPeriod.L7 },
        order: { decayedScore: "DESC" },
        take: 10,
      });
    });
  });

  describe("PERIOD_DAYS (exported constant)", () => {
    it("각 기간에 올바른 일수가 매핑되어야 함", () => {
      expect(PERIOD_DAYS[ReputationPeriod.L7]).toBe(7);
      expect(PERIOD_DAYS[ReputationPeriod.L30]).toBe(30);
      expect(PERIOD_DAYS[ReputationPeriod.L90]).toBe(90);
      // ALL_TIME은 정의되어 있거나 null일 수 있음
      expect(PERIOD_DAYS[ReputationPeriod.ALL_TIME] ?? 9999).toBe(9999);
    });
  });
});
