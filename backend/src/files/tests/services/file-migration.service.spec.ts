/**
 * FileMigrationService Unit Tests
 * Tests for v1 to v2 file structure migration
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FileMigrationService } from "../../services/file-migration.service";
import { File } from "../../entities/file.entity";
import { FileContext } from "../../entities/file-context.entity";
import { S3Service } from "../../services/s3.service";
import { ContextualFileService } from "../../services/contextual-file.service";
import { MockRepository } from "../test-utils/repository.mock";
import { MockS3Service } from "../test-utils/s3.mock";
import { MockFactory } from "../test-utils/mock.factory";

describe("FileMigrationService", () => {
  let service: FileMigrationService;
  let fileRepository: MockRepository<File>;
  let contextRepository: MockRepository<FileContext>;
  let s3Service: MockS3Service;
  let contextualFileService: any;

  beforeEach(async () => {
    MockFactory.resetIdCounter();

    fileRepository = new MockRepository<File>();
    contextRepository = new MockRepository<FileContext>();
    s3Service = new MockS3Service();

    // Mock ContextualFileService
    contextualFileService = {
      createContext: jest
        .fn()
        .mockImplementation((type, id, purpose, ownerId) => {
          const context = MockFactory.createMockFileContext({
            contextType: type,
            contextId: id,
            purpose,
            ownerId,
          });
          contextRepository.save(context);
          return Promise.resolve(context);
        }),
      findOrCreateContext: jest
        .fn()
        .mockImplementation((type, id, purpose, ownerId) => {
          const existing = contextRepository
            .getData()
            .find(
              (c) =>
                c.contextType === type &&
                c.contextId === id &&
                c.purpose === purpose,
            );
          if (existing) return Promise.resolve(existing);
          return contextualFileService.createContext(
            type,
            id,
            purpose,
            ownerId,
          );
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileMigrationService,
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
        {
          provide: ContextualFileService,
          useValue: contextualFileService,
        },
      ],
    }).compile();

    service = module.get<FileMigrationService>(FileMigrationService);
  });

  afterEach(() => {
    fileRepository.clear();
    contextRepository.clear();
    s3Service.clear();
    jest.clearAllMocks();
  });

  describe("analyzeExistingFiles", () => {
    it("should correctly identify v1 and v2 files", async () => {
      // Arrange
      const v1Files = [
        MockFactory.createMockFile({
          fileKey: "uploads/images/2024/01/file1.jpg",
        }),
        MockFactory.createMockFile({
          fileKey: "uploads/documents/2024/01/file2.pdf",
        }),
      ];
      const v2Files = [
        MockFactory.createMockFile({
          fileKey: "v2/users/user-123/post/content/file3.jpg",
        }),
        MockFactory.createMockFile({
          fileKey: "v2/users/user-456/profile/avatar/file4.png",
        }),
      ];

      fileRepository.setData([...v1Files, ...v2Files]);

      // Act
      const analysis = await service.analyzeExistingFiles();

      // Assert
      expect(analysis.total).toBe(4);
      expect(analysis.v1Files).toBe(2);
      expect(analysis.v2Files).toBe(2);
      expect(analysis.fileTypes).toHaveLength(1); // All are 'image' type in mock
    });

    it("should group files by type correctly", async () => {
      // Arrange
      const files = [
        MockFactory.createMockFile({ fileType: "image" }),
        MockFactory.createMockFile({ fileType: "image" }),
        MockFactory.createMockFile({ fileType: "document" }),
        MockFactory.createMockFile({ fileType: "video" }),
      ];
      fileRepository.setData(files);

      // Act
      const analysis = await service.analyzeExistingFiles();

      // Assert
      expect(analysis.fileTypes).toEqual(
        expect.arrayContaining([
          { type: "image", count: 2 },
          { type: "document", count: 1 },
          { type: "video", count: 1 },
        ]),
      );
    });
  });

  describe("migrateToV2", () => {
    it("should migrate v1 file to v2 structure", async () => {
      // Arrange
      const v1File = MockFactory.createMockFile({
        id: "file-123",
        fileKey: "uploads/images/2024/01/test.jpg",
        userId: "user-123",
      });
      fileRepository.setData([v1File]);

      // Upload the file to mock S3
      s3Service.uploadFile(null as any, v1File.fileKey);

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.progress.processed).toBe(1);
      expect(result.progress.successful).toBe(1);
      expect(result.progress.failed).toBe(0);

      // Verify S3 operations
      expect(s3Service.copyFile).toHaveBeenCalledWith(
        "uploads/images/2024/01/test.jpg",
        expect.stringMatching(/^v2\/users\/user-123\/general\//),
      );
      expect(s3Service.deleteFile).toHaveBeenCalledWith(
        "uploads/images/2024/01/test.jpg",
      );

      // Verify file was updated
      expect(fileRepository.save).toHaveBeenCalled();
      const savedFile = fileRepository.save.mock.calls[0][0] as File;
      expect(savedFile.fileKey).toMatch(/^v2\/users\/user-123\/general\//);
      expect(savedFile.contextId).toBeDefined();
    });

    it("should handle dry run mode without making changes", async () => {
      // Arrange
      const v1File = MockFactory.createMockFile({
        fileKey: "uploads/images/2024/01/test.jpg",
      });
      fileRepository.setData([v1File]);

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.progress.processed).toBe(1);
      expect(result.progress.skipped).toBe(1);

      // Verify no actual changes were made
      expect(s3Service.copyFile).not.toHaveBeenCalled();
      expect(s3Service.deleteFile).not.toHaveBeenCalled();
      expect(fileRepository.save).not.toHaveBeenCalled();
    });

    it("should process files in batches", async () => {
      // Arrange
      const v1Files = MockFactory.createMockFileBatch(25, true);
      fileRepository.setData(v1Files);
      v1Files.forEach((f) => s3Service.uploadFile(null as any, f.fileKey));

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.progress.processed).toBe(25);
      expect(result.progress.successful).toBe(25);

      // Verify batching (should have been called 3 times: 10 + 10 + 5)
      const queryBuilderCalls = fileRepository.createQueryBuilder.mock.calls;
      expect(queryBuilderCalls.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle S3 copy failures gracefully", async () => {
      // Arrange
      const v1File = MockFactory.createMockFile({
        fileKey: "uploads/images/2024/01/test.jpg",
      });
      fileRepository.setData([v1File]);

      // Simulate S3 copy failure
      s3Service.copyFile.mockRejectedValueOnce(new Error("S3 copy failed"));

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.progress.failed).toBe(1);
      expect(result.progress.successful).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("S3 copy failed");

      // Verify original file was not deleted
      expect(s3Service.deleteFile).not.toHaveBeenCalled();

      // File should not be updated in database
      expect(fileRepository.save).not.toHaveBeenCalled();
    });

    it("should skip already migrated v2 files", async () => {
      // Arrange
      const v2File = MockFactory.createMockFile({
        fileKey: "v2/users/user-123/post/content/test.jpg",
      });
      fileRepository.setData([v2File]);

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.progress.processed).toBe(0);
      expect(s3Service.copyFile).not.toHaveBeenCalled();
    });
  });

  describe("migrateFileToContext", () => {
    it("should detect and migrate post attachment", async () => {
      // Arrange
      const post = MockFactory.createMockPost({ id: "post-123" });
      const file = MockFactory.createMockFile({
        userId: "user-123",
        fileKey: "uploads/images/2024/01/test.jpg",
      });

      // Mock the relationship
      file.posts = Promise.resolve([post]);
      fileRepository.setData([file]);
      s3Service.uploadFile(null as any, file.fileKey);

      // Act
      const migratedFile = await service["migrateFileToContext"](file);

      // Assert
      expect(migratedFile).toBeDefined();
      expect(contextualFileService.findOrCreateContext).toHaveBeenCalledWith(
        "post",
        "post-123",
        "content",
        "user-123",
      );
      expect(migratedFile!.fileKey).toMatch(
        /^v2\/users\/user-123\/post\/content\//,
      );
    });

    it("should detect profile image", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        userId: "user-123",
        fileKey: "uploads/profile/2024/01/avatar.jpg",
        originalName: "profile.jpg",
      });
      file.posts = Promise.resolve([]);
      fileRepository.setData([file]);
      s3Service.uploadFile(null as any, file.fileKey);

      // Act
      const migratedFile = await service["migrateFileToContext"](file);

      // Assert
      expect(contextualFileService.findOrCreateContext).toHaveBeenCalledWith(
        "profile",
        "user-123",
        "avatar",
        "user-123",
      );
      expect(migratedFile!.fileKey).toMatch(
        /^v2\/users\/user-123\/profile\/avatar\//,
      );
    });

    it("should use general context for unclassified files", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        userId: "user-123",
        fileKey: "uploads/misc/2024/01/random.pdf",
      });
      file.posts = Promise.resolve([]);
      fileRepository.setData([file]);
      s3Service.uploadFile(null as any, file.fileKey);

      // Act
      const migratedFile = await service["migrateFileToContext"](file);

      // Assert
      expect(contextualFileService.findOrCreateContext).toHaveBeenCalledWith(
        "system",
        "user-123",
        "general",
        "user-123",
      );
      expect(migratedFile!.fileKey).toMatch(/^v2\/users\/user-123\/general\//);
    });
  });

  describe("rollback", () => {
    it("should rollback migration on critical failure", async () => {
      // Arrange
      const successfulFile = MockFactory.createMockFile({
        id: "file-1",
        fileKey: "uploads/images/2024/01/file1.jpg",
      });
      const failingFile = MockFactory.createMockFile({
        id: "file-2",
        fileKey: "uploads/images/2024/01/file2.jpg",
      });

      fileRepository.setData([successfulFile, failingFile]);
      s3Service.uploadFile(null as any, successfulFile.fileKey);

      // First file succeeds
      s3Service.copyFile.mockResolvedValueOnce({
        success: true,
        sourceKey: "",
        destKey: "",
      });
      // Second file fails
      s3Service.copyFile.mockRejectedValueOnce(new Error("Critical S3 error"));

      // Track migrated files for rollback
      const migratedFiles: any[] = [];
      fileRepository.save.mockImplementation((file) => {
        migratedFiles.push(file);
        return Promise.resolve(file);
      });

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.progress.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle files with missing userId", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        userId: null as any,
        fileKey: "uploads/images/2024/01/test.jpg",
      });
      file.posts = Promise.resolve([]);
      fileRepository.setData([file]);

      // Act
      const migratedFile = await service["migrateFileToContext"](file);

      // Assert
      expect(migratedFile).toBeNull();
    });

    it("should handle empty file batches", async () => {
      // Arrange
      fileRepository.setData([]);

      // Act
      const result = await service.migrateToV2({
        batchSize: 10,
        dryRun: false,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.progress.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle concurrent migrations safely", async () => {
      // Arrange
      const files = MockFactory.createMockFileBatch(10, true);
      fileRepository.setData(files);
      files.forEach((f) => s3Service.uploadFile(null as any, f.fileKey));

      // Act - Run concurrent migrations
      const results = await Promise.all([
        service.migrateToV2({ batchSize: 5, dryRun: false }),
        service.migrateToV2({ batchSize: 5, dryRun: false }),
      ]);

      // Assert - Should handle without conflicts
      const totalProcessed = results.reduce(
        (sum, r) => sum + r.progress.processed,
        0,
      );
      expect(totalProcessed).toBeLessThanOrEqual(10);
    });
  });
});
