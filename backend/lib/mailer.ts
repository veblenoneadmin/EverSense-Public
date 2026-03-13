import nodemailer from 'nodemailer';
import { Role } from '@prisma/client';

// Configure SMTP transporter
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
  // Additional options for better deliverability
  tls: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
if (process.env.SMTP_HOST) {
  transporter.verify((error: any) => {
    if (error) {
      console.error('❌ SMTP configuration error:', error);
    } else {
      console.log('✅ SMTP server ready');
    }
  });
}

// Email template interfaces
interface InviteEmailData {
  orgName: string;
  role: Role;
  invitedBy: string;
  acceptUrl: string;
  expiresIn: string;
}

interface PasswordResetData {
  name?: string;
  resetUrl: string;
  expiresIn: string;
}

interface WelcomeEmailData {
  name?: string;
  orgName: string;
  role: Role;
  dashboardUrl: string;
}

/**
 * HTML template for organization invite emails
 */
export function inviteEmailHtml(data: InviteEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${data.orgName} on VebTask</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .btn { display: inline-block; background: #667eea; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .btn:hover { background: #5a67d8; }
        .role-badge { display: inline-block; background: #e2e8f0; color: #4a5568; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #718096; font-size: 14px; }
        .logo { font-size: 24px; font-weight: 700; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">VebTask</div>
            <h1>You're invited to join ${data.orgName}</h1>
        </div>
        <div class="content">
            <p>Hi there! 👋</p>
            
            <p><strong>${data.invitedBy}</strong> has invited you to join <strong>${data.orgName}</strong> on VebTask as a <span class="role-badge">${data.role}</span>.</p>
            
            <p>VebTask is a powerful productivity platform that helps teams manage tasks, track time, and collaborate effectively with AI-powered workflow optimization.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.acceptUrl}" class="btn">Accept Invitation</a>
            </div>
            
            <p><strong>What you'll get:</strong></p>
            <ul>
                <li>🤖 AI-powered task management and brain dump processing</li>
                <li>⏰ Smart time tracking with billable hour management</li>
                <li>📅 Intelligent calendar scheduling</li>
                <li>📊 Real-time productivity analytics</li>
                <li>👥 Team collaboration tools</li>
            </ul>
            
            <p style="color: #e53e3e; background: #fed7d7; padding: 12px; border-radius: 6px; margin: 20px 0;">
                ⚠️ This invitation will expire in ${data.expiresIn}.
            </p>
            
            <p>If you have any questions, please reply to this email or contact your administrator.</p>
            
            <p>Welcome to the team! 🚀</p>
        </div>
        <div class="footer">
            <p>This invitation was sent by ${data.invitedBy} from ${data.orgName}.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Plain text template for organization invite emails
 */
export function inviteEmailText(data: InviteEmailData): string {
  return `
Join ${data.orgName} on VebTask

Hi there!

${data.invitedBy} has invited you to join ${data.orgName} on VebTask as a ${data.role}.

VebTask is a powerful productivity platform that helps teams manage tasks, track time, and collaborate effectively with AI-powered workflow optimization.

Accept your invitation: ${data.acceptUrl}

What you'll get:
- AI-powered task management and brain dump processing
- Smart time tracking with billable hour management
- Intelligent calendar scheduling  
- Real-time productivity analytics
- Team collaboration tools

⚠️ This invitation will expire in ${data.expiresIn}.

If you have any questions, please reply to this email or contact your administrator.

Welcome to the team!

---
This invitation was sent by ${data.invitedBy} from ${data.orgName}.
If you didn't expect this invitation, you can safely ignore this email.
`;
}

/**
 * HTML template for password reset emails
 */
export function passwordResetEmailHtml(data: PasswordResetData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your VebTask Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .btn { display: inline-block; background: #e53e3e; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .btn:hover { background: #c53030; }
        .footer { text-align: center; margin-top: 20px; color: #718096; font-size: 14px; }
        .logo { font-size: 24px; font-weight: 700; }
        .security-notice { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; padding: 12px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">VebTask</div>
            <h1>Reset Your Password</h1>
        </div>
        <div class="content">
            <p>Hi ${data.name || 'there'}! 👋</p>
            
            <p>We received a request to reset your VebTask password. If you made this request, click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.resetUrl}" class="btn">Reset Password</a>
            </div>
            
            <div class="security-notice">
                <p><strong>Security Notice:</strong></p>
                <ul>
                    <li>This link will expire in ${data.expiresIn}</li>
                    <li>The link can only be used once</li>
                    <li>If you didn't request this, you can safely ignore this email</li>
                </ul>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${data.resetUrl}</p>
            
            <p>For security reasons, we recommend:</p>
            <ul>
                <li>Using a strong, unique password</li>
                <li>Not sharing your password with others</li>
                <li>Logging out of shared devices</li>
            </ul>
        </div>
        <div class="footer">
            <p>If you have any concerns about your account security, please contact support immediately.</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * HTML template for welcome emails after joining organization
 */
export function welcomeEmailHtml(data: WelcomeEmailData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${data.orgName} on VebTask</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .btn { display: inline-block; background: #48bb78; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .btn:hover { background: #38a169; }
        .role-badge { display: inline-block; background: #e2e8f0; color: #4a5568; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #718096; font-size: 14px; }
        .logo { font-size: 24px; font-weight: 700; }
        .feature { background: #f7fafc; padding: 15px; border-radius: 6px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">VebTask</div>
            <h1>Welcome to ${data.orgName}! 🎉</h1>
        </div>
        <div class="content">
            <p>Hi ${data.name || 'there'}! 👋</p>
            
            <p>Congratulations! You've successfully joined <strong>${data.orgName}</strong> as a <span class="role-badge">${data.role}</span>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.dashboardUrl}" class="btn">Go to Dashboard</a>
            </div>
            
            <h2>🚀 Getting Started</h2>
            
            <div class="feature">
                <h3>🤖 AI Brain Dump</h3>
                <p>Transform chaotic thoughts into organized tasks with our AI-powered brain dump feature. Just speak or type your ideas!</p>
            </div>
            
            <div class="feature">
                <h3>⏱️ Smart Time Tracking</h3>
                <p>Track time efficiently with our built-in timer, automatic task association, and billable hour management.</p>
            </div>
            
            <div class="feature">
                <h3>📅 Intelligent Calendar</h3>
                <p>Let AI schedule your tasks at optimal times based on priority, energy levels, and your workflow patterns.</p>
            </div>
            
            <div class="feature">
                <h3>📊 Productivity Analytics</h3>
                <p>Get insights into your productivity patterns with real-time dashboards and detailed reports.</p>
            </div>
            
            <p><strong>Quick Tips:</strong></p>
            <ul>
                <li>Start with the Brain Dump feature to organize your thoughts</li>
                <li>Use the Timer to track your work sessions</li>
                <li>Check your Dashboard daily for productivity insights</li>
                <li>Explore the Calendar for AI-optimized scheduling</li>
            </ul>
            
            <p>Need help? Check out our documentation or reach out to your team administrator.</p>
            
            <p>Happy productivity! 🚀</p>
        </div>
        <div class="footer">
            <p>You're now part of ${data.orgName}. Let's build something amazing together!</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Send organization invite email
 */
export async function sendInviteEmail(
  to: string, 
  data: InviteEmailData
): Promise<void> {
  const subject = `Join ${data.orgName} on VebTask`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject,
    text: inviteEmailText(data),
    html: inviteEmailHtml(data)
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string, 
  data: PasswordResetData
): Promise<void> {
  const subject = 'Reset Your VebTask Password';
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject,
    html: passwordResetEmailHtml(data)
  });
}

/**
 * Send welcome email after user joins organization
 */
export async function sendWelcomeEmail(
  to: string, 
  data: WelcomeEmailData
): Promise<void> {
  const subject = `Welcome to ${data.orgName} on VebTask!`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject,
    html: welcomeEmailHtml(data)
  });
}

/**
 * Utility to format time duration for email templates
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
  return `${Math.floor(minutes / 1440)} days`;
}

/**
 * Test email configuration
 */
export async function testEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return false;
  }
}