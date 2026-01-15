import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
// EmailService might be exported from EmailModule
import { EmailService } from "../src/email/email.service";

describe("AuthController (Mobile E2E)", () => {
  let app: INestApplication;
  const mockEmailService = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
    checkVerificationStatus: jest.fn().mockResolvedValue(true), // Always verify
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  }, 30000); // 30s timeout for app init

  afterAll(async () => {
    await app.close();
  });

  const uniqueId = Date.now();
  const testUser = {
    email: `mobile_test_${uniqueId}@example.com`,
    username: `mob_${uniqueId}`,
    password: "Password123!",
  };

  it("/auth/register (POST) should return tokens in body", () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
        emailVerificationToken: "dummy_token", // Mocked service accepts anything
        isOver14: true,
        termsAccepted: true,
        privacyAccepted: true,
      })
      .expect(201)
      .expect((res) => {
        // Check for access_token and refresh_token in BODY
        if (!res.body.access_token)
          throw new Error("access_token missing in body");
        if (!res.body.refresh_token)
          throw new Error("refresh_token missing in body");
        if (!res.body.user) throw new Error("user missing in body");
      });
  });

  it("/auth/login (POST) should return tokens in body", () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`Unexpected status code: ${res.status}`);
        }
        if (!res.body.access_token)
          throw new Error("access_token missing in body");
        if (!res.body.refresh_token)
          throw new Error("refresh_token missing in body");
      });
  });
});
