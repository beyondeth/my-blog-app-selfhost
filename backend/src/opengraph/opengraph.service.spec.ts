import { Test, TestingModule } from "@nestjs/testing";
import { OpenGraphService } from "./opengraph.service";
import { CacheService } from "../cache/cache.service";
import { UrlSafetyService } from "../common/services/url-safety.service";

// Mock CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
};

describe("OpenGraphService", () => {
  let service: OpenGraphService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenGraphService,
        UrlSafetyService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<OpenGraphService>(OpenGraphService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    it("should allow a public IP and parse its metadata", async () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Public page" />
          </head>
        </html>
      `;
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn((name: string) =>
            name.toLowerCase() === "content-type" ? "text/html" : null,
          ),
        },
        text: jest.fn().mockResolvedValue(html),
      } as unknown as Response);

      const result = await service.fetchOpenGraph("https://93.184.216.34");

      expect(result).toMatchObject({
        success: true,
        domain: "93.184.216.34",
        title: "Public page",
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://93.184.216.34",
        expect.any(Object),
      );
    });
  });
});
