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
import { CommunityRole, MembershipStatus } from "../enums";
import { COMMUNITY_ROLES_KEY } from "../decorators/community-roles.decorator";
import { CommunityMember } from "../entities/community-member.entity";
import { Community } from "../entities/community.entity";

/**
 * 커뮤니티 역할 기반 접근 제어 Guard
 *
 * @description
 * @CommunityRoles() 데코레이터와 함께 사용하여
 * 특정 커뮤니티 역할을 가진 사용자만 접근할 수 있도록 제어
 *
 * **동작 방식:**
 * 1. URL 파라미터에서 communityId 또는 slug 추출
 * 2. 커뮤니티 존재 여부 확인
 * 3. 사용자의 멤버십 및 역할 확인
 * 4. 요구되는 역할과 비교하여 접근 허용/거부
 *
 * **성능 최적화:**
 * - 커뮤니티 및 멤버십 조회 결과를 request에 캐싱
 * - 컨트롤러에서 재사용 가능
 */
@Injectable()
export class CommunityRolesGuard implements CanActivate {
  private readonly logger = new Logger(CommunityRolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 데코레이터에서 요구하는 역할 확인
    const requiredRoles = this.reflector.getAllAndOverride<CommunityRole[]>(
      COMMUNITY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 역할 요구사항 없으면 통과
    if (!requiredRoles || requiredRoles.length === 0) {
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

    const community = await this.communityRepository.findOne({
      where: isUuid
        ? { id: communityIdentifier }
        : { slug: communityIdentifier },
      select: ["id", "creatorId", "slug", "name"],
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    // request에 커뮤니티 정보 캐싱 (컨트롤러에서 재사용)
    request.community = community;

    // 5. 사용자 멤버십 조회
    const membership = await this.memberRepository.findOne({
      where: {
        communityId: community.id,
        userId: user.id,
      },
      select: ["id", "role", "status"],
    });

    // request에 멤버십 정보 캐싱
    request.communityMembership = membership;

    // 6. 멤버십 및 역할 검증
    if (!membership) {
      // 멤버가 아닌 경우
      throw new ForbiddenException("이 커뮤니티의 멤버가 아닙니다");
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      // 활성 상태가 아닌 경우
      if (membership.status === MembershipStatus.BANNED) {
        throw new ForbiddenException("이 커뮤니티에서 차단되었습니다");
      }
      if (membership.status === MembershipStatus.PENDING) {
        throw new ForbiddenException("가입 승인 대기 중입니다");
      }
      throw new ForbiddenException("유효하지 않은 멤버십 상태입니다");
    }

    // 7. 역할 권한 확인
    const hasRequiredRole = requiredRoles.includes(membership.role);

    if (!hasRequiredRole) {
      this.logger.debug(
        `권한 부족: 사용자 역할=${membership.role}, 필요 역할=${requiredRoles.join(", ")}`,
      );
      throw new ForbiddenException("이 작업에 필요한 권한이 없습니다");
    }

    return true;
  }
}
