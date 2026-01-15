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

  async listSnapshots(communityId: string, limit?: number) {
    return this.communityRecoveryService.listSnapshots(communityId, limit);
  }

  async captureSnapshot(
    communityId: string,
    operatorId: string,
    dto: CaptureSnapshotDto,
  ) {
    return this.communityRecoveryService.captureSnapshot(
      communityId,
      operatorId,
      dto.reason,
      dto.metadata,
    );
  }

  async restoreSnapshot(snapshotId: string, operatorId: string) {
    await this.communityRecoveryService.restoreSnapshot(snapshotId, operatorId);
  }

  async lockCommunity(
    communityId: string,
    operatorId: string,
    dto: LockCommunityDto,
  ) {
    await this.communityService.lockCommunity(
      communityId,
      operatorId,
      dto.reason,
    );
  }

  async unlockCommunity(
    communityId: string,
    operatorId: string,
    dto: LockCommunityDto,
  ) {
    await this.communityService.unlockCommunity(
      communityId,
      operatorId,
      dto.reason,
    );
  }
}
