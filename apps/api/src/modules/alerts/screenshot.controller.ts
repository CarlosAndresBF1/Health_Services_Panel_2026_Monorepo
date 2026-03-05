import {
  Controller,
  Get,
  Header,
  NotFoundException,
  BadRequestException,
  Param,
  ParseIntPipe,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "screenshots");

// Only allow safe filenames: alphanumeric, underscores, hyphens, dots, ending in .png
const SAFE_FILENAME = /^[a-zA-Z0-9_\-]+\.png$/;

@Controller("api")
@UseGuards(JwtAuthGuard)
export class ScreenshotController {
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
