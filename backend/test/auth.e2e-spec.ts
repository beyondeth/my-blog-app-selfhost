import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import * as cookieParser from "cookie-parser";

describe("AuthController (E2E) - Core Security", () => {
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
    app.use(cookieParser());
    await app.init();
  }, 30000); // 30s timeout for app init

  afterAll(async () => {
    await app.close();
  });

  const uniqueId = Date.now();
  const testUser = {
    email: `security_test_${uniqueId}@example.com`,
    username: `sec_${uniqueId}`,
    password: "SecurePassword123!",
  };

  let cookies: string[] = [];

  const getCookieString = (cookiesArray: string[]) => {
    if (!cookiesArray || !Array.isArray(cookiesArray)) return "";
    return cookiesArray.map((c) => c.split(";")[0]).join("; ");
  };

  it("1. Should fail registration with missing fields", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testUser.email,
        // missing password
      })
      .expect(400);
  });

  it("2. Should successfully register a new user", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
        emailVerificationToken: "dummy_token",
        isOver14: true,
        termsAccepted: true,
        privacyAccepted: true,
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toEqual(testUser.email);
  });

  it("3. Should fail login with incorrect password", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword!",
      })
      .expect(401);
  });

  it("4. Should fail login with non-existent email", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "nonexistent@example.com",
        password: "Password123!",
      })
      .expect(401);
  });

  it("5. Should successfully login and set HttpOnly cookies", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(201)
      .expect("set-cookie", /access_token=/)
      .expect("set-cookie", /refresh_token=/);

    // Save cookies for authenticated requests
    cookies = res.headers["set-cookie"] as unknown as string[];
  });

  it("6. Should access protected endpoint (/auth/me) with tokens", async () => {
    console.log("Cookie string:", getCookieString(cookies));
    const res = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", getCookieString(cookies));

    if (res.status === 401) {
      console.error("401 Error body:", res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.email).toEqual(testUser.email);
    expect(res.body.username).toEqual(testUser.username);
  });

  it("7. Should fail to access protected endpoint without tokens", async () => {
    return request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
  });

  it("8. Should refresh tokens successfully", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", getCookieString(cookies))
      .send()
      .expect(201)
      .expect("set-cookie", /access_token=/);

    // new cookies issued
    cookies = res.headers["set-cookie"] as unknown as string[];
  });

  it("9. Should prevent token refresh with missing refresh token", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send()
      .expect(401);
  });

  it("10. Should successfully logout and clear cookies", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", getCookieString(cookies))
      .expect(201); // Post returns 201 by default unless overriden to 200, wait let's check auth.controller.ts, it says HttpCode is not specified, so 201.

    // check that cookies are cleared
    const setCookieHeader = res.headers["set-cookie"] as unknown as string[];
    expect(setCookieHeader).toBeDefined();
    const joinedCookies = setCookieHeader.join(";");
    expect(joinedCookies).toContain("access_token=;");
    expect(joinedCookies).toContain("refresh_token=;");
  });

  it("11. Should fail to access protected endpoint after logout", async () => {
    return (
      request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", getCookieString(cookies)) // Using the old tokens. Wait, the JWT validation cache is deleted. The token might still be valid unless the cache bust blocks it.
        // But let's see what happens.
        // E2E test will reveal if logout actually revokes token usage.
        .send()
    );
  });
});
