import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EmailVerification } from "./entities/email-verification.entity";

describe("EmailService verification safeguards", () => {
  let service: EmailService;
  let mailerService: { sendMail: jest.Mock };
  let verificationRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    mailerService = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: "message-1",
        response: "250 OK",
      }),
    };
    verificationRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
      create: jest.fn().mockImplementation((value) => value),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === "EMAIL_MODE") return "smtp";
        return defaultValue;
      }),
    };

    service = new EmailService(
      mailerService as any,
      verificationRepository as any,
      userRepository as any,
      configService as any,
    );
  });

  const createVerification = (
    overrides: Partial<EmailVerification> = {},
  ): EmailVerification =>
    ({
      id: "verification-1",
      email: "person@example.com",
      code: "123456",
      isVerified: false,
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verifiedAt: null,
      sessionToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as EmailVerification;

  it("rejects an expired verification code without consuming an attempt", async () => {
    const verification = createVerification({
      expiresAt: new Date(Date.now() - 1_000),
    });
    verificationRepository.findOne.mockResolvedValue(verification);

    await expect(
      service.verifyCode(verification.email, verification.code),
    ).rejects.toThrow(BadRequestException);

    expect(verification.attemptCount).toBe(0);
    expect(verificationRepository.save).not.toHaveBeenCalled();
  });

  it("increments failed attempts and blocks verification after the configured maximum", async () => {
    const verification = createVerification();
    verificationRepository.findOne.mockResolvedValue(verification);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(
        service.verifyCode(verification.email, "000000"),
      ).rejects.toThrow(UnauthorizedException);
      expect(verification.attemptCount).toBe(attempt);
    }

    await expect(
      service.verifyCode(verification.email, verification.code),
    ).rejects.toThrow(BadRequestException);
    expect(verificationRepository.save).toHaveBeenCalledTimes(3);
  });

  it("returns a session token and marks the verification as verified for the correct code", async () => {
    const verification = createVerification();
    verificationRepository.findOne.mockResolvedValue(verification);

    const result = await service.verifyCode(
      verification.email,
      verification.code,
    );

    expect(result.verified).toBe(true);
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(verification.isVerified).toBe(true);
    expect(verification.attemptCount).toBe(1);
    expect(verification.sessionToken).toBe(result.sessionToken);
    expect(verificationRepository.save).toHaveBeenCalledWith(verification);
  });

  it("does not emit the full verification code to logs during SMTP delivery", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const logger = (service as any).logger;
    const loggerSpies = ["debug", "log", "warn", "error"].map((method) =>
      jest.spyOn(logger, method),
    );

    try {
      await service.sendVerificationCode("person@example.com", false);

      const verification = verificationRepository.create.mock.calls[0][0] as {
        code: string;
      };
      const loggedText = loggerSpies
        .flatMap((spy) => spy.mock.calls.flat())
        .map((value) => String(value))
        .join(" ");

      expect(verification.code).toMatch(/^\d{6}$/);
      expect(loggedText).not.toContain(verification.code);
      expect(mailerService.sendMail).toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      loggerSpies.forEach((spy) => spy.mockRestore());
    }
  });
});
