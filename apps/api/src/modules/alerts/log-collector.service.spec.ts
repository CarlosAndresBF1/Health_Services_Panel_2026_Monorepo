import { Test, TestingModule } from "@nestjs/testing";

import { CryptoService } from "../../common/crypto.service";
import { HmacSignerService } from "../../common/hmac-signer.service";
import { Service } from "../../database/entities/service.entity";
import { LogCollectorService } from "./log-collector.service";

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

describe("LogCollectorService", () => {
  let service: LogCollectorService;

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
        LogCollectorService,
        { provide: CryptoService, useValue: mockCrypto },
        { provide: HmacSignerService, useValue: mockHmac },
      ],
    }).compile();

    service = module.get<LogCollectorService>(LogCollectorService);
  });

  // ─── buildLogsUrl ───────────────────────────────────────────────────────

  describe("buildLogsUrl()", () => {
    it("builds correct URL with lines param", () => {
      const svc = makeService();
      const url = service.buildLogsUrl(svc, 50);
      expect(url).toBe("https://api.example.com/logs?lines=50");
    });

    it("handles trailing slash in base URL", () => {
      const svc = makeService({ url: "https://api.example.com/" });
      const url = service.buildLogsUrl(svc, 100);
      expect(url).toBe("https://api.example.com/logs?lines=100");
    });

    it("handles leading slash in logsEndpoint", () => {
      const svc = makeService({ logsEndpoint: "/api/logs" });
      const url = service.buildLogsUrl(svc, 100);
      expect(url).toBe("https://api.example.com/api/logs?lines=100");
    });

    it("appends with & if endpoint already has query params", () => {
      const svc = makeService({ logsEndpoint: "/logs?format=json" });
      const url = service.buildLogsUrl(svc, 100);
      expect(url).toBe("https://api.example.com/logs?format=json&lines=100");
    });
  });

  // ─── collect ────────────────────────────────────────────────────────────

  describe("collect()", () => {
    it("returns plain text response", async () => {
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: "line1\nline2\nline3",
      });

      const result = await service.collect(makeService());
      expect(result).toBe("line1\nline2\nline3");
      expect(mockCrypto.decrypt).toHaveBeenCalledWith("encrypted-secret");
      expect(mockHmac.sign).toHaveBeenCalled();
    });

    it("returns logs from JSON object with logs field", async () => {
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: { logs: "json-log-data" },
      });

      const result = await service.collect(makeService());
      expect(result).toBe("json-log-data");
    });

    it("joins array logs with newlines", async () => {
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: { logs: ["line1", "line2"] },
      });

      const result = await service.collect(makeService());
      expect(result).toBe("line1\nline2");
    });

    it("returns data field if present", async () => {
      mockAxiosGet.mockResolvedValue({
        status: 200,
        data: { data: "data-field-content" },
      });

      const result = await service.collect(makeService());
      expect(result).toBe("data-field-content");
    });

    it("returns message when no logsEndpoint configured", async () => {
      const svc = makeService({ logsEndpoint: "" });
      const result = await service.collect(svc);
      expect(result).toBe("Logs endpoint not configured for this service.");
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it("returns HTTP error message on non-200", async () => {
      mockAxiosGet.mockResolvedValue({ status: 403, data: "Forbidden" });

      const result = await service.collect(makeService());
      expect(result).toBe("Logs unavailable (HTTP 403)");
    });

    it("returns fallback message on network error", async () => {
      mockAxiosGet.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await service.collect(makeService());
      expect(result).toBe(
        "Logs not available — connection failed or timed out.",
      );
    });
  });
});
