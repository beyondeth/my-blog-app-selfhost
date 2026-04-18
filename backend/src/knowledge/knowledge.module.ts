import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule } from "@nestjs/config";
import { KnowledgeController } from "./knowledge.controller";
import { Blog } from "../blogs/entities/blog.entity";
import { Post } from "../posts/entities/post.entity";
import { PostMetadata } from "../posts/entities/post-metadata.entity";
import { RedisModule } from "../redis/redis.module";
import { KNOWLEDGE_COMPILE_QUEUE } from "./knowledge.constants";
import { KnowledgeCompileRun } from "./entities/knowledge-compile-run.entity";
import { KnowledgeAliasEntity } from "./entities/knowledge-alias.entity";
import { KnowledgeCandidateEdgeEntity } from "./entities/knowledge-candidate-edge.entity";
import { KnowledgeCandidateNodeEntity } from "./entities/knowledge-candidate-node.entity";
import { KnowledgeEdge } from "./entities/knowledge-edge.entity";
import { KnowledgeFollowupSuggestion } from "./entities/knowledge-followup-suggestion.entity";
import { KnowledgeManifestCache } from "./entities/knowledge-manifest-cache.entity";
import { KnowledgeNode } from "./entities/knowledge-node.entity";
import { KnowledgeSource } from "./entities/knowledge-source.entity";
import { KnowledgeSourceArtifact } from "./entities/knowledge-source-artifact.entity";
import { PostKnowledgeLink } from "./entities/post-knowledge-link.entity";
import { KnowledgeLifecycleListener } from "./listeners/knowledge-lifecycle.listener";
import { KnowledgeCompileProcessor } from "./processors/knowledge-compile.processor";
import { KnowledgeArtifactService } from "./services/knowledge-artifact.service";
import { KnowledgeCandidateResolverService } from "./services/knowledge-candidate-resolver.service";
import { KnowledgeCandidateGraphService } from "./services/knowledge-candidate-graph.service";
import { KnowledgeCompilerGatewayService } from "./services/knowledge-compiler-gateway.service";
import { KnowledgeGraphUpsertService } from "./services/knowledge-graph-upsert.service";
import { KnowledgeManifestService } from "./services/knowledge-manifest.service";
import { KnowledgePublicReadService } from "./services/knowledge-public-read.service";
import { KnowledgeQueryService } from "./services/knowledge-query.service";
import { KnowledgeRebuildService } from "./services/knowledge-rebuild.service";
import { KnowledgeSourceBuilderService } from "./services/knowledge-source-builder.service";

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    TypeOrmModule.forFeature([
      Blog,
      Post,
      PostMetadata,
      KnowledgeSource,
      KnowledgeSourceArtifact,
      KnowledgeNode,
      KnowledgeCandidateNodeEntity,
      KnowledgeCandidateEdgeEntity,
      KnowledgeAliasEntity,
      KnowledgeEdge,
      PostKnowledgeLink,
      KnowledgeFollowupSuggestion,
      KnowledgeCompileRun,
      KnowledgeManifestCache,
    ]),
    BullModule.registerQueue({
      name: KNOWLEDGE_COMPILE_QUEUE,
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
    }),
  ],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeSourceBuilderService,
    KnowledgeArtifactService,
    KnowledgeCandidateResolverService,
    KnowledgeCandidateGraphService,
    KnowledgeCompilerGatewayService,
    KnowledgeGraphUpsertService,
    KnowledgeManifestService,
    KnowledgePublicReadService,
    KnowledgeQueryService,
    KnowledgeRebuildService,
    KnowledgeLifecycleListener,
    KnowledgeCompileProcessor,
  ],
  exports: [
    KnowledgeQueryService,
    KnowledgeManifestService,
    KnowledgePublicReadService,
    KnowledgeRebuildService,
    KnowledgeCandidateGraphService,
  ],
})
export class KnowledgeModule {}
