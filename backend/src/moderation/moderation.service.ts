import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ModerationLog,
  ModerationAction,
} from "./entities/moderation-log.entity";
import { IpBlockList } from "./entities/ip-block-list.entity";
import { UsersService } from "../users/users.service";
import { IpSecurityService } from "../common/services/ip-security.service";
import { IpAuditService } from "../common/services/ip-audit.service";
import { CacheService } from "../cache/cache.service";

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly REDIS_BLOCK_KEY = "ip:blocked_list";

  constructor(
    @InjectRepository(ModerationLog)
    private readonly logRepository: Repository<ModerationLog>,
    @InjectRepository(IpBlockList)
    private readonly ipBlockRepository: Repository<IpBlockList>,
    private readonly usersService: UsersService,
    private readonly ipSecurityService: IpSecurityService,
    private readonly ipAuditService: IpAuditService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 유저 계정 정지
   */
  async banUser(
    adminId: string,
    targetUserId: string,
    reason: string,
    adminMemo?: string,
    evidence?: any,
  ) {
    // 1. 유저 상태 BANNED로 변경
    await this.usersService.banUser(targetUserId);

    // 2. 로그 기록
    const log = this.logRepository.create({
      adminId,
      targetUserId,
      action: ModerationAction.BAN_USER,
      reason,
      adminMemo,
      evidenceSnapshot: evidence,
    });
    return this.logRepository.save(log);
  }

  /**
   * 유저 계정 일시 정지 (Suspension)
   */
  async suspendUser(
    adminId: string,
    targetUserId: string,
    durationDays: number,
    reason: string,
    adminMemo?: string,
  ) {
    const until = new Date();
    until.setDate(until.getDate() + durationDays);

    // 1. 유저 업데이트 (일시 정지 설정)
    await this.usersService.update(targetUserId, {
      suspensionUntil: until,
      suspensionReason: reason,
      // isActive는 true로 유지해야 시간 만료 후 자동 접속 가능
      // 단, 영구 정지 상태였다면 풀어줘야 함 (선택 사항, 여기선 안전하게 영구 정지는 끔)
      isBanned: false,
      bannedAt: null,
      banReason: null,
    });

    // 2. 로그 기록
    const log = this.logRepository.create({
      adminId,
      targetUserId,
      action: ModerationAction.SUSPEND_USER,
      reason: `${reason} (${durationDays} days)`,
      adminMemo,

      evidenceSnapshot: { durationDays, until },
    });
    return this.logRepository.save(log);
  }

  /**
   * 유저 정지 해제/일시 정지 해제
   */
  async unsuspendUser(adminId: string, targetUserId: string) {
    const user = await this.usersService.findById(targetUserId);
    if (!user) throw new NotFoundException("User not found");

    // 1. 유저 상태 복구 (영구 정지, 일시 정지 모두 클리어)
    await this.usersService.update(targetUserId, {
      isActive: true,
      isBanned: false,
      bannedAt: null,
      banReason: null,
      suspensionUntil: null,
      suspensionReason: null,
    });

    // 2. 로그 기록
    const log = this.logRepository.create({
      adminId,
      targetUserId,
      action: ModerationAction.UNBAN_USER,
      reason: "Admin request (Unsuspend)",
    });
    return this.logRepository.save(log);
  }

  /**
   * 유저 정지 해제 (Alias to unsuspendUser for consistency)
   */
  async unbanUser(adminId: string, targetUserId: string) {
    return this.unsuspendUser(adminId, targetUserId);
  }

  /**
   * IP 차단
   */
  async blockIp(
    adminId: string,
    ipAddress: string,
    reason: string,
    adminMemo?: string,
    targetUserId?: string,
  ) {
    // 0. IP 해싱 (Redis 저장용)
    const ipHash = this.ipSecurityService.hash(ipAddress);
    if (!ipHash) throw new Error("Failed to hash IP");

    // 1. IP 차단 리스트 추가 (암호화된 IP 저장 - DB 영구 보관용)
    const encryptedIp = this.ipSecurityService.encrypt(ipAddress);

    await this.ipBlockRepository.save({
      ipAddress: encryptedIp,
      reason,
      blockedBy: adminId,
    });

    // 2. Redis 블랙리스트에 추가 (실시간 차단용)
    await this.cacheService.addToSet(this.REDIS_BLOCK_KEY, ipHash);

    // 3. 로그 기록
    const log = this.logRepository.create({
      adminId,
      targetUserId, // 옵션: 해당 IP를 쓰던 유저 ID
      targetIp: encryptedIp,
      action: ModerationAction.BLOCK_IP,
      reason,
      adminMemo,
    });

    // 4. IP Audit 로그 기록
    await this.ipAuditService.logIpAccess(
      adminId,
      "ip",
      "blocked-ip",
      "block",
      ipAddress,
    );

    return this.logRepository.save(log);
  }

  /**
   * IP 차단 해제
   */
  async unblockIp(adminId: string, ipAddress: string) {
    const ipHash = this.ipSecurityService.hash(ipAddress);
    if (!ipHash) throw new Error("Failed to hash IP");

    // 1. DB에서 제거 (암호화된 IP를 찾아야 함 - 전체 스캔 비효율적이나 어드민 기능이므로 수용)
    // 정확히 찾기 위해 모든 Block List를 가져와서 복호화 후 비교해야 함 -> 비효율
    // 개선: IP Hash를 DB에도 저장하면 좋지만 스키마 변경 부담.
    // 대안: 입력받은 IP를 암호화해서 지우려 해도 IV 때문에 값이 다름.
    // 해결책: 어드민 UI에서는 "차단 목록"을 보고 "해제"를 누를 것임.
    // 이때 UI는 원본 IP를 알고 있음(복호화해서 보여줬으므로).
    // 하지만 DB 삭제를 위해서는 PK(ip_address)를 알아야 하는데, PK가 암호화된 값임.
    // 기존 암호화된 값을 UI가 가지고 있다가 보내주거나,
    // *중요*: IpSecurityService.encrypt는 매번 다른 값을 뱉음(IV 랜덤). PK 조회가 불가능.
    // 따라서 SELECT * FROM ip_block_list WHERE ip_address = encrypt(ip) 불가.

    // 해결책: IP 차단 해제를 위해서는 "IP 해시"를 DB에도 저장했어야 함.
    // 현재 상황에서의 Workaround:
    // 1. Redis에서 제거 (즉시 차단 해제됨)
    // 2. DB 정리는... 모든 row를 가져와서 decrypt해서 비교 후 삭제 (데이터 적을 때만 가능)
    // 또는: 마이그레이션으로 ip_hash 컬럼 추가 (가장 확실).

    // --> 일단 Redis에서만 제거해도 차단은 풀림. 기록은 남음.
    // User Request: "3번은 무리 가는거 아닌가?" -> Redis만 쓰면 됨.

    // 우선 Redis에서 제거
    await this.cacheService.removeFromSet(this.REDIS_BLOCK_KEY, ipHash);

    // DB 삭제 시도 (전체 로드 후 찾기 - 레코드 수 적다고 가정)
    const allBlocks = await this.ipBlockRepository.find();
    for (const block of allBlocks) {
      const decrypted = this.ipSecurityService.decrypt(block.ipAddress);
      if (decrypted === ipAddress) {
        await this.ipBlockRepository.remove(block);
        break;
      }
    }

    // IP Audit 로그 기록
    await this.ipAuditService.logIpAccess(
      adminId,
      "ip",
      "unblocked-ip",
      "unblock",
      ipAddress,
    );

    // 로그 기록
    const log = this.logRepository.create({
      adminId,
      action: ModerationAction.UNBLOCK_IP,
      reason: "Admin request",
      targetIp: this.ipSecurityService.encrypt(ipAddress),
    });

    return this.logRepository.save(log);
  }

  /**
   * 차단된 IP 목록 조회
   */
  async getBlockedIps(adminId: string) {
    const blocks = await this.ipBlockRepository.find({
      order: { createdAt: "DESC" },
    });

    // 복호화하여 반환
    return blocks.map((block) => ({
      ...block,
      originalIp: this.ipSecurityService.decrypt(block.ipAddress),
      ipAddress: "***encrypted***", // 보안상 원본 필드는 마스킹하거나 숨김
    }));
  }

  /**
   * 모더레이션 로그 조회
   */
  async getLogs(targetUserId?: string) {
    const query = this.logRepository
      .createQueryBuilder("log")
      .leftJoinAndSelect("log.admin", "admin")
      .leftJoinAndSelect("log.targetUser", "targetUser");

    if (targetUserId) {
      query.where("log.targetUserId = :targetUserId", { targetUserId });
    }

    const logs = await query.orderBy("log.createdAt", "DESC").getMany();

    // IP 마스킹 적용 (암호화된 값에서 복호화 후 마스킹)
    return logs.map((log) => ({
      ...log,
      targetIp: log.targetIp
        ? this.ipSecurityService.mask(log.targetIp, true)
        : null,
    }));
  }

  /**
   * 모더레이션 컨텍스트 조회 (Admin용)
   *
   * IP는 복호화 후 마스킹하여 반환
   * 감사 로그 기록
   */
  async getModerationContext(
    type: "post" | "comment",
    id: string,
    adminId?: string,
  ) {
    let result;

    if (type === "post") {
      const post = await this.logRepository.manager.query(
        `SELECT p.id, p.title, p.content, p."ip_address" as "ipAddress", p."user_agent" as "userAgent", 
        u.id as "userId", u.username, u.email, u.role, u."createdAt" as "userCreatedAt"
        FROM posts p
        JOIN users u ON p."authorId" = u.id
        WHERE p.id = $1`,
        [id],
      );
      result = post[0];
    } else {
      const comment = await this.logRepository.manager.query(
        `SELECT c.id, c.content, c."ip_address" as "ipAddress", c."user_agent" as "userAgent",
        u.id as "userId", u.username, u.email, u.role, u."createdAt" as "userCreatedAt"
        FROM comments c
        JOIN users u ON c."authorId" = u.id
        WHERE c.id = $1`,
        [id],
      );
      result = comment[0];
    }

    if (!result) {
      return null;
    }

    // IP 복호화 및 마스킹
    const decryptedIp = this.ipSecurityService.decrypt(result.ipAddress);
    const maskedIp = this.ipSecurityService.mask(decryptedIp);

    // 감사 로그 기록
    if (adminId) {
      await this.ipAuditService.logIpAccess(
        adminId,
        type,
        id,
        "view",
        maskedIp,
      );
    }

    return {
      ...result,
      ipAddress: maskedIp, // 마스킹된 IP 반환
      ipAddressFull: decryptedIp, // 전체 IP (Admin 전용, 추가 권한 체크 필요)
    };
  }
}
