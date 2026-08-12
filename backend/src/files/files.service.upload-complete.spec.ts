import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FilesService } from "./files.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { UploadCompleteDto } from "./dto/upload-complete.dto";

describe("FilesService upload completion contract", () => {
  let service: FilesService;
  let fileRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let contextRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let s3Service: {
    generatePresignedUploadUrl: jest.Mock;
    getObjectMetadata: jest.Mock;
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
      }),
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
});
