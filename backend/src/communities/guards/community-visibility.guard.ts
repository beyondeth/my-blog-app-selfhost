import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Community } from "../entities/community.entity";
import { CommunityMember } from "../entities/community-member.entity";
import { JoinPolicy, MembershipStatus } from "../enums";

/**
 * 커뮤니티 공개/비공개 접근 제어 Guard
 *
 * @description
 * - 공개/제한 커뮤니티: 누구나 접근 가능
 * - 비공개 커뮤니티: 활성 멤버만 접근 가능
 */
@Injectable()
export class CommunityVisibilityGuard implements CanActivate {
  private readonly logger = new Logger(CommunityVisibilityGuard.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const communityIdentifier =
      request.params.communityId ||
      request.params.slug ||
      request.params.communitySlug;

    if (!communityIdentifier) {
      this.logger.warn("커뮤니티 식별자를 찾을 수 없습니다");
      throw new ForbiddenException("커뮤니티 식별자가 필요합니다");
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        communityIdentifier,
      );

    const community = await this.communityRepository.findOne({
      where: isUuid
        ? { id: communityIdentifier }
        : { slug: communityIdentifier },
      select: ["id", "slug", "joinPolicy"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    request.community = community;

    if (community.joinPolicy !== JoinPolicy.PRIVATE) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException("초대 전용 커뮤니티입니다");
    }

    const membership = await this.memberRepository.findOne({
      where: {
        communityId: community.id,
        userId: user.id,
      },
      select: ["id", "role", "status"],
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("초대 전용 커뮤니티입니다");
    }

    request.communityMembership = membership;

    return true;
  }
}
