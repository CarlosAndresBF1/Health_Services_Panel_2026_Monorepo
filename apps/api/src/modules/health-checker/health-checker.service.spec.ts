import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import axios from "axios";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { HealthCheck } from "../../database/entities/health-check.entity";
import { Service } from "../../database/entities/service.entity";
import { HealthCheckerService } from "./health-checker.service";
import { IncidentService } from "./incident.service";
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HealthCheckerService", () => {
  let service: HealthCheckerService;

  const mockServiceRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockHealthCheckRepo = {
    create: jest.fn((data: Partial<HealthCheck>) => data),
    save: jest.fn(async (data: Partial<HealthCheck>) => ({
      ...data,
      id: 1,
      checkedAt: data.checkedAt ?? new Date(),
    })),
    findAndCount: jest.fn(),
  };

  const mockCryptoService = {
    decrypt: jest.fn().mockReturnValue("decrypted-secret"),
  };

  const mockHmacSigner = {
    sign: jest.fn().mockReturnValue({
      "x-monitor-key": "key",
      "x-monitor-timestamp": "1234567890",
      "x-monitor-signature": "sig",
    }),
  };

  const mockIncidentService = {
    evaluate: jest.fn(),
  };

  const mockMonitorGateway = {
    emitHealthUpdate: jest.fn(),
    emitIncidentNew: jest.fn(),
    emitIncidentResolved: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckerService,
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        {
          provide: getRepositoryToken(HealthCheck),
          useValue: mockHealthCheckRepo,
        },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: HmacSignerService, useValue: mockHmacSigner },
        { provide: IncidentService, useValue: mockIncidentService },
        { provide: MonitorGateway, useValue: mockMonitorGateway },
      ],
    }).compile();

    service = module.get<HealthCheckerService>(HealthCheckerService);
  });

  // ─── URL building ──────────────────────────────────────────────────────

  describe("buildCheckUrl()", () => {
    it("concatenates base URL and health endpoint", () => {
      const svc = makeService({
        url: "https://api.example.com",
        healthEndpoint: "/health",
      });
      expect(service.buildCheckUrl(svc)).toBe("https://api.example.com/health");
    });

    it("strips trailing slash from base URL", () => {
      const svc = makeService({
        url: "https://api.example.com/",
        healthEndpoint: "/status",
      });
      expect(service.buildCheckUrl(svc)).toBe("https://api.example.com/status");
    });

    it("defaults to /health when healthEndpoint is empty", () => {
      const svc = makeService({
        url: "https://api.example.com",
        healthEndpoint: "",
      });
      expect(service.buildCheckUrl(svc)).toBe("https://api.example.com/health");
    });
  });

  // ─── SSRF prevention ──────────────────────────────────────────────────

  describe("validateUrl() — SSRF prevention", () => {
    it("blocks localhost", () => {
      expect(() => service.validateUrl("http://localhost/health")).toThrow(
        /SSRF/,
      );
    });

    it("blocks 127.0.0.1", () => {
      expect(() => service.validateUrl("http://127.0.0.1/health")).toThrow(
        /SSRF/,
      );
    });

    it("blocks 0.0.0.0", () => {
      expect(() => service.validateUrl("http://0.0.0.0/health")).toThrow(
        /SSRF/,
      );
    });

    it("blocks private 10.x.x.x", () => {
      expect(() => service.validateUrl("http://10.0.0.1/health")).toThrow(
        /SSRF/,
      );
    });

    it("blocks private 192.168.x.x", () => {
      expect(() => service.validateUrl("http://192.168.1.1/health")).toThrow(
        /SSRF/,
      );
    });

    it("blocks private 172.16–31.x.x", () => {
      expect(() => service.validateUrl("http://172.16.0.1/health")).toThrow(
        /SSRF/,
      );
      expect(() => service.validateUrl("http://172.31.255.255/health")).toThrow(
        /SSRF/,
      );
    });

    it("allows public domains", () => {
      expect(() =>
        service.validateUrl("https://api.example.com/health"),
      ).not.toThrow();
    });

    it("rejects invalid URLs", () => {
      expect(() => service.validateUrl("not-a-url")).toThrow(/Invalid URL/);
    });
  });

  // ─── Classification logic ─────────────────────────────────────────────

  describe("performRequest() — classification", () => {
    it("classifies 200 response < 3s as UP", async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { status: "ok" },
      });

      const result = await service.performRequest(
        "https://api.example.com/health",
        {},
      );
      expect(result.status).toBe("up");
      expect(result.statusCode).toBe(200);
    });

    it("classifies non-200 response as DOWN", async () => {
      mockedAxios.get.mockResolvedValue({ status: 500, data: {} });

      const result = await service.performRequest(
        "https://api.example.com/health",
        {},
      );
      expect(result.status).toBe("down");
      expect(result.statusCode).toBe(500);
    });

    it("classifies network error as DOWN", async () => {
      mockedAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await service.performRequest(
        "https://api.example.com/health",
        {},
      );
      expect(result.status).toBe("down");
      expect(result.statusCode).toBeNull();
      expect(result.errorMessage).toContain("ECONNREFUSED");
    });

    it("classifies timeout as DOWN", async () => {
      mockedAxios.get.mockRejectedValue(
        new Error("timeout of 10000ms exceeded"),
      );

      const result = await service.performRequest(
        "https://api.example.com/health",
        {},
      );
      expect(result.status).toBe("down");
      expect(result.errorMessage).toContain("timeout");
    });
  });

  // ─── executeCheck ─────────────────────────────────────────────────────

  describe("executeCheck()", () => {
    it("saves health check to DB", async () => {
      const svc = makeService();
      mockServiceRepo.findOne.mockResolvedValue(svc);
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      await service.executeCheck(1);

      expect(mockHealthCheckRepo.save).toHaveBeenCalledTimes(1);
    });

    it("emits WebSocket event", async () => {
      const svc = makeService();
      mockServiceRepo.findOne.mockResolvedValue(svc);
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      await service.executeCheck(1);

      expect(mockMonitorGateway.emitHealthUpdate).toHaveBeenCalledTimes(1);
    });

    it("calls incidentService.evaluate", async () => {
      const svc = makeService();
      mockServiceRepo.findOne.mockResolvedValue(svc);
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      await service.executeCheck(1);

      expect(mockIncidentService.evaluate).toHaveBeenCalledWith(svc, "up");
    });

    it("retries once before marking as DOWN", async () => {
      const svc = makeService();
      mockServiceRepo.findOne.mockResolvedValue(svc);

      // First call fails, second succeeds
      mockedAxios.get
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({ status: 200, data: {} });

      const check = await service.executeCheck(1);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(check.status).toBe("up");
    });

    it("throws if service not found", async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);

      await expect(service.executeCheck(99)).rejects.toThrow(/not found/i);
    });

    it("decrypts secret and signs request with HMAC", async () => {
      const svc = makeService();
      mockServiceRepo.findOne.mockResolvedValue(svc);
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      await service.executeCheck(1);

      expect(mockCryptoService.decrypt).toHaveBeenCalledWith(svc.monitorSecret);
      expect(mockHmacSigner.sign).toHaveBeenCalledWith(
        svc.monitorApiKey,
        "decrypted-secret",
        "GET",
        "/health",
      );
    });
  });

  // ─── getHistory ───────────────────────────────────────────────────────

  describe("getHistory()", () => {
    it("returns paginated health checks", async () => {
      mockHealthCheckRepo.findAndCount.mockResolvedValue([[{}, {}], 2]);

      const result = await service.getHistory(1, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockHealthCheckRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { serviceId: 1 }, skip: 0, take: 10 }),
      );
    });
  });
});
