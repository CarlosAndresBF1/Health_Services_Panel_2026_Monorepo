import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";

import {
  DEFAULT_CHECK_INTERVAL,
  DEFAULT_HEALTH_ENDPOINTS,
  DEFAULT_LOGS_ENDPOINTS,
  ServiceType,
} from "@healthpanel/shared";

import { CryptoService } from "../../common/crypto.service";
import { Category } from "../../database/entities/category.entity";
import { Service } from "../../database/entities/service.entity";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";

export interface CategoryInfo {
  id: number;
  name: string;
  color: string | null;
}

export interface ServiceResponse {
  id: number;
  name: string;
  url: string;
  type: string;
  healthEndpoint: string;
  logsEndpoint: string;
  monitorApiKey: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  alertsEnabled: boolean;
  categories: CategoryInfo[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceWithSecret extends ServiceResponse {
  monitorSecret: string; // plaintext — shown only once
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateServiceDto): Promise<ServiceWithSecret> {
    const apiKey = this.cryptoService.generateApiKey();
    const secret = this.cryptoService.generateSecret();
    const encryptedSecret = this.cryptoService.encrypt(secret);

    const type = dto.type as ServiceType;

    const service = this.serviceRepository.create({
      name: dto.name,
      url: dto.url,
      type: dto.type,
      healthEndpoint:
        dto.healthEndpoint ?? DEFAULT_HEALTH_ENDPOINTS[type] ?? "/health",
      logsEndpoint: dto.logsEndpoint ?? DEFAULT_LOGS_ENDPOINTS[type] ?? "/logs",
      monitorApiKey: apiKey,
      monitorSecret: encryptedSecret,
      checkIntervalSeconds: dto.checkIntervalSeconds ?? DEFAULT_CHECK_INTERVAL,
      isActive: dto.isActive ?? true,
      alertsEnabled: dto.alertsEnabled ?? true,
      deletedAt: null,
    });

    // Resolve categories
    if (dto.categoryIds?.length) {
      service.categories = await this.categoryRepository.findBy({
        id: In(dto.categoryIds),
      });
    } else {
      service.categories = [];
    }

    const saved = await this.serviceRepository.save(service);

    return {
      ...this.toResponse(saved),
      monitorSecret: secret, // return plaintext secret ONCE
    };
  }

  async findAll(
    page = 1,
    limit = 20,
    categoryId?: number,
  ): Promise<{ data: ServiceResponse[]; total: number }> {
    const qb = this.serviceRepository
      .createQueryBuilder("service")
      .leftJoinAndSelect("service.categories", "category")
      .where("service.deletedAt IS NULL")
      .orderBy("service.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (categoryId !== undefined) {
      qb.andWhere(
        "EXISTS (SELECT 1 FROM service_categories sc WHERE sc.service_id = service.id AND sc.category_id = :catId)",
        { catId: categoryId },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((s) => this.toResponse(s)),
      total,
    };
  }

  async findOne(id: number): Promise<ServiceResponse> {
    const service = await this.findActiveById(id);
    return this.toResponse(service);
  }

  async update(id: number, dto: UpdateServiceDto): Promise<ServiceResponse> {
    const service = await this.findActiveById(id);

    if (dto.name !== undefined) service.name = dto.name;
    if (dto.url !== undefined) service.url = dto.url;
    if (dto.type !== undefined) service.type = dto.type;
    if (dto.healthEndpoint !== undefined)
      service.healthEndpoint = dto.healthEndpoint;
    if (dto.logsEndpoint !== undefined) service.logsEndpoint = dto.logsEndpoint;
    if (dto.checkIntervalSeconds !== undefined)
      service.checkIntervalSeconds = dto.checkIntervalSeconds;
    if (dto.isActive !== undefined) service.isActive = dto.isActive;
    if (dto.alertsEnabled !== undefined)
      service.alertsEnabled = dto.alertsEnabled;

    // Update categories when provided
    if (dto.categoryIds !== undefined) {
      if (dto.categoryIds.length > 0) {
        service.categories = await this.categoryRepository.findBy({
          id: In(dto.categoryIds),
        });
      } else {
        service.categories = [];
      }
    }

    const saved = await this.serviceRepository.save(service);
    return this.toResponse(saved);
  }

  async remove(id: number): Promise<{ message: string }> {
    const service = await this.findActiveById(id);
    service.deletedAt = new Date();
    await this.serviceRepository.save(service);
    return { message: "Service deleted successfully" };
  }

  async regenerateKeys(id: number): Promise<ServiceWithSecret> {
    const service = await this.findActiveById(id);

    const apiKey = this.cryptoService.generateApiKey();
    const secret = this.cryptoService.generateSecret();
    const encryptedSecret = this.cryptoService.encrypt(secret);

    service.monitorApiKey = apiKey;
    service.monitorSecret = encryptedSecret;

    const saved = await this.serviceRepository.save(service);

    return {
      ...this.toResponse(saved),
      monitorSecret: secret, // return plaintext secret ONCE
    };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async findActiveById(id: number): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ["categories"],
    });

    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }

    return service;
  }

  /** Strip sensitive/internal fields from a Service entity. */
  private toResponse(service: Service): ServiceResponse {
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      type: service.type,
      healthEndpoint: service.healthEndpoint,
      logsEndpoint: service.logsEndpoint,
      monitorApiKey: service.monitorApiKey,
      checkIntervalSeconds: service.checkIntervalSeconds,
      isActive: service.isActive,
      alertsEnabled: service.alertsEnabled,
      categories: (service.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
