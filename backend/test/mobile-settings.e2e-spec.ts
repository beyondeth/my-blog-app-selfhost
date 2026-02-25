import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { Role } from "../src/common/enums/role.enum";
import { ThemePreference } from "../src/users/dto/update-mobile-theme-preference.dto";
import { UsersService } from "../src/users/users.service";

describe("Mobile Settings (E2E)", () => {
  let app: INestApplication;
  let usersService: UsersService;
  let authService: AuthService;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    usersService = moduleFixture.get(UsersService);
    authService = moduleFixture.get(AuthService);
  }, 60000);

  beforeEach(async () => {
    const uniqueId = `ms${Date.now().toString(36)}${Math.floor(
      Math.random() * 1000,
    ).toString(36)}`;
    const email = `${uniqueId}@example.com`;
    const username = uniqueId;
    const password = "SecurePass123!";

    const user = await usersService.create({
      email,
      username,
      role: Role.USER,
      isEmailVerified: true,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    });

    userId = user.id;
    await usersService.updatePassword(user.id, password);

    const authResponse = await authService.login({ email, password });
    accessToken = authResponse.access_token;
  });

  afterEach(async () => {
    if (userId) {
      await usersService.remove(userId);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /mobile/settings returns snapshot", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/mobile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      themePreference: ThemePreference.SYSTEM,
      notifications: {
        pushEnabled: true,
        marketingEnabled: false,
        communityReplyEnabled: true,
      },
      privacy: {
        profileVisible: true,
        activityVisible: true,
      },
    });
  });

  it("GET /mobile/settings returns 401 without token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/mobile/settings")
      .expect(401);
  });

  it("PATCH /mobile/settings/theme updates theme preference", async () => {
    const updateResponse = await request(app.getHttpServer())
      .patch("/api/v1/mobile/settings/theme")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ themePreference: ThemePreference.DARK })
      .expect(200);

    expect(updateResponse.body.themePreference).toBe(ThemePreference.DARK);

    const snapshotResponse = await request(app.getHttpServer())
      .get("/api/v1/mobile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(snapshotResponse.body.themePreference).toBe(ThemePreference.DARK);
  });

  it("PATCH /mobile/settings/notifications updates notification preferences", async () => {
    const payload = {
      pushEnabled: false,
      marketingEnabled: true,
      communityReplyEnabled: false,
    };

    const updateResponse = await request(app.getHttpServer())
      .patch("/api/v1/mobile/settings/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload)
      .expect(200);

    expect(updateResponse.body.notifications).toMatchObject(payload);

    const snapshotResponse = await request(app.getHttpServer())
      .get("/api/v1/mobile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(snapshotResponse.body.notifications).toMatchObject(payload);
  });

  it("PATCH /mobile/settings/privacy updates privacy preferences", async () => {
    const payload = {
      profileVisible: false,
      activityVisible: false,
    };

    const updateResponse = await request(app.getHttpServer())
      .patch("/api/v1/mobile/settings/privacy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload)
      .expect(200);

    expect(updateResponse.body.privacy).toMatchObject(payload);

    const snapshotResponse = await request(app.getHttpServer())
      .get("/api/v1/mobile/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(snapshotResponse.body.privacy).toMatchObject(payload);
  });

  it("PATCH /mobile/settings/theme returns 400 for malformed JSON", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/mobile/settings/theme")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send('{"themePreference":')
      .expect(400);
  });
});
