import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { Organization } from "./entities/organization.entity";
import {
  OrganizationMember,
  OrganizationMemberStatus,
  OrganizationRole,
} from "./entities/organization-member.entity";

export interface OrganizationContext {
  organizationId: string;
  role: OrganizationRole;
  isPersonal: boolean;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    private readonly dataSource: DataSource,
  ) {}

  async listForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepository.find({
      where: { userId, status: OrganizationMemberStatus.ACTIVE },
      relations: ["organization"],
      order: { createdAt: "ASC" },
    });

    return memberships
      .map((membership) => membership.organization)
      .filter(Boolean);
  }

  async getMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember> {
    const membership = await this.memberRepository.findOne({
      where: {
        organizationId,
        userId,
        status: OrganizationMemberStatus.ACTIVE,
      },
      relations: ["organization"],
    });

    if (!membership) {
      throw new NotFoundException("Organization membership not found");
    }

    return membership;
  }

  async assertMember(
    organizationId: string,
    userId: string,
    roles: OrganizationRole[] = [],
  ): Promise<OrganizationMember> {
    let membership: OrganizationMember;
    try {
      membership = await this.getMembership(organizationId, userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException("Organization access denied");
      }
      throw error;
    }

    if (roles.length > 0 && !roles.includes(membership.role)) {
      throw new ForbiddenException("Insufficient organization permission");
    }

    return membership;
  }

  async resolveContext(
    userId: string,
    requestedOrganizationId?: string,
  ): Promise<OrganizationContext> {
    if (requestedOrganizationId) {
      const membership = await this.assertMember(
        requestedOrganizationId,
        userId,
      );

      return {
        organizationId: membership.organizationId,
        role: membership.role,
        isPersonal: membership.organization.isPersonal,
      };
    }

    const memberships = await this.memberRepository.find({
      where: { userId, status: OrganizationMemberStatus.ACTIVE },
      relations: ["organization"],
      order: { createdAt: "ASC" },
    });

    if (process.env.HOSTED_MULTI_TENANT === "true") {
      if (memberships.length === 0) {
        throw new ForbiddenException("No active organization membership");
      }

      if (memberships.length > 1) {
        throw new ConflictException(
          "X-Organization-Id is required when the user belongs to multiple organizations",
        );
      }
    }

    let membership =
      memberships.find((item) => item.organization.isPersonal) ||
      memberships[0];

    if (!membership) {
      const organization = await this.ensurePersonalOrganization(userId);
      membership = await this.memberRepository.findOne({
        where: {
          organizationId: organization.id,
          userId,
          status: OrganizationMemberStatus.ACTIVE,
        },
        relations: ["organization"],
      });
    }

    if (!membership) {
      throw new ForbiddenException("No active organization membership");
    }

    return {
      organizationId: membership.organizationId,
      role: membership.role,
      isPersonal: membership.organization.isPersonal,
    };
  }

  /**
   * Ensure every user has a tenant boundary while keeping the single-user
   * self-host workflow unchanged.
   */
  async ensurePersonalOrganization(
    userId: string,
    displayName?: string,
  ): Promise<Organization> {
    const existingMemberships = await this.memberRepository.find({
      where: {
        userId,
        role: OrganizationRole.OWNER,
        status: OrganizationMemberStatus.ACTIVE,
      },
      relations: ["organization"],
      order: { createdAt: "ASC" },
    });
    const existingMembership = existingMemberships.find(
      (membership) => membership.organization?.isPersonal,
    );

    if (existingMembership?.organization) {
      return existingMembership.organization;
    }

    const baseName = (displayName || "Personal Workspace").trim().slice(0, 130);
    const slug = `personal-${userId
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 24)
      .toLowerCase()}`;

    try {
      return await this.dataSource.transaction(async (manager) => {
        const organizations = manager.getRepository(Organization);
        const members = manager.getRepository(OrganizationMember);

        const organization = await organizations.save(
          organizations.create({
            name: baseName || "Personal Workspace",
            slug,
            ownerId: userId,
            isPersonal: true,
          }),
        );

        await members.save(
          members.create({
            organizationId: organization.id,
            userId,
            role: OrganizationRole.OWNER,
            status: OrganizationMemberStatus.ACTIVE,
          }),
        );

        return organization;
      });
    } catch (error: any) {
      // Two first requests for a new user may race. The partial unique index
      // makes the database authoritative; return the winner's organization.
      if (error?.code === "23505") {
        const winners = await this.memberRepository.find({
          where: {
            userId,
            role: OrganizationRole.OWNER,
            status: OrganizationMemberStatus.ACTIVE,
          },
          relations: ["organization"],
          order: { createdAt: "ASC" },
        });
        const winner = winners.find(
          (membership) => membership.organization?.isPersonal,
        );
        if (winner?.organization) {
          return winner.organization;
        }
      }
      throw error;
    }
  }

  async create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<Organization> {
    const existing = await this.organizationRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException("Organization slug is already in use");
    }

    return this.dataSource.transaction(async (manager) => {
      const organizations = manager.getRepository(Organization);
      const members = manager.getRepository(OrganizationMember);
      const organization = await organizations.save(
        organizations.create({
          name: dto.name.trim(),
          slug: dto.slug.toLowerCase(),
          ownerId: userId,
          isPersonal: false,
        }),
      );

      await members.save(
        members.create({
          organizationId: organization.id,
          userId,
          role: OrganizationRole.OWNER,
          status: OrganizationMemberStatus.ACTIVE,
        }),
      );

      return organization;
    });
  }
}
