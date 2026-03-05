import * as fs from "fs";
import * as path from "path";

import { Injectable, Logger } from "@nestjs/common";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "screenshots");
const SCREENSHOT_TIMEOUT_MS = 15_000;

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor() {
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  }

  /**
   * Capture a screenshot of the given URL using Puppeteer.
   * Returns the file path and buffer, or null on failure.
   */
  async capture(
    url: string,
    serviceId: number,
  ): Promise<{ filePath: string; buffer: Buffer } | null> {
    let browser: import("puppeteer").Browser | null = null;

    try {
      // Dynamic import to avoid breaking if Puppeteer is not installed
      const puppeteer = await import("puppeteer");

      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: SCREENSHOT_TIMEOUT_MS,
      });

      const filename = `${serviceId}_${Date.now()}.png`;
      const filePath = path.join(SCREENSHOT_DIR, filename);

      const buffer = (await page.screenshot({
        path: filePath,
        fullPage: false,
      })) as Buffer;

      this.logger.log(`Screenshot captured: ${filePath}`);
      return { filePath, buffer };
    } catch (error) {
      this.logger.warn(
        `Failed to capture screenshot for service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
      }
    }
  }

  /**
   * Capture a daily preview screenshot for a service.
   * Overwrites the previous preview file for that service.
   */
  async capturePreview(url: string, serviceId: number): Promise<string | null> {
    let browser: import("puppeteer").Browser | null = null;

    try {
      const puppeteer = await import("puppeteer");

      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: SCREENSHOT_TIMEOUT_MS,
      });

      const filename = `preview_${serviceId}.png`;
      const filePath = path.join(SCREENSHOT_DIR, filename);

      await page.screenshot({ path: filePath, fullPage: false });

      this.logger.log(`Preview screenshot captured: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.warn(
        `Failed to capture preview for service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
      }
    }
  }

  /** Check if a preview screenshot exists for a service. */
  hasPreview(serviceId: number): boolean {
    const filePath = path.join(SCREENSHOT_DIR, `preview_${serviceId}.png`);
    return fs.existsSync(filePath);
  }

  /**
   * Clean up old screenshots older than the given age in milliseconds.
   * Does NOT delete preview files (preview_*.png).
   */
  async cleanup(maxAgeMs = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    let deleted = 0;
    const now = Date.now();

    try {
      const files = fs.readdirSync(SCREENSHOT_DIR);
      for (const file of files) {
        if (!file.endsWith(".png") || file.startsWith("preview_")) continue;
        const filePath = path.join(SCREENSHOT_DIR, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    } catch {
      // directory might not exist yet
    }

    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} old screenshots`);
    }
    return deleted;
  }
}
