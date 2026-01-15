import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Brackets } from "typeorm";
import { Conversation } from "../entities/conversation.entity";
import { ConversationWithUnread } from "../dto/conversation-with-unread.dto";

@Injectable()
export class ConversationRepository {
  /**
   * 반복되는 select 옵션을 상수화 (DRY 원칙)
   * - conversations 테이블의 모든 필드
   * - user 테이블의 필요한 필드만 (blog 등 불필요한 relation 제외)
   */
  private readonly CONVERSATION_SELECT = {
    base: [
      "conversation.id",
      "conversation.user1Id",
      "conversation.user2Id",
      "conversation.lastMessageAt",
      "conversation.user1LastReadAt",
      "conversation.user2LastReadAt",
      "conversation.user1DeletedAt",
      "conversation.user2DeletedAt",
      "conversation.createdAt",
      "conversation.updatedAt",
    ],
    // Phase 1-2-3: profileImage는 profiles 테이블로 이동
    userFields: ["id", "username", "isActive"],
  };

  constructor(
    @InjectRepository(Conversation)
    private readonly repository: Repository<Conversation>,
  ) {}

  async findOrCreate(user1Id: string, user2Id: string): Promise<Conversation> {
    // Order user IDs to ensure consistency
    const [orderedUser1Id, orderedUser2Id] = [user1Id, user2Id].sort();

    let conversation = await this.repository.findOne({
      where: { user1Id: orderedUser1Id, user2Id: orderedUser2Id },
      relations: ["user1", "user1.profile", "user2", "user2.profile"],
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        lastMessageAt: true,
        user1LastReadAt: true,
        user2LastReadAt: true,
        user1DeletedAt: true,
        user2DeletedAt: true,
        createdAt: true,
        updatedAt: true,
        user1: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
        user2: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
      },
    });

    if (!conversation) {
      // Use upsert to avoid race condition
      await this.repository
        .createQueryBuilder()
        .insert()
        .into(Conversation)
        .values({ user1Id: orderedUser1Id, user2Id: orderedUser2Id })
        .orIgnore()
        .execute();

      conversation = await this.repository.findOne({
        where: { user1Id: orderedUser1Id, user2Id: orderedUser2Id },
        relations: ["user1", "user1.profile", "user2", "user2.profile"],
        select: {
          id: true,
          user1Id: true,
          user2Id: true,
          lastMessageAt: true,
          user1LastReadAt: true,
          user2LastReadAt: true,
          user1DeletedAt: true,
          user2DeletedAt: true,
          createdAt: true,
          updatedAt: true,
          user1: {
            id: true,
            username: true,
            isActive: true,
            profile: {
              profileImage: true,
            },
          },
          user2: {
            id: true,
            username: true,
            isActive: true,
            profile: {
              profileImage: true,
            },
          },
        },
      });
    }

    return conversation;
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.repository.findOne({
      where: { id },
      relations: ["user1", "user1.profile", "user2", "user2.profile"],
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        lastMessageAt: true,
        user1LastReadAt: true,
        user2LastReadAt: true,
        user1DeletedAt: true,
        user2DeletedAt: true,
        createdAt: true,
        updatedAt: true,
        user1: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
        user2: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
      },
    });
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<Conversation | null> {
    const conversation = await this.repository.findOne({
      where: { id },
      relations: ["user1", "user1.profile", "user2", "user2.profile"],
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        lastMessageAt: true,
        user1LastReadAt: true,
        user2LastReadAt: true,
        user1DeletedAt: true,
        user2DeletedAt: true,
        createdAt: true,
        updatedAt: true,
        user1: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
        user2: {
          id: true,
          username: true,
          isActive: true,
          profile: {
            profileImage: true,
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    // Check if user is part of the conversation
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return null;
    }

    return conversation;
  }

  async findUserConversations(userId: string): Promise<Conversation[]> {
    /**
     * 대화 목록 조회
     * - 삭제하지 않은 대화 표시 (deletedAt IS NULL)
     * - 삭제했지만 새 메시지가 있는 대화도 표시 (lastMessageAt > deletedAt)
     * - 삭제 후 새 메시지가 오면 대화는 다시 나타나지만, 이전 메시지는 보이지 않음
     *
     * Phase 1-2-3: profileImage는 profiles 테이블에서 JOIN
     * 표준 관계 쿼리 사용 (formatAuthorData 패턴과 호환)
     */
    return this.repository
      .createQueryBuilder("conversation")
      .leftJoin("conversation.user1", "user1")
      .leftJoin("user1.profile", "user1Profile")
      .leftJoin("conversation.user2", "user2")
      .leftJoin("user2.profile", "user2Profile")
      .select([
        ...this.CONVERSATION_SELECT.base,
        // User 기본 필드
        ...this.CONVERSATION_SELECT.userFields.map((field) => `user1.${field}`),
        ...this.CONVERSATION_SELECT.userFields.map((field) => `user2.${field}`),
        // Profile 관계 전체 (formatAuthorData에서 flatten 처리)
        "user1Profile",
        "user2Profile",
      ])
      .where(
        new Brackets((qb) => {
          qb.where(
            "conversation.user1Id = :userId AND (conversation.user1DeletedAt IS NULL OR conversation.lastMessageAt > conversation.user1DeletedAt)",
          ).orWhere(
            "conversation.user2Id = :userId AND (conversation.user2DeletedAt IS NULL OR conversation.lastMessageAt > conversation.user2DeletedAt)",
          );
        }),
      )
      .setParameters({ userId })
      .orderBy("conversation.lastMessageAt", "DESC", "NULLS LAST")
      .getMany();
  }

  async updateLastMessageAt(conversationId: string): Promise<void> {
    await this.repository.update(conversationId, {
      lastMessageAt: new Date(),
    });
  }

  async markUserAsLeft(conversationId: string, userId: string): Promise<void> {
    // 조건부 UPDATE로 최적화 - DB 조회 없이 한 번의 쿼리로 처리
    // user1이면 user1DeletedAt 업데이트, user2면 user2DeletedAt 업데이트
    const result = await this.repository
      .createQueryBuilder()
      .update(Conversation)
      .set({
        user1DeletedAt: () =>
          `CASE WHEN user1Id = :userId THEN NOW() ELSE user1DeletedAt END`,
        user2DeletedAt: () =>
          `CASE WHEN user2Id = :userId THEN NOW() ELSE user2DeletedAt END`,
      })
      .where("id = :conversationId", { conversationId })
      .andWhere("(user1Id = :userId OR user2Id = :userId)", { userId })
      .execute();

    // 업데이트된 행이 없으면 해당 대화가 없거나 사용자가 참여자가 아님
    if (result.affected === 0) {
      console.warn(
        `[대화] 대화 ${conversationId}에서 사용자 ${userId}를 찾을 수 없음`,
      );
    }
  }

  async resetUserDeletedAt(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    // 조건부 UPDATE로 최적화 - DB 조회 없이 한 번의 쿼리로 처리
    // user1이면 user1DeletedAt을 null로, user2면 user2DeletedAt을 null로
    const result = await this.repository
      .createQueryBuilder()
      .update(Conversation)
      .set({
        user1DeletedAt: () =>
          `CASE WHEN user1Id = :userId THEN NULL ELSE user1DeletedAt END`,
        user2DeletedAt: () =>
          `CASE WHEN user2Id = :userId THEN NULL ELSE user2DeletedAt END`,
      })
      .where("id = :conversationId", { conversationId })
      .andWhere("(user1Id = :userId OR user2Id = :userId)", { userId })
      // deletedAt이 설정된 경우에만 리셋 (불필요한 UPDATE 방지)
      .andWhere(
        "(user1Id = :userId AND user1DeletedAt IS NOT NULL) OR (user2Id = :userId AND user2DeletedAt IS NOT NULL)",
        { userId },
      )
      .execute();

    if (result.affected === 0) {
      console.log(
        `[대화] 대화 ${conversationId}에서 사용자 ${userId}의 deletedAt이 이미 null이거나 참여자가 아님`,
      );
    }
  }
}
