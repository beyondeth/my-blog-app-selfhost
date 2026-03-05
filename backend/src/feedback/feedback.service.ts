import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../email/email.service";
import {
  FeedbackTicket,
  FeedbackMode,
  FeedbackStatus,
} from "./entities/feedback-ticket.entity";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { DateUtils } from "../common/utils/date.utils";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(FeedbackTicket)
    private readonly feedbackRepository: Repository<FeedbackTicket>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async submitFeedback(
    userId: string,
    dto: SubmitFeedbackDto,
  ): Promise<FeedbackTicket> {
    // 1. 제목 누락 시 자동 생성
    const title = dto.title || this.generateDefaultTitle(dto.mode, dto.message);

    // 2. DB 저장
    const ticket = this.feedbackRepository.create({
      userId,
      mode: dto.mode,
      type: dto.type || null,
      title,
      message: dto.message,
      pagePath: dto.pagePath || "unknown",
      theme: dto.theme || "unknown",
      userAgent: dto.userAgent || "unknown",
      status: FeedbackStatus.NEW,
      emailSent: false,
    });

    const savedTicket = await this.feedbackRepository.save(ticket);

    // 3. 관리자 메일 발송 시도
    const receiverEmail =
      this.configService.get<string>("FEEDBACK_RECEIVER_EMAIL") ||
      this.configService.get<string>("EMAIL_FROM") ||
      "info@codebase.blog";

    let emailSent = false;
    try {
      await this.sendFeedbackEmail(receiverEmail, savedTicket);
      emailSent = true;
    } catch (error) {
      this.logger.error(
        `Failed to send feedback email for ticket ${savedTicket.id}`,
        error.stack,
      );
    }

    // 4. 발송 결과 업데이트
    if (emailSent) {
      savedTicket.emailSent = true;
      await this.feedbackRepository.save(savedTicket);
    }

    return savedTicket;
  }

  private generateDefaultTitle(mode: string, message: string): string {
    const prefix = mode === FeedbackMode.FORM ? "[Form]" : "[Free]";
    const excerpt =
      message.length > 20 ? message.substring(0, 20) + "..." : message;
    return `${prefix} 피드백 제보: ${excerpt}`;
  }

  private async sendFeedbackEmail(
    to: string,
    ticket: FeedbackTicket,
  ): Promise<void> {
    const html = `
      <h2>새로운 의견이 접수되었습니다. (Ticket #${ticket.id.split("-")[0]})</h2>
      <p><strong>작성자 ID:</strong> ${ticket.userId}</p>
      <p><strong>작성 모드:</strong> ${ticket.mode}</p>
      <p><strong>분류:</strong> ${ticket.type || "없음"}</p>
      <p><strong>제목:</strong> ${ticket.title}</p>
      <p><strong>경로:</strong> ${ticket.pagePath}</p>
      <p><strong>환경 (테마/브라우저):</strong> ${ticket.theme} / ${
      ticket.userAgent
    }</p>
      <hr />
      <h3>내용</h3>
      <p style="white-space: pre-wrap;">${ticket.message}</p>
    `;

    await this.mailerService.sendMail({
      to,
      subject: `[codebase.blog] 고객의 소리 제보 - ${ticket.title}`,
      html,
    });
  }
}
