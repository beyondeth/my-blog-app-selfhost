import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Conversation } from '../entities/conversation.entity';
import { QueuedMessage } from '../interfaces/message-queue.interface';

@Injectable()
export class MessageRepository {
  constructor(
    @InjectRepository(Message)
    private readonly repository: Repository<Message>,
    private readonly dataSource: DataSource,
  ) {}

  async saveMessage(message: Partial<Message>): Promise<Message> {
    return this.repository.save(message);
  }

  async saveBatch(messages: QueuedMessage[]): Promise<Message[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedMessages: Message[] = [];

      // Batch insert all messages
      const messageEntities = messages.map(msg =>
        this.repository.create({
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: msg.createdAt,
        })
      );

      const result = await queryRunner.manager.save(Message, messageEntities);
      savedMessages.push(...result);

      // 대화별로 lastMessageAt 업데이트 및 deletedAt 리셋
      const conversationIds = [...new Set(messages.map(m => m.conversationId))];

      // 대화별 발신자 ID 수집 (새 메시지를 보낸 사용자들)
      const conversationSenders = new Map<string, Set<string>>();
      messages.forEach(msg => {
        if (!conversationSenders.has(msg.conversationId)) {
          conversationSenders.set(msg.conversationId, new Set());
        }
        conversationSenders.get(msg.conversationId).add(msg.senderId);
      });

      // 각 대화에 대해 업데이트 수행
      for (const conversationId of conversationIds) {
        const senderIds = conversationSenders.get(conversationId);

        // 1. lastMessageAt 업데이트
        // 2. 메시지를 보낸 사용자의 deletedAt을 null로 리셋
        //    - user1이 메시지를 보냈으면 user1DeletedAt = null
        //    - user2가 메시지를 보냈으면 user2DeletedAt = null
        //    - 이렇게 하면 나간 후 새 메시지가 있는 대화가 자동으로 다시 표시됨

        // Entity를 사용하여 대화 조회 (컬럼명 문제 방지)
        const conversation = await queryRunner.manager.findOne(Conversation, {
          where: { id: conversationId },
          select: ['id', 'user1Id', 'user2Id']
        });

        if (conversation) {
          // 새 메시지가 전송되면 lastMessageAt만 업데이트
          // deletedAt은 유지하여 이전 메시지는 보이지 않도록 함
          const updateData: any = {
            lastMessageAt: new Date()
          };

          // 발신자가 대화를 삭제했었다면 발신자의 deletedAt만 리셋
          senderIds.forEach(senderId => {
            if (senderId === conversation.user1Id && conversation.user1DeletedAt) {
              updateData.user1DeletedAt = null;
            } else if (senderId === conversation.user2Id && conversation.user2DeletedAt) {
              updateData.user2DeletedAt = null;
            }
          });

          await queryRunner.manager
            .createQueryBuilder()
            .update('conversations')
            .set(updateData)
            .where('id = :conversationId', { conversationId })
            .execute();
        }
      }

      await queryRunner.commitTransaction();
      return savedMessages;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getMessagesByIds(ids: string[]): Promise<Message[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  async getConversationMessages(
    conversationId: string,
    page: number,
    limit: number,
    afterDate?: Date,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const queryBuilder = this.repository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.isDeleted = false');

    if (afterDate) {
      queryBuilder.andWhere('message.createdAt > :afterDate', { afterDate });
    }

    const total = await queryBuilder.getCount();
    const messages = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      messages: messages.reverse(),
      hasMore: total > page * limit,
    };
  }

  // Note: markAsRead and markAllAsRead methods removed
  // We now use lastReadAt timestamp on conversations table instead
}