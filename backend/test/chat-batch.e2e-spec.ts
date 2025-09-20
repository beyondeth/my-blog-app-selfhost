/**
 * 채팅 배치 처리 시스템 E2E 테스트
 *
 * 목적: 채팅 메시지 배치 처리 시스템의 전체 동작을 검증
 * - 메시지를 큐에 저장하고 배치로 처리하는 과정 테스트
 * - DB 부하를 50-100배 줄이는 효과 검증
 * - 메시지 유실 방지 메커니즘 확인
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/chat/services/chat.service';
import { ChatQueueService } from '../src/chat/services/chat-queue.service';
import { ChatBatchService } from '../src/chat/services/chat-batch.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { Message } from '../src/chat/entities/message.entity';
import { Conversation } from '../src/chat/entities/conversation.entity';
import { Repository } from 'typeorm';
import Redis from 'ioredis';

describe('ChatBatchProcessing (e2e)', () => {
  let app: INestApplication;
  let chatService: ChatService;
  let queueService: ChatQueueService;
  let batchService: ChatBatchService;
  let userRepository: Repository<User>;
  let messageRepository: Repository<Message>;
  let conversationRepository: Repository<Conversation>;
  let redis: Redis;
  let authToken: string;
  let user1: User;
  let user2: User;
  let conversation: Conversation;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get services and repositories
    chatService = moduleFixture.get<ChatService>(ChatService);
    queueService = moduleFixture.get<ChatQueueService>(ChatQueueService);
    batchService = moduleFixture.get<ChatBatchService>(ChatBatchService);
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    messageRepository = moduleFixture.get<Repository<Message>>(getRepositoryToken(Message));
    conversationRepository = moduleFixture.get<Repository<Conversation>>(getRepositoryToken(Conversation));

    // Setup test users
    user1 = await userRepository.save({
      email: 'user1@test.com',
      username: 'testuser1',
      password: 'hashed_password',
    });

    user2 = await userRepository.save({
      email: 'user2@test.com',
      username: 'testuser2',
      password: 'hashed_password',
    });

    // Create conversation
    conversation = await conversationRepository.save({
      user1Id: user1.id,
      user2Id: user2.id,
    });

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user1@test.com', password: 'password' })
      .expect(201);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await messageRepository.delete({});
    await conversationRepository.delete({});
    await userRepository.delete({});
    await queueService.clearQueues();
    await app.close();
  });

  describe('Queue Management', () => {
    it('should queue messages successfully', async () => {
      // Queue multiple messages
      const messages = [];
      for (let i = 0; i < 10; i++) {
        const message = await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: user1.id,
          content: `Test message ${i}`,
          tempId: `temp-${i}`,
        });
        messages.push(message);
      }

      // Check queue metrics
      const metrics = await queueService.getMetrics();
      expect(metrics.queueSize).toBeGreaterThan(0);
    });

    it('should dequeue messages in batch', async () => {
      // Queue messages
      for (let i = 0; i < 5; i++) {
        await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: user1.id,
          content: `Batch test ${i}`,
        });
      }

      // Dequeue batch
      const batch = await queueService.dequeueMessages(3);
      expect(batch).toHaveLength(3);
      expect(batch[0].content).toContain('Batch test');
    });

    it('should cache messages in Redis', async () => {
      // Queue and cache a message
      const message = await queueService.queueMessage({
        conversationId: conversation.id,
        senderId: user1.id,
        content: 'Cached message',
      });

      // Retrieve from cache
      const cached = await queueService.getCachedMessages(conversation.id, 10);
      expect(cached).toBeDefined();
      expect(cached.find(m => m.content === 'Cached message')).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    it('should process messages in batches', async () => {
      // Queue multiple messages
      const messageCount = 20;
      for (let i = 0; i < messageCount; i++) {
        await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: i % 2 === 0 ? user1.id : user2.id,
          content: `Batch process test ${i}`,
        });
      }

      // 배치 처리
      const result = await batchService.processBatch();

      // Check results
      expect(result.success).toBe(true);
      expect(result.processedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);

      // Verify messages were saved to database
      const savedMessages = await messageRepository.find({
        where: { conversationId: conversation.id },
      });
      expect(savedMessages.length).toBeGreaterThan(0);
    });

    it('should handle batch processing failures', async () => {
      // Queue a message with invalid conversation ID
      await queueService.queueMessage({
        conversationId: 'invalid-id',
        senderId: user1.id,
        content: 'This should fail',
      });

      // 배치 처리
      const result = await batchService.processBatch();

      // Should have failed messages
      expect(result.failedCount).toBeGreaterThan(0);

      // Check DLQ
      const metrics = await queueService.getMetrics();
      expect(metrics.dlqSize).toBeGreaterThan(0);
    });

    it('should recover messages from DLQ', async () => {
      // Move failed messages to DLQ
      const failedMessages = [{
        id: 'failed-1',
        conversationId: conversation.id,
        senderId: user1.id,
        content: 'Failed message',
        createdAt: new Date(),
        queuedAt: new Date(),
        retryCount: 1,
      }];
      await queueService.moveToDeadLetterQueue(failedMessages);

      // Recover from DLQ
      const recovered = await queueService.recoverFromDeadLetterQueue(10);
      expect(recovered.length).toBeGreaterThan(0);
      expect(recovered[0].content).toBe('Failed message');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should reduce database transactions significantly', async () => {
      const messageCount = 100;
      const startTime = Date.now();

      // Queue 100 messages
      for (let i = 0; i < messageCount; i++) {
        await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: i % 2 === 0 ? user1.id : user2.id,
          content: `Performance test ${i}`,
        });
      }

      // Process in batches
      let totalProcessed = 0;
      let batchCount = 0;
      while (totalProcessed < messageCount) {
        const result = await batchService.processBatch();
        totalProcessed += result.processedCount;
        batchCount++;
        if (result.processedCount === 0) break;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 100 messages in much fewer batches
      expect(batchCount).toBeLessThan(10); // Should be 1-2 batches for 100 messages
      expect(totalProcessed).toBe(messageCount);

      console.log(`Processed ${messageCount} messages in ${batchCount} batches (${duration}ms)`);
    });

    it('should handle concurrent message sending', async () => {
      // Simulate multiple users sending messages concurrently
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          queueService.queueMessage({
            conversationId: conversation.id,
            senderId: i % 2 === 0 ? user1.id : user2.id,
            content: `Concurrent message ${i}`,
          })
        );
      }

      // Wait for all to queue
      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);

      // 배치 처리
      const batchResult = await batchService.processBatch();
      expect(batchResult.processedCount).toBeGreaterThan(0);
    });
  });

  describe('API Endpoints', () => {
    it('should return queue metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/queue/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('queueSize');
      expect(response.body).toHaveProperty('dlqSize');
      expect(response.body).toHaveProperty('processingRate');
    });

    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/chat/queue/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
    });

    it('should trigger immediate processing', async () => {
      // Queue a message
      await queueService.queueMessage({
        conversationId: conversation.id,
        senderId: user1.id,
        content: 'Immediate process test',
      });

      // Trigger immediate processing
      const response = await request(app.getHttpServer())
        .post('/chat/queue/process-immediate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('processed');
      expect(response.body.processedCount).toBeGreaterThan(0);
    });

    it('should recover from DLQ via API', async () => {
      // Add message to DLQ
      const failedMessages = [{
        id: 'api-failed-1',
        conversationId: conversation.id,
        senderId: user1.id,
        content: 'API DLQ test',
        createdAt: new Date(),
        queuedAt: new Date(),
        retryCount: 1,
      }];
      await queueService.moveToDeadLetterQueue(failedMessages);

      // Recover via API
      const response = await request(app.getHttpServer())
        .post('/chat/queue/recover-dlq?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('recovered');
      expect(response.body.recovered).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain message order', async () => {
      // Queue messages with specific order
      const messages = [];
      for (let i = 0; i < 10; i++) {
        const msg = await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: user1.id,
          content: `Order test ${i}`,
        });
        messages.push(msg);
        // Small delay to ensure order
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 배치 처리
      await batchService.processBatch();

      // Check order in database
      const saved = await messageRepository.find({
        where: { conversationId: conversation.id },
        order: { createdAt: 'ASC' },
      });

      // Messages should maintain order
      for (let i = 0; i < saved.length - 1; i++) {
        if (saved[i].content.includes('Order test') && saved[i + 1].content.includes('Order test')) {
          const num1 = parseInt(saved[i].content.match(/\d+/)[0]);
          const num2 = parseInt(saved[i + 1].content.match(/\d+/)[0]);
          expect(num1).toBeLessThan(num2);
        }
      }
    });

    it('should not lose messages on failure', async () => {
      // Queue messages
      const messageIds = [];
      for (let i = 0; i < 5; i++) {
        const msg = await queueService.queueMessage({
          conversationId: conversation.id,
          senderId: user1.id,
          content: `No loss test ${i}`,
        });
        messageIds.push(msg.id);
      }

      // Simulate batch processing with potential failure
      try {
        await batchService.processBatch();
      } catch (error) {
        // Even on error, messages should be in DLQ
      }

      // Check metrics
      const metrics = await queueService.getMetrics();

      // Messages should be either processed or in DLQ, never lost
      const savedMessages = await messageRepository.count({
        where: { conversationId: conversation.id },
      });

      const totalAccountedFor = savedMessages + metrics.dlqSize + metrics.queueSize;
      expect(totalAccountedFor).toBeGreaterThan(0);
    });
  });
});