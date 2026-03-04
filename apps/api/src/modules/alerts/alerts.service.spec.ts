/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { Incident } from "../../database/entities/incident.entity";
import { Setting } from "../../database/entities/setting.entity";
import { Service } from "../../database/entities/service.entity";
import { AlertsService, AlertPayload } from "./alerts.service";

// ─── Mock SendGrid ────────────────────────────────────────────────────────────

const mockSgSend = jest.fn().mockResolvedValue([{ statusCode: 202 }]);
jest.mock("@sendgrid/mail", () => ({
  __esModule: true,
  default: {
    setApiKey: jest.fn(),
    send: mockSgSend,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<Service> = {}): Service {
  const s = new Service();
  s.id = 1;
  s.name = "Test API";
  s.url = "https://api.example.com";
  s.type = "api_nestjs";
  s.healthEndpoint = "/health";
  s.logsEndpoint = "/logs";
  s.monitorApiKey = "key";
  s.monitorSecret = "enc";
  s.checkIntervalSeconds = 60;
  s.isActive = true;
  s.alertsEnabled = true;
  s.deletedAt = null;
  s.createdAt = new Date();
  s.updatedAt = new Date();
  return Object.assign(s, overrides);
}

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  const i = new Incident();
  i.id = 10;
  i.serviceId = 1;
  i.startedAt = new Date("2024-06-01T00:00:00Z");
  i.resolvedAt = null;
  i.emailSent = false;
  i.emailSentAt = null;
  i.screenshotPath = null;
  i.lastLogsSnapshot = null;
  return Object.assign(i, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AlertsService", () => {
  let service: AlertsService;

  const mockIncidentRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (data: Partial<Incident>) => data),
  };

  const mockSettingRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env["SENDGRID_API_KEY"] = "SG.test-key";
    process.env["PANEL_URL"] = "http://localhost:3000";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: getRepositoryToken(Incident),
          useValue: mockIncidentRepo,
        },
        {
          provide: getRepositoryToken(Setting),
          useValue: mockSettingRepo,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    delete process.env["SENDGRID_API_KEY"];
    delete process.env["PANEL_URL"];
  });

  // ─── getSetting ─────────────────────────────────────────────────────────

  describe("getSetting()", () => {
    it("returns setting value from DB", async () => {
      mockSettingRepo.findOne.mockResolvedValue({ key: "k", value: "v" });
      const result = await service.getSetting("k", "fallback");
      expect(result).toBe("v");
    });

    it("returns fallback when setting not found", async () => {
      mockSettingRepo.findOne.mockResolvedValue(null);
      const result = await service.getSetting("missing", "fallback");
      expect(result).toBe("fallback");
    });
  });

  // ─── isGloballyEnabled ─────────────────────────────────────────────────

  describe("isGloballyEnabled()", () => {
    it('returns true when alerts_enabled is "true"', async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: "alerts_enabled",
        value: "true",
      });
      expect(await service.isGloballyEnabled()).toBe(true);
    });

    it("returns false when alerts_enabled is not true", async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: "alerts_enabled",
        value: "false",
      });
      expect(await service.isGloballyEnabled()).toBe(false);
    });
  });

  // ─── isRateLimited ─────────────────────────────────────────────────────

  describe("isRateLimited()", () => {
    it("returns false when no previous email was sent", async () => {
      mockSettingRepo.findOne.mockResolvedValue(null); // fallback interval
      mockIncidentRepo.findOne.mockResolvedValue(null);
      expect(await service.isRateLimited(1)).toBe(false);
    });

    it("returns true when last email was sent recently", async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: "alert_min_interval_ms",
        value: "300000",
      });
      mockIncidentRepo.findOne.mockResolvedValue({
        emailSent: true,
        emailSentAt: new Date(), // just now
      });
      expect(await service.isRateLimited(1)).toBe(true);
    });

    it("returns false when last email was sent long ago", async () => {
      mockSettingRepo.findOne.mockResolvedValue({
        key: "alert_min_interval_ms",
        value: "300000",
      });
      mockIncidentRepo.findOne.mockResolvedValue({
        emailSent: true,
        emailSentAt: new Date(Date.now() - 600_000), // 10 min ago
      });
      expect(await service.isRateLimited(1)).toBe(false);
    });
  });

  // ─── sendDownAlert ──────────────────────────────────────────────────────

  describe("sendDownAlert()", () => {
    const base: AlertPayload = {
      incident: makeIncident(),
      service: makeService(),
    };

    beforeEach(() => {
      // Default: alerts enabled, not rate limited
      mockSettingRepo.findOne.mockImplementation(
        async ({ where }: { where: { key: string } }) => {
          const map: Record<string, string> = {
            alerts_enabled: "true",
            alert_email_to: "admin@test.com",
            alert_email_from: "monitor@test.com",
            alert_min_interval_ms: "300000",
          };
          return map[where.key]
            ? { key: where.key, value: map[where.key] }
            : null;
        },
      );
      mockIncidentRepo.findOne.mockResolvedValue(null); // not rate limited
    });

    it("sends an email successfully", async () => {
      const result = await service.sendDownAlert(base);
      expect(result).toBe(true);
      expect(mockSgSend).toHaveBeenCalledTimes(1);
      expect(mockIncidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ emailSent: true }),
      );
    });

    it("skips when alertsEnabled is false on service", async () => {
      const payload: AlertPayload = {
        ...base,
        service: makeService({ alertsEnabled: false }),
      };
      const result = await service.sendDownAlert(payload);
      expect(result).toBe(false);
      expect(mockSgSend).not.toHaveBeenCalled();
    });

    it("skips when globally disabled", async () => {
      mockSettingRepo.findOne.mockImplementation(
        async ({ where }: { where: { key: string } }) => {
          if (where.key === "alerts_enabled")
            return { key: "alerts_enabled", value: "false" };
          return null;
        },
      );
      const result = await service.sendDownAlert(base);
      expect(result).toBe(false);
    });

    it("skips when rate-limited", async () => {
      mockIncidentRepo.findOne.mockResolvedValue({
        emailSent: true,
        emailSentAt: new Date(),
      });
      const result = await service.sendDownAlert(base);
      expect(result).toBe(false);
    });

    it("attaches screenshot when provided", async () => {
      const payload: AlertPayload = {
        ...base,
        screenshotBuffer: Buffer.from("fake-png"),
      };
      await service.sendDownAlert(payload);
      expect(mockSgSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ type: "image/png" }),
          ]),
        }),
      );
    });

    it("returns false when SendGrid throws", async () => {
      mockSgSend.mockRejectedValueOnce(new Error("SG failure"));
      const result = await service.sendDownAlert(base);
      expect(result).toBe(false);
    });
  });

  // ─── sendRecoveryAlert ────────────────────────────────────────────────

  describe("sendRecoveryAlert()", () => {
    beforeEach(() => {
      mockSettingRepo.findOne.mockImplementation(
        async ({ where }: { where: { key: string } }) => {
          const map: Record<string, string> = {
            alerts_enabled: "true",
            alert_email_to: "admin@test.com",
            alert_email_from: "monitor@test.com",
          };
          return map[where.key]
            ? { key: where.key, value: map[where.key] }
            : null;
        },
      );
    });

    it("sends recovery email for previously alerted incident", async () => {
      const incident = makeIncident({
        emailSent: true,
        resolvedAt: new Date("2024-06-01T01:00:00Z"),
      });
      const result = await service.sendRecoveryAlert(incident, makeService());
      expect(result).toBe(true);
      expect(mockSgSend).toHaveBeenCalledTimes(1);
    });

    it("skips when original alert was never sent", async () => {
      const incident = makeIncident({ emailSent: false });
      const result = await service.sendRecoveryAlert(incident, makeService());
      expect(result).toBe(false);
      expect(mockSgSend).not.toHaveBeenCalled();
    });

    it("skips when service alerts disabled", async () => {
      const incident = makeIncident({ emailSent: true });
      const result = await service.sendRecoveryAlert(
        incident,
        makeService({ alertsEnabled: false }),
      );
      expect(result).toBe(false);
    });
  });

  // ─── HTML templates ──────────────────────────────────────────────────

  describe("buildDownAlertHtml()", () => {
    it("generates HTML with service info", () => {
      const html = service.buildDownAlertHtml({
        serviceName: "My API",
        serviceUrl: "https://api.example.com",
        serviceType: "api_nestjs",
        timestamp: "2024-06-01T00:00:00.000Z",
        dashboardUrl: "http://localhost:3000/services/1",
      });
      expect(html).toContain("My API");
      expect(html).toContain("Service Down");
      expect(html).toContain("View in Dashboard");
    });

    it("includes log snapshot when provided", () => {
      const html = service.buildDownAlertHtml({
        serviceName: "My API",
        serviceUrl: "https://api.example.com",
        serviceType: "api_nestjs",
        timestamp: "2024-06-01T00:00:00.000Z",
        logsSnapshot: "ERROR: something failed",
        dashboardUrl: "http://localhost:3000/services/1",
      });
      expect(html).toContain("Last log lines");
      expect(html).toContain("ERROR: something failed");
    });

    it("escapes HTML in template values", () => {
      const html = service.buildDownAlertHtml({
        serviceName: '<script>alert("xss")</script>',
        serviceUrl: "https://api.example.com",
        serviceType: "api_nestjs",
        timestamp: "2024-06-01T00:00:00.000Z",
        dashboardUrl: "http://localhost:3000/services/1",
      });
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("buildRecoveryAlertHtml()", () => {
    it("generates HTML with recovery info", () => {
      const html = service.buildRecoveryAlertHtml({
        serviceName: "My API",
        serviceUrl: "https://api.example.com",
        resolvedAt: "2024-06-01T01:00:00.000Z",
        duration: "1h 0m",
        dashboardUrl: "http://localhost:3000/services/1",
      });
      expect(html).toContain("Service Recovered");
      expect(html).toContain("1h 0m");
    });
  });
});
