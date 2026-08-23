import { PostMapperService } from "./post-mapper.service";

describe("PostMapperService image batching", () => {
  it("loads all post images with one ordered query", async () => {
    const filesRepository = {
      query: jest.fn().mockResolvedValue([
        {
          postId: "00000000-0000-0000-0000-000000000001",
          id: "00000000-0000-0000-0000-000000000011",
          fileKey: "uploads/image/first.webp",
        },
        {
          postId: "00000000-0000-0000-0000-000000000001",
          id: "00000000-0000-0000-0000-000000000012",
          fileKey: "uploads/image/second.webp",
        },
      ]),
    };
    const service = new PostMapperService(
      filesRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getAttachedImageFilesByPostIds([
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ]);

    expect(filesRepository.query).toHaveBeenCalledTimes(1);
    expect(filesRepository.query.mock.calls[0][0]).toContain("image_order");
    expect(
      result
        .get("00000000-0000-0000-0000-000000000001")
        ?.map((file) => file.fileKey),
    ).toEqual(["uploads/image/first.webp", "uploads/image/second.webp"]);
    expect(result.get("00000000-0000-0000-0000-000000000002")).toEqual([]);
  });
});
