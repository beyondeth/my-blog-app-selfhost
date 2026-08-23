/**
 * ContextualFileService Unit Tests
 * Tests for context-aware file management
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContextualFileService } from "../../services/contextual-file.service";
import { File } from "../../entities/file.entity";
import {
  FileContext,
  FileContextType,
  FilePurpose,
} from "../../entities/file-context.entity";
import { S3Service } from "../../services/s3.service";
import { CdnService } from "../../services/cdn.service";
import { MockRepository } from "../test-utils/repository.mock";
import { MockS3Service } from "../test-utils/s3.mock";
import { MockFactory } from "../test-utils/mock.factory";

describe("ContextualFileService", () => {
  let service: ContextualFileService;
  let fileRepository: MockRepository<File>;
  let contextRepository: MockRepository<FileContext>;
  let s3Service: MockS3Service;

  const mockCdnService = {
    generateCdnUrl: jest.fn((file: File) => ({
      url: `https://cdn.example.test/${file.fileKey}`,
      cached: true,
    })),
  };

  beforeEach(async () => {
    MockFactory.resetIdCounter();

    fileRepository = new MockRepository<File>();
    contextRepository = new MockRepository<FileContext>();
    s3Service = new MockS3Service();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextualFileService,
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
          provide: CdnService,
          useValue: mockCdnService,
        },
      ],
    }).compile();

    service = module.get<ContextualFileService>(ContextualFileService);
  });

  afterEach(() => {
    fileRepository.clear();
    contextRepository.clear();
    s3Service.clear();
    jest.clearAllMocks();
  });

  describe("createContext", () => {
    it("should create a new file context", async () => {
      // Act
      const context = await service.createContext(
        FileContextType.POST,
        "post-123",
        FilePurpose.CONTENT,
        "user-123",
      );

      // Assert
      expect(context).toBeDefined();
      expect(context.contextType).toBe(FileContextType.POST);
      expect(context.contextId).toBe("post-123");
      expect(context.purpose).toBe(FilePurpose.CONTENT);
      expect(context.ownerId).toBe("user-123");
      expect(context.isActive).toBe(true);
      expect(context.version).toBe(1);
      expect(contextRepository.save).toHaveBeenCalledWith(context);
    });

    it("should set appropriate file limits based on context type", async () => {
      // Act - Profile context
      const profileContext = await service.createContext(
        FileContextType.PROFILE,
        "user-123",
        FilePurpose.AVATAR,
        "user-123",
      );

      // Assert
      expect(profileContext.maxFiles).toBe(1);
      expect(profileContext.maxFileSize).toBe(5 * 1024 * 1024); // 5MB
      expect(profileContext.allowedTypes).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

      // Act - Post context
      const postContext = await service.createContext(
        FileContextType.POST,
        "post-123",
        FilePurpose.CONTENT,
        "user-123",
      );

      // Assert
      expect(postContext.maxFiles).toBe(10);
      expect(postContext.maxFileSize).toBe(5 * 1024 * 1024); // 5MB
    });
  });

  describe("findOrCreateContext", () => {
    it("should return existing context if found", async () => {
      // Arrange
      const existingContext = MockFactory.createMockFileContext({
        contextType: FileContextType.POST,
        contextId: "post-123",
        purpose: FilePurpose.CONTENT,
      });
      contextRepository.setData([existingContext]);

      // Act
      const context = await service.findOrCreateContext(
        FileContextType.POST,
        "post-123",
        FilePurpose.CONTENT,
        "user-123",
      );

      // Assert
      expect(context.id).toBe(existingContext.id);
      expect(contextRepository.save).not.toHaveBeenCalled(); // Shouldn't create new
    });

    it("should create new context if not found", async () => {
      // Arrange
      contextRepository.setData([]);

      // Act
      const context = await service.findOrCreateContext(
        FileContextType.POST,
        "post-123",
        FilePurpose.CONTENT,
        "user-123",
      );

      // Assert
      expect(context).toBeDefined();
      expect(contextRepository.save).toHaveBeenCalled();
    });
  });

  describe("uploadWithContext", () => {
    it("should upload file and attach to context", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        contextType: FileContextType.POST,
        maxFiles: 5,
        maxFileSize: 10 * 1024 * 1024,
        allowedTypes: ["image/jpeg", "image/png"],
        fileCount: 0,
        totalSize: 0,
      });
      contextRepository.setData([context]);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024 * 100,
        buffer: Buffer.from("test-image"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act
      const file = await service.uploadWithContext(
        mockFile,
        "context-123",
        "user-123",
      );

      // Assert
      expect(file).toBeDefined();
      expect(file.contextId).toBe("context-123");
      expect(file.userId).toBe("user-123");
      expect(s3Service.uploadFile).toHaveBeenCalled();
      expect(fileRepository.save).toHaveBeenCalled();

      // Context stats should be updated
      expect(contextRepository.save).toHaveBeenCalled();
      const updatedContext = contextRepository.save.mock
        .calls[0][0] as FileContext;
      expect(updatedContext.fileCount).toBe(1);
      expect(updatedContext.totalSize).toBe(mockFile.size);
    });

    it("should reject file if context limit is exceeded", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        maxFiles: 1,
        fileCount: 1, // Already at limit
      });
      contextRepository.setData([context]);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act & Assert
      await expect(
        service.uploadWithContext(mockFile, "context-123", "user-123"),
      ).rejects.toThrow(BadRequestException);
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
    });

    it("should reject file if size limit is exceeded", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        maxFileSize: 1024, // 1KB limit
      });
      contextRepository.setData([context]);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 2048, // 2KB - exceeds limit
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act & Assert
      await expect(
        service.uploadWithContext(mockFile, "context-123", "user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject file with disallowed mime type", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        allowedTypes: ["image/jpeg", "image/png"],
      });
      contextRepository.setData([context]);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf", // Not allowed
        size: 1024,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act & Assert
      await expect(
        service.uploadWithContext(mockFile, "context-123", "user-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should mark images as optimized when the context requires it", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        contextType: FileContextType.POST,
        metadata: { optimizeImages: true },
      });
      contextRepository.setData([context]);

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024 * 500,
        buffer: Buffer.from("large-image"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act
      const file = await service.uploadWithContext(
        mockFile,
        "context-123",
        "user-123",
      );

      // Assert
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        mockFile,
        expect.any(String),
      );
      expect(file.isOptimized).toBe(true);
      expect(file.metadata?.optimized).toBe(true);
    });
  });

  describe("removeFileFromContext", () => {
    it("should remove file from context and update stats", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        fileCount: 2,
        totalSize: 2048,
      });
      const file = MockFactory.createMockFile({
        id: "file-123",
        contextId: "context-123",
        context,
        fileSize: 1024,
      });

      contextRepository.setData([context]);
      fileRepository.setData([file]);
      s3Service.seedFile(file.fileKey);

      // Act
      await service.removeFileFromContext("file-123");

      // Assert
      expect(s3Service.deleteFile).toHaveBeenCalledWith(file.fileKey);
      expect(fileRepository.remove).toHaveBeenCalledWith(file);

      // Context stats should be updated
      expect(contextRepository.save).toHaveBeenCalled();
      const updatedContext = contextRepository.save.mock
        .calls[0][0] as FileContext;
      expect(updatedContext.fileCount).toBe(1);
      expect(updatedContext.totalSize).toBe(1024);
    });

    it("should throw if file not found", async () => {
      // Arrange
      fileRepository.setData([]);

      // Act & Assert
      await expect(
        service.removeFileFromContext("non-existent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should delete thumbnails if present", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        id: "file-123",
        contextId: "context-123",
        metadata: {
          thumbnails: ["thumb-1.jpg", "thumb-2.jpg"],
        },
      });

      const context = MockFactory.createMockFileContext({ id: "context-123" });
      fileRepository.setData([file]);
      contextRepository.setData([context]);
      s3Service.seedFile(file.fileKey);
      s3Service.seedFile("thumb-1.jpg");
      s3Service.seedFile("thumb-2.jpg");

      // Act
      await service.removeFileFromContext("file-123");

      // Assert
      expect(s3Service.deleteFile).toHaveBeenCalledTimes(3); // Main + 2 thumbnails
      expect(s3Service.deleteFile).toHaveBeenCalledWith("thumb-1.jpg");
      expect(s3Service.deleteFile).toHaveBeenCalledWith("thumb-2.jpg");
    });
  });

  describe("getContextFiles", () => {
    it("should return all files for a context", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({ id: "context-123" });
      const files = [
        MockFactory.createMockFile({ contextId: "context-123" }),
        MockFactory.createMockFile({ contextId: "context-123" }),
        MockFactory.createMockFile({ contextId: "other-context" }),
      ];

      contextRepository.setData([context]);
      fileRepository.setData(files);

      // Act
      const contextFiles = await service.getContextFiles("context-123");

      // Assert
      expect(contextFiles).toHaveLength(2);
      expect(contextFiles.every((f) => f.contextId === "context-123")).toBe(
        true,
      );
    });

    it("should throw if context not found", async () => {
      // Arrange
      contextRepository.setData([]);

      // Act & Assert
      await expect(service.getContextFiles("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateContextMetadata", () => {
    it("should update context metadata", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        metadata: { key1: "value1" },
      });
      contextRepository.setData([context]);

      // Act
      const updated = await service.updateContextMetadata("context-123", {
        key2: "value2",
        key3: "value3",
      });

      // Assert
      expect(updated.metadata).toEqual({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      });
      expect(contextRepository.save).toHaveBeenCalled();
    });
  });

  describe("deactivateContext", () => {
    it("should deactivate context and schedule files for deletion", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        isActive: true,
      });
      const files = [
        MockFactory.createMockFile({ contextId: "context-123" }),
        MockFactory.createMockFile({ contextId: "context-123" }),
      ];

      contextRepository.setData([context]);
      fileRepository.setData(files);

      // Act
      await service.deactivateContext("context-123");

      // Assert
      expect(context.isActive).toBe(false);
      expect(contextRepository.save).toHaveBeenCalled();

      // Files should be scheduled for deletion
      expect(fileRepository.update).toHaveBeenCalledWith(
        { contextId: "context-123" },
        expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe("generateThumbnails", () => {
    it("should generate thumbnail keys for image files", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        id: "file-123",
        mimeType: "image/jpeg",
        fileKey: "v2/users/user-123/post/content/image.jpg",
      });
      fileRepository.setData([file]);

      const sizes = [
        { width: 150, height: 150, suffix: "thumb" },
        { width: 300, height: 300, suffix: "small" },
      ];

      // Act
      const thumbnails = await service.generateThumbnails("file-123", sizes);

      // Assert
      expect(thumbnails).toHaveLength(2);
      expect(thumbnails).toEqual([
        "v2/users/user-123/post/content/image_thumb.jpg",
        "v2/users/user-123/post/content/image_small.jpg",
      ]);

      // File metadata should be updated
      expect(fileRepository.save).toHaveBeenCalled();
      const updatedFile = fileRepository.save.mock.calls[0][0] as File;
      expect(updatedFile.metadata?.thumbnails).toHaveLength(2);
    });

    it("should skip non-image files", async () => {
      // Arrange
      const file = MockFactory.createMockFile({
        id: "file-123",
        mimeType: "application/pdf",
      });
      fileRepository.setData([file]);

      // Act
      const thumbnails = await service.generateThumbnails("file-123", []);

      // Assert
      expect(thumbnails).toHaveLength(0);
      expect(fileRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle context with no files gracefully", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({
        id: "context-123",
        fileCount: 0,
      });
      contextRepository.setData([context]);
      fileRepository.setData([]);

      // Act
      const files = await service.getContextFiles("context-123");

      // Assert
      expect(files).toHaveLength(0);
    });

    it("should handle S3 upload failure and cleanup", async () => {
      // Arrange
      const context = MockFactory.createMockFileContext({ id: "context-123" });
      contextRepository.setData([context]);

      s3Service.uploadFile.mockRejectedValueOnce(new Error("S3 upload failed"));

      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "test.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test"),
        stream: null as any,
        destination: "",
        filename: "",
        path: "",
      };

      // Act & Assert
      await expect(
        service.uploadWithContext(mockFile, "context-123", "user-123"),
      ).rejects.toThrow("S3 upload failed");

      // File should not be saved to database
      expect(fileRepository.save).not.toHaveBeenCalled();
      expect(contextRepository.save).not.toHaveBeenCalled();
    });
  });
});
