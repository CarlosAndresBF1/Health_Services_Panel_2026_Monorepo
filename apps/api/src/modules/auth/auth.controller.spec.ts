import {
  BadRequestException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { User } from "../../database/entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const mockAuthService = () => ({
  validateUser: jest.fn(),
  login: jest.fn(),
  changePassword: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: "admin",
  password: "$2b$12$hashedpassword",
  email: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useFactory: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /api/auth/login ──────────────────────────────────────────────────

  describe("login", () => {
    it("throws UnauthorizedException when credentials are invalid", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        controller.login({ username: "bad", password: "wrong" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("returns token and user on success", async () => {
      const user = makeUser();
      authService.validateUser.mockResolvedValue(user);
      authService.login.mockResolvedValue({
        accessToken: "mock.jwt.token",
        user: { id: 1, username: "admin" },
      });

      const result = await controller.login({
        username: "admin",
        password: "admin123",
      });

      expect(result.accessToken).toBe("mock.jwt.token");
      expect(result.user.username).toBe("admin");
    });

    it("does not expose the password in the response", async () => {
      const user = makeUser();
      authService.validateUser.mockResolvedValue(user);
      authService.login.mockResolvedValue({
        accessToken: "mock.jwt.token",
        user: { id: 1, username: "admin" },
      });

      const result = await controller.login({
        username: "admin",
        password: "admin123",
      });

      expect(result.user).not.toHaveProperty("password");
    });
  });

  // ─── GET /api/auth/profile ────────────────────────────────────────────────

  describe("getProfile", () => {
    it("returns id and username from the authenticated request", () => {
      const req = { user: makeUser() };

      const result = controller.getProfile(req);

      expect(result).toEqual({ id: 1, username: "admin" });
    });
  });

  // ─── PUT /api/auth/change-password ────────────────────────────────────────

  describe("changePassword", () => {
    it("delegates to authService.changePassword", async () => {
      authService.changePassword.mockResolvedValue({
        message: "Password changed successfully",
      });
      const req = { user: makeUser() };

      const result = await controller.changePassword(req, {
        currentPassword: "Old1!",
        newPassword: "New1!",
        confirmPassword: "New1!",
      });

      expect(authService.changePassword).toHaveBeenCalledWith(1, {
        currentPassword: "Old1!",
        newPassword: "New1!",
        confirmPassword: "New1!",
      });
      expect(result.message).toBe("Password changed successfully");
    });

    it("propagates BadRequestException from service", async () => {
      authService.changePassword.mockRejectedValue(
        new BadRequestException("Passwords do not match"),
      );
      const req = { user: makeUser() };

      await expect(
        controller.changePassword(req, {
          currentPassword: "Old1!",
          newPassword: "New1!",
          confirmPassword: "Different1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── POST /api/auth/forgot-password ───────────────────────────────────────

  describe("forgotPassword", () => {
    it("returns generic message regardless of email existence", async () => {
      const genericMsg =
        "If an account exists with this email, you'll receive a reset link shortly";
      authService.forgotPassword.mockResolvedValue({ message: genericMsg });

      const result = await controller.forgotPassword({
        email: "any@example.com",
      });

      expect(result.message).toBe(genericMsg);
    });
  });

  // ─── POST /api/auth/reset-password ────────────────────────────────────────

  describe("resetPassword", () => {
    it("delegates reset to authService", async () => {
      authService.resetPassword.mockResolvedValue({
        message: "Password reset successfully",
      });

      const result = await controller.resetPassword({
        token: "valid-token",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });

      expect(authService.resetPassword).toHaveBeenCalledWith({
        token: "valid-token",
        newPassword: "NewPassword1!",
        confirmPassword: "NewPassword1!",
      });
      expect(result.message).toBe("Password reset successfully");
    });

    it("propagates BadRequestException for expired token", async () => {
      authService.resetPassword.mockRejectedValue(
        new BadRequestException("This reset link has expired"),
      );

      await expect(
        controller.resetPassword({
          token: "expired",
          newPassword: "NewPassword1!",
          confirmPassword: "NewPassword1!",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// Re-export for HTTP status assertion convenience
export { HttpStatus };
