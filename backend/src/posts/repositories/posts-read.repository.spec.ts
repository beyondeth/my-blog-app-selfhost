import { PostsReadRepository } from "./posts-read.repository";

describe("PostsReadRepository", () => {
  const createQueryBuilderMock = () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    return queryBuilder;
  };

  it("matches blogSlug against slug and alias after normalizing @ prefix", () => {
    const queryBuilder = createQueryBuilderMock();
    const postsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const repository = new PostsReadRepository(
      {} as any,
      postsRepository as any,
    );

    repository.getCursorPaginatedQueryBuilder({
      blogSlug: "@park",
      limit: 20,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(blog.slug = :blogIdentifier OR blog.alias = :blogIdentifier)",
      expect.objectContaining({ blogIdentifier: "park" }),
    );
  });

  it("prefers blogId filter when blogId is provided", () => {
    const queryBuilder = createQueryBuilderMock();
    const postsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const repository = new PostsReadRepository(
      {} as any,
      postsRepository as any,
    );

    repository.getCursorPaginatedQueryBuilder({
      blogId: "blog-1",
      blogSlug: "@park",
      limit: 20,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "blog.id = :blogId",
      expect.objectContaining({ blogId: "blog-1" }),
    );
  });
});
