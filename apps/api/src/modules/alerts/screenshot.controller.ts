import {
  Controller,
  Get,
  Post,
  Header,
  NotFoundException,
  BadRequestException,
  Param,
  ParseIntPipe,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as fs from "fs";
import * as path from "path";
import { IsNull, Repository } from "typeorm";

import { Service } from "../../database/entities/service.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScreenshotSchedulerService } from "./screenshot-scheduler.service";
import { ScreenshotService } from "./screenshot.service";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "screenshots");

// Only allow safe filenames: alphanumeric, underscores, hyphens, dots, ending in .png
const SAFE_FILENAME = /^[a-zA-Z0-9_\-]+\.png$/;

@Controller("api")
@UseGuards(JwtAuthGuard)
export class ScreenshotController {
  constructor(
    private readonly screenshotScheduler: ScreenshotSchedulerService,
    private readonly screenshotService: ScreenshotService,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  /**
   * POST /api/screenshots/capture-all
   * Manually trigger the daily preview capture for all active web services.
   */
  @Post("screenshots/capture-all")
  async captureAll() {
    const result = await this.screenshotScheduler.captureDaily();
    return {
      message: "Daily preview capture completed",
      ...result,
    };
  }
  /**
   * POST /api/services/:id/capture-screenshot
   * Manually trigger a preview screenshot capture for a single service.
   */
  @Post("services/:id/capture-screenshot")
  async captureService(@Param("id", ParseIntPipe) id: number) {
    const service = await this.serviceRepository.findOne({
      where: { id, isActive: true, deletedAt: IsNull() },
    });

    if (!service) {
      throw new NotFoundException("Service not found");
    }

    const result = await this.screenshotService.capturePreview(
      service.url,
      service.id,
    );

    if (!result) {
      throw new BadRequestException("Failed to capture screenshot");
    }

    return { message: "Screenshot captured", serviceId: service.id };
  }

  /**
   * GET /api/screenshots/:filename
   * Serve a specific screenshot file by name.
   */
  @Get("screenshots/:filename")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", "public, max-age=86400")
  getScreenshot(@Param("filename") filename: string): StreamableFile {
    if (!SAFE_FILENAME.test(filename)) {
      throw new BadRequestException("Invalid filename");
    }

    const filePath = path.join(SCREENSHOT_DIR, filename);

    // Ensure resolved path is within SCREENSHOT_DIR (path traversal protection)
    if (!path.resolve(filePath).startsWith(SCREENSHOT_DIR)) {
      throw new BadRequestException("Invalid filename");
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Screenshot not found");
    }

    const file = fs.createReadStream(filePath);
    return new StreamableFile(file);
  }

  /**
   * GET /api/services/:id/screenshot
   * Serve the latest daily preview screenshot for a service.
   */
  @Get("services/:id/screenshot")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", "public, max-age=3600")
  getServicePreview(@Param("id", ParseIntPipe) id: number): StreamableFile {
    const filename = `preview_${id}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("No preview available");
    }

    const file = fs.createReadStream(filePath);
    return new StreamableFile(file);
  }
}
