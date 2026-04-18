import { Queue, QueueOptions } from "bullmq";
import Redis from "ioredis";
import {
  KnowledgeCompileJobData,
  KnowledgeCompileQueueResult,
  KnowledgeRemovePostJobData,
} from "../knowledge.types";
import { KNOWLEDGE_COMPILE_QUEUE } from "../knowledge.constants";

export type KnowledgeQueueJobData =
  | KnowledgeCompileJobData
  | KnowledgeRemovePostJobData;

export type KnowledgeQueueJobResult = KnowledgeCompileQueueResult;

export const getKnowledgeRedisConnection = (): Redis => {
  const redisUrl =
    process.env.REDIS_CORE_URL ||
    process.env.REDIS_URL ||
    "redis://localhost:6379";

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 1000, 10000),
  });
};

export const knowledgeQueueOptions: QueueOptions = {
  connection: getKnowledgeRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400,
      count: 1000,
    },
    removeOnFail: {
      age: 604800,
      count: 5000,
    },
  },
};

export const knowledgeCompileQueue = new Queue<KnowledgeQueueJobData>(
  KNOWLEDGE_COMPILE_QUEUE,
  knowledgeQueueOptions,
);

export const closeKnowledgeQueue = async () => {
  await knowledgeCompileQueue.close();
};
