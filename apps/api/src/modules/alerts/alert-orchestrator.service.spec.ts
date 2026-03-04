import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { ServiceType } from "@healthpanel/shared";

import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { AlertsService, AlertPayload } from "./alerts.service";
import { AlertOrchestratorService } from "./alert-orchestrator.service";
import { LogCollectorService } from "./log-collector.service";
import { ScreenshotService } from "./screenshot.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<Service> = {}): Service {
  const s = new Service();
  s.id = 1;
  s.name = "Test API";
  s.url = "https://api.example.com";
  s.type = ServiceType.API_NESTJS;
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

describe("AlertOrchestratorService", () => {
  let orchestrator: AlertOrchestratorService;

  const mockIncidentRepo = {
    save: jest.fn(async (data: Partial<Incident>) => data),
  };

  const mockAlertsService = {
    sendDownAlert: jest.fn().mockResolvedValue(true),
    sendRecoveryAlert: jest.fn().mockResolvedValue(true),
  };

  const mockScreenshotService = {
    capture: jest.fn().mockResolvedValue({
      filePath: "/screenshots/1_123.png",
      buffer: Buffer.from("fake-png"),
    }),
  };

  const mockLogCollector = {
    collect: jest.fn().mockResolvedValue("collected logs content"),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertOrchestratorService,
        {
          provide: getRepositoryToken(Incident),
          useValue: mockIncidentRepo,
        },
        { provide: AlertsService, useValue: mockAlertsService },
        { provide: ScreenshotService, useValue: mockScreenshotService },
        { provide: LogCollectorService, useValue: mockLogCollector },
      ],
    }).compile();

    orchestrator = module.get<AlertOrchestratorService>(
      AlertOrchestratorService,
    );
  });

  // ─── onNewIncident ────────────────────────────────────────────────────

  describe("onNewIncident()", () => {
    it("collects logs and screenshot for web_nextjs, then sends alert", async () => {
      const incident = makeIncident();
      const svc = makeService({ type: ServiceType.WEB_NEXTJS });

      await orchestrator.onNewIncident(incident, svc);

      expect(mockScreenshotService.capture).toHaveBeenCalledWith(
        svc.url,
        svc.id,
      );
      expect(mockLogCollector.collect).toHaveBeenCalledWith(svc);
      expect(mockIncidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLogsSnapshot: "collected logs content",
          screenshotPath: "/screenshots/1_123.png",
        }),
      );
      expect(mockAlertsService.sendDownAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          incident: expect.objectContaining({ id: 10 }),
          service: svc,
          screenshotBuffer: expect.any(Buffer),
          logsSnapshot: "collected logs content",
        } satisfies AlertPayload),
      );
    });

    it("skips screenshot for api_nestjs services", async () => {
      const incident = makeIncident();
      const svc = makeService({ type: ServiceType.API_NESTJS });

      await orchestrator.onNewIncident(incident, svc);

      expect(mockScreenshotService.capture).not.toHaveBeenCalled();
      expect(mockLogCollector.collect).toHaveBeenCalled();
      expect(mockAlertsService.sendDownAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshotBuffer: undefined,
        }),
      );
    });

    it("handles screenshot failure gracefully", async () => {
      mockScreenshotService.capture.mockResolvedValue(null);
      const incident = makeIncident();
      const svc = makeService({ type: ServiceType.WEB_NEXTJS });

      await orchestrator.onNewIncident(incident, svc);

      expect(mockIncidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshotPath: null,
          lastLogsSnapshot: "collected logs content",
        }),
      );
      expect(mockAlertsService.sendDownAlert).toHaveBeenCalled();
    });

    it("handles full orchestration error without throwing", async () => {
      mockLogCollector.collect.mockRejectedValue(new Error("boom"));

      const incident = makeIncident();
      const svc = makeService();

      // Should not throw
      await expect(
        orchestrator.onNewIncident(incident, svc),
      ).resolves.toBeUndefined();
    });
  });

  // ─── onIncidentResolved ───────────────────────────────────────────────

  describe("onIncidentResolved()", () => {
    it("calls sendRecoveryAlert", async () => {
      const incident = makeIncident({
        emailSent: true,
        resolvedAt: new Date(),
      });
      const svc = makeService();

      await orchestrator.onIncidentResolved(incident, svc);

      expect(mockAlertsService.sendRecoveryAlert).toHaveBeenCalledWith(
        incident,
        svc,
      );
    });

    it("handles error without throwing", async () => {
      mockAlertsService.sendRecoveryAlert.mockRejectedValue(new Error("fail"));

      await expect(
        orchestrator.onIncidentResolved(makeIncident(), makeService()),
      ).resolves.toBeUndefined();
    });
  });
});
