import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as sgMail from '@sendgrid/mail';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { User } from '../../database/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username, isActive: true },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(user: User): Promise<{ accessToken: string; user: { id: number; username: string } }> {
    const payload = { sub: user.id, username: user.username };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);

    if (isSamePassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message: "If an account exists with this email, you'll receive a reset link shortly",
    };

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Prevent email enumeration — always return success
      return genericResponse;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const resetToken = this.passwordResetTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
      usedAt: null,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    const panelUrl = this.configService.get<string>('PANEL_URL', 'http://localhost:3000');
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
    const fromEmail = this.configService.get<string>('ALERT_EMAIL_FROM', '');

    const resetLink = `${panelUrl}/reset-password?token=${token}`;

    sgMail.setApiKey(sendgridApiKey);

    await sgMail.send({
      to: email,
      from: fromEmail,
      subject: 'HealthPanel — Password Reset Request',
      text: `You requested a password reset for your HealthPanel account.\n\nClick the link below to reset your password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: monospace; background: #0A0F1A; color: #E5E7EB; padding: 32px; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #C8A951; margin-top: 0;">HealthPanel — Password Reset</h2>
          <p>You requested a password reset for your HealthPanel account.</p>
          <p>Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
          <a href="${resetLink}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #C8A951; color: #0A0F1A; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset Password
          </a>
          <p style="color: #6B7280; font-size: 12px;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
          <p style="color: #6B7280; font-size: 12px; margin-bottom: 0;">SECURED ACCESS &mdash; UNAUTHORIZED USE PROHIBITED</p>
        </div>
      `,
    });

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: dto.token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (resetToken.usedAt !== null) {
      throw new BadRequestException('This reset link has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    resetToken.user.password = hashedPassword;
    await this.userRepository.save(resetToken.user);

    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    return { message: 'Password reset successfully' };
  }
}
