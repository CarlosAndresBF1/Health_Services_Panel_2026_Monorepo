import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { Service } from "../../database/entities/service.entity";
import { LogsService } from "./logs.service";

// ─── Mock axios ───────────────────────────────────────────────────────────────

const mockAxiosGet = jest.fn();
jest.mock("axios", () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockAxiosGet(...args) },
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
  s.monitorApiKey = "key-123";
  s.monitorSecret = "encrypted-secret";
  s.checkIntervalSeconds = 60;
  s.isActive = true;
  s.alertsEnabled = true;
  s.deletedAt = null;
  s.createdAt = new Date();
  s.updatedAt = new Date();
  return Object.assign(s, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LogsService", () => {
  let service: LogsService;

  const mockServiceRepo = {
    findOne: jest.fn(),
  };

  const mockCrypto = {
    decrypt: jest.fn().mockReturnValue("decrypted-secret"),
  };

  const mockHmac = {
    sign: jest.fn().mockReturnValue({
      "x-monitor-key": "key-123",
      "x-monitor-ts": "123456",
      "x-monitor-sig": "abc",
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: HmacSignerService, useValue: mockHmac },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
    service.invalidateCache(1); // Clear cache between tests
  });

  // ─── fetchLogs ──────────────────────────────────────────────────────────

  describe("fetchLogs()", () => {
    it("throws NotFoundException for non-existent service", async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);
      await expect(service.fetchLogs(999)).rejects.toThrow(NotFoundException);
    });

    it("returns message when logsEndpoint is empty", async () => {
      mockServiceRepo.findOne.mockResolvedValue(
        makeService({ logsEndpoint: "" }),
      );
      const result = await service.fetchLogs(1);
      expect(result).toBe("Logs endpoint not configured for this service.");
    });

    it("fetches logs via HMAC-signed request", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: "line1\nline2\nline3",
      });

      const result = await service.fetchLogs(1, 100);

      expect(result).toBe("line1\nline2\nline3");
      expect(mockCrypto.decrypt).toHaveBeenCalledWith("encrypted-secret");
      expect(mockHmac.sign).toHaveBeenCalledWith(
        "key-123",
        "decrypted-secret",
        "GET",
        "/logs?lines=100",
      );
    });

    it("handles JSON response with logs field", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: { logs: "json-log-content" },
      });

      const result = await service.fetchLogs(1);
      expect(result).toBe("json-log-content");
    });

    it("handles JSON response with array logs", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: { logs: ["line1", "line2"] },
      });

      const result = await service.fetchLogs(1);
      expect(result).toBe("line1\nline2");
    });

    it("returns error message on non-200 status", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockResolvedValue({ status: 500, data: "Error" });

      const result = await service.fetchLogs(1);
      expect(result).toBe("Logs unavailable (HTTP 500)");
    });

    it("returns error message on network failure", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await service.fetchLogs(1);
      expect(result).toBe(
        "Logs not available — connection failed or timed out.",
      );
    });

    it("uses cached result on subsequent calls within TTL", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: "cached-logs",
      });

      const first = await service.fetchLogs(1, 100);
      const second = await service.fetchLogs(1, 100);

      expect(first).toBe("cached-logs");
      expect(second).toBe("cached-logs");
      // axios should only have been called once (second was cached)
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });

    it("refreshes cache after invalidation", async () => {
      mockServiceRepo.findOne.mockResolvedValue(makeService());
      mockAxiosGet
        .mockResolvedValueOnce({ status: 200, data: "first" })
        .mockResolvedValueOnce({ status: 200, data: "second" });

      await service.fetchLogs(1, 100);
      service.invalidateCache(1);
      const result = await service.fetchLogs(1, 100);

      expect(result).toBe("second");
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });
  });

  // ─── buildLogsUrl ───────────────────────────────────────────────────────

  describe("buildLogsUrl()", () => {
    it("builds correct URL", () => {
      const url = service.buildLogsUrl(makeService(), 50);
      expect(url).toBe("https://api.example.com/logs?lines=50");
    });

    it("handles trailing slash in base URL", () => {
      const url = service.buildLogsUrl(
        makeService({ url: "https://api.example.com/" }),
        100,
      );
      expect(url).toBe("https://api.example.com/logs?lines=100");
    });

    it("uses & separator when endpoint already has query params", () => {
      const url = service.buildLogsUrl(
        makeService({ logsEndpoint: "/logs?format=json" }),
        100,
      );
      expect(url).toBe("https://api.example.com/logs?format=json&lines=100");
    });
  });
});
