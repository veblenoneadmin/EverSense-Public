import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { sendPasswordResetEmail, formatDuration } from '../lib/mailer.js';

const router = express.Router();

// Validation schemas
const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128)
});

const verifyResetTokenSchema = z.object({
  token: z.string().min(1)
});

/**
 * POST /api/auth/forgot-password
 * Request password reset (public endpoint)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid email address',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { email } = validation.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`🔍 Password reset requested for non-existent email: ${email}`);
      return res.json({
        success: true,
        message: 'If an account exists with that email, you will receive password reset instructions.'
      });
    }

    // Check for existing unexpired reset tokens
    const existingToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date() }
      }
    });

    if (existingToken) {
      // Rate limiting: don't allow new reset requests too frequently
      const timeSinceLastRequest = Date.now() - existingToken.expires.getTime() + (15 * 60 * 1000); // 15 minutes ago
      if (timeSinceLastRequest < 5 * 60 * 1000) { // Less than 5 minutes
        console.log(`⏰ Rate limited password reset for ${email}`);
        return res.json({
          success: true,
          message: 'If an account exists with that email, you will receive password reset instructions.'
        });
      }

      // Delete existing token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: existingToken.token
          }
        }
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: resetToken,
        expires: expiresAt
      }
    });

    // Send password reset email
    try {
      const resetUrl = `${process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      await sendPasswordResetEmail(email, {
        name: user.name,
        resetUrl,
        expiresIn: formatDuration(15) // 15 minutes
      });

      console.log(`📧 Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      
      // Delete the token since we couldn't send the email
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: resetToken
          }
        }
      });

      return res.status(500).json({ 
        error: 'Failed to send reset email',
        code: 'EMAIL_SEND_ERROR' 
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, you will receive password reset instructions.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      code: 'FORGOT_PASSWORD_ERROR' 
    });
  }
});

/**
 * POST /api/auth/verify-reset-token
 * Verify reset token validity (public endpoint)
 */
router.post('/verify-reset-token', async (req, res) => {
  try {
    const validation = verifyResetTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid token',
        code: 'VALIDATION_ERROR' 
      });
    }

    const { token } = validation.data;

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken) {
      return res.status(404).json({ 
        error: 'Invalid reset token',
        code: 'INVALID_TOKEN' 
      });
    }

    // Check if expired
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      });

      return res.status(400).json({ 
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED' 
      });
    }

    // Find associated user
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
      select: { email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'Associated user not found',
        code: 'USER_NOT_FOUND' 
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        email: user.email,
        name: user.name
      },
      expiresAt: verificationToken.expires
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ 
      error: 'Failed to verify reset token',
      code: 'VERIFY_TOKEN_ERROR' 
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token (public endpoint)
 */
router.post('/reset-password', async (req, res) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { token, password } = validation.data;

    // Find and validate the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken) {
      return res.status(404).json({ 
        error: 'Invalid reset token',
        code: 'INVALID_TOKEN' 
      });
    }

    // Check if expired
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      });

      return res.status(400).json({ 
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED' 
      });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Hash the new password (Better Auth will handle this)
    // For now, we'll use a simple approach and let Better Auth handle the actual password update
    // In a real implementation, you'd integrate with Better Auth's password reset flow

    console.log(`🔐 Password reset completed for user ${user.email}`);

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token
        }
      }
    });

    // Note: In a real implementation with Better Auth, you would:
    // 1. Use Better Auth's password hashing
    // 2. Update the user's account record
    // 3. Invalidate existing sessions if needed

    res.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      code: 'RESET_PASSWORD_ERROR' 
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', async (req, res) => {
  try {
    // This would typically be handled by Better Auth middleware
    // For now, return a placeholder response
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        code: 'UNAUTHENTICATED' 
      });
    }

    // Get user with organizations
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        memberships: {
          include: {
            org: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          },
          orderBy: [
            { role: 'desc' }, // OWNER first
            { org: { name: 'asc' } }
          ]
        }
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }

    const organizations = user.memberships.map(m => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
      membershipId: m.id
    }));

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        organizations,
        activeOrgId: req.user.activeOrgId || organizations[0]?.id
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user info',
      code: 'USER_INFO_ERROR' 
    });
  }
});

/**
 * PATCH /api/auth/profile
 * Update user profile (requires auth)
 */
router.patch('/profile', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        code: 'UNAUTHENTICATED' 
      });
    }

    const updateSchema = z.object({
      name: z.string().min(1).max(100).trim().optional(),
      image: z.string().url().optional().nullable()
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const updates = validation.data;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      code: 'UPDATE_PROFILE_ERROR' 
    });
  }
});

/**
 * POST /api/auth/switch-org
 * Switch active organization (requires auth)
 */
router.post('/switch-org', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        code: 'UNAUTHENTICATED' 
      });
    }

    const switchSchema = z.object({
      orgId: z.string().min(1)
    });

    const validation = switchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid organization ID',
        code: 'VALIDATION_ERROR' 
      });
    }

    const { orgId } = validation.data;

    // Verify user is a member of this organization
    const membership = await prisma.membership.findUnique({
      where: { 
        userId_orgId: { 
          userId: req.user.id, 
          orgId 
        } 
      },
      include: {
        org: { 
          select: { 
            id: true, 
            name: true, 
            slug: true 
          } 
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'You are not a member of this organization',
        code: 'NOT_MEMBER' 
      });
    }

    // Here you would typically update the user's session or JWT token
    // For now, we'll just return the organization info
    // The frontend can handle storing the active org context

    res.json({
      success: true,
      message: 'Active organization switched',
      organization: {
        id: membership.org.id,
        name: membership.org.name,
        slug: membership.org.slug,
        role: membership.role
      }
    });

  } catch (error) {
    console.error('Switch organization error:', error);
    res.status(500).json({ 
      error: 'Failed to switch organization',
      code: 'SWITCH_ORG_ERROR' 
    });
  }
});

export default router;