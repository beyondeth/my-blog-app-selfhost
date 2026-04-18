import { BadRequestException } from "@nestjs/common";
import { FilesService } from "./files.service";

describe("FilesService", () => {
  const createService = () =>
    new FilesService(
      {} as any,
      {} as any,
      {
        generatePresignedUploadUrl: jest.fn(),
      } as any,
      {} as any,
      {
        get: jest.fn((_: string, fallback: unknown) => fallback),
      } as any,
    );

  it("rejects svg image uploads with an explicit policy message", async () => {
    const service = createService();

    await expect(
      service.createUploadUrl("user-1", {
        fileName: "diagram.svg",
        mimeType: "image/svg+xml",
        fileSize: 1024,
        fileType: "image",
      } as any),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createUploadUrl("user-1", {
        fileName: "diagram.svg",
        mimeType: "image/svg+xml",
        fileSize: 1024,
        fileType: "image",
      } as any),
    ).rejects.toThrow(
      "SVG 업로드는 보안 정책상 허용되지 않습니다. PNG, JPEG, WebP 이미지를 사용하세요.",
    );
  });
});
