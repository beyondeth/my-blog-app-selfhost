import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { Community } from "../entities/community.entity";

/**
 * Binds protected community routes to the organization resolved for the
 * current request. Public community content intentionally remains globally
 * readable and is skipped here.
 */
@Injectable()
export class CommunityOrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const organizationId = request.organizationContext?.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException("Organization context requires login");
    }

    const communityIdentifier =
      request.params.communityId ||
      request.params.slug ||
      request.params.communitySlug;

    // Collection-level operations such as POST /community do not have a
    // community identifier yet; the organization context is sufficient.
    if (!communityIdentifier) {
      return true;
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        communityIdentifier,
      );

    const community = await this.communityRepository.findOne({
      where: isUuid
        ? { id: communityIdentifier, organizationId }
        : { slug: communityIdentifier, organizationId },
    });

    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다");
    }

    request.community = community;
    return true;
  }
}
