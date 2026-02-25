import { Test, TestingModule } from "@nestjs/testing";
import { CommentsService } from "./comments.service";
import { CommentsQueryService } from "./services/comments-query.service";
import { CommentsCommandService } from "./services/comments-command.service";
import { User } from "../users/entities/user.entity";
import { Role } from "../common/enums/role.enum";

describe("CommentsService (Facade)", () => {
  let service: CommentsService;
  let queryService: CommentsQueryService;
  let commandService: CommentsCommandService;

  const mockQueryService = {
    findAllByPost: jest.fn(),
    findOne: jest.fn(),
    findAllComments: jest.fn(),
    getParentCommentsPaginated: jest.fn(),
    getRepliesPaginated: jest.fn(),
  };

  const mockCommandService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleLike: jest.fn(),
    toggleDislike: jest.fn(),
    incrementRepliesCount: jest.fn(),
    decrementRepliesCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: CommentsQueryService,
          useValue: mockQueryService,
        },
        {
          provide: CommentsCommandService,
          useValue: mockCommandService,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    queryService = module.get<CommentsQueryService>(CommentsQueryService);
    commandService = module.get<CommentsCommandService>(CommentsCommandService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Facade delegation", () => {
    const mockUser = { id: "user-uuid", role: Role.USER } as User;

    it("should delegate create to CommentsCommandService", async () => {
      const dto = { content: "test", postId: "post-1" };
      await service.create(dto, mockUser, "127.0.0.1");
      expect(commandService.create).toHaveBeenCalledWith(
        dto,
        mockUser,
        "127.0.0.1",
      );
    });

    it("should delegate findOne to CommentsQueryService", async () => {
      await service.findOne("comment-1");
      expect(queryService.findOne).toHaveBeenCalledWith("comment-1");
    });

    it("should delegate update to CommentsCommandService", async () => {
      const dto = { content: "updated" };
      await service.update("comment-1", dto, mockUser);
      expect(commandService.update).toHaveBeenCalledWith(
        "comment-1",
        dto,
        mockUser,
      );
    });

    it("should delegate remove to CommentsCommandService", async () => {
      await service.remove("comment-1", mockUser);
      expect(commandService.remove).toHaveBeenCalledWith("comment-1", mockUser);
    });

    it("should delegate toggleLike to CommentsCommandService", async () => {
      await service.toggleLike("comment-1", mockUser);
      expect(commandService.toggleLike).toHaveBeenCalledWith(
        "comment-1",
        mockUser,
      );
    });

    it("should delegate getParentCommentsPaginated to CommentsQueryService", async () => {
      const queryDto = { limit: 10 };
      await service.getParentCommentsPaginated("post-1", queryDto, mockUser);
      expect(queryService.getParentCommentsPaginated).toHaveBeenCalledWith(
        "post-1",
        queryDto,
        mockUser,
      );
    });
  });
});
