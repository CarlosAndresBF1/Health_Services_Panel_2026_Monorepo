import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { IncidentService } from "./incident.service";
import { MonitorGateway } from "./monitor.gateway";

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

describe("IncidentService", () => {
  let service: IncidentService;

  const mockIncidentRepo = {
    findOne: jest.fn(),
    create: jest.fn((data: Partial<Incident>) => data),
    save: jest.fn(async (data: Partial<Incident>) => ({ ...data, id: 10 })),
    findAndCount: jest.fn(),
  };

  const mockGateway = {
    emitIncidentNew: jest.fn(),
    emitIncidentResolved: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        { provide: getRepositoryToken(Incident), useValue: mockIncidentRepo },
        { provide: MonitorGateway, useValue: mockGateway },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
  });

  // ─── evaluate ─────────────────────────────────────────────────────────

  describe("evaluate()", () => {
    const svc = makeService();

    it("creates a new incident when DOWN and no open incident", async () => {
      mockIncidentRepo.findOne.mockResolvedValue(null); // no open incident

      await service.evaluate(svc, "down" as never);

      expect(mockIncidentRepo.save).toHaveBeenCalledTimes(1);
      expect(mockGateway.emitIncidentNew).toHaveBeenCalledTimes(1);
    });

    it("does NOT create duplicate incident when DOWN and incident already open", async () => {
      mockIncidentRepo.findOne.mockResolvedValue(makeIncident()); // open incident

      await service.evaluate(svc, "down" as never);

      expect(mockIncidentRepo.save).not.toHaveBeenCalled();
    });

    it("resolves open incident when UP", async () => {
      const open = makeIncident();
      mockIncidentRepo.findOne.mockResolvedValue(open);

      await service.evaluate(svc, "up" as never);

      expect(mockIncidentRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockIncidentRepo.save.mock.calls[0]![0] as Incident;
      expect(saved.resolvedAt).toBeInstanceOf(Date);
      expect(mockGateway.emitIncidentResolved).toHaveBeenCalledTimes(1);
    });

    it("does NOT resolve incident when DEGRADED", async () => {
      const open = makeIncident();
      mockIncidentRepo.findOne.mockResolvedValue(open);

      await service.evaluate(svc, "degraded" as never);

      expect(mockIncidentRepo.save).not.toHaveBeenCalled();
    });

    it("does nothing when UP and no open incident", async () => {
      mockIncidentRepo.findOne.mockResolvedValue(null);

      await service.evaluate(svc, "up" as never);

      expect(mockIncidentRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── findByService ────────────────────────────────────────────────────

  describe("findByService()", () => {
    it("returns paginated incidents", async () => {
      mockIncidentRepo.findAndCount.mockResolvedValue([[makeIncident()], 1]);

      const result = await service.findByService(1, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
