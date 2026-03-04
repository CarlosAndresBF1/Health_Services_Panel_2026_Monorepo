/**
 * E2E flow test: Check → Incident → Alert
 *
 * Tests the full lifecycle without a running HTTP server,
 * by directly invoking services in the correct order and verifying
 * the chain of effects.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import axios from "axios";

import { HealthStatus } from "@healthpanel/shared";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Incident } from "../../database/entities/incident.entity";
import { Service } from "../../database/entities/service.entity";
import { HealthCheckerService } from "./health-checker.service";
import {
  INCIDENT_CREATED_EVENT,
  INCIDENT_RESOLVED_EVENT,
  IncidentService,
} from "./incident.service";
import { MonitorGateway } from "./monitor.gateway";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(overrides: Partial<Service> = {}): Service {
  const s = new Service();
  s.id = 1;
  s.name = "Test API";
  s.url = "https://api.example.com";
  s.type = "api_nestjs";
  s.healthEndpoint = "/health";
  s.logsEndpoint = "/logs";
  s.monitorApiKey = "test-key";
  s.monitorSecret = "iv:tag:encrypted";
  s.checkIntervalSeconds = 60;
  s.isActive = true;
  s.alertsEnabled = true;
  s.deletedAt = null;
  s.createdAt = new Date("2024-01-01");
  s.updatedAt = new Date("2024-01-01");
  return Object.assign(s, overrides);
}

// ─── E2E Flow Tests ───────────────────────────────────────────────────────────

describe("E2E: Check → Incident → Alert flow", () => {
  let healthChecker: HealthCheckerService;
  let incidentService: IncidentService;
  let eventEmitter: EventEmitter2;

  const testSvc = makeService();

  // Track auto-increment IDs
  let healthCheckIdCounter = 0;
  let incidentIdCounter = 0;

  // In-memory incident store (simulates DB)
  let openIncidents: Map<number, Incident>;

  const mockServiceRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockHealthCheckRepo = {
    create: jest.fn((data: Partial<HealthCheck>) => data),
    save: jest.fn(async (data: Partial<HealthCheck>) => ({
      ...data,
      id: ++healthCheckIdCounter,
      checkedAt: data.checkedAt ?? new Date(),
    })),
    findAndCount: jest.fn(),
  };

  const mockIncidentRepo = {
    findOne: jest.fn(),
    create: jest.fn((data: Partial<Incident>) => data),
    save: jest.fn(async (data: Partial<Incident>) => ({
      ...data,
      id: data.id ?? ++incidentIdCounter,
    })),
    findAndCount: jest.fn(),
  };

  const mockCryptoService = {
    decrypt: jest.fn().mockReturnValue("decrypted-secret"),
  };

  const mockHmacSigner = {
    sign: jest.fn().mockReturnValue({
      "x-monitor-key": "test-key",
      "x-monitor-timestamp": "12345",
      "x-monitor-signature": "abc",
    }),
  };

  const mockGateway = {
    emitHealthUpdate: jest.fn(),
    emitIncidentNew: jest.fn(),
    emitIncidentResolved: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    healthCheckIdCounter = 0;
    incidentIdCounter = 0;
    openIncidents = new Map();

    // Dynamic behavior: findOne for incidents checks our in-memory store
    mockIncidentRepo.findOne.mockImplementation(async () => {
      return openIncidents.get(testSvc.id) ?? null;
    });

    // When an incident is saved, track it in our store
    mockIncidentRepo.save.mockImplementation(
      async (data: Partial<Incident>) => {
        const saved = {
          ...data,
          id: data.id ?? ++incidentIdCounter,
        } as Incident;

        if (saved.resolvedAt) {
          openIncidents.delete(testSvc.id);
        } else {
          openIncidents.set(testSvc.id, saved);
        }

        return saved;
      },
    );

    mockServiceRepo.findOne.mockResolvedValue(testSvc);

    eventEmitter = new EventEmitter2();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckerService,
        IncidentService,
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        {
          provide: getRepositoryToken(HealthCheck),
          useValue: mockHealthCheckRepo,
        },
        {
          provide: getRepositoryToken(Incident),
          useValue: mockIncidentRepo,
        },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: HmacSignerService, useValue: mockHmacSigner },
        { provide: MonitorGateway, useValue: mockGateway },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    healthChecker = module.get(HealthCheckerService);
    incidentService = module.get(IncidentService);
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────

  it("should complete the full lifecycle: UP → DOWN (incident) → UP (resolve)", async () => {
    const emittedEvents: string[] = [];
    eventEmitter.on(INCIDENT_CREATED_EVENT, () =>
      emittedEvents.push("incident.created"),
    );
    eventEmitter.on(INCIDENT_RESOLVED_EVENT, () =>
      emittedEvents.push("incident.resolved"),
    );

    // 1. Service is UP — no incident should be created
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok" },
    });

    const check1 = await healthChecker.executeCheck(testSvc.id);
    expect(check1.status).toBe(HealthStatus.UP);
    expect(mockGateway.emitHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: HealthStatus.UP }),
    );
    expect(mockGateway.emitIncidentNew).not.toHaveBeenCalled();
    expect(openIncidents.size).toBe(0);

    // 2. Service goes DOWN — incident should be created
    jest.clearAllMocks();
    mockedAxios.get
      .mockRejectedValueOnce(new Error("ECONNREFUSED")) // first attempt
      .mockRejectedValueOnce(new Error("ECONNREFUSED")); // retry

    const check2 = await healthChecker.executeCheck(testSvc.id);
    expect(check2.status).toBe(HealthStatus.DOWN);
    expect(mockGateway.emitHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: HealthStatus.DOWN }),
    );
    expect(mockGateway.emitIncidentNew).toHaveBeenCalledTimes(1);
    expect(openIncidents.size).toBe(1);
    expect(emittedEvents).toContain("incident.created");

    // 3. Service still DOWN — no duplicate incident
    jest.clearAllMocks();
    mockedAxios.get
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await healthChecker.executeCheck(testSvc.id);
    expect(mockGateway.emitIncidentNew).not.toHaveBeenCalled();
    expect(openIncidents.size).toBe(1); // still just one

    // 4. Service recovers UP — incident should be resolved
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok" },
    });

    const check4 = await healthChecker.executeCheck(testSvc.id);
    expect(check4.status).toBe(HealthStatus.UP);
    expect(mockGateway.emitIncidentResolved).toHaveBeenCalledTimes(1);
    expect(openIncidents.size).toBe(0);
    expect(emittedEvents).toContain("incident.resolved");
  });

  // ─── Retry prevents false positives ────────────────────────────────

  it("should retry once before marking as DOWN (prevents false positives)", async () => {
    // First attempt fails, retry succeeds
    mockedAxios.get
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ status: 200, data: {} });

    const check = await healthChecker.executeCheck(testSvc.id);
    expect(check.status).toBe(HealthStatus.UP);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockGateway.emitIncidentNew).not.toHaveBeenCalled();
  });

  // ─── DEGRADED doesn't resolve incident ─────────────────────────────

  it("should NOT resolve an open incident on DEGRADED status", async () => {
    // First: create an incident
    mockedAxios.get
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"));

    await healthChecker.executeCheck(testSvc.id);
    expect(openIncidents.size).toBe(1);

    // Now service is DEGRADED (slow but 200)
    jest.clearAllMocks();
    mockedAxios.get.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          // Simulate slow response: still resolves immediately in test
          // but responseTime > 3000
          resolve({ status: 200, data: {} }),
        ),
    );

    // Override performRequest to simulate DEGRADED
    await healthChecker.performRequest("https://api.example.com/health", {});
    // In a real scenario > 3s would be DEGRADED. In tests, we check the
    // evaluate logic directly.
    await incidentService.evaluate(testSvc, HealthStatus.DEGRADED);

    // Incident should still be open
    expect(openIncidents.size).toBe(1);
    expect(mockGateway.emitIncidentResolved).not.toHaveBeenCalled();
  });

  // ─── Event emission ────────────────────────────────────────────────

  it("should emit INCIDENT_CREATED_EVENT with incident and service data", async () => {
    const eventPromise = new Promise<{ incident: Incident; service: Service }>(
      (resolve) => {
        eventEmitter.on(INCIDENT_CREATED_EVENT, (data) => resolve(data));
      },
    );

    mockedAxios.get
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    await healthChecker.executeCheck(testSvc.id);

    const eventData = await eventPromise;
    expect(eventData.service.id).toBe(testSvc.id);
    expect(eventData.incident.serviceId).toBe(testSvc.id);
  });

  // ─── WebSocket broadcasts ──────────────────────────────────────────

  it("should broadcast health update via WebSocket on every check", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok" },
    });

    await healthChecker.executeCheck(testSvc.id);

    expect(mockGateway.emitHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: testSvc.id,
        status: HealthStatus.UP,
      }),
    );
  });

  // ─── Multiple services isolation ──────────────────────────────────

  it("should handle incidents independently for different services", async () => {
    const svc2 = makeService({ id: 2, name: "Test API 2" });

    // Configure findOne to return the right service
    mockServiceRepo.findOne.mockImplementation(
      async (opts: { where: { id: number } }) => {
        if (opts.where.id === 1) return testSvc;
        if (opts.where.id === 2) return svc2;
        return null;
      },
    );

    // Configure incident findOne to check per-service
    mockIncidentRepo.findOne.mockImplementation(
      async (opts: { where: { serviceId: number } }) => {
        return openIncidents.get(opts.where.serviceId) ?? null;
      },
    );

    // Service 1 DOWN
    mockedAxios.get
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));
    await healthChecker.executeCheck(1);

    // Service 2 UP
    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    await healthChecker.executeCheck(2);

    // Only service 1 should have an incident
    expect(openIncidents.size).toBe(1);
    expect(openIncidents.has(1)).toBe(true);
    expect(openIncidents.has(2)).toBe(false);
  });

  // ─── 30 simultaneous services ──────────────────────────────────────

  it("should handle 30 simultaneous service checks without errors", async () => {
    const services = Array.from({ length: 30 }, (_, i) =>
      makeService({ id: i + 1, name: `Service ${i + 1}` }),
    );

    mockServiceRepo.findOne.mockImplementation(
      async (opts: { where: { id: number } }) => {
        return services.find((s) => s.id === opts.where.id) ?? null;
      },
    );

    mockIncidentRepo.findOne.mockImplementation(
      async (opts: { where: { serviceId: number } }) => {
        return openIncidents.get(opts.where.serviceId) ?? null;
      },
    );

    // All return 200
    mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

    const results = await Promise.all(
      services.map((svc) => healthChecker.executeCheck(svc.id)),
    );

    expect(results).toHaveLength(30);
    results.forEach((r) => expect(r.status).toBe(HealthStatus.UP));
    expect(openIncidents.size).toBe(0);
  });
});
