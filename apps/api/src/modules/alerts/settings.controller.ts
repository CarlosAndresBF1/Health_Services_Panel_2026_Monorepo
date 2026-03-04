import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Setting } from "../../database/entities/setting.entity";

interface SettingsResponse {
  alert_email_to: string;
  alert_email_from: string;
  alerts_enabled: boolean;
  alert_min_interval_ms: number;
}

interface UpdateSettingsDto {
  alert_email_to?: string;
  alert_email_from?: string;
  alerts_enabled?: boolean;
  alert_min_interval_ms?: number;
}

const ALLOWED_KEYS = [
  "alert_email_to",
  "alert_email_from",
  "alerts_enabled",
  "alert_min_interval_ms",
] as const;

@Controller("api/settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  @Get()
  async getSettings(): Promise<SettingsResponse> {
    const settings = await this.settingRepository.find();
    const map = new Map(settings.map((s) => [s.key, s.value]));

    return {
      alert_email_to: map.get("alert_email_to") ?? "admin@example.com",
      alert_email_from: map.get("alert_email_from") ?? "monitor@example.com",
      alerts_enabled: (map.get("alerts_enabled") ?? "true") === "true",
      alert_min_interval_ms: parseInt(
        map.get("alert_min_interval_ms") ?? "300000",
        10,
      ),
    };
  }

  @Put()
  async updateSettings(
    @Body() body: UpdateSettingsDto,
  ): Promise<SettingsResponse> {
    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        const value = String(body[key]);
        const existing = await this.settingRepository.findOne({
          where: { key },
        });
        if (existing) {
          existing.value = value;
          await this.settingRepository.save(existing);
        } else {
          await this.settingRepository.save(
            this.settingRepository.create({ key, value }),
          );
        }
      }
    }

    return this.getSettings();
  }
}
