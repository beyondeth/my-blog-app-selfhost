import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { EmailVerification } from "./entities/email-verification.entity";
import { User } from "../users/entities/user.entity";
import * as crypto from "crypto";
import {
  getAWSStyleEmailTemplate,
  getAWSStylePasswordResetTemplate,
  getModernAccountLinkTemplate,
} from "./email-templates";
import { DateUtils } from "../common/utils/date.utils";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(EmailVerification)
    private readonly verificationRepository: Repository<EmailVerification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 6자리 숫자 인증 코드 생성
   */
  generateVerificationCode(): string {
    const min = parseInt(process.env.EMAIL_CODE_MIN || "100000");
    const max = parseInt(process.env.EMAIL_CODE_MAX || "999999");
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * 세션 토큰 생성
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * 이메일 인증 코드 발송
   * @param email - 인증할 이메일 주소
   * @param isSignup - 회원가입 용도인지 여부 (기본값: true)
   */
  async sendVerificationCode(
    email: string,
    isSignup: boolean = true,
  ): Promise<void> {
    // 회원가입 용도일 때만 기존 회원 체크
    if (isSignup) {
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        // 보안을 위해 구체적인 이유를 명확히 알려줌
        // 사용자 경험 개선을 위해 친절한 안내 제공
        throw new ConflictException(
          "이미 등록된 이메일입니다. 로그인 페이지에서 로그인해주세요.",
        );
      }
    }

    // Rate limiting 체크
    await this.checkRateLimit(email);

    // 기존 미인증 코드 무효화
    await this.invalidateExistingCodes(email);

    // 새 인증 코드 생성
    const code = this.generateVerificationCode();
    const expiresIn = this.configService.get(
      "EMAIL_VERIFICATION_EXPIRES_IN",
      5,
    );
    // DateUtils를 사용한 만료 시간 계산 (5분 후)
    const expiresAt = DateUtils.fromNowAddMinutes(expiresIn);

    // DB에 저장
    const verification = this.verificationRepository.create({
      email,
      code,
      expiresAt,
    });
    await this.verificationRepository.save(verification);

    // 이메일 발송
    await this.sendEmail(email, code);
  }

  /**
   * 인증 코드 검증
   */
  async verifyCode(
    email: string,
    code: string,
  ): Promise<{ verified: boolean; sessionToken?: string }> {
    const verification = await this.verificationRepository.findOne({
      where: { email, code, isVerified: false },
      order: { createdAt: "DESC" },
    });

    if (!verification) {
      throw new UnauthorizedException("유효하지 않은 인증 코드입니다.");
    }

    // 만료 체크
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException(
        "인증 코드가 만료되었습니다. 재발급해주세요.",
      );
    }

    // 시도 횟수 체크
    const maxAttempts = this.configService.get(
      "EMAIL_VERIFICATION_MAX_ATTEMPTS",
      3,
    );
    if (verification.attemptCount >= maxAttempts) {
      throw new BadRequestException(
        "최대 시도 횟수를 초과했습니다. 재발급해주세요.",
      );
    }

    // 시도 횟수 증가
    verification.attemptCount += 1;

    // 코드가 일치하는지 확인
    if (verification.code !== code) {
      await this.verificationRepository.save(verification);
      throw new UnauthorizedException(
        `잘못된 인증 코드입니다. (${verification.attemptCount}/${maxAttempts}회 시도)`,
      );
    }

    // 인증 성공
    const sessionToken = this.generateSessionToken();
    verification.isVerified = true;
    verification.verifiedAt = new Date();
    verification.sessionToken = sessionToken;
    await this.verificationRepository.save(verification);

    return { verified: true, sessionToken };
  }

  /**
   * 인증 코드 재발송
   */
  async resendVerificationCode(email: string): Promise<void> {
    // Rate limiting 체크
    await this.checkRateLimit(email);

    // 새 코드 발송 (기존 로직 재사용)
    await this.sendVerificationCode(email);
  }

  /**
   * 세션 토큰으로 이메일 인증 상태 확인
   */
  async checkVerificationStatus(
    email: string,
    sessionToken: string,
  ): Promise<boolean> {
    const verification = await this.verificationRepository.findOne({
      where: {
        email,
        sessionToken,
        isVerified: true,
      },
      order: { createdAt: "DESC" },
    });

    return !!verification;
  }

  /**
   * 이메일 실제 발송
   */
  private async sendEmail(email: string, code: string): Promise<void> {
    const html = getAWSStyleEmailTemplate(code);

    try {
      // 개발 환경에서만 상세 로그 출력
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(`이메일 발송 시도: ${email}`, {
          email,
          code: `${code.substring(0, 2)}****`,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await this.mailerService.sendMail({
        to: email,
        subject: "[codebase.blog] 이메일 인증 코드",
        html,
        replyTo: "noreply@codebase.blog", // 회신 주소를 noreply로 설정
      });

      // 성공 로그
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(`이메일 발송 성공: ${email}`, {
          messageId: result.messageId,
          response: result.response,
        });
      }
    } catch (error) {
      // 상세 에러 로깅
      this.logger.error("이메일 발송 실패:", {
        email,
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      // 사용자에게는 일반적인 에러 메시지 제공
      if (error.code === "EAUTH") {
        throw new BadRequestException(
          "이메일 인증에 실패했습니다. 관리자에게 문의해주세요.",
        );
      } else if (error.code === "ECONNECTION") {
        throw new BadRequestException(
          "이메일 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      } else {
        throw new BadRequestException(
          "이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }
  }

  /**
   * 기존 미인증 코드 무효화
   */
  private async invalidateExistingCodes(email: string): Promise<void> {
    await this.verificationRepository.update(
      { email, isVerified: false },
      { expiresAt: new Date() },
    );
  }

  /**
   * Rate limiting 체크 (간단한 구현)
   */
  private async checkRateLimit(email: string): Promise<void> {
    // DateUtils를 사용한 1분 전 시간 계산
    const oneMinuteAgo = DateUtils.fromNowSubtractMinutes(1);

    const recentAttempts = await this.verificationRepository.count({
      where: {
        email,
        createdAt: new Date(oneMinuteAgo.getTime()),
      },
    });

    const limitPerMinute = this.configService.get(
      "EMAIL_RATE_LIMIT_PER_MINUTE",
      1,
    );
    if (recentAttempts >= limitPerMinute) {
      throw new BadRequestException(
        "너무 많은 요청입니다. 1분 후 다시 시도해주세요.",
      );
    }

    // 일일 제한 체크 - 오늘 시작 시간 (00:00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayAttempts = await this.verificationRepository.count({
      where: {
        email,
        createdAt: new Date(todayStart.getTime()),
      },
    });

    const limitPerDay = this.configService.get("EMAIL_RATE_LIMIT_PER_DAY", 5);
    if (todayAttempts >= limitPerDay) {
      throw new BadRequestException(
        "일일 발송 한도를 초과했습니다. 내일 다시 시도해주세요.",
      );
    }
  }

  /**
   * 계정 삭제 알림 이메일 발송
   */
  async sendAccountDeletionNotification(email: string): Promise<void> {
    const html = this.getAccountDeletionTemplate();

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: "[codebase.blog] 계정 삭제 완료",
        html,
        replyTo: "noreply@codebase.blog", // 회신 주소를 noreply로 설정
      });
    } catch (error) {
      this.logger.error("Account deletion email sending error:", error);
      // 이메일 발송 실패는 무시하고 계속 진행
    }
  }

  /**
   * 계정 연결 알림 이메일 발송
   */
  async sendAccountLinkNotification(
    email: string,
    provider: string,
    linkedEmail: string,
  ): Promise<void> {
    const html = getModernAccountLinkTemplate(provider, linkedEmail);

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: "[codebase.blog] 새로운 로그인 방법이 추가되었습니다",
        html,
        replyTo: "noreply@codebase.blog", // 회신 주소를 noreply로 설정
      });
    } catch (error) {
      this.logger.error("Account link email sending error:", error);
      // 이메일 발송 실패는 무시하고 계속 진행
    }
  }

  /**
   * 이메일 템플릿
   */
  private getEmailTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8f8f8;
            color: #333333;
          }
          .container {
            max-width: 560px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .card {
            background: #ffffff;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
          }
          .header {
            background: #000000;
            padding: 24px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.3px;
            margin: 0;
          }
          .content {
            padding: 32px;
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            color: #000000;
            margin: 0 0 16px;
          }
          .text {
            font-size: 15px;
            color: #555555;
            line-height: 1.6;
            margin: 0 0 24px;
          }
          .code-box {
            background: #f0f0f0;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .code {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #000000;
            font-family: 'Courier New', monospace;
          }
          .divider {
            border-top: 1px solid #e5e5e5;
            margin: 24px 0;
          }
          .info-box {
            background: #f8f8f8;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
          }
          .info-text {
            font-size: 14px;
            color: #666666;
            line-height: 1.6;
            margin: 0;
          }
          .footer {
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e5e5;
          }
          .footer-text {
            font-size: 13px;
            color: #999999;
            margin: 0;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">codebase.blog</div>
            </div>
            <div class="content">
              <h1 class="title">이메일 인증</h1>
              <p class="text">
                안녕하세요!<br><br>
                codebase.blog 회원가입을 위한 이메일 인증 코드입니다.
                아래 코드를 입력하여 회원가입을 완료해주세요.
              </p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <div class="divider"></div>
              <div class="info-box">
                <p class="info-text">
                  <strong>보안 안내</strong><br>
                  • 이 코드는 5분간만 유효합니다<br>
                  • 다른 사람과 공유하지 마세요<br>
                  • 최대 3회까지 입력 가능합니다<br>
                  • 본인이 요청하지 않은 경우 이 이메일을 무시하세요
                </p>
              </div>
            </div>
            <div class="footer">
              <p class="footer-text">
                © 2025 codebase.blog. All rights reserved.<br>
                이 이메일은 codebase.blog 회원가입을 위해 발송되었습니다.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 계정 삭제 이메일 템플릿
   */
  private getAccountDeletionTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', system-ui, sans-serif;
            background-color: #ffffff;
            color: #1a1a1a;
            line-height: 1.6;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f8f9fa;
            padding: 40px 20px;
          }
          .container {
            max-width: 480px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            padding: 32px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .logo {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .logo-icon {
            display: inline-block;
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            position: relative;
          }
          .logo-icon::before {
            content: "</>";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 14px;
            font-weight: 700;
            color: white;
          }
          .content {
            padding: 40px 32px;
            text-align: center;
          }
          .emoji {
            font-size: 48px;
            margin-bottom: 24px;
          }
          .title {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
          }
          .description {
            font-size: 15px;
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.8;
          }
          .info-box {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .info-text {
            font-size: 14px;
            color: #4b5563;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
          }
          .footer {
            padding: 24px 32px;
            text-align: center;
            background-color: #f8f9fa;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            font-size: 13px;
            color: #9ca3af;
            margin-bottom: 8px;
          }
          .footer-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">
                <span class="logo-icon"></span>
                codebase.blog
              </div>
            </div>
            <div class="content">
              <div class="emoji">👋</div>
              <h1 class="title">계정이 삭제되었습니다</h1>
              <p class="description">
                codebase.blog 계정과 모든 데이터가<br>
                성공적으로 삭제되었습니다
              </p>
              <div class="info-box">
                <p class="info-text">
                  <strong>삭제된 항목:</strong><br>
                  • 블로그 및 모든 포스트<br>
                  • 댓글 및 좋아요<br>
                  • 업로드된 파일
                </p>
              </div>
              <p class="description">
                그동안 이용해 주셔서 감사합니다<br>
                언제든 다시 만나요!
              </p>
              <a href="https://codebase.blog" class="button">
                codebase.blog 방문
              </a>
            </div>
            <div class="footer">
              <p class="footer-text">
                © 2024 <a href="https://codebase.blog" class="footer-link">codebase.blog</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 비밀번호 재설정 이메일 발송
   */
  async sendPasswordResetEmail(
    email: string,
    username: string,
    resetUrl: string,
  ): Promise<void> {
    const html = getAWSStylePasswordResetTemplate(username, resetUrl);

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: "[codebase.blog] 비밀번호 재설정",
        html,
        replyTo: "noreply@codebase.blog", // 회신 주소를 noreply로 설정
      });
    } catch (error) {
      this.logger.error("Password reset email sending error:", error);
      throw new BadRequestException(
        "이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  }

  /**
   * 비밀번호 재설정 이메일 템플릿
   */
  private getPasswordResetTemplate(username: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8f8f8;
            color: #333333;
          }
          .container {
            max-width: 560px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .card {
            background: #ffffff;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
          }
          .header {
            background: #000000;
            padding: 24px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.3px;
            margin: 0;
          }
          .content {
            padding: 32px;
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            color: #000000;
            margin: 0 0 16px;
          }
          .text {
            font-size: 15px;
            color: #555555;
            line-height: 1.6;
            margin: 0 0 24px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #000000;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .button:hover {
            background: #333333;
          }
          .divider {
            border-top: 1px solid #e5e5e5;
            margin: 24px 0;
          }
          .info-box {
            background: #f8f8f8;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
          }
          .info-text {
            font-size: 14px;
            color: #666666;
            line-height: 1.6;
            margin: 0;
          }
          .link-text {
            font-size: 13px;
            color: #999999;
            word-break: break-all;
            margin: 16px 0;
          }
          .footer {
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e5e5;
          }
          .footer-text {
            font-size: 13px;
            color: #999999;
            margin: 0;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">codebase.blog</div>
            </div>
            <div class="content">
              <h1 class="title">비밀번호 재설정</h1>
              <p class="text">
                안녕하세요, ${username || "사용자"}님<br><br>
                비밀번호 재설정을 요청하셨습니다.
                아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.
              </p>
              <a href="${resetUrl}" class="button">
                비밀번호 재설정하기
              </a>
              <div class="divider"></div>
              <div class="info-box">
                <p class="info-text">
                  <strong>보안 안내</strong><br>
                  • 이 링크는 15분간만 유효합니다<br>
                  • 한 번만 사용 가능합니다<br>
                  • 본인이 요청하지 않은 경우 이 이메일을 무시하세요
                </p>
              </div>
              <p class="link-text">
                버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                ${resetUrl}
              </p>
            </div>
            <div class="footer">
              <p class="footer-text">
                비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.<br>
                © 2025 codebase.blog. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
