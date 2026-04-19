/**
 * FileLifecycleService Unit Tests
 * Tests for 30-day retention policy and file lifecycle management
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  FileLifecycleService,
  FileLifecycleEvent,
} from "../../services/file-lifecycle.service";
import { File } from "../../entities/file.entity";
import { Post } from "../../../posts/entities/post.entity";
import {
  FileContext,
  FileContextType,
} from "../../entities/file-context.entity";
import { S3Service } from "../../services/s3.service";
import { MockRepository } from "../test-utils/repository.mock";
import { MockS3Service } from "../test-utils/s3.mock";
import { MockFactory } from "../test-utils/mock.factory";

describe("FileLifecycleService", () => {
  let service: FileLifecycleService;
  let fileRepository: MockRepository<File>;
  let postsRepository: MockRepository<Post>;
  let contextRepository: MockRepository<FileContext>;
  let s3Service: MockS3Service;

  beforeEach(async () => {
    // Reset mock factory counter for consistent IDs
    MockFactory.resetIdCounter();

    // Create mock repositories and services
    fileRepository = new MockRepository<File>();
    postsRepository = new MockRepository<Post>();
    contextRepository = new MockRepository<FileContext>();
    s3Service = new MockS3Service();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileLifecycleService,
        {
          provide: getRepositoryToken(File),
          useValue: fileRepository,
        },
        {
          provide: getRepositoryToken(Post),
          useValue: postsRepository,
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

    service = module.get<FileLifecycleService>(FileLifecycleService);
  });

  afterEach(() => {
    fileRepository.clear();
    postsRepository.clear();
    contextRepository.clear();
    s3Service.clear();
  });

  describe("deleteExpiredTemporaryFiles", () => {
    it("should delete files with expired timestamps", async () => {
      // Arrange
      const expiredFile1 = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });
      const expiredFile2 = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      });
      const validFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day future
      });

      fileRepository.setData([expiredFile1, expiredFile2, validFile]);
      s3Service.uploadFile(null as any, expiredFile1.fileKey);
      s3Service.uploadFile(null as any, expiredFile2.fileKey);
      s3Service.uploadFile(null as any, validFile.fileKey);

      // Act
      const deletedCount = await service.deleteExpiredTemporaryFiles();

      // Assert
      expect(deletedCount).toBe(2);
      expect(s3Service.deleteFile).toHaveBeenCalledTimes(2);
      expect(s3Service.deleteFile).toHaveBeenCalledWith(expiredFile1.fileKey);
      expect(s3Service.deleteFile).toHaveBeenCalledWith(expiredFile2.fileKey);
      expect(fileRepository.remove).toHaveBeenCalledTimes(2);

      // Verify valid file still exists
      const remainingFiles = fileRepository.getData();
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles[0].id).toBe(validFile.id);
    });

    it("should handle S3 deletion errors gracefully", async () => {
      // Arrange
      const expiredFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      fileRepository.setData([expiredFile]);

      // Simulate S3 error
      s3Service.deleteFile.mockRejectedValueOnce(new Error("S3 error"));

      // Act
      const deletedCount = await service.deleteExpiredTemporaryFiles();

      // Assert
      expect(deletedCount).toBe(0);
      expect(s3Service.deleteFile).toHaveBeenCalled();
      // File should still exist in repository due to error
      expect(fileRepository.getData()).toHaveLength(1);
    });

    it("should delete thumbnails along with main file", async () => {
      // Arrange
      const expiredFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        metadata: {
          thumbnails: ["thumb-1.jpg", "thumb-2.jpg"],
        },
      });
      fileRepository.setData([expiredFile]);

      // Act
      const deletedCount = await service.deleteExpiredTemporaryFiles();

      // Assert
      expect(deletedCount).toBe(1);
      expect(s3Service.deleteFile).toHaveBeenCalledTimes(3); // Main + 2 thumbnails
      expect(s3Service.deleteFile).toHaveBeenCalledWith(expiredFile.fileKey);
      expect(s3Service.deleteFile).toHaveBeenCalledWith("thumb-1.jpg");
      expect(s3Service.deleteFile).toHaveBeenCalledWith("thumb-2.jpg");
    });
  });

  describe("cleanupOrphanedFiles", () => {
    it("should schedule orphaned files for deletion after 30 days", async () => {
      // Arrange
      const orphanedFile = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      const recentOrphan = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      });
      const attachedFile = MockFactory.createMockFile({
        contextId: "context-123",
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      });

      fileRepository.setData([orphanedFile, recentOrphan, attachedFile]);
      const fileQb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([orphanedFile]),
      };
      fileRepository.createQueryBuilder.mockReturnValue(fileQb as any);

      // Act
      const cleanedCount = await service.cleanupOrphanedFiles();

      // Assert
      expect(cleanedCount).toBe(1);
      expect(fileRepository.save).toHaveBeenCalledTimes(1);

      // Check that orphaned file now has expiration date
      const savedFile = fileRepository.save.mock.calls[0][0] as File;
      expect(savedFile.id).toBe(orphanedFile.id);
      expect(savedFile.expiresAt).toBeDefined();

      // Verify expiration is ~30 days from now
      const expirationTime = savedFile.expiresAt!.getTime();
      const expectedTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expirationTime - expectedTime)).toBeLessThan(1000); // Within 1 second
    });

    it("should not process files with existing context", async () => {
      // Arrange
      const fileWithContext = MockFactory.createMockFile({
        contextId: "context-123",
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      fileRepository.setData([fileWithContext]);
      const fileQb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      fileRepository.createQueryBuilder.mockReturnValue(fileQb as any);

      // Act
      const cleanedCount = await service.cleanupOrphanedFiles();

      // Assert
      expect(cleanedCount).toBe(0);
      expect(fileRepository.save).not.toHaveBeenCalled();
    });

    it("should skip scheduling when a post still references the file key", async () => {
      // Arrange
      const referencedFile = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        fileKey: "uploads/image/2026/04/referenced.png",
      });
      fileRepository.setData([referencedFile]);
      const fileQb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([referencedFile]),
      };
      fileRepository.createQueryBuilder.mockReturnValue(fileQb as any);

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      postsRepository.createQueryBuilder.mockReturnValue(qb as any);

      // Act
      const cleanedCount = await service.cleanupOrphanedFiles();

      // Assert
      expect(cleanedCount).toBe(0);
      expect(fileRepository.save).not.toHaveBeenCalled();
      expect(qb.getCount).toHaveBeenCalled();
    });
  });

  describe("archiveOldFiles", () => {
    it("should archive files older than 6 months", async () => {
      // Arrange
      const oldFile = MockFactory.createMockFile({
        createdAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        isOptimized: false,
      });
      const recentFile = MockFactory.createMockFile({
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
        isOptimized: false,
      });

      fileRepository.setData([oldFile, recentFile]);
      s3Service.uploadFile(null as any, oldFile.fileKey);

      // Act
      const archivedCount = await service.archiveOldFiles();

      // Assert
      expect(archivedCount).toBe(1);
      expect(s3Service.transitionToArchive).toHaveBeenCalledWith(
        oldFile.fileKey,
      );
      expect(fileRepository.save).toHaveBeenCalledTimes(1);

      const savedFile = fileRepository.save.mock.calls[0][0] as File;
      expect(savedFile.id).toBe(oldFile.id);
      expect(savedFile.isOptimized).toBe(true);
      expect(savedFile.metadata?.archived).toBe(true);
    });

    it("should not archive already optimized files", async () => {
      // Arrange
      const oldOptimizedFile = MockFactory.createMockFile({
        createdAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000),
        isOptimized: true,
      });
      fileRepository.setData([oldOptimizedFile]);

      // Act
      const archivedCount = await service.archiveOldFiles();

      // Assert
      expect(archivedCount).toBe(0);
      expect(s3Service.transitionToArchive).not.toHaveBeenCalled();
    });

    it("should handle S3 archive errors gracefully", async () => {
      // Arrange
      const oldFile = MockFactory.createMockFile({
        createdAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000),
        isOptimized: false,
      });
      fileRepository.setData([oldFile]);

      s3Service.transitionToArchive.mockRejectedValueOnce(
        new Error("S3 archive error"),
      );

      // Act
      const archivedCount = await service.archiveOldFiles();

      // Assert
      expect(archivedCount).toBe(0);
      expect(s3Service.transitionToArchive).toHaveBeenCalled();
      expect(fileRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("handlePostDeletion", () => {
    it("should schedule related files for deletion after 30 days", async () => {
      // Arrange
      const postId = "post-123";
      const context = MockFactory.createMockFileContext({
        contextType: FileContextType.POST,
        contextId: postId,
        isActive: true,
      });
      const file1 = MockFactory.createMockFile({ contextId: context.id });
      const file2 = MockFactory.createMockFile({ contextId: context.id });

      contextRepository.setData([context]);
      fileRepository.setData([file1, file2]);

      // Act
      await service.handlePostDeletion(postId);

      // Assert
      expect(fileRepository.save).toHaveBeenCalledTimes(2);

      // Verify both files are scheduled for deletion
      const savedFiles = fileRepository.save.mock.calls.map(
        (call) => call[0],
      ) as File[];
      savedFiles.forEach((file) => {
        expect(file.expiresAt).toBeDefined();
        const expirationTime = file.expiresAt!.getTime();
        const expectedTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
        expect(Math.abs(expirationTime - expectedTime)).toBeLessThan(1000);
      });

      // Verify context is deactivated
      expect(contextRepository.save).toHaveBeenCalledTimes(1);
      const savedContext = contextRepository.save.mock
        .calls[0][0] as FileContext;
      expect(savedContext.isActive).toBe(false);
    });

    it("should handle non-existent post gracefully", async () => {
      // Arrange
      const postId = "non-existent-post";
      contextRepository.setData([]);

      // Act & Assert (should not throw)
      await expect(service.handlePostDeletion(postId)).resolves.toBeUndefined();
      expect(fileRepository.save).not.toHaveBeenCalled();
      expect(contextRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("handleUserDeletion", () => {
    it("should schedule all user files for deletion after 30 days", async () => {
      // Arrange
      const userId = "user-123";
      const file1 = MockFactory.createMockFile({ userId });
      const file2 = MockFactory.createMockFile({ userId });
      const otherUserFile = MockFactory.createMockFile({ userId: "user-456" });

      const context1 = MockFactory.createMockFileContext({ ownerId: userId });
      const context2 = MockFactory.createMockFileContext({
        ownerId: "user-456",
      });

      fileRepository.setData([file1, file2, otherUserFile]);
      contextRepository.setData([context1, context2]);

      // Act
      await service.handleUserDeletion(userId);

      // Assert
      expect(fileRepository.save).toHaveBeenCalledTimes(2);

      // Verify only user's files are scheduled
      const savedFiles = fileRepository.save.mock.calls.map(
        (call) => call[0],
      ) as File[];
      expect(savedFiles.map((f) => f.id)).toEqual([file1.id, file2.id]);
      savedFiles.forEach((file) => {
        expect(file.expiresAt).toBeDefined();
      });

      // Verify only user's contexts are deactivated
      expect(contextRepository.update).toHaveBeenCalledWith(
        { ownerId: userId },
        { isActive: false },
      );
    });
  });

  describe("performDailyCleanup", () => {
    it("should execute all cleanup operations", async () => {
      // Arrange
      const expiredFile = MockFactory.createMockFile({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const orphanedFile = MockFactory.createMockFile({
        contextId: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
      const oldFile = MockFactory.createMockFile({
        createdAt: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000),
        isOptimized: false,
      });

      fileRepository.setData([expiredFile, orphanedFile, oldFile]);
      s3Service.uploadFile(null as any, expiredFile.fileKey);
      s3Service.uploadFile(null as any, oldFile.fileKey);

      // Act
      const result = await service.performDailyCleanup();

      // Assert
      expect(result.expiredFiles).toBe(1);
      expect(result.orphanedFiles).toBe(1);
      expect(result.archivedFiles).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle errors in cleanup operations", async () => {
      // Arrange
      fileRepository.find.mockRejectedValueOnce(new Error("Database error"));

      // Act
      const result = await service.performDailyCleanup();

      // Assert
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Database error");
    });
  });

  describe("createNewVersion", () => {
    it("should deactivate old versions and increment context version", async () => {
      // Arrange
      const contextId = "context-123";
      const context = MockFactory.createMockFileContext({
        id: contextId,
        version: 1,
      });
      const oldFile = MockFactory.createMockFile({
        contextId,
        expiresAt: null,
      });

      contextRepository.setData([context]);
      fileRepository.setData([oldFile]);

      // Act
      await service.createNewVersion(contextId, {} as Express.Multer.File);

      // Assert
      // Old file should be scheduled for deletion
      expect(fileRepository.update).toHaveBeenCalledWith(
        { contextId, expiresAt: null },
        expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      );

      // Context version should be incremented
      expect(contextRepository.save).toHaveBeenCalled();
      const savedContext = contextRepository.save.mock
        .calls[0][0] as FileContext;
      expect(savedContext.version).toBe(2);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent cleanup operations", async () => {
      // Arrange
      const files = MockFactory.createMockFileBatch(10, true);
      files.forEach((f) => {
        f.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      });
      fileRepository.setData(files);

      // Act - Simulate concurrent cleanups
      const cleanups = await Promise.all([
        service.deleteExpiredTemporaryFiles(),
        service.deleteExpiredTemporaryFiles(),
      ]);

      // Assert - Should handle gracefully without double-deletion
      const totalDeleted = cleanups.reduce((sum, count) => sum + count, 0);
      expect(totalDeleted).toBeLessThanOrEqual(10);
    });

    it("should handle files without metadata gracefully", async () => {
      // Arrange
      const fileWithoutMetadata = MockFactory.createMockFile({
        metadata: null as any,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      fileRepository.setData([fileWithoutMetadata]);

      // Act & Assert - Should not throw
      await expect(service.deleteExpiredTemporaryFiles()).resolves.toBe(1);
    });
  });
});
