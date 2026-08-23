import { PostReadService } from "./post-read.service";

describe("PostReadService related-post query", () => {
  const createQueryBuilder = () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn(),
      leftJoin: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      take: jest.fn(),
      getMany: jest.fn(async () => []),
    };
    for (const method of [
      "leftJoinAndSelect",
      "leftJoin",
      "addSelect",
      "where",
      "andWhere",
      "orderBy",
      "take",
    ] as const) {
      queryBuilder[method].mockReturnValue(queryBuilder);
    }
    return queryBuilder;
  };

  it("uses a parameterized PostgreSQL JSONB tag-overlap expression", async () => {
    const relevanceQuery = createQueryBuilder();
    const popularityQuery = createQueryBuilder();
    const postsRepository = {
      findOne: jest.fn(async () => ({
        id: "post-1",
        blogId: "blog-1",
        category: "Tech",
        tags: ["mcp", "self-host"],
      })),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(relevanceQuery)
        .mockReturnValueOnce(popularityQuery),
    };
    const service = new PostReadService(
      postsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getRelatedPosts("post-1", 6);

    expect(relevanceQuery.andWhere).toHaveBeenCalledWith(
      "(post.category = :category OR jsonb_exists_any(post.tags, ARRAY[:...tags]::text[]))",
      { category: "Tech", tags: ["mcp", "self-host"] },
    );
  });
});
