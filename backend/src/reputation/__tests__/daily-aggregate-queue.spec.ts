/**
 * 평판 시스템 - DailyAggregateJob 큐 처리 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DailyAggregateJob } from '../jobs/daily-aggregate.job';
import { AggregatorService } from '../services/aggregator.service';
import { TitleService } from '../services/title.service';
import { LedgerService } from '../services/ledger.service';
import { ReputationQueueService, ReputationEventData } from '../queues/reputation-queue.service';
import { ReputationAction, REPUTATION_ACTION_SCORES } from '../enums/reputation-action.enum';

describe('DailyAggregateJob - Queue Processing', () => {
  let job: DailyAggregateJob;
  let queueService: jest.Mocked<ReputationQueueService>;
  let ledgerService: jest.Mocked<LedgerService>;

  const mockAggregatorService = {
    aggregateAll: jest.fn(),
  };

  const mockTitleService = {
    revokeExpired: jest.fn(),
  };

  const mockLedgerService = {
    record: jest.fn(),
  };

  const mockQueueService = {
    getWaitingJobs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyAggregateJob,
        { provide: AggregatorService, useValue: mockAggregatorService },
        { provide: TitleService, useValue: mockTitleService },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: ReputationQueueService, useValue: mockQueueService },
      ],
    }).compile();

    job = module.get<DailyAggregateJob>(DailyAggregateJob);
    queueService = module.get(ReputationQueueService);
    ledgerService = module.get(LedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('큐에 대기 중인 이벤트를 가져와서 LedgerService에 기록해야 함', async () => {
    // Mock Job 데이터
    const mockJobs = [
      {
        id: 'job-1',
        token: 'token-1',
        data: {
          action: ReputationAction.POST_PUBLISHED,
          userId: 'user-1',
          targetId: 'post-1',
          targetType: 'post',
          occurredAt: new Date(),
          metadata: { title: 'Test Post' },
        } as ReputationEventData,
        moveToCompleted: jest.fn(),
        moveToFailed: jest.fn(),
      },
      {
        id: 'job-2',
        token: 'token-2',
        data: {
          action: ReputationAction.LIKE_RECEIVED,
          userId: 'user-2',
          targetId: 'post-2',
          targetType: 'post',
          triggeredBy: 'user-1',
          occurredAt: new Date(),
        } as ReputationEventData,
        moveToCompleted: jest.fn(),
        moveToFailed: jest.fn(),
      },
    ];

    mockQueueService.getWaitingJobs.mockResolvedValue(mockJobs as any);

    // 실행
    await job.handleCron();

    // 검증 1: 큐 서비스 호출
    expect(queueService.getWaitingJobs).toHaveBeenCalled();

    // 검증 2: LedgerService 호출 (2번)
    expect(ledgerService.record).toHaveBeenCalledTimes(2);

    // Job 1 처리 검증
    expect(ledgerService.record).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      actionType: ReputationAction.POST_PUBLISHED,
      targetType: 'post',
      targetId: 'post-1',
      delta: REPUTATION_ACTION_SCORES[ReputationAction.POST_PUBLISHED],
      actorId: undefined,
      metadata: { title: 'Test Post' },
    });
    expect(mockJobs[0].moveToCompleted).toHaveBeenCalledWith('processed', 'token-1', false);

    // Job 2 처리 검증
    expect(ledgerService.record).toHaveBeenNthCalledWith(2, {
      userId: 'user-2',
      actionType: ReputationAction.LIKE_RECEIVED,
      targetType: 'post',
      targetId: 'post-2',
      delta: REPUTATION_ACTION_SCORES[ReputationAction.LIKE_RECEIVED],
      actorId: 'user-1',
      metadata: undefined,
    });
    expect(mockJobs[1].moveToCompleted).toHaveBeenCalledWith('processed', 'token-2', false);
  });

  it('큐가 비어있으면 LedgerService를 호출하지 않아야 함', async () => {
    mockQueueService.getWaitingJobs.mockResolvedValue([]);

    await job.handleCron();

    expect(ledgerService.record).not.toHaveBeenCalled();
  });

  it('LedgerService 기록 실패 시 Job을 Failed 상태로 이동해야 함', async () => {
    const error = new Error('DB Error');
    mockLedgerService.record.mockRejectedValue(error);

    const mockJob = {
      id: 'job-err',
      token: 'token-err',
      data: {
        action: ReputationAction.POST_PUBLISHED,
        userId: 'user-1',
      } as ReputationEventData,
      moveToCompleted: jest.fn(),
      moveToFailed: jest.fn(),
    };

    mockQueueService.getWaitingJobs.mockResolvedValue([mockJob] as any);

    await job.handleCron();

    expect(ledgerService.record).toHaveBeenCalled();
    expect(mockJob.moveToCompleted).not.toHaveBeenCalled();
    expect(mockJob.moveToFailed).toHaveBeenCalledWith(error, 'token-err', false);
  });
});
