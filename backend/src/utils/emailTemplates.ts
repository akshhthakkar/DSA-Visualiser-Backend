import { env } from '../config/env.js';

export function getVerificationEmailTemplate(
  name: string,
  token: string
): { subject: string; html: string } {
  const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  return {
    subject: 'Welcome to DSA Visualizer - Please verify your email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #2c3e50;">Hello ${name},</h2>
        <p style="color: #34495e; font-size: 16px;">
          Welcome to DSA Visualizer. To get started, please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #7f8c8d; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${verificationLink}" style="color: #3498db;">${verificationLink}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="color: #95a5a6; font-size: 12px; text-align: center;">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  };
}

export function getPasswordResetTemplate(
  name: string,
  token: string
): { subject: string; html: string } {
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    subject: 'DSA Visualizer - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #2c3e50;">Hello ${name},</h2>
        <p style="color: #34495e; font-size: 16px;">
          We received a request to reset your password for your DSA Visualizer account.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #7f8c8d; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${resetLink}" style="color: #e74c3c;">${resetLink}</a>
        </p>
        <p style="color: #7f8c8d; font-size: 14px;">This link will expire in 1 hour.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="color: #95a5a6; font-size: 12px; text-align: center;">
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>
    `,
  };
}
