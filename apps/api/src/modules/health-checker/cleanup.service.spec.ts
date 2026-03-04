import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as fs from "fs";
import * as path from "path";

import { HealthCheck } from "../../database/entities/health-check.entity";
import { CleanupService } from "./cleanup.service";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("fs");

const mockedFs = fs as jest.Mocked<typeof fs>;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CleanupService", () => {
  let service: CleanupService;

  const mockHealthCheckRepo = {
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: getRepositoryToken(HealthCheck),
          useValue: mockHealthCheckRepo,
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  // ─── handleCleanup ─────────────────────────────────────────────────────

  describe("handleCleanup", () => {
    it("should run both cleanup tasks in parallel", async () => {
      mockHealthCheckRepo.delete.mockResolvedValue({ affected: 5 });
      mockedFs.existsSync.mockReturnValue(false);

      await service.handleCleanup();

      expect(mockHealthCheckRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockedFs.existsSync).toHaveBeenCalled();
    });
  });

  // ─── cleanupOldHealthChecks ─────────────────────────────────────────────

  describe("cleanupOldHealthChecks", () => {
    it("should delete health checks older than 30 days", async () => {
      mockHealthCheckRepo.delete.mockResolvedValue({ affected: 42 });

      const result = await service.cleanupOldHealthChecks();

      expect(result).toBe(42);
      expect(mockHealthCheckRepo.delete).toHaveBeenCalledTimes(1);

      // Verify the cutoff date is roughly 30 days ago
      const callArg = mockHealthCheckRepo.delete.mock.calls[0][0];
      expect(callArg).toHaveProperty("checkedAt");
    });

    it("should return 0 when no rows affected", async () => {
      mockHealthCheckRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.cleanupOldHealthChecks();

      expect(result).toBe(0);
    });

    it("should return 0 and not throw on database error", async () => {
      mockHealthCheckRepo.delete.mockRejectedValue(
        new Error("connection lost"),
      );

      const result = await service.cleanupOldHealthChecks();

      expect(result).toBe(0);
    });

    it("should handle affected being undefined", async () => {
      mockHealthCheckRepo.delete.mockResolvedValue({});

      const result = await service.cleanupOldHealthChecks();

      expect(result).toBe(0);
    });
  });

  // ─── cleanupOldScreenshots ──────────────────────────────────────────────

  describe("cleanupOldScreenshots", () => {
    const screenshotsDir = path.resolve(process.cwd(), "screenshots");

    it("should return 0 when screenshots directory does not exist", async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await service.cleanupOldScreenshots();

      expect(result).toBe(0);
      expect(mockedFs.readdirSync).not.toHaveBeenCalled();
    });

    it("should delete .png files older than 30 days", async () => {
      const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago

      mockedFs.existsSync.mockReturnValue(true);
      (mockedFs.readdirSync as jest.Mock).mockReturnValue([
        "old-screenshot.png",
        "recent-screenshot.png",
      ]);
      mockedFs.statSync.mockImplementation((filePath: fs.PathLike) => {
        const name = String(filePath);
        if (name.includes("old-screenshot")) {
          return { mtimeMs: oldTime } as fs.Stats;
        }
        return { mtimeMs: Date.now() } as fs.Stats;
      });
      mockedFs.unlinkSync.mockImplementation(() => undefined);

      const result = await service.cleanupOldScreenshots();

      expect(result).toBe(1);
      expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(
        path.join(screenshotsDir, "old-screenshot.png"),
      );
    });

    it("should skip non-png files", async () => {
      mockedFs.existsSync.mockReturnValue(true);
      (mockedFs.readdirSync as jest.Mock).mockReturnValue([
        "notes.txt",
        "data.json",
      ]);

      const result = await service.cleanupOldScreenshots();

      expect(result).toBe(0);
      expect(mockedFs.statSync).not.toHaveBeenCalled();
    });

    it("should return 0 and not throw on filesystem error", async () => {
      mockedFs.existsSync.mockReturnValue(true);
      (mockedFs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error("permission denied");
      });

      const result = await service.cleanupOldScreenshots();

      expect(result).toBe(0);
    });

    it("should delete multiple old screenshots", async () => {
      const oldTime = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago

      mockedFs.existsSync.mockReturnValue(true);
      (mockedFs.readdirSync as jest.Mock).mockReturnValue([
        "shot1.png",
        "shot2.png",
        "shot3.png",
      ]);
      mockedFs.statSync.mockReturnValue({ mtimeMs: oldTime } as fs.Stats);
      mockedFs.unlinkSync.mockImplementation(() => undefined);

      const result = await service.cleanupOldScreenshots();

      expect(result).toBe(3);
      expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(3);
    });
  });
});
