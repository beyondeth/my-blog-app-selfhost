/**
 * FileMonitoringService Unit Tests
 * Tests for file system health monitoring and metrics
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FileMonitoringService } from "../../services/file-monitoring.service";
import { File } from "../../entities/file.entity";
import {
  FileContext,
  FileContextType,
} from "../../entities/file-context.entity";
import { S3Service } from "../../services/s3.service";
import { MockRepository } from "../test-utils/repository.mock";
import { MockS3Service } from "../test-utils/s3.mock";
import { MockFactory } from "../test-utils/mock.factory";

describe("FileMonitoringService", () => {
  let service: FileMonitoringService;
  let fileRepository: MockRepository<File>;
  let contextRepository: MockRepository<FileContext>;
  let s3Service: MockS3Service;

  beforeEach(async () => {
    MockFactory.resetIdCounter();

    fileRepository = new MockRepository<File>();
    contextRepository = new MockRepository<FileContext>();
    s3Service = new MockS3Service();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileMonitoringService,
        {
          provide: getRepositoryToken(File),
          useValue: fileRepository,
        },
        {
          provide: getRepositoryToken(FileContext),
          useValue: contextRepository,
        },
        {
          provide: S3Service,
          useValue: s3Service,
        },
      ],
    }).compile();

    service = module.get<FileMonitoringService>(FileMonitoringService);
  });

  afterEach(() => {
    fileRepository.clear();
    contextRepository.clear();
    s3Service.clear();
  });

  describe("healthCheck", () => {
    it("should return healthy status when all systems are operational", async () => {
      // Arrange
      const files = [
        MockFactory.createMockFile({
          fileKey: "v2/users/user-1/post/content/file1.jpg",
        }),
        MockFactory.createMockFile({
          fileKey: "v2/users/user-2/profile/avatar/file2.jpg",
        }),
      ];
      const contexts = [
        MockFactory.createMockFileContext({ isActive: true }),
        MockFactory.createMockFileContext({ isActive: true }),
      ];

      fileRepository.setData(files);
      contextRepository.setData(contexts);

      // Mock S3 health check
      files.forEach((f) => s3Service.seedFile(f.fileKey));

      // Act
      const health = await service.healthCheck();

      // Assert
      expect(health.status).toBe("healthy");
      expect(health.services.database).toBe("operational");
      expect(health.services.s3).toBe("operational");
      expect(health.issues).toHaveLength(0);
    });

    it("should return degraded status when orphaned files exist", async () => {
      // Arrange
      const orphanedFile = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days old
      });
      const normalFile = MockFactory.createMockFile({
        contextId: "context-123",
      });

      fileRepository.setData([orphanedFile, normalFile]);

      // Act
      const health = await service.healthCheck();

      // Assert
      expect(health.status).toBe("degraded");
      expect(health.issues).toContain("1 orphaned files detected");
    });

    it("should detect v1 files needing migration", async () => {
      // Arrange
      const v1File = MockFactory.createMockFile({
        fileKey: "uploads/images/2024/01/file.jpg", // v1 structure
      });
      const v2File = MockFactory.createMockFile({
        fileKey: "v2/users/user-123/post/content/file.jpg",
      });

      fileRepository.setData([v1File, v2File]);

      // Act
      const health = await service.healthCheck();

      // Assert
      expect(health.status).toBe("degraded");
      expect(health.issues).toContain("1 files need migration to v2");
    });

    it("should return unhealthy when database is unavailable", async () => {
      // Arrange
      fileRepository.count.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      // Act
      const health = await service.healthCheck();

      // Assert
      expect(health.status).toBe("unhealthy");
      expect(health.services.database).toBe("unavailable");
      expect(health.issues).toContain("Database connection failed");
    });

    it("should detect files scheduled for deletion", async () => {
      // Arrange
      const scheduledFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day future
      });

      fileRepository.setData([scheduledFile]);

      // Act
      const health = await service.healthCheck();

      // Assert
      expect(health.issues).toContain("1 files scheduled for deletion");
    });
  });

  describe("getMetrics", () => {
    it("should return comprehensive file system metrics", async () => {
      // Arrange
      const files = [
        MockFactory.createMockFile({
          fileSize: 1024 * 100,
          fileType: "image",
          fileKey: "v2/users/user-1/post/content/file1.jpg",
          contextId: "context-1",
        }),
        MockFactory.createMockFile({
          fileSize: 1024 * 200,
          fileType: "image",
          fileKey: "v2/users/user-2/post/content/file2.jpg",
          contextId: "context-1",
        }),
        MockFactory.createMockFile({
          fileSize: 1024 * 300,
          fileType: "document",
          fileKey: "uploads/docs/2024/01/file3.pdf", // v1 file
        }),
      ];

      const contexts = [
        MockFactory.createMockFileContext({
          fileCount: 2,
          totalSize: 1024 * 300,
          contextType: FileContextType.POST,
        }),
      ];

      fileRepository.setData(files);
      contextRepository.setData(contexts);

      // Act
      const metrics = await service.getMetrics();

      // Assert
      expect(metrics.totalFiles).toBe(3);
      expect(metrics.totalSize).toBe(1024 * 600);
      expect(metrics.filesByType).toEqual({
        image: 2,
        document: 1,
      });
      expect(metrics.filesByContext).toEqual({
        post: 1,
      });
      expect(metrics.v1Files).toBe(1);
      expect(metrics.v2Files).toBe(2);
      expect(metrics.orphanedFiles).toBe(1); // The v1 file has no context
      expect(metrics.averageFileSize).toBe(1024 * 200);
    });

    it("should handle empty file system", async () => {
      // Arrange
      fileRepository.setData([]);
      contextRepository.setData([]);

      // Act
      const metrics = await service.getMetrics();

      // Assert
      expect(metrics.totalFiles).toBe(0);
      expect(metrics.totalSize).toBe(0);
      expect(metrics.filesByType).toEqual({});
      expect(metrics.filesByContext).toEqual({});
      expect(metrics.averageFileSize).toBe(0);
    });
  });

  describe("getStorageUsageByUser", () => {
    it("should calculate storage usage per user", async () => {
      // Arrange
      const user1Files = [
        MockFactory.createMockFile({ userId: "user-1", fileSize: 1024 * 100 }),
        MockFactory.createMockFile({ userId: "user-1", fileSize: 1024 * 200 }),
      ];
      const user2Files = [
        MockFactory.createMockFile({ userId: "user-2", fileSize: 1024 * 300 }),
      ];

      fileRepository.setData([...user1Files, ...user2Files]);

      // Act
      const usage = await service.getStorageUsageByUser();

      // Assert
      expect(usage).toEqual([
        { userId: "user-1", fileCount: 2, totalSize: 1024 * 300 },
        { userId: "user-2", fileCount: 1, totalSize: 1024 * 300 },
      ]);
    });

    it("should sort users by total size descending", async () => {
      // Arrange
      const files = [
        MockFactory.createMockFile({ userId: "user-small", fileSize: 1024 }),
        MockFactory.createMockFile({
          userId: "user-large",
          fileSize: 1024 * 1000,
        }),
        MockFactory.createMockFile({
          userId: "user-medium",
          fileSize: 1024 * 100,
        }),
      ];

      fileRepository.setData(files);

      // Act
      const usage = await service.getStorageUsageByUser();

      // Assert
      expect(usage[0].userId).toBe("user-large");
      expect(usage[1].userId).toBe("user-medium");
      expect(usage[2].userId).toBe("user-small");
    });
  });

  describe("detectAnomalies", () => {
    it("should detect large files exceeding threshold", async () => {
      // Arrange
      const largeFile = MockFactory.createMockFile({
        fileSize: 100 * 1024 * 1024, // 100MB
        fileName: "large-file.jpg",
        fileKey: "v2/users/user-1/post/content/large-file.jpg",
        contextId: "context-1",
        checksum: "large-file-checksum",
      });
      const normalFile = MockFactory.createMockFile({
        fileSize: 1 * 1024 * 1024, // 1MB
        fileKey: "v2/users/user-1/post/content/normal-file.jpg",
        contextId: "context-2",
        checksum: "normal-file-checksum",
      });

      fileRepository.setData([largeFile, normalFile]);

      // Act
      const anomalies = await service.detectAnomalies();

      // Assert
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe("large_file");
      expect(anomalies[0].fileId).toBe(largeFile.id);
      expect(anomalies[0].details).toContain("100.00MB");
    });

    it("should detect duplicate files by checksum", async () => {
      // Arrange
      const file1 = MockFactory.createMockFile({
        id: "file-1",
        checksum: "abc123",
        fileName: "file1.jpg",
      });
      const file2 = MockFactory.createMockFile({
        id: "file-2",
        checksum: "abc123", // Same checksum
        fileName: "file2.jpg",
      });
      const file3 = MockFactory.createMockFile({
        id: "file-3",
        checksum: "def456",
        fileName: "file3.jpg",
      });

      fileRepository.setData([file1, file2, file3]);

      // Act
      const anomalies = await service.detectAnomalies();

      // Assert
      const duplicates = anomalies.filter((a) => a.type === "duplicate");
      expect(duplicates).toHaveLength(2); // Both duplicates are reported
      expect(duplicates[0].details).toContain("Duplicate of");
    });

    it("should detect orphaned files older than 24 hours", async () => {
      // Arrange
      const oldOrphan = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        fileName: "orphan.jpg",
      });
      const newOrphan = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours
      });

      fileRepository.setData([oldOrphan, newOrphan]);

      // Act
      const anomalies = await service.detectAnomalies();

      // Assert
      const orphans = anomalies.filter((a) => a.type === "orphaned");
      expect(orphans).toHaveLength(1);
      expect(orphans[0].fileId).toBe(oldOrphan.id);
    });

    it("should detect files in v1 structure", async () => {
      // Arrange
      const v1File = MockFactory.createMockFile({
        fileKey: "uploads/images/2024/01/old-file.jpg",
        fileName: "old-file.jpg",
      });

      fileRepository.setData([v1File]);

      // Act
      const anomalies = await service.detectAnomalies();

      // Assert
      const v1Anomalies = anomalies.filter((a) => a.type === "v1_structure");
      expect(v1Anomalies).toHaveLength(1);
      expect(v1Anomalies[0].severity).toBe("medium");
    });
  });

  describe("generateReport", () => {
    it("should generate comprehensive monitoring report", async () => {
      // Arrange
      const files = MockFactory.createMockFileBatch(5, false);
      const contexts = [
        MockFactory.createMockFileContext({ isActive: true }),
        MockFactory.createMockFileContext({ isActive: false }),
      ];

      fileRepository.setData(files);
      contextRepository.setData(contexts);

      // Act
      const report = await service.generateReport();

      // Assert
      expect(report).toContain("File System Monitoring Report");
      expect(report).toContain("Health Status:");
      expect(report).toContain("Metrics:");
      expect(report).toContain("Total Files: 5");
      expect(report).toContain("Active Contexts: 1");
      expect(report).toContain("Recommendations:");
    });

    it("should include anomalies in report", async () => {
      // Arrange
      const largeFile = MockFactory.createMockFile({
        fileSize: 100 * 1024 * 1024,
        fileName: "huge.jpg",
      });

      fileRepository.setData([largeFile]);

      // Act
      const report = await service.generateReport();

      // Assert
      expect(report).toContain("Anomalies Detected:");
      expect(report).toContain("large_file");
      expect(report).toContain("huge.jpg");
    });
  });

  describe("cleanupRecommendations", () => {
    it("should recommend cleanup actions based on system state", async () => {
      // Arrange
      const orphanedFile = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      const v1File = MockFactory.createMockFile({
        fileKey: "uploads/old/file.jpg",
      });
      const expiredFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      fileRepository.setData([orphanedFile, v1File, expiredFile]);

      // Act
      const recommendations = await service.cleanupRecommendations();

      // Assert
      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Run orphaned file cleanup/),
          expect.stringMatching(/^Migrate v1 files to v2 structure/),
          expect.stringMatching(/^Process expired files for deletion/),
        ]),
      );
    });

    it("should return no recommendations for healthy system", async () => {
      // Arrange
      const healthyFiles = [
        MockFactory.createMockFile({
          fileKey: "v2/users/user-1/post/content/file.jpg",
          contextId: "context-123",
        }),
      ];

      fileRepository.setData(healthyFiles);

      // Act
      const recommendations = await service.cleanupRecommendations();

      // Assert
      expect(recommendations).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle database errors gracefully in metrics", async () => {
      // Arrange
      fileRepository.count.mockRejectedValueOnce(new Error("DB error"));

      // Act
      const metrics = await service.getMetrics();

      // Assert
      expect(metrics.totalFiles).toBe(0);
      expect(metrics.error).toBeDefined();
    });

    it("should handle empty checksum in duplicate detection", async () => {
      // Arrange
      const files = [
        MockFactory.createMockFile({ checksum: null as any }),
        MockFactory.createMockFile({ checksum: "" }),
        MockFactory.createMockFile({ checksum: "valid-checksum" }),
      ];

      fileRepository.setData(files);

      // Act & Assert - Should not throw
      const anomalies = await service.detectAnomalies();
      expect(anomalies.filter((a) => a.type === "duplicate")).toHaveLength(0);
    });
  });
});
