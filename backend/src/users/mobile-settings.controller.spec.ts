import { Test, TestingModule } from "@nestjs/testing";
import { MobileSettingsController } from "./mobile-settings.controller";
import { UsersService } from "./users.service";
import { ThemePreference } from "./dto/update-mobile-theme-preference.dto";

describe("MobileSettingsController", () => {
  let controller: MobileSettingsController;

  const snapshot = {
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
  };

  const usersService = {
    getMobileSettings: jest.fn().mockResolvedValue(snapshot),
    updateMobileThemePreference: jest.fn().mockResolvedValue(snapshot),
    updateMobileNotificationPreferences: jest.fn().mockResolvedValue(snapshot),
    updateMobilePrivacyPreferences: jest.fn().mockResolvedValue(snapshot),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MobileSettingsController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<MobileSettingsController>(MobileSettingsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("returns settings snapshot", async () => {
    const user = { id: "user-1" };
    await expect(controller.getSettings(user)).resolves.toEqual(snapshot);
    expect(usersService.getMobileSettings).toHaveBeenCalledWith(user.id);
  });

  it("updates theme preference", async () => {
    const user = { id: "user-1" };
    const dto = { themePreference: ThemePreference.DARK };
    await controller.updateTheme(user, dto);
    expect(usersService.updateMobileThemePreference).toHaveBeenCalledWith(
      user.id,
      dto.themePreference,
    );
  });

  it("updates notification preferences", async () => {
    const user = { id: "user-1" };
    const dto = {
      pushEnabled: false,
      marketingEnabled: true,
      communityReplyEnabled: false,
    };
    await controller.updateNotifications(user, dto);
    expect(
      usersService.updateMobileNotificationPreferences,
    ).toHaveBeenCalledWith(user.id, dto);
  });

  it("updates privacy preferences", async () => {
    const user = { id: "user-1" };
    const dto = {
      profileVisible: false,
      activityVisible: false,
    };
    await controller.updatePrivacy(user, dto);
    expect(usersService.updateMobilePrivacyPreferences).toHaveBeenCalledWith(
      user.id,
      dto,
    );
  });
});
