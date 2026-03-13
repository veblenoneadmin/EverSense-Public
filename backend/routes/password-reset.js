// Password reset routes
import express from 'express';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { transporter } from '../lib/mailer.js';

const router = express.Router();

// Request password reset
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal whether user exists or not for security
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, you will receive a password reset email.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token in verification table
    await prisma.verification.create({
      data: {
        identifier: email.toLowerCase(),
        value: resetToken,
        expiresAt: resetTokenExpiry
      }
    });

    // Check SMTP is configured
    if (!process.env.SMTP_HOST) {
      console.error('❌ SMTP_HOST not configured — cannot send reset email');
      return res.status(500).json({ success: false, message: 'Email service is not configured. Please contact your administrator.' });
    }

    // Send reset email
    const appUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'https://eversense-ai.up.railway.app';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    const fromAddr = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim().replace(/^["']|["']$/g, '');

    console.log(`📧 Sending reset email to ${email} from ${fromAddr}, url: ${resetUrl}`);

    await transporter.sendMail({
      from: fromAddr,
      to: email,
      subject: 'Reset your EverSense AI password',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;background:#f8fafc;" role="presentation"><tr><td align="center" style="padding:40px 20px;">
    <table style="width:100%;max-width:600px;background:#fff;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" role="presentation">
      <tr><td style="padding:40px 40px 20px;text-align:center;border-bottom:1px solid #e2e8f0;">
        <h1 style="margin:0;color:#1e293b;font-size:24px;font-weight:600;">Password Reset Request</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.6;">Hi ${user.name || 'there'},</p>
        <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.6;">We received a request to reset your EverSense AI password. If you didn't make this request, you can safely ignore this email.</p>
        <div style="text-align:center;margin:40px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#007acc;color:#fff;padding:16px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">Reset Password</a>
        </div>
        <p style="margin:20px 0;color:#64748b;font-size:14px;">If the button doesn't work, copy this link:</p>
        <p style="margin:0 0 20px;color:#007acc;font-size:14px;word-break:break-all;">${resetUrl}</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;">
          <p style="margin:0;color:#92400e;font-size:14px;"><strong>Security Notice:</strong> This link expires in 15 minutes.</p>
        </div>
      </td></tr>
      <tr><td style="padding:20px 40px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">EverSense AI — Secure Task Management</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });

    console.log(`✅ Password reset email sent to ${email}`);

    res.json({
      success: true,
      message: 'If an account with that email exists, you will receive a password reset email.'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: error.message?.includes('SMTP') || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')
        ? 'Failed to send email. Please contact your administrator.'
        : 'An error occurred. Please try again.',
    });
  }
});

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token is required' 
      });
    }

    // Check if token exists and is not expired
    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Token is valid' 
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

// Confirm password reset
router.post('/reset-password/confirm', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Find and verify token
    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    // Find user by email from verification
    const user = await prisma.user.findUnique({
      where: { email: verification.identifier }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Hash new password using Better Auth's own hashing (scrypt-based)
    const hashedPassword = await hashPassword(password);

    // Debug: log what accounts exist for this user
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, providerId: true, accountId: true },
    });
    console.log(`🔍 Accounts for user ${user.email}:`, JSON.stringify(accounts));

    // Update password — try all credential-type accounts
    const updated = await prisma.account.updateMany({
      where: {
        userId: user.id,
        providerId: { in: ['credential', 'email-password', 'email'] },
      },
      data: { password: hashedPassword },
    });
    console.log(`🔐 Updated ${updated.count} account(s) with new password`);

    // Delete used verification token
    await prisma.verification.delete({
      where: { id: verification.id }
    });

    console.log(`✅ Password reset successful for user ${user.email}`);

    res.json({ 
      success: true, 
      message: 'Password has been successfully reset' 
    });

  } catch (error) {
    console.error('Password reset confirmation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

export default router;