import { WsException } from "@nestjs/websockets";
import { ChatGateway } from "./chat.gateway";

describe("ChatGateway conversation room authorization", () => {
  const chatService = {
    setChatGateway: jest.fn(),
    assertConversationParticipant: jest.fn(),
    markAllMessagesAsRead: jest.fn(),
  };
  const unifiedRedisService = {
    addToSet: jest.fn(),
    removeFromSet: jest.fn(),
    getSetMembers: jest.fn(),
  };

  const createGateway = () =>
    new ChatGateway(
      chatService as any,
      {} as any,
      {} as any,
      unifiedRedisService as any,
      { updateWebSocketConnections: jest.fn() } as any,
    );

  const createClient = () => ({
    data: { userId: "attacker" },
    join: jest.fn(),
    leave: jest.fn(),
    broadcast: {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    unifiedRedisService.removeFromSet.mockResolvedValue(undefined);
  });

  it("does not join or add presence for a non-participant", async () => {
    const gateway = createGateway();
    const client = createClient();
    chatService.assertConversationParticipant.mockRejectedValue(
      new Error("Not authorized"),
    );

    await expect(
      gateway.handleJoinConversation("conversation-1", client as any),
    ).rejects.toBeInstanceOf(WsException);

    expect(client.join).not.toHaveBeenCalled();
    expect(unifiedRedisService.addToSet).not.toHaveBeenCalled();
    expect(chatService.markAllMessagesAsRead).not.toHaveBeenCalled();
    expect(client.leave).toHaveBeenCalledWith("conversation:conversation-1");
    expect(unifiedRedisService.removeFromSet).toHaveBeenCalledWith(
      "conversation",
      "conversation-1:active-users",
      "attacker",
    );
  });

  it("returns success only after validation and a completed room join", async () => {
    const gateway = createGateway();
    const client = createClient();
    chatService.assertConversationParticipant.mockResolvedValue(undefined);
    client.join.mockResolvedValue(undefined);
    unifiedRedisService.addToSet.mockResolvedValue(undefined);
    chatService.markAllMessagesAsRead.mockResolvedValue(undefined);

    await expect(
      gateway.handleJoinConversation("conversation-1", client as any),
    ).resolves.toMatchObject({ success: true, joined: true });

    expect(
      chatService.assertConversationParticipant.mock.invocationCallOrder[0],
    ).toBeLessThan(client.join.mock.invocationCallOrder[0]);
    expect(client.join.mock.invocationCallOrder[0]).toBeLessThan(
      unifiedRedisService.addToSet.mock.invocationCallOrder[0],
    );
    expect(
      unifiedRedisService.addToSet.mock.invocationCallOrder[0],
    ).toBeLessThan(
      chatService.markAllMessagesAsRead.mock.invocationCallOrder[0],
    );
  });
});
