// src/services/email.service.ts
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using Brevo SMTP.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Mass send emails sequentially or in small parallel batches.
 */
export async function sendBulkEmails(emails: SendEmailOptions[]) {
  const results = [];
  // Since this is a simple implementation, we loop through and send to avoid rate limits
  // depending on Brevo's limits, it might be better to send them completely sequentially
  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ success: true, to: email.to, id: result.messageId });
    } catch (error: any) {
      results.push({ success: false, to: email.to, error: error.message });
    }
  }
  return results;
}
