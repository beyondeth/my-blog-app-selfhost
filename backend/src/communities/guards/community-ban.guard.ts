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
import { CommunityBan } from "../entities/community-ban.entity";

/**
 * 커뮤니티 차단 확인 Guard
 *
 * @description
 * 사용자가 해당 커뮤니티에서 차단되었는지만 확인
 * 멤버가 아닌 사용자도 차단될 수 있음 (가입 시도 차단)
 *
 * **사용 케이스:**
 * - 커뮤니티 가입 시도 시
 * - 공개 커뮤니티 콘텐츠 접근 시
 */
@Injectable()
export class CommunityBanGuard implements CanActivate {
  private readonly logger = new Logger(CommunityBanGuard.name);

  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityBan)
    private readonly banRepository: Repository<CommunityBan>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 비로그인 사용자는 차단 확인 불필요
    if (!user) {
      return true;
    }

    // 커뮤니티 식별자 추출
    const communityIdentifier =
      request.params.communityId ||
      request.params.slug ||
      request.params.communitySlug;

    if (!communityIdentifier) {
      return true;
    }

    // 이미 캐싱된 커뮤니티 사용
    let community = request.community;

    if (!community) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          communityIdentifier,
        );

      community = await this.communityRepository.findOne({
        where: isUuid
          ? { id: communityIdentifier }
          : { slug: communityIdentifier },
        select: ["id", "slug", "name"],
      });

      if (!community) {
        throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
      }

      request.community = community;
    }

    // 차단 여부 확인
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

      // 만료된 경우 비활성화 (비동기)
      this.banRepository
        .update({ id: activeBan.id }, { isActive: false })
        .catch(() => {});
    }

    return true;
  }
}
