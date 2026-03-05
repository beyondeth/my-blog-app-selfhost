import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import { FeedbackTicket, FeedbackStatus, FeedbackType } from "../../feedback/entities/feedback-ticket.entity";

@Injectable()
export class AdminFeedbackService {
  constructor(
    @InjectRepository(FeedbackTicket)
    private readonly feedbackRepository: Repository<FeedbackTicket>,
  ) {}

  async findAll(options: {
    status?: FeedbackStatus;
    type?: FeedbackType;
    q?: string;
    page: number;
    limit: number;
  }) {
    const { status, type, q, page, limit } = options;
    const queryBuilder = this.feedbackRepository.createQueryBuilder("feedback");

    // 기본 정렬: 최신순
    queryBuilder.orderBy("feedback.createdAt", "DESC");

    // 조건 필터링
    if (status) {
      queryBuilder.andWhere("feedback.status = :status", { status });
    }
    if (type) {
      queryBuilder.andWhere("feedback.type = :type", { type });
    }
    if (q) {
      queryBuilder.andWhere(
        "(feedback.title ILIKE :q OR feedback.message ILIKE :q)",
        { q: `%${q}%` }
      );
    }

    // 페이징
    queryBuilder.skip((page - 1) * limit).take(limit);

    // 작성자 이메일, 이름 등을 함께 가져오기
    queryBuilder.leftJoinAndSelect("feedback.user", "user");
    queryBuilder.leftJoinAndSelect("user.profile", "profile");

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((item) => ({
        ...item,
        user: item.user
          ? {
              id: item.user.id,
              email: item.user.email,
              name: item.user.profile?.name || item.user.username,
            }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(id: string, status: FeedbackStatus): Promise<FeedbackTicket> {
    const ticket = await this.feedbackRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException("피드백을 찾을 수 없습니다.");
    }

    ticket.status = status;
    return this.feedbackRepository.save(ticket);
  }
}
