import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Block } from "./entities/block.entity";
import { CreateBlockDto } from "./dto/create-block.dto";

/**
 * 사용자 차단 서비스
 * 차단 생성, 해제, 조회 기능 제공
 */
@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,
  ) {}

  /**
   * 사용자 차단
   * @param blockerId 차단하는 사용자 ID
   * @param createBlockDto 차단 정보
   * @returns 생성된 차단 정보
   */
  async blockUser(
    blockerId: string,
    createBlockDto: CreateBlockDto,
  ): Promise<Block> {
    const { blockedId, reason } = createBlockDto;

    // 자기 자신을 차단할 수 없음
    if (blockerId === blockedId) {
      throw new BadRequestException("자기 자신을 차단할 수 없습니다.");
    }

    // 이미 차단한 사용자인지 확인
    const existingBlock = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existingBlock) {
      throw new ConflictException("이미 차단한 사용자입니다.");
    }

    // 차단 생성
    const block = this.blockRepository.create({
      blockerId,
      blockedId,
      reason,
    });

    return await this.blockRepository.save(block);
  }

  /**
   * 사용자 차단 해제
   * @param blockerId 차단 해제하는 사용자 ID
   * @param blockedId 차단 해제할 사용자 ID
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException("차단 정보를 찾을 수 없습니다.");
    }

    await this.blockRepository.remove(block);
  }

  /**
   * 내가 차단한 사용자 목록 조회
   * @param blockerId 조회하는 사용자 ID
   * @param page 페이지 번호
   * @param limit 페이지 당 개수
   * @returns 차단한 사용자 목록 및 총 개수
   */
  async getMyBlocks(
    blockerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Block[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.blockRepository.findAndCount({
      where: { blockerId },
      relations: ["blocked"], // 차단당한 사용자 정보 포함
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * 두 사용자 간 차단 여부 확인
   * @param blockerId 차단하는 사용자 ID
   * @param blockedId 차단당하는 사용자 ID
   * @returns 차단 여부
   */
  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    return !!block;
  }

  /**
   * 서로 차단 여부 확인 (양방향)
   * @param userId1 사용자 1 ID
   * @param userId2 사용자 2 ID
   * @returns { user1BlockedUser2, user2BlockedUser1 }
   */
  async checkMutualBlock(
    userId1: string,
    userId2: string,
  ): Promise<{ user1BlockedUser2: boolean; user2BlockedUser1: boolean }> {
    const [user1BlockedUser2, user2BlockedUser1] = await Promise.all([
      this.isBlocked(userId1, userId2),
      this.isBlocked(userId2, userId1),
    ]);

    return {
      user1BlockedUser2,
      user2BlockedUser1,
    };
  }

  /**
   * 차단한 사용자 ID 목록 조회 (간단 버전)
   * @param blockerId 조회하는 사용자 ID
   * @returns 차단한 사용자 ID 배열
   */
  async getBlockedUserIds(blockerId: string): Promise<string[]> {
    const blocks = await this.blockRepository.find({
      where: { blockerId },
      select: ["blockedId"],
    });

    return blocks.map((block) => block.blockedId);
  }
}
