import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { Setting } from "../../database/entities/setting.entity";
import { SettingsController } from "./settings.controller";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SettingsController", () => {
  let controller: SettingsController;

  const mockSettings: Array<{ key: string; value: string }> = [
    { key: "alert_email_to", value: "admin@test.com" },
    { key: "alert_email_from", value: "monitor@test.com" },
    { key: "alerts_enabled", value: "true" },
    { key: "alert_min_interval_ms", value: "300000" },
  ];

  const mockSettingRepo = {
    find: jest.fn().mockResolvedValue(mockSettings),
    findOne: jest.fn(),
    save: jest.fn(async (data: Partial<Setting>) => data),
    create: jest.fn((data: Partial<Setting>) => data as Setting),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettingRepo.find.mockResolvedValue([...mockSettings]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: getRepositoryToken(Setting),
          useValue: mockSettingRepo,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  // ─── getSettings ──────────────────────────────────────────────────────

  describe("getSettings()", () => {
    it("returns all settings with correct types", async () => {
      const result = await controller.getSettings();
      expect(result).toEqual({
        alert_email_to: "admin@test.com",
        alert_email_from: "monitor@test.com",
        alerts_enabled: true,
        alert_min_interval_ms: 300000,
      });
    });

    it("returns defaults when no settings exist", async () => {
      mockSettingRepo.find.mockResolvedValue([]);
      const result = await controller.getSettings();
      expect(result).toEqual({
        alert_email_to: "admin@example.com",
        alert_email_from: "monitor@example.com",
        alerts_enabled: true,
        alert_min_interval_ms: 300000,
      });
    });
  });

  // ─── updateSettings ──────────────────────────────────────────────────

  describe("updateSettings()", () => {
    it("updates existing settings", async () => {
      const existing = { key: "alert_email_to", value: "old@test.com" };
      mockSettingRepo.findOne.mockResolvedValue(existing);

      await controller.updateSettings({
        alert_email_to: "new@test.com",
      });

      expect(mockSettingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "alert_email_to",
          value: "new@test.com",
        }),
      );
    });

    it("creates new settings when they do not exist", async () => {
      mockSettingRepo.findOne.mockResolvedValue(null);

      await controller.updateSettings({
        alert_email_from: "new-from@test.com",
      });

      expect(mockSettingRepo.create).toHaveBeenCalledWith({
        key: "alert_email_from",
        value: "new-from@test.com",
      });
      expect(mockSettingRepo.save).toHaveBeenCalled();
    });

    it("converts boolean values to strings", async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: "alerts_enabled",
        value: "true",
      });

      await controller.updateSettings({ alerts_enabled: false });

      expect(mockSettingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "alerts_enabled",
          value: "false",
        }),
      );
    });

    it("returns updated settings response", async () => {
      mockSettingRepo.findOne.mockResolvedValue(null);

      const result = await controller.updateSettings({
        alert_email_to: "new@test.com",
      });

      // Returns getSettings() which uses the find mock
      expect(result).toEqual(
        expect.objectContaining({
          alerts_enabled: true,
        }),
      );
    });
  });
});
