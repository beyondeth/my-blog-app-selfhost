import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ModeratorPermission, MembershipStatus } from "../enums";
import { COMMUNITY_PERMISSIONS_KEY } from "../decorators/community-permissions.decorator";
import { CommunityMember } from "../entities/community-member.entity";
import { Community } from "../entities/community.entity";
import { hasPermission, hasAnyPermission } from "../utils/permission.utils";

/**
 * 커뮤니티 권한 기반 접근 제어 Guard (Reddit 스타일)
 *
 * @description
 * @RequirePermission() 데코레이터와 함께 사용하여
 * 특정 모더레이터 권한을 가진 사용자만 접근할 수 있도록 제어
 *
 * **기존 역할 기반 Guard와의 차이점:**
 * - CommunityRolesGuard: 역할(OWNER, ADMIN, MODERATOR, MEMBER)로 체크
 * - CommunityPermissionsGuard: 세부 권한(POSTS, MEMBERS, SETTINGS 등)으로 체크
 *
 * **동작 방식:**
 * 1. URL 파라미터에서 communityId 또는 slug 추출
 * 2. 커뮤니티 존재 여부 확인
 * 3. 사용자의 멤버십 및 권한 확인
 * 4. 요구되는 권한과 비교하여 접근 허용/거부
 *
 * **권한 체크 로직:**
 * - ALL 권한이 있으면 모든 권한 보유로 간주
 * - 요구 권한 목록 중 하나라도 있으면 통과
 */
@Injectable()
export class CommunityPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(CommunityPermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 데코레이터에서 요구하는 권한 확인
    const requiredPermissions = this.reflector.getAllAndOverride<
      ModeratorPermission[]
    >(COMMUNITY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // 권한 요구사항 없으면 통과
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 2. 인증된 사용자 확인
    if (!user) {
      throw new ForbiddenException("로그인이 필요합니다");
    }

    // 3. 커뮤니티 식별자 추출 (ID 또는 slug)
    const communityIdentifier =
      request.params.communityId ||
      request.params.slug ||
      request.params.communitySlug;

    if (!communityIdentifier) {
      this.logger.warn("커뮤니티 식별자를 찾을 수 없습니다");
      throw new ForbiddenException("커뮤니티 식별자가 필요합니다");
    }

    // 4. 커뮤니티 조회 (ID 또는 slug로)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        communityIdentifier,
      );

    const organizationId = request.organizationContext?.organizationId;
    let community = request.community;

    if (!community) {
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
    }

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    if (organizationId && community.organizationId !== organizationId) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // request에 커뮤니티 정보 캐싱 (컨트롤러에서 재사용)
    request.community = community;

    // 5. 사용자 멤버십 조회 (권한 정보 포함)
    const membership = await this.memberRepository.findOne({
      where: {
        communityId: community.id,
        userId: user.id,
      },
      select: ["id", "role", "status", "permissions", "moderatorOrder"],
    });

    // request에 멤버십 정보 캐싱
    request.communityMembership = membership;

    // 6. 멤버십 검증
    if (!membership) {
      throw new ForbiddenException("이 커뮤니티의 멤버가 아닙니다");
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      if (membership.status === MembershipStatus.BANNED) {
        throw new ForbiddenException("이 커뮤니티에서 차단되었습니다");
      }
      if (membership.status === MembershipStatus.PENDING) {
        throw new ForbiddenException("가입 승인 대기 중입니다");
      }
      throw new ForbiddenException("유효하지 않은 멤버십 상태입니다");
    }

    // 7. 권한 체크 (요구 권한 중 하나라도 있으면 통과)
    const hasRequiredPermission = hasAnyPermission(
      membership,
      requiredPermissions,
    );

    if (!hasRequiredPermission) {
      this.logger.debug(
        `권한 부족: 사용자 권한=${membership.permissions?.join(", ") || "없음"}, 필요 권한=${requiredPermissions.join(", ")}`,
      );
      throw new ForbiddenException("이 작업에 필요한 권한이 없습니다");
    }

    return true;
  }
}
