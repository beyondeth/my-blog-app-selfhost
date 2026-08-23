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
import { MembershipStatus } from "../enums";
import { CommunityMember } from "../entities/community-member.entity";
import { Community } from "../entities/community.entity";
import { CommunityBan } from "../entities/community-ban.entity";

/**
 * 커뮤니티 멤버십 확인 Guard
 *
 * @description
 * 사용자가 커뮤니티에 가입된 활성 멤버인지 확인
 * 차단된 사용자는 접근 거부
 *
 * **사용 케이스:**
 * - 게시물 작성
 * - 댓글 작성
 * - 좋아요
 * - 기타 멤버 전용 기능
 */
@Injectable()
export class CommunityMembershipGuard implements CanActivate {
  private readonly logger = new Logger(CommunityMembershipGuard.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityBan)
    private readonly banRepository: Repository<CommunityBan>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 1. 인증 확인
    if (!user) {
      throw new ForbiddenException("로그인이 필요합니다");
    }

    // 2. 커뮤니티 식별자 추출
    const communityIdentifier =
      request.params.communityId ||
      request.params.slug ||
      request.params.communitySlug;

    if (!communityIdentifier) {
      throw new ForbiddenException("커뮤니티 식별자가 필요합니다");
    }

    // 3. 이미 CommunityRolesGuard에서 캐싱된 경우 재사용
    let community = request.community;
    let membership = request.communityMembership;

    if (!community) {
      // 커뮤니티 조회
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          communityIdentifier,
        );

      const organizationId = request.organizationContext?.organizationId;
      community = await this.communityRepository.findOne({
        where: isUuid
          ? {
              id: communityIdentifier,
              ...(organizationId ? { organizationId } : {}),
            }
          : {
              slug: communityIdentifier,
              ...(organizationId ? { organizationId } : {}),
            },
        select: ["id", "creatorId", "slug", "name", "organizationId"],
      });

      if (!community) {
        throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
      }

      request.community = community;
    }

    const organizationId = request.organizationContext?.organizationId;
    if (organizationId && community.organizationId !== organizationId) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // 4. 차단 여부 확인 (우선)
    const activeBan = await this.banRepository.findOne({
      where: {
        communityId: community.id,
        userId: user.id,
        isActive: true,
      },
      select: ["id", "expiresAt", "reason"],
    });

    if (activeBan) {
      // 만료 확인
      if (!activeBan.expiresAt || new Date() < activeBan.expiresAt) {
        const message = activeBan.expiresAt
          ? `이 커뮤니티에서 차단되었습니다 (해제일: ${activeBan.expiresAt.toLocaleDateString()})`
          : "이 커뮤니티에서 영구 차단되었습니다";
        throw new ForbiddenException(message);
      }
      // 만료된 경우 isActive를 false로 업데이트 (비동기, 에러 무시)
      this.banRepository
        .update({ id: activeBan.id }, { isActive: false })
        .catch(() => {});
    }

    // 5. 멤버십 확인
    if (!membership) {
      membership = await this.memberRepository.findOne({
        where: {
          communityId: community.id,
          userId: user.id,
        },
        select: ["id", "role", "status"],
      });

      request.communityMembership = membership;
    }

    if (!membership) {
      throw new ForbiddenException("이 커뮤니티의 멤버가 아닙니다");
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      if (membership.status === MembershipStatus.PENDING) {
        throw new ForbiddenException("가입 승인 대기 중입니다");
      }
      throw new ForbiddenException("유효하지 않은 멤버십 상태입니다");
    }

    return true;
  }
}
