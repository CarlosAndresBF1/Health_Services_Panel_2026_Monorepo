/**
 * Security and configuration invariant tests for Phase 1.
 *
 * These tests verify that critical security settings are in place:
 * - TypeORM synchronize is disabled (migrations-only)
 * - JWT tokens have an expiration
 * - Secrets are loaded from environment variables (not hardcoded)
 * - Reset tokens expire correctly
 */

import * as fs from "fs";
import * as path from "path";

describe("Security configuration invariants", () => {
  // ─── TypeORM configuration ──────────────────────────────────────────────

  describe("TypeORM", () => {
    it("synchronize must be false in app.module.ts", () => {
      const appModulePath = path.resolve(__dirname, "../../app.module.ts");
      const content = fs.readFileSync(appModulePath, "utf-8");

      // Must have explicit synchronize: false
      expect(content).toMatch(/synchronize:\s*false/);
    });

    it("app.module.ts must not enable synchronize:true", () => {
      const appModulePath = path.resolve(__dirname, "../../app.module.ts");
      const content = fs.readFileSync(appModulePath, "utf-8");

      expect(content).not.toMatch(/synchronize:\s*true/);
    });

    it("data-source.ts must not enable synchronize:true", () => {
      const dataSourcePath = path.resolve(
        __dirname,
        "../../database/data-source.ts",
      );
      const content = fs.readFileSync(dataSourcePath, "utf-8");

      expect(content).not.toMatch(/synchronize:\s*true/);
    });
  });

  // ─── JWT configuration ───────────────────────────────────────────────────

  describe("JWT", () => {
    it("JWT module must configure an expiration", () => {
      const authModulePath = path.resolve(__dirname, "./auth.module.ts");
      const content = fs.readFileSync(authModulePath, "utf-8");

      // expiresIn must be set
      expect(content).toMatch(/expiresIn/);
    });

    it("JWT secret must come from environment variable, not be hardcoded nonsecret string", () => {
      const authModulePath = path.resolve(__dirname, "./auth.module.ts");
      const content = fs.readFileSync(authModulePath, "utf-8");

      // Secret must reference configService / env var
      expect(content).toMatch(/configService\.get.*JWT_SECRET/);
    });
  });

  // ─── No hardcoded secrets ────────────────────────────────────────────────

  describe("No hardcoded secrets", () => {
    const sensitivePatterns = [
      /password\s*=\s*['"][^'"]{4,}['"]/i,
      /secret\s*=\s*['"][^'"]{8,}['"]/i,
      /api_key\s*=\s*['"][^'"]{8,}['"]/i,
      /SG\.[A-Za-z0-9_-]{22,}/, // Real SendGrid keys
    ];

    function getSourceFiles(dir: string): string[] {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (
          entry.isDirectory() &&
          !entry.name.includes("node_modules") &&
          !entry.name.includes("dist")
        ) {
          files.push(...getSourceFiles(fullPath));
        } else if (
          entry.isFile() &&
          /\.(ts|js)$/.test(entry.name) &&
          !entry.name.includes(".spec.")
        ) {
          files.push(fullPath);
        }
      }
      return files;
    }

    it("source files must not contain raw SendGrid API keys", () => {
      const srcDir = path.resolve(__dirname, "../..");
      const files = getSourceFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toMatch(/SG\.[A-Za-z0-9_-]{22,}/);
      }
    });

    it("source files must not hardcode a JWT secret value", () => {
      const srcDir = path.resolve(__dirname, "../..");
      const files = getSourceFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        // Should not have jwt_secret = 'some-fixed-value' (a common mistake)
        expect(content).not.toMatch(/jwt_secret\s*=\s*['"][^'"]+['"]/i);
      }
    });
  });

  // ─── Password hashing ────────────────────────────────────────────────────

  describe("Password hashing", () => {
    it("auth.service.ts must use bcrypt for password operations", () => {
      const authServicePath = path.resolve(__dirname, "./auth.service.ts");
      const content = fs.readFileSync(authServicePath, "utf-8");

      expect(content).toMatch(/bcrypt\.hash/);
      expect(content).toMatch(/bcrypt\.compare/);
    });

    it("auth.service.ts must not store passwords in plaintext", () => {
      const authServicePath = path.resolve(__dirname, "./auth.service.ts");
      const content = fs.readFileSync(authServicePath, "utf-8");

      // Should not assign raw dto.newPassword to user.password
      expect(content).not.toMatch(
        /user\.password\s*=\s*dto\.(new|current)Password/,
      );
    });
  });

  // ─── Reset token expiry ──────────────────────────────────────────────────

  describe("Reset token expiry", () => {
    it("auth.service.ts must set an expiry of exactly 1 hour (3600 seconds)", () => {
      const authServicePath = path.resolve(__dirname, "./auth.service.ts");
      const content = fs.readFileSync(authServicePath, "utf-8");

      // The expiry calculation: Date.now() + 60 * 60 * 1000
      expect(content).toMatch(/60\s*\*\s*60\s*\*\s*1000/);
    });

    it("auth.service.ts must validate that used tokens are rejected", () => {
      const authServicePath = path.resolve(__dirname, "./auth.service.ts");
      const content = fs.readFileSync(authServicePath, "utf-8");

      // Should check usedAt
      expect(content).toMatch(/usedAt/);
    });

    it("auth.service.ts must validate that expired tokens are rejected", () => {
      const authServicePath = path.resolve(__dirname, "./auth.service.ts");
      const content = fs.readFileSync(authServicePath, "utf-8");

      // Should check expiresAt
      expect(content).toMatch(/expiresAt/);
    });
  });
});
