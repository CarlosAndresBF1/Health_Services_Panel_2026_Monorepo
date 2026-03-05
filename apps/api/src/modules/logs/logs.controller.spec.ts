import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { LogsController } from "./logs.controller";
import { LogsService } from "./logs.service";

describe("LogsController", () => {
  let controller: LogsController;

  const mockLogsService = {
    fetchLogs: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [{ provide: LogsService, useValue: mockLogsService }],
    }).compile();

    controller = module.get<LogsController>(LogsController);
  });

  describe("getLogs()", () => {
    it("returns logs with default lines", async () => {
      mockLogsService.fetchLogs.mockResolvedValue(
        "2024-06-01 ERROR something\n2024-06-01 INFO ok",
      );

      const result = await controller.getLogs(1);

      expect(result).toEqual({
        logs: "2024-06-01 ERROR something\n2024-06-01 INFO ok",
        serviceId: 1,
        lines: 100,
      });
      expect(mockLogsService.fetchLogs).toHaveBeenCalledWith(1, 100);
    });

    it("parses custom lines param", async () => {
      mockLogsService.fetchLogs.mockResolvedValue("logs");

      const result = await controller.getLogs(1, "50");

      expect(result).toEqual({
        logs: "logs",
        serviceId: 1,
        lines: 50,
      });
      expect(mockLogsService.fetchLogs).toHaveBeenCalledWith(1, 50);
    });

    it("caps lines at 500", async () => {
      mockLogsService.fetchLogs.mockResolvedValue("logs");

      const result = await controller.getLogs(1, "9999");

      expect(result.lines).toBe(500);
      expect(mockLogsService.fetchLogs).toHaveBeenCalledWith(1, 500);
    });

    it("enforces minimum of 1 line", async () => {
      mockLogsService.fetchLogs.mockResolvedValue("logs");

      const result = await controller.getLogs(1, "-5");

      expect(result.lines).toBe(1);
      expect(mockLogsService.fetchLogs).toHaveBeenCalledWith(1, 1);
    });

    it("propagates NotFoundException from service", async () => {
      mockLogsService.fetchLogs.mockRejectedValue(
        new NotFoundException("Service 999 not found"),
      );

      await expect(controller.getLogs(999)).rejects.toThrow(NotFoundException);
    });
  });
});
