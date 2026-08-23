import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { FilesService } from "./files.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { UploadCompleteDto } from "./dto/upload-complete.dto";
import {
  BatchUploadCompleteDto,
  CreateBatchUploadUrlDto,
} from "./dto/batch-upload.dto";

describe("FilesService upload completion contract", () => {
  let service: FilesService;
  let fileRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let contextRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let s3Service: {
    generatePresignedUploadUrl: jest.Mock;
    getObjectMetadata: jest.Mock;
    getObjectSample: jest.Mock;
  };
  let cdnService: { generateCdnUrl: jest.Mock };
  let configService: { get: jest.Mock };

  const uploadRequest: CreateUploadUrlDto = {
    fileName: "image.webp",
    mimeType: "image/webp",
    fileSize: 1024,
    fileType: "image",
  };

  beforeEach(() => {
    fileRepository = {
      create: jest.fn((value) => ({ id: "file-1", ...value })),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (value) => value),
    };
    contextRepository = {
      create: jest.fn((value) => ({ id: "context-1", ...value })),
      save: jest.fn(async (value) => value),
    };
    s3Service = {
      generatePresignedUploadUrl: jest.fn(async (fileKey: string) => ({
        uploadUrl: "https://storage.example/upload",
        fileKey,
        expiresIn: 900,
      })),
      getObjectMetadata: jest.fn(),
      getObjectSample: jest.fn(async () =>
        Buffer.from("524946460000000057454250", "hex"),
      ),
    };
    cdnService = {
      generateCdnUrl: jest.fn(() => ({
        url: "/api/v1/files/proxy/uploads/image.webp",
        cached: false,
      })),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === "JWT_SECRET") {
          return "test-secret-with-at-least-32-characters";
        }
        return defaultValue;
      }),
    };

    service = new FilesService(
      fileRepository as any,
      contextRepository as any,
      s3Service as any,
      cdnService as any,
      configService as any,
    );
  });

  const issueUpload = () => service.createUploadUrl("user-1", uploadRequest);

  const completeUpload = (
    issued: Awaited<ReturnType<typeof issueUpload>>,
    overrides: Partial<UploadCompleteDto> = {},
  ): UploadCompleteDto => ({
    tempId: issued.tempId,
    fileKey: issued.fileKey,
    fileUrl: issued.fileKey,
    fileName: uploadRequest.fileName,
    mimeType: uploadRequest.mimeType,
    fileSize: uploadRequest.fileSize,
    fileType: uploadRequest.fileType,
    ...overrides,
  });

  it("accepts completion only when the issued intent and stored object metadata agree", async () => {
    const issued = await issueUpload();
    s3Service.getObjectMetadata.mockResolvedValue({
      contentType: uploadRequest.mimeType,
      contentLength: uploadRequest.fileSize,
    });

    const result = await service.uploadComplete(
      "user-1",
      completeUpload(issued),
    );

    expect(result).toEqual(
      expect.objectContaining({
        fileKey: issued.fileKey,
        fileSize: uploadRequest.fileSize,
        mimeType: uploadRequest.mimeType,
        userId: "user-1",
        accessUrl: "/api/v1/files/proxy/uploads/image.webp",
        expiresAt: expect.any(Date),
      }),
    );
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 24 * 60 * 60 * 1000,
    );
    expect(s3Service.getObjectMetadata).toHaveBeenCalledWith(issued.fileKey);
    expect(fileRepository.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["file key", { fileKey: "uploads/image/tampered.webp" }],
    ["file name", { fileName: "tampered.webp" }],
    ["MIME type", { mimeType: "image/png" }],
    ["file size", { fileSize: 2048 }],
    ["file URL", { fileUrl: "https://attacker.example/object.webp" }],
  ])("rejects tampered completion metadata (%s)", async (_field, override) => {
    const issued = await issueUpload();

    await expect(
      service.uploadComplete("user-1", completeUpload(issued, override)),
    ).rejects.toThrow(BadRequestException);

    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects an upload intent used by a different user", async () => {
    const issued = await issueUpload();

    await expect(
      service.uploadComplete("user-2", completeUpload(issued)),
    ).rejects.toThrow(ForbiddenException);

    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects an upload intent used by a different organization", async () => {
    const issued = await service.createUploadUrl(
      "user-1",
      uploadRequest,
      "org-a",
    );

    await expect(
      service.uploadComplete("user-1", completeUpload(issued), "org-b"),
    ).rejects.toThrow(ForbiddenException);

    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects a forged upload intent before reading or persisting an object", async () => {
    const issued = await issueUpload();
    const forged = {
      ...completeUpload(issued),
      tempId: `${issued.tempId.slice(0, -1)}x`,
    };

    await expect(service.uploadComplete("user-1", forged)).rejects.toThrow(
      BadRequestException,
    );

    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects completion when the uploaded object is missing or has mismatched metadata", async () => {
    const issued = await issueUpload();
    const request = completeUpload(issued);

    s3Service.getObjectMetadata.mockResolvedValueOnce(null);
    await expect(service.uploadComplete("user-1", request)).rejects.toThrow(
      BadRequestException,
    );

    s3Service.getObjectMetadata.mockResolvedValueOnce({
      contentType: "image/png",
      contentLength: uploadRequest.fileSize + 1,
    });
    await expect(service.uploadComplete("user-1", request)).rejects.toThrow(
      BadRequestException,
    );

    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects an object whose bytes do not match the signed WebP MIME type", async () => {
    const issued = await issueUpload();
    s3Service.getObjectMetadata.mockResolvedValue({
      contentType: uploadRequest.mimeType,
      contentLength: uploadRequest.fileSize,
    });
    s3Service.getObjectSample.mockResolvedValue(
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );

    await expect(
      service.uploadComplete("user-1", completeUpload(issued)),
    ).rejects.toThrow(BadRequestException);

    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("rejects replaying a completion for an already persisted object", async () => {
    const issued = await issueUpload();
    fileRepository.findOne.mockResolvedValue({ id: "existing-file" });

    await expect(
      service.uploadComplete("user-1", completeUpload(issued)),
    ).rejects.toThrow(ConflictException);

    expect(fileRepository.findOne).toHaveBeenCalledWith({
      where: { fileKey: issued.fileKey },
    });
    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it("binds batch completion to the signed batch intent and owner", async () => {
    const batchRequest: CreateBatchUploadUrlDto = {
      files: [
        {
          fileName: "batch.webp",
          mimeType: "image/webp",
          fileSize: 1024,
          fileType: "image",
        },
      ],
    };
    const issued = await service.createBatchUploadUrl("user-1", batchRequest);
    const completion: BatchUploadCompleteDto = {
      batchId: issued.batchId,
      fileKeys: [issued.uploads[0].fileKey],
    };

    await expect(
      service.batchUploadComplete("user-2", completion),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.batchUploadComplete("user-1", {
        ...completion,
        fileKeys: ["uploads/attacker.webp"],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(s3Service.getObjectMetadata).not.toHaveBeenCalled();
  });
});
