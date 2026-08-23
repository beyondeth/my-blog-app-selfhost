import { Injectable } from "@nestjs/common";
import { CommunityRecoveryService } from "../../communities/services/community-recovery.service";
import { CommunityService } from "../../communities/services/community.service";

export interface CaptureSnapshotDto {
  reason: string;
  metadata?: Record<string, any>;
}

export interface LockCommunityDto {
  reason?: string;
}

@Injectable()
export class AdminCommunitiesService {
  constructor(
    private readonly communityRecoveryService: CommunityRecoveryService,
    private readonly communityService: CommunityService,
  ) {}

  async listSnapshots(
    communityId: string,
    limit?: number,
    organizationId?: string,
  ) {
    return this.communityRecoveryService.listSnapshots(
      communityId,
      limit,
      organizationId,
    );
  }

  async captureSnapshot(
    communityId: string,
    operatorId: string,
    dto: CaptureSnapshotDto,
    organizationId?: string,
  ) {
    return this.communityRecoveryService.captureSnapshot(
      communityId,
      operatorId,
      dto.reason,
      dto.metadata,
      organizationId,
    );
  }

  async restoreSnapshot(
    snapshotId: string,
    operatorId: string,
    organizationId?: string,
  ) {
    await this.communityRecoveryService.restoreSnapshot(
      snapshotId,
      operatorId,
      organizationId,
    );
  }

  async lockCommunity(
    communityId: string,
    operatorId: string,
    dto: LockCommunityDto,
    organizationId?: string,
  ) {
    await this.communityService.lockCommunity(
      communityId,
      operatorId,
      dto.reason,
      organizationId,
    );
  }

  async unlockCommunity(
    communityId: string,
    operatorId: string,
    dto: LockCommunityDto,
    organizationId?: string,
  ) {
    await this.communityService.unlockCommunity(
      communityId,
      operatorId,
      dto.reason,
      organizationId,
    );
  }
}
