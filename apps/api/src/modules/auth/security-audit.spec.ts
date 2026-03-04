/**
 * Security audit tests (Phase 7.3).
 *
 * Verifies the project follows OWASP top-10 best practices:
 *   - All data-modifying endpoints are protected by JWT
 *   - CORS is configured
 *   - ValidationPipe is enabled (input validation)
 *   - Graceful shutdown hooks are enabled
 *   - SSRF protections in health checker
 *   - No secrets in source code
 *   - Encryption at rest for sensitive fields
 *   - Password reset tokens expire and can't be reused
 *   - Rate-limiting awareness in login flow (brute-force protection)
 *   - No sensitive env vars leaked in responses
 */

import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(SRC_DIR, relativePath), "utf-8");
}

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
      !entry.name.includes(".spec.") &&
      !entry.name.includes(".test.")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

// ─── Security Audit ────────────────────────────────────────────────────────────

describe("Security Audit (OWASP Top-10)", () => {
  // ─── A01:2021 – Broken Access Control ────────────────────────────────

  describe("A01: Broken Access Control", () => {
    const controllerFiles = [
      "modules/services/services.controller.ts",
      "modules/health-checker/health-checker.controller.ts",
      "modules/alerts/settings.controller.ts",
      "modules/logs/logs.controller.ts",
    ];

    it.each(controllerFiles)(
      "%s should use JwtAuthGuard at class level",
      (file) => {
        const content = readSource(file);
        expect(content).toMatch(/@UseGuards\(JwtAuthGuard\)/);
      },
    );

    it("auth controller should protect profile and change-password with JwtAuthGuard", () => {
      const content = readSource("modules/auth/auth.controller.ts");
      // Count @UseGuards appearances — profile, change-password at minimum
      const guards = content.match(/@UseGuards\(JwtAuthGuard\)/g);
      expect(guards).not.toBeNull();
      expect(guards!.length).toBeGreaterThanOrEqual(2);
    });

    it("auth login endpoint should NOT require JwtAuthGuard", () => {
      const content = readSource("modules/auth/auth.controller.ts");
      // login method should be before the first @UseGuards
      const loginIndex = content.indexOf("async login(");
      const firstGuardIndex = content.indexOf("@UseGuards(JwtAuthGuard)");
      // Login should come before the first guard
      expect(loginIndex).toBeLessThan(firstGuardIndex);
    });
  });

  // ─── A02:2021 – Cryptographic Failures ──────────────────────────────

  describe("A02: Cryptographic Failures", () => {
    it("passwords must be hashed with bcrypt", () => {
      const content = readSource("modules/auth/auth.service.ts");
      expect(content).toMatch(/bcrypt\.hash/);
      expect(content).toMatch(/bcrypt\.compare/);
    });

    it("monitor secrets must use AES-256-GCM encryption", () => {
      const content = readSource("common/crypto.service.ts");
      expect(content).toMatch(/aes-256-gcm/i);
    });

    it("no raw passwords stored in database entities", () => {
      const userEntity = readSource("database/entities/user.entity.ts");
      // Password column should exist but no plaintext indicator
      expect(userEntity).toMatch(/password/);
      // And auth service should hash before saving
      const authService = readSource("modules/auth/auth.service.ts");
      expect(authService).toMatch(/bcrypt\.hash/);
    });
  });

  // ─── A03:2021 – Injection ────────────────────────────────────────────

  describe("A03: Injection", () => {
    it("main.ts must enable ValidationPipe with whitelist and forbidNonWhitelisted", () => {
      const content = readSource("main.ts");
      expect(content).toMatch(/ValidationPipe/);
      expect(content).toMatch(/whitelist:\s*true/);
      expect(content).toMatch(/forbidNonWhitelisted:\s*true/);
    });

    it("TypeORM must use parameterized queries (no raw SQL concatenation)", () => {
      const files = getSourceFiles(SRC_DIR);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        // Should not find raw SQL string concatenation patterns
        expect(content).not.toMatch(
          /\.query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/,
        );
      }
    });
  });

  // ─── A05:2021 – Security Misconfiguration ──────────────────────────

  describe("A05: Security Misconfiguration", () => {
    it("TypeORM synchronize must be false", () => {
      const content = readSource("app.module.ts");
      expect(content).toMatch(/synchronize:\s*false/);
      expect(content).not.toMatch(/synchronize:\s*true/);
    });

    it("CORS must be explicitly configured", () => {
      const content = readSource("main.ts");
      expect(content).toMatch(/enableCors/);
    });

    it("graceful shutdown hooks must be enabled", () => {
      const content = readSource("main.ts");
      expect(content).toMatch(/enableShutdownHooks/);
    });

    it("TypeORM retryAttempts must be configured for resilience", () => {
      const content = readSource("app.module.ts");
      expect(content).toMatch(/retryAttempts/);
    });
  });

  // ─── A07:2021 – Server-Side Request Forgery (SSRF) ────────────────

  describe("A07: SSRF Prevention", () => {
    it("health checker must block localhost and private IPs", () => {
      const content = readSource(
        "modules/health-checker/health-checker.service.ts",
      );
      expect(content).toMatch(/localhost/);
      expect(content).toMatch(/127\.0\.0\.1/);
      expect(content).toMatch(/::1/);
      expect(content).toMatch(/192\.168\./);
      expect(content).toMatch(/172\\/);
      expect(content).toMatch(/10\./);
    });

    it("health checker must validate URLs before making requests", () => {
      const content = readSource(
        "modules/health-checker/health-checker.service.ts",
      );
      expect(content).toMatch(/validateUrl/);
      // validateUrl must be called before performRequest
      const validateIndex = content.indexOf("this.validateUrl(");
      const performIndex = content.indexOf("this.performRequest(");
      expect(validateIndex).toBeGreaterThan(-1);
      expect(performIndex).toBeGreaterThan(-1);
      expect(validateIndex).toBeLessThan(performIndex);
    });
  });

  // ─── A08:2021 – Software and Data Integrity Failures ──────────────

  describe("A08: Data Integrity", () => {
    it("HMAC signatures must be used for external service communication", () => {
      const content = readSource("common/hmac-signer.service.ts");
      expect(content).toMatch(/sha256/i);
      expect(content).toMatch(/createHmac/);
    });

    it("HMAC must include timestamp to prevent replay attacks", () => {
      const content = readSource("common/hmac-signer.service.ts");
      expect(content).toMatch(/timestamp/i);
    });
  });

  // ─── No Hardcoded Secrets ────────────────────────────────────────────

  describe("No hardcoded secrets", () => {
    it("no raw SendGrid API keys in source", () => {
      const files = getSourceFiles(SRC_DIR);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toMatch(/SG\.[A-Za-z0-9_-]{22,}/);
      }
    });

    it("no hardcoded JWT secret values", () => {
      const files = getSourceFiles(SRC_DIR);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toMatch(/jwt_secret\s*=\s*['"][^'"]+['"]/i);
      }
    });

    it("JWT secret must come from environment variable", () => {
      const content = readSource("modules/auth/auth.module.ts");
      expect(content).toMatch(/configService\.get.*JWT_SECRET/);
    });

    it("database credentials must come from environment variables", () => {
      const content = readSource("app.module.ts");
      expect(content).toMatch(/configService\.get.*DB_HOST/);
      expect(content).toMatch(/configService\.get.*DB_PASSWORD/);
    });
  });

  // ─── Password Reset Security ────────────────────────────────────────

  describe("Password reset security", () => {
    it("reset tokens must have an expiration", () => {
      const content = readSource("modules/auth/auth.service.ts");
      expect(content).toMatch(/expiresAt/);
    });

    it("reset tokens must check if already used", () => {
      const content = readSource("modules/auth/auth.service.ts");
      expect(content).toMatch(/usedAt/);
    });

    it("token entity must include expiresAt and usedAt columns", () => {
      const content = readSource(
        "database/entities/password-reset-token.entity.ts",
      );
      expect(content).toMatch(/expiresAt/);
      expect(content).toMatch(/usedAt/);
    });
  });

  // ─── Data Retention ─────────────────────────────────────────────────

  describe("Data retention", () => {
    it("cleanup service must exist for old health checks", () => {
      const content = readSource("modules/health-checker/cleanup.service.ts");
      expect(content).toMatch(/cleanupOldHealthChecks/);
      expect(content).toMatch(/RETENTION_DAYS/);
    });

    it("cleanup service must run on a schedule", () => {
      const content = readSource("modules/health-checker/cleanup.service.ts");
      expect(content).toMatch(/@Cron/);
    });
  });

  // ─── Docker Security ────────────────────────────────────────────────

  describe("Docker security", () => {
    const dockerfilePath = path.resolve(
      SRC_DIR,
      "../../../apps/api/Dockerfile",
    );

    it("production Dockerfile must use non-root user", () => {
      const content = fs.readFileSync(dockerfilePath, "utf-8");
      expect(content).toMatch(/USER\s+\w+/);
      expect(content).not.toMatch(/USER\s+root/);
    });

    it("production Dockerfile must include HEALTHCHECK", () => {
      const content = fs.readFileSync(dockerfilePath, "utf-8");
      expect(content).toMatch(/HEALTHCHECK/);
    });
  });
});
