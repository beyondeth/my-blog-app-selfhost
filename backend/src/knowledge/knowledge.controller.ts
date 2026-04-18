import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { BlogResolverService } from "../common/services/blog-resolver.service";
import { User } from "../users/entities/user.entity";
import { KnowledgeCandidateGraphService } from "./services/knowledge-candidate-graph.service";
import { KnowledgeManifestService } from "./services/knowledge-manifest.service";

@ApiTags("knowledge")
@Controller("knowledge")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(
    private readonly blogResolverService: BlogResolverService,
    private readonly knowledgeManifestService: KnowledgeManifestService,
    private readonly knowledgeCandidateGraphService: KnowledgeCandidateGraphService,
  ) {}

  @Get("blogs/:slug/manifest")
  @ApiOperation({ summary: "작성자용 KB manifest 조회" })
  async getManifest(
    @Param("slug") slug: string,
    @CurrentUser() user: User,
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);
    if (!blog || blog.userId !== user.id) {
      throw new UnauthorizedException("블로그 지식 매니페스트를 조회할 권한이 없습니다.");
    }

    return this.knowledgeManifestService.getOrCreate(user.id);
  }

  @Get("blogs/:slug/candidates")
  @ApiOperation({ summary: "작성자용 KB candidate inbox 조회" })
  async getBlogCandidates(
    @Param("slug") slug: string,
    @CurrentUser() user: User,
    @Query("status") status?: "provisional" | "approved" | "rejected",
  ) {
    const blog = await this.blogResolverService.resolveBlogByIdentifier(slug);
    if (!blog || blog.userId !== user.id) {
      throw new UnauthorizedException("블로그 KB candidate를 조회할 권한이 없습니다.");
    }

    return this.knowledgeCandidateGraphService.getBlogKnowledgeCandidates({
      blog,
      userId: user.id,
      status,
    });
  }

  @Get("posts/:postId/artifact")
  @ApiOperation({ summary: "작성자용 KB source artifact 조회" })
  async getPostArtifact(
    @Param("postId") postId: string,
    @CurrentUser() user: User,
  ) {
    const artifact = await this.knowledgeCandidateGraphService.getPostArtifact({
      userId: user.id,
      postId,
    });
    if (!artifact) {
      throw new NotFoundException("KB source artifact를 찾을 수 없습니다.");
    }

    return artifact;
  }

  @Post("candidates/:candidateId/approve")
  @ApiOperation({ summary: "KB candidate 승인" })
  async approveCandidate(
    @Param("candidateId") candidateId: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.knowledgeCandidateGraphService.approveCandidate({
      userId: user.id,
      candidateId,
    });
    if (!result) {
      throw new NotFoundException("KB candidate를 찾을 수 없습니다.");
    }

    await this.knowledgeManifestService.regenerateForUser(user.id);
    return result;
  }

  @Post("candidates/:candidateId/reject")
  @ApiOperation({ summary: "KB candidate 반려" })
  async rejectCandidate(
    @Param("candidateId") candidateId: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.knowledgeCandidateGraphService.rejectCandidate({
      userId: user.id,
      candidateId,
    });
    if (!result) {
      throw new NotFoundException("KB candidate를 찾을 수 없습니다.");
    }

    return result;
  }
}
