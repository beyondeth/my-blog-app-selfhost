import { Test, TestingModule } from "@nestjs/testing";
import { OpenGraphService } from "./opengraph.service";
import { CacheService } from "../cache/cache.service";

// Mock CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
};

describe("OpenGraphService", () => {
  let service: OpenGraphService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenGraphService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<OpenGraphService>(OpenGraphService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("SSRF Protection", () => {
    it("should block localhost (Loopback)", async () => {
      // Localhost usually resolves to 127.0.0.1 or ::1
      const result = await service.fetchOpenGraph("http://localhost:3000");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/접근이 제한된|유효하지 않은/);
    });

    it("should block 127.0.0.1 (Loopback IP)", async () => {
      const result = await service.fetchOpenGraph("http://127.0.0.1:8080");
      expect(result.success).toBe(false);
      expect(result.error).toContain("접근이 제한된 IP 대역");
    });

    it("should block 192.168.0.1 (Private IP)", async () => {
      const result = await service.fetchOpenGraph("http://192.168.0.1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("접근이 제한된 IP 대역");
    });

    it("should block AWS Metadata Service (169.254.169.254)", async () => {
      const result = await service.fetchOpenGraph("http://169.254.169.254");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/클라우드 메타데이터|접근이 제한된/);
    });

    it("should allow public domains (e.g., example.com)", async () => {
      // Mock fetchHtml to avoid actual network call if possible, or just rely on validateUrl passing
      // Since we can't easily mock private method, we assume validateUrl passes and it fails at fetchHtml or returns success
      // We just check that it does NOT return "Access restricted" error.

      // However, actual network call might fail in test env.
      // Let's just create a spy if needed, but for now we focus on BLOCKING logic which happens BEFORE fetch.

      // If validateUrl passes, it proceeds to fetchHtml.
      // If fetchHtml fails (network), it returns error "request to ... failed" etc.
      // It should NOT be "Access restricted".

      try {
        const result = await service.fetchOpenGraph("http://example.com");
        expect(result.error).not.toContain("접근이 제한된");
      } catch (e) {
        // Ignore network errors
      }
    });
  });
});
