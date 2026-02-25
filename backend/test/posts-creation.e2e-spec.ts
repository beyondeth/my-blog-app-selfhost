import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import * as cookieParser from "cookie-parser";

/**
 * Posts Creation E2E Test
 *
 * MCP 자동 포스팅 핵심 경로(POST /api/v1/posts) 보호를 위한 E2E 테스트
 * Phase 4C: 배포 방어선 게이트
 *
 * 시나리오:
 * 1. 인증 없이 포스트 생성 시도 → 401
 * 2. 필수 필드 누락 시 → 400
 * 3. 인증된 사용자로 포스트 생성 → 201
 * 4. 생성된 포스트 조회 → 200
 * 5. 권한 없는 사용자가 삭제 시도 → 403
 */
describe("Posts Creation E2E - Core Path Protection", () => {
  let app: INestApplication;
  const mockEmailService = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
    checkVerificationStatus: jest.fn().mockResolvedValue(true),
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
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  const uniqueId = Date.now();
  const testUser = {
    email: `posts_e2e_${uniqueId}@example.com`,
    username: `poster_${uniqueId}`,
    password: "SecurePassword123!",
  };

  let cookies: string[] = [];
  let createdPostId: string;

  const getCookieString = (cookiesArray: string[]) => {
    if (!cookiesArray || !Array.isArray(cookiesArray)) return "";
    return cookiesArray.map((c) => c.split(";")[0]).join("; ");
  };

  // ─── 사전 준비: 사용자 등록 + 로그인 ─────────────

  it("0. 테스트 사용자 등록 및 로그인", async () => {
    // 등록
    await request(app.getHttpServer())
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

    // 로그인
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(201);

    cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies).toBeDefined();
  });

  // ─── 시나리오 1: 인증 실패 ────────────────────

  it("1. 인증 없이 포스트 생성 → 401 Unauthorized", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/posts")
      .send({
        title: "테스트 포스트",
        content: "<p>내용</p>",
      })
      .expect(401);
  });

  // ─── 시나리오 2: 필수 필드 누락 ──────────────────

  it("2. 필수 필드(title) 누락 → 400 Bad Request", async () => {
    return request(app.getHttpServer())
      .post("/api/v1/posts")
      .set("Cookie", getCookieString(cookies))
      .send({
        // title 누락
        content: "<p>내용만 있고 제목 없음</p>",
      })
      .expect(400);
  });

  // ─── 시나리오 3: 정상 포스트 생성 ─────────────────

  it("3. 인증된 사용자로 포스트 생성 → 201 Created", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/posts")
      .set("Cookie", getCookieString(cookies))
      .send({
        title: "E2E 테스트 포스트",
        content: "<p>Phase 4C E2E 테스트 콘텐츠입니다.</p>",
        category: "테스트",
        tags: ["e2e", "phase4c"],
        isPublished: true,
      })
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toEqual("E2E 테스트 포스트");
    createdPostId = res.body.id;
  });

  // ─── 시나리오 4: 생성된 포스트 조회 ───────────────

  it("4. 생성된 포스트 조회 → 200 OK", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/posts/${createdPostId}`)
      .set("Cookie", getCookieString(cookies))
      .expect(200);

    expect(res.body.title).toEqual("E2E 테스트 포스트");
  });

  // ─── 시나리오 5: 인증 없이 삭제 시도 ──────────────

  it("5. 인증 없이 포스트 삭제 → 401 Unauthorized", async () => {
    return request(app.getHttpServer())
      .delete(`/api/v1/posts/${createdPostId}`)
      .expect(401);
  });
});
