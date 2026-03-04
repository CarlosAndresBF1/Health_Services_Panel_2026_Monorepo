import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { IsNull } from "typeorm";

import { CryptoService } from "../../common/crypto.service";
import { Service } from "../../database/entities/service.entity";
import { ServicesService } from "./services.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<Service> = {}): Service {
  const s = new Service();
  s.id = 1;
  s.name = "Test API";
  s.url = "https://api.example.com";
  s.type = "api_nestjs";
  s.healthEndpoint = "/health";
  s.logsEndpoint = "/logs";
  s.monitorApiKey = "test-api-key-uuid";
  s.monitorSecret = "encrypted-secret";
  s.checkIntervalSeconds = 60;
  s.isActive = true;
  s.alertsEnabled = true;
  s.deletedAt = null;
  s.createdAt = new Date("2024-01-01");
  s.updatedAt = new Date("2024-01-01");
  return Object.assign(s, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ServicesService", () => {
  let service: ServicesService;
  let cryptoService: jest.Mocked<CryptoService>;

  const mockSave = jest.fn();
  const mockCreate = jest.fn();
  const mockFindAndCount = jest.fn();
  const mockFindOne = jest.fn();

  const mockRepository = {
    save: mockSave,
    create: mockCreate,
    findAndCount: mockFindAndCount,
    findOne: mockFindOne,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: getRepositoryToken(Service),
          useValue: mockRepository,
        },
        {
          provide: CryptoService,
          useValue: {
            generateApiKey: jest.fn().mockReturnValue("new-api-key"),
            generateSecret: jest
              .fn()
              .mockReturnValue("plaintext-secret-32chars-longxxx"),
            encrypt: jest.fn().mockReturnValue("iv:tag:ciphertext"),
            decrypt: jest.fn().mockReturnValue("decrypted-secret"),
          },
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    cryptoService = module.get(CryptoService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create()", () => {
    const dto: CreateServiceDto = {
      name: "My NestJS API",
      url: "https://api.example.com",
      type: "api_nestjs" as unknown as CreateServiceDto["type"],
    };

    it("generates a new api key and secret", async () => {
      const entity = makeEntity();
      mockCreate.mockReturnValue(entity);
      mockSave.mockResolvedValue(entity);

      await service.create(dto);

      expect(cryptoService.generateApiKey).toHaveBeenCalledTimes(1);
      expect(cryptoService.generateSecret).toHaveBeenCalledTimes(1);
    });

    it("encrypts the secret before saving", async () => {
      const entity = makeEntity();
      mockCreate.mockReturnValue(entity);
      mockSave.mockResolvedValue(entity);

      await service.create(dto);

      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        "plaintext-secret-32chars-longxxx",
      );
    });

    it("returns the plaintext secret exactly once", async () => {
      const entity = makeEntity({
        monitorApiKey: "new-api-key",
        monitorSecret: "iv:tag:ciphertext",
      });
      mockCreate.mockReturnValue(entity);
      mockSave.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(result.monitorSecret).toBe("plaintext-secret-32chars-longxxx");
    });

    it("does NOT store plaintext secret in the database entity", async () => {
      let savedEntity: Partial<Service> | undefined;
      mockCreate.mockImplementation((data) => data);
      mockSave.mockImplementation(async (e: Service) => {
        savedEntity = { ...e };
        return { ...e, id: 1, createdAt: new Date(), updatedAt: new Date() };
      });

      await service.create(dto);

      expect(savedEntity).toBeDefined();
      expect(
        (savedEntity as Partial<Service> & { monitorSecret?: string })
          .monitorSecret,
      ).toBe("iv:tag:ciphertext");
      expect(
        (savedEntity as Partial<Service> & { monitorSecret?: string })
          .monitorSecret,
      ).not.toBe("plaintext-secret-32chars-longxxx");
    });

    it("uses provided healthEndpoint when given", async () => {
      let createdWith: Partial<Service> | undefined;
      mockCreate.mockImplementation((data) => {
        createdWith = data;
        return data;
      });
      mockSave.mockImplementation(async (e: Service) => ({
        ...e,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await service.create({ ...dto, healthEndpoint: "/api/health" });

      expect(
        (createdWith as Partial<Service> & { healthEndpoint?: string })
          .healthEndpoint,
      ).toBe("/api/health");
    });

    it("applies default checkIntervalSeconds when not provided", async () => {
      let createdWith: Partial<Service> | undefined;
      mockCreate.mockImplementation((data) => {
        createdWith = data;
        return data;
      });
      mockSave.mockImplementation(async (e: Service) => ({
        ...e,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await service.create(dto);

      expect(
        (createdWith as Partial<Service> & { checkIntervalSeconds?: number })
          .checkIntervalSeconds,
      ).toBeGreaterThan(0);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe("findAll()", () => {
    it("returns paginated services", async () => {
      const entities = [makeEntity({ id: 1 }), makeEntity({ id: 2 })];
      mockFindAndCount.mockResolvedValue([entities, 2]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("passes pagination parameters correctly", async () => {
      mockFindAndCount.mockResolvedValue([[], 0]);

      await service.findAll(3, 10);

      expect(mockFindAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("filters by deletedAt IS NULL (excludes soft-deleted)", async () => {
      mockFindAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(mockFindAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: IsNull() } }),
      );
    });

    it("strips monitorSecret from each item", async () => {
      const entities = [makeEntity({ monitorSecret: "Enc:secret:value" })];
      mockFindAndCount.mockResolvedValue([entities, 1]);

      const result = await service.findAll();

      expect(
        (result.data[0]! as unknown as Record<string, unknown>)[
          "monitorSecret"
        ],
      ).toBeUndefined();
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe("findOne()", () => {
    it("returns a service by id", async () => {
      const entity = makeEntity({ id: 42 });
      mockFindOne.mockResolvedValue(entity);

      const result = await service.findOne(42);

      expect(result.id).toBe(42);
    });

    it("throws NotFoundException when service does not exist", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });

    it("strips monitorSecret from response", async () => {
      const entity = makeEntity({ monitorSecret: "Enc:very:secret" });
      mockFindOne.mockResolvedValue(entity);

      const result = await service.findOne(1);

      expect(
        (result as unknown as Record<string, unknown>)["monitorSecret"],
      ).toBeUndefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("updates only provided fields", async () => {
      const entity = makeEntity({ name: "Old name", isActive: true });
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      const dto: UpdateServiceDto = { name: "New name" };
      const result = await service.update(1, dto);

      expect(result.name).toBe("New name");
      expect(result.isActive).toBe(true); // unchanged
    });

    it("throws NotFoundException for a missing service", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.update(99, { name: "X" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("can toggle isActive", async () => {
      const entity = makeEntity({ isActive: true });
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      const result = await service.update(1, { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe("remove()", () => {
    it("sets deletedAt to a date (soft delete)", async () => {
      const entity = makeEntity({ deletedAt: null });
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      await service.remove(1);

      expect(entity.deletedAt).toBeInstanceOf(Date);
    });

    it("returns success message", async () => {
      const entity = makeEntity();
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      const result = await service.remove(1);

      expect(result.message).toMatch(/deleted/i);
    });

    it("throws NotFoundException for missing service", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── regenerateKeys ───────────────────────────────────────────────────────

  describe("regenerateKeys()", () => {
    it("generates new api key and secret", async () => {
      const entity = makeEntity();
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      await service.regenerateKeys(1);

      expect(cryptoService.generateApiKey).toHaveBeenCalledTimes(1);
      expect(cryptoService.generateSecret).toHaveBeenCalledTimes(1);
    });

    it("returns plaintext secret once", async () => {
      const entity = makeEntity();
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      const result = await service.regenerateKeys(1);

      expect(result.monitorSecret).toBe("plaintext-secret-32chars-longxxx");
    });

    it("encrypts the new secret before saving", async () => {
      const entity = makeEntity();
      mockFindOne.mockResolvedValue(entity);
      mockSave.mockImplementation(async (e: Service) => e);

      await service.regenerateKeys(1);

      expect(cryptoService.encrypt).toHaveBeenCalledWith(
        "plaintext-secret-32chars-longxxx",
      );
    });

    it("throws NotFoundException for missing service", async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.regenerateKeys(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
