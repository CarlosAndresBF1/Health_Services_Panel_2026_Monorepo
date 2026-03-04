import * as bcrypt from "bcrypt";
import * as sgMail from "@sendgrid/mail";

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { PasswordResetToken } from "../../database/entities/password-reset-token.entity";
import { User } from "../../database/entities/user.entity";
import { AuthService } from "./auth.service";

// Mock SendGrid to avoid real emails in tests
jest.mock("@sendgrid/mail");

const mockUserRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockPasswordResetTokenRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn().mockReturnValue("mock.jwt.token"),
  verify: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, defaultVal?: unknown) => {
    const config: Record<string, unknown> = {
      PANEL_URL: "http://localhost:3000",
      SENDGRID_API_KEY: "SG.test-key",
      ALERT_EMAIL_FROM: "no-reply@healthpanel.test",
    };
    return config[key] ?? defaultVal;
  }),
});

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let passwordResetTokenRepository: jest.Mocked<Repository<PasswordResetToken>>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useFactory: mockPasswordResetTokenRepository,
        },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    passwordResetTokenRepository = module.get(
      getRepositoryToken(PasswordResetToken),
    );
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── validateUser ──────────────────────────────────────────────────────────

  describe("validateUser", () => {
    it("returns null when user is not found", async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser("nonexistent", "password");

      expect(result).toBeNull();
    });

    it("returns null when password is invalid", async () => {
      const hashedPassword = await bcrypt.hash("correctpassword", 12);
      userRepository.findOne.mockResolvedValue({
        id: 1,
        username: "admin",
        password: hashedPassword,
        isActive: true,
      } as User);

      const result = await service.validateUser("admin", "wrongpassword");

      expect(result).toBeNull();
    });

    it("returns user when credentials are valid", async () => {
      const password = "correctpassword";
      const hashedPassword = await bcrypt.hash(password, 12);
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: hashedPassword,
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser("admin", password);

      expect(result).toEqual(mockUser);
    });

    it("stores password as bcrypt hash (not plaintext)", async () => {
      const password = "secret123";
      const hashedPassword = await bcrypt.hash(password, 12);
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: hashedPassword,
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      await service.validateUser("admin", password);

      // Verify the stored password is a bcrypt hash, not plaintext
      expect(mockUser.password).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(mockUser.password).not.toBe(password);
    });

    it("does not return inactive users", async () => {
      userRepository.findOne.mockResolvedValue(null); // findOne with isActive:true returns null for inactive

      const result = await service.validateUser("inactiveuser", "password");

      expect(result).toBeNull();
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: "inactiveuser", isActive: true },
      });
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns an accessToken and user info", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "hash",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.login(mockUser);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("user");
      expect(result.user).toEqual({ id: 1, username: "admin" });
    });

    it("signs JWT with correct payload (sub + username)", async () => {
      const mockUser: User = {
        id: 42,
        username: "testuser",
        password: "hash",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 42,
        username: "testuser",
      });
    });

    it("does not expose password in the returned user object", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "$2b$12$hashedpassword",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.login(mockUser);

      expect(result.user).not.toHaveProperty("password");
    });
  });

  // ─── changePassword ────────────────────────────────────────────────────────

  describe("changePassword", () => {
    const userId = 1;
    const currentPassword = "OldPassword1!";

    async function buildUser(): Promise<User> {
      return {
        id: userId,
        username: "admin",
        password: await bcrypt.hash(currentPassword, 12),
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    it("throws NotFoundException when user does not exist", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, {
          currentPassword: "any",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws UnauthorizedException when current password is wrong", async () => {
      userRepository.findOne.mockResolvedValue(await buildUser());

      await expect(
        service.changePassword(userId, {
          currentPassword: "wrongpassword",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws BadRequestException when new password equals current password", async () => {
      userRepository.findOne.mockResolvedValue(await buildUser());

      await expect(
        service.changePassword(userId, {
          currentPassword,
          newPassword: currentPassword,
          confirmPassword: currentPassword,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when confirmation does not match new password", async () => {
      userRepository.findOne.mockResolvedValue(await buildUser());

      await expect(
        service.changePassword(userId, {
          currentPassword,
          newPassword: "NewPassword1!",
          confirmPassword: "DifferentPassword1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates password with bcrypt hash when all validations pass", async () => {
      const user = await buildUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.changePassword(userId, {
        currentPassword,
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

      expect(result.message).toBe("Password changed successfully");
      expect(userRepository.save).toHaveBeenCalled();
      // Verify new password is stored as bcrypt hash
      const savedUser = userRepository.save.mock.calls[0]![0] as User;
      expect(savedUser.password).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(savedUser.password).not.toBe("NewPassword1!");
    });
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("returns generic response when email is not found (prevents enumeration)", async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword("unknown@example.com");

      expect(result.message).toContain("If an account exists");
    });

    it("creates a reset token and sends email when user exists", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "hash",
        email: "admin@example.com",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      const mockToken: PasswordResetToken = {
        id: 1,
        userId: 1,
        token: "mock-uuid-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: mockUser,
      };
      passwordResetTokenRepository.create.mockReturnValue(mockToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockToken);
      (sgMail.send as jest.Mock).mockResolvedValue([{}, {}]);

      const result = await service.forgotPassword("admin@example.com");

      expect(result.message).toContain("If an account exists");
      expect(passwordResetTokenRepository.create).toHaveBeenCalled();
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
      expect(sgMail.send).toHaveBeenCalled();
    });

    it("sets token expiry to 1 hour from now", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "hash",
        email: "admin@example.com",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      (sgMail.send as jest.Mock).mockResolvedValue([{}, {}]);

      const before = new Date();
      const mockToken: PasswordResetToken = {
        id: 1,
        userId: 1,
        token: "uuid",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: mockUser,
      };
      passwordResetTokenRepository.create.mockReturnValue(mockToken);
      passwordResetTokenRepository.save.mockResolvedValue(mockToken);

      await service.forgotPassword("admin@example.com");

      const createdArg = passwordResetTokenRepository.create.mock.calls[0]![0];
      const expiry = (createdArg as { expiresAt: Date }).expiresAt;
      const diffMs = expiry.getTime() - before.getTime();

      // Should be ~1 hour (3600000 ms), allow ±5s tolerance
      expect(diffMs).toBeGreaterThan(3594000);
      expect(diffMs).toBeLessThan(3606000);
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("throws BadRequestException when passwords do not match", async () => {
      await expect(
        service.resetPassword({
          token: "abc",
          newPassword: "NewPassword1!",
          confirmPassword: "DifferentPassword!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when token is invalid", async () => {
      passwordResetTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: "invalid-token",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when token has already been used", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "hash",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      passwordResetTokenRepository.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        token: "used-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // already used
        user: mockUser,
      });

      await expect(
        service.resetPassword({
          token: "used-token",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when token is expired", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "hash",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      passwordResetTokenRepository.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        token: "expired-token",
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        usedAt: null,
        user: mockUser,
      });

      await expect(
        service.resetPassword({
          token: "expired-token",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("resets password and marks token as used on success", async () => {
      const mockUser: User = {
        id: 1,
        username: "admin",
        password: "oldhash",
        email: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockResetToken: PasswordResetToken = {
        id: 1,
        userId: 1,
        token: "valid-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: mockUser,
      };
      passwordResetTokenRepository.findOne.mockResolvedValue(mockResetToken);
      userRepository.save.mockResolvedValue(mockUser);
      passwordResetTokenRepository.save.mockResolvedValue(mockResetToken);

      const result = await service.resetPassword({
        token: "valid-token",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

      expect(result.message).toBe("Password reset successfully");

      // Verify new password is hashed
      expect(mockUser.password).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(mockUser.password).not.toBe("NewPassword1!");

      // Verify token is marked as used
      expect(mockResetToken.usedAt).not.toBeNull();
      expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
        mockResetToken,
      );
    });
  });

  // ─── Security checks ───────────────────────────────────────────────────────

  describe("Security invariants", () => {
    it("bcrypt salt rounds are at least 12", async () => {
      const user = await buildUserWithPassword("MyPassword1!");
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      await service.changePassword(1, {
        currentPassword: "MyPassword1!",
        newPassword: "AnotherPassword1!",
        confirmPassword: "AnotherPassword1!",
      });

      const savedUser = userRepository.save.mock.calls[0]![0] as User;
      // Extract cost factor from bcrypt hash ($2b$12$...)
      const costFactor = parseInt(savedUser.password.split("$")[2] ?? "0", 10);
      expect(costFactor).toBeGreaterThanOrEqual(12);
    });
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildUserWithPassword(password: string): Promise<User> {
  return {
    id: 1,
    username: "admin",
    password: await bcrypt.hash(password, 12),
    email: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
