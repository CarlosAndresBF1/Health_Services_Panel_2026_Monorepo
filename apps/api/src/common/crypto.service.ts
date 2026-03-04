import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * AES-256-GCM encryption/decryption service.
 *
 * Encrypted values are stored as: `iv:authTag:ciphertext` (all hex-encoded).
 * The secret key is 32 bytes, loaded from ENCRYPTION_KEY env var.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>("ENCRYPTION_KEY", "");

    if (!rawKey) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }

    // Accept hex (64 chars) or base64 (44 chars) encoded 32-byte key
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      this.key = Buffer.from(rawKey, "hex");
    } else if (rawKey.length >= 32) {
      // Use first 32 chars as UTF-8 key (dev convenience)
      this.key = Buffer.from(rawKey.slice(0, 32), "utf-8");
    } else {
      throw new Error("ENCRYPTION_KEY must be at least 32 characters");
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns: `iv:authTag:ciphertext` (all hex).
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /**
   * Decrypt an AES-256-GCM ciphertext.
   * Expects: `iv:authTag:ciphertext` (all hex).
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted value format");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid encrypted value format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }

  /**
   * Generate a random API key (UUID v4 format).
   */
  generateApiKey(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a random secret (64 hex characters = 32 bytes).
   */
  generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
