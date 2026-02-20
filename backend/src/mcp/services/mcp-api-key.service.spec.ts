import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { McpApiKey } from "../entities/mcp-api-key.entity";
import { UsageTracking } from "../../usage/entities/usage-tracking.entity";
import { CacheService } from "../../cache/cache.service";
import { McpApiKeySecretService } from "./mcp-api-key-secret.service";
import { McpApiKeyService } from "./mcp-api-key.service";

jest.mock("nanoid", () => ({
  customAlphabet: () => () => "abcd1234",
}));

describe("McpApiKeyService", () => {
  let service: McpApiKeyService;
  let queryBuilderInsertSpy: jest.Mock;
  let queryBuilderIntoSpy: jest.Mock;
  let queryBuilderValuesSpy: jest.Mock;
  let queryBuilderExecuteSpy: jest.Mock;

  const mockMcpApiKeyRepository = {
    count: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    query: jest.fn(),
  };

  const mockUsageTrackingRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCacheService = {
    del: jest.fn(),
    get: jest.fn(),
    increment: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
  };

  const mockSecretService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryBuilderExecuteSpy = jest.fn().mockResolvedValue(undefined);
    queryBuilderValuesSpy = jest.fn().mockReturnValue({
      execute: queryBuilderExecuteSpy,
    });
    queryBuilderIntoSpy = jest.fn().mockReturnValue({
      values: queryBuilderValuesSpy,
    });
    queryBuilderInsertSpy = jest.fn().mockReturnValue({
      into: queryBuilderIntoSpy,
    });
    mockMcpApiKeyRepository.createQueryBuilder.mockReturnValue({
      insert: queryBuilderInsertSpy,
    });
    mockMcpApiKeyRepository.query.mockResolvedValue([{ exists: true }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpApiKeyService,
        {
          provide: getRepositoryToken(McpApiKey),
          useValue: mockMcpApiKeyRepository,
        },
        {
          provide: getRepositoryToken(UsageTracking),
          useValue: mockUsageTrackingRepository,
        },
        { provide: CacheService, useValue: mockCacheService },
        { provide: McpApiKeySecretService, useValue: mockSecretService },
      ],
    }).compile();

    service = module.get<McpApiKeyService>(McpApiKeyService);
  });

  describe("create", () => {
    it("should throw when user already has 3 active keys", async () => {
      mockMcpApiKeyRepository.count.mockResolvedValue(3);

      await expect(
        service.create("user-1", "blog-1", "Primary Key"),
      ).rejects.toThrow(ConflictException);
      expect(queryBuilderExecuteSpy).not.toHaveBeenCalled();
    });

    it("should save encrypted key and trimmed name", async () => {
      mockMcpApiKeyRepository.count.mockResolvedValue(0);
      mockMcpApiKeyRepository.findOne.mockResolvedValue(null);
      mockSecretService.encrypt.mockReturnValue("encrypted-payload");

      const result = await service.create("user-1", "blog-1", "  My Key  ");

      expect(mockSecretService.encrypt).toHaveBeenCalledWith(result.apiKey);
      expect(result.apiKey.startsWith("blog_sk_")).toBe(true);
      expect(queryBuilderValuesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Key",
          encryptedApiKey: "encrypted-payload",
        }),
      );
      expect(queryBuilderExecuteSpy).toHaveBeenCalledTimes(1);
    });

    it("should create key without encryptedApiKey column", async () => {
      mockMcpApiKeyRepository.count.mockResolvedValue(0);
      mockMcpApiKeyRepository.findOne.mockResolvedValue(null);
      mockMcpApiKeyRepository.query.mockResolvedValue([{ exists: false }]);

      await service.create("user-1", "blog-1", "Legacy Key");

      expect(mockSecretService.encrypt).not.toHaveBeenCalled();
      expect(queryBuilderValuesSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          encryptedApiKey: expect.any(String),
        }),
      );
    });

    it("should fallback to legacy insert when encrypted column insert fails", async () => {
      mockMcpApiKeyRepository.count.mockResolvedValue(0);
      mockMcpApiKeyRepository.findOne.mockResolvedValue(null);
      mockSecretService.encrypt.mockReturnValue("encrypted-payload");
      queryBuilderExecuteSpy
        .mockRejectedValueOnce(
          new Error(
            'column "encryptedApiKey" of relation "mcp_api_keys" does not exist',
          ),
        )
        .mockResolvedValueOnce(undefined);

      await service.create("user-1", "blog-1", "Fallback Key");

      expect(queryBuilderValuesSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          encryptedApiKey: "encrypted-payload",
        }),
      );
      expect(queryBuilderValuesSpy).toHaveBeenNthCalledWith(
        2,
        expect.not.objectContaining({
          encryptedApiKey: expect.any(String),
        }),
      );
      expect(queryBuilderExecuteSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("revealSecret", () => {
    const mockRevealQueryBuilder = (result: any) => {
      const getOne = jest.fn().mockResolvedValue(result);
      const where = jest.fn().mockReturnValue({ getOne });
      const addSelect = jest.fn().mockReturnValue({ where });
      mockMcpApiKeyRepository.createQueryBuilder.mockReturnValue({
        addSelect,
      });
      return { addSelect, where, getOne };
    };

    it("should throw when encrypted column is not available", async () => {
      mockMcpApiKeyRepository.query.mockResolvedValue([{ exists: false }]);

      await expect(service.revealSecret("key-1", "user-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw when key does not exist", async () => {
      mockRevealQueryBuilder(null);

      await expect(service.revealSecret("key-1", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw when key does not belong to user", async () => {
      mockRevealQueryBuilder({
        id: "key-1",
        userId: "other-user",
      });

      await expect(service.revealSecret("key-1", "user-1")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should decrypt and return api key for owner", async () => {
      mockRevealQueryBuilder({
        id: "key-1",
        userId: "user-1",
        keyHint: "abcd1234",
        name: "My Key",
        encryptedApiKey: "encrypted-payload",
      });
      mockSecretService.decrypt.mockReturnValue("blog_sk_abcd1234_secret");

      const result = await service.revealSecret("key-1", "user-1");

      expect(result).toEqual({
        apiKey: "blog_sk_abcd1234_secret",
        keyHint: "abcd1234",
        name: "My Key",
      });
      expect(mockSecretService.decrypt).toHaveBeenCalledWith(
        "encrypted-payload",
      );
    });
  });
});
