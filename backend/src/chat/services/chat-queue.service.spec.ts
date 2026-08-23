import { Test, TestingModule } from "@nestjs/testing";
import { ChatQueueService } from "./chat-queue.service";
import Redis from "ioredis";

/**
 * ChatQueueService 단위 테스트
 * @description 단순화된 큐 시스템 테스트
 */
describe("ChatQueueService", () => {
  let service: ChatQueueService;
  let redis: jest.Mocked<Redis>;

  beforeEach(async () => {
    // Redis mock 생성
    const redisMock = {
      pipeline: jest.fn(),
      llen: jest.fn(),
      rpop: jest.fn(),
      lpush: jest.fn(),
      hgetall: jest.fn(),
      hincrby: jest.fn(),
      hset: jest.fn(),
      del: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatQueueService,
        {
          provide: "default_IORedisModuleConnectionToken",
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<ChatQueueService>(ChatQueueService);
    redis = module.get("default_IORedisModuleConnectionToken");
  });

  describe("샤드 분산 로직", () => {
    it("메시지가 샤드별로 균등하게 분산되어야 함", async () => {
      // Pipeline mock 설정
      const pipelineMock = {
        hset: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        lpush: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        hincrby: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipelineMock as any);

      // 4개의 메시지를 큐에 추가 (샤드 4개에 각각 1개씩 들어가야 함)
      const messages = [
        { conversationId: "conv1", senderId: "user1", content: "Hello" },
        { conversationId: "conv2", senderId: "user2", content: "Hi" },
        { conversationId: "conv3", senderId: "user3", content: "Hey" },
        { conversationId: "conv4", senderId: "user4", content: "Yo" },
      ];

      for (const msg of messages) {
        await service.queueMessage(msg);
      }

      // lpush 호출 확인
      const lpushCalls = pipelineMock.lpush.mock.calls;

      // 샤드별로 분산되었는지 확인
      const shardKeys = lpushCalls.map((call) => call[0]);
      const uniqueShards = new Set(
        shardKeys.filter(
          (key) => typeof key === "string" && key.includes("shard"),
        ),
      );

      // 라운드로빈으로 순차적으로 분산되어야 함
      expect(shardKeys[0]).toBe("chat:queue:shard:0");
      expect(shardKeys[1]).toBe("chat:queue:shard:1");
      expect(shardKeys[2]).toBe("chat:queue:shard:2");
      expect(shardKeys[3]).toBe("chat:queue:shard:3");
    });
  });

  describe("메시지 수집 로직", () => {
    it("모든 샤드에서 균등하게 메시지를 수집해야 함", async () => {
      // 각 샤드에서 메시지를 가져오는 상황 시뮬레이션
      const pipelineMock = {
        rpop: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            // 샤드 0에서 1개
            [null, JSON.stringify({ id: "msg1", content: "test" })],
          ])
          .mockResolvedValueOnce([
            // 샤드 1에서 1개
            [null, JSON.stringify({ id: "msg2", content: "test" })],
          ])
          .mockResolvedValueOnce([
            // 샤드 2에서 1개
            [null, JSON.stringify({ id: "msg3", content: "test" })],
          ])
          .mockResolvedValueOnce([
            // 샤드 3에서 1개
            [null, JSON.stringify({ id: "msg4", content: "test" })],
          ])
          .mockResolvedValue([
            // 기본 큐 (비어있음)
            [null, null],
          ]),
      };
      redis.pipeline.mockReturnValue(pipelineMock as any);

      const messages = await service.dequeueMessages(4);

      // 모든 샤드에서 메시지를 수집했는지 확인
      expect(messages).toHaveLength(4);
      expect(messages[0].id).toBe("msg1");
      expect(messages[1].id).toBe("msg2");
      expect(messages[2].id).toBe("msg3");
      expect(messages[3].id).toBe("msg4");

      // 샤드에서 batch가 모두 채워졌으므로 legacy 기본 큐는 조회하지 않는다.
      expect(pipelineMock.exec).toHaveBeenCalledTimes(4);
      expect(pipelineMock.rpop).not.toHaveBeenCalledWith("chat:queue:messages");
    });
  });

  describe("큐 건강 상태 모니터링", () => {
    it("경고 임계값을 초과해도 critical 한도 이하면 healthy를 유지해야 함", async () => {
      // 각 큐의 크기 설정
      redis.llen
        .mockResolvedValueOnce(600) // shard:0 - 과다
        .mockResolvedValueOnce(100) // shard:1 - 정상
        .mockResolvedValueOnce(50) // shard:2 - 정상
        .mockResolvedValueOnce(30) // shard:3 - 정상
        .mockResolvedValueOnce(60); // DLQ - 과다

      const health = await service.getQueueHealth();

      // 경고가 생성되었는지 확인
      expect(health.healthy).toBe(true);
      expect(health.warnings).toContain(
        "샤드 chat:queue:shard:0에 메시지 과다: 600개",
      );
      expect(health.warnings).toContain("Dead Letter Queue에 60개 실패 메시지");
    });

    it("총 큐 크기가 critical 한도에 도달하면 unhealthy를 반환해야 함", async () => {
      redis.llen
        .mockResolvedValueOnce(600)
        .mockResolvedValueOnce(250)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(0);

      const health = await service.getQueueHealth();

      expect(health.totalSize).toBe(1000);
      expect(health.healthy).toBe(false);
    });

    it("모든 큐가 정상 범위면 healthy를 반환해야 함", async () => {
      // 모든 큐가 정상 범위
      redis.llen.mockResolvedValue(10);

      const health = await service.getQueueHealth();

      expect(health.healthy).toBe(true);
      expect(health.warnings).toHaveLength(0);
    });
  });

  describe("메트릭 수집", () => {
    it("모든 큐의 메트릭을 종합하여 반환해야 함", async () => {
      // 각 큐 크기 설정
      redis.llen
        .mockResolvedValueOnce(10) // shard:0
        .mockResolvedValueOnce(20) // shard:1
        .mockResolvedValueOnce(15) // shard:2
        .mockResolvedValueOnce(5) // shard:3
        .mockResolvedValueOnce(0) // default
        .mockResolvedValueOnce(1); // DLQ

      redis.hgetall.mockResolvedValue({
        totalQueued: "100",
        totalProcessed: "80",
        totalFailed: "5",
        totalProcessingTime: "1000",
      });

      const metrics = await service.getMetrics();

      // 총 큐 크기 = 10+20+15+5+0 = 50
      expect(metrics.queueSize).toBe(50);
      expect(metrics.dlqSize).toBe(1);
      expect(metrics.failureRate).toBe(0.05); // 5/100
    });
  });

  describe("에러 처리", () => {
    it("파싱 실패한 메시지는 DLQ로 이동해야 함", async () => {
      const pipelineMock = {
        rpop: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValueOnce([
            [null, "invalid json"], // 파싱 불가능한 데이터
          ])
          .mockResolvedValue([[null, null]]),
      };
      redis.pipeline.mockReturnValue(pipelineMock as any);

      await service.dequeueMessages(1);

      // DLQ로 이동했는지 확인
      expect(redis.lpush).toHaveBeenCalledWith(
        "chat:queue:dlq",
        "invalid json",
      );
    });
  });
});
