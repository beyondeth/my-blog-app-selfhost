import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Community } from "../entities/community.entity";
import { CommunityPost } from "../entities/community-post.entity";
import { CommunityComment } from "../entities/community-comment.entity";

/**
 * Ensures resource identifiers in community routes belong to the routed
 * community. This also runs for public post/comment endpoints because the
 * URL relationship must be valid regardless of authentication state.
 */
@Injectable()
export class CommunityResourceScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,
    @InjectRepository(CommunityComment)
    private readonly commentRepository: Repository<CommunityComment>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const slug = request.params.slug;
    let community = request.community;

    if (!community && slug) {
      community = await this.communityRepository.findOne({
        where: { slug },
        select: ["id", "slug", "organizationId"],
      });
    }

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    const { postId, commentId } = request.params;

    if (postId) {
      const post = await this.postRepository.findOne({
        where: { id: postId, communityId: community.id },
        select: ["id", "communityId", "authorId", "status"],
      });

      if (!post) {
        throw new NotFoundException("게시물을 찾을 수 없습니다");
      }

      request.communityPost = post;
    }

    if (commentId) {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId, communityId: community.id },
        select: ["id", "postId", "communityId", "authorId"],
      });

      if (!comment) {
        throw new NotFoundException("댓글을 찾을 수 없습니다");
      }

      request.communityComment = comment;
    }

    request.community = community;
    return true;
  }
}
