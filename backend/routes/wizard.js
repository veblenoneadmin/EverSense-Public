import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/rbac.js';
import { prisma } from '../lib/prisma.js';
import { 
  WIZARD_STEPS, 
  hasCompletedWizardStep, 
  markWizardStepCompleted, 
  getNextWizardStep,
  userNeedsOnboarding,
  getOnboardingProgress,
  getCompletedWizardSteps,
  resetWizardProgress
} from '../lib/wizard.js';

const router = express.Router();

// Validation schemas
const markStepSchema = z.object({
  step: z.enum(WIZARD_STEPS)
});

/**
 * GET /api/wizard/status
 * Get current wizard/onboarding status for user
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Only OWNER-role users go through onboarding
    const ownerMembership = await prisma.membership.findFirst({
      where: { userId, role: 'OWNER' },
      select: { orgId: true },
    });

    if (!ownerMembership) {
      return res.json({
        success: true,
        data: {
          needsOnboarding: false,
          progress: 100,
          completedSteps: WIZARD_STEPS,
          nextStep: null,
          totalSteps: WIZARD_STEPS.length,
          allSteps: WIZARD_STEPS,
        },
      });
    }

    const [needsOnboarding, progress, completedSteps, nextStep] = await Promise.all([
      userNeedsOnboarding(userId),
      getOnboardingProgress(userId),
      getCompletedWizardSteps(userId),
      getNextWizardStep(userId)
    ]);

    res.json({
      success: true,
      data: {
        needsOnboarding,
        progress,
        completedSteps,
        nextStep,
        totalSteps: WIZARD_STEPS.length,
        allSteps: WIZARD_STEPS
      }
    });
  } catch (error) {
    console.error('Get wizard status error:', error);
    res.status(500).json({ 
      error: 'Failed to get wizard status',
      code: 'WIZARD_STATUS_ERROR' 
    });
  }
});

/**
 * POST /api/wizard/complete-step
 * Mark a wizard step as completed
 */
router.post('/complete-step', requireAuth, async (req, res) => {
  try {
    const validation = markStepSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid step name',
        details: validation.error.issues,
        code: 'VALIDATION_ERROR'
      });
    }

    const { step } = validation.data;
    const userId = req.user.id;

    // Check if step is already completed
    const alreadyCompleted = await hasCompletedWizardStep(userId, step);
    if (alreadyCompleted) {
      return res.json({
        success: true,
        message: 'Step already completed',
        data: { step, alreadyCompleted: true }
      });
    }

    // Mark step as completed
    const success = await markWizardStepCompleted(userId, step);
    if (!success) {
      throw new Error('Failed to mark step as completed');
    }

    // Get updated status
    const [progress, nextStep, needsOnboarding] = await Promise.all([
      getOnboardingProgress(userId),
      getNextWizardStep(userId),
      userNeedsOnboarding(userId)
    ]);

    res.json({
      success: true,
      message: 'Wizard step completed successfully',
      data: {
        completedStep: step,
        progress,
        nextStep,
        needsOnboarding,
        onboardingComplete: !needsOnboarding
      }
    });

  } catch (error) {
    console.error('Complete wizard step error:', error);
    res.status(500).json({ 
      error: 'Failed to complete wizard step',
      code: 'WIZARD_COMPLETE_ERROR' 
    });
  }
});

/**
 * GET /api/wizard/step/:step
 * Check if a specific wizard step is completed
 */
router.get('/step/:step', requireAuth, async (req, res) => {
  try {
    const { step } = req.params;
    
    if (!WIZARD_STEPS.includes(step)) {
      return res.status(400).json({
        error: 'Invalid wizard step',
        validSteps: WIZARD_STEPS,
        code: 'INVALID_STEP'
      });
    }

    const userId = req.user.id;
    const completed = await hasCompletedWizardStep(userId, step);

    res.json({
      success: true,
      data: {
        step,
        completed,
        stepIndex: WIZARD_STEPS.indexOf(step),
        totalSteps: WIZARD_STEPS.length
      }
    });
  } catch (error) {
    console.error('Get wizard step error:', error);
    res.status(500).json({ 
      error: 'Failed to get wizard step status',
      code: 'WIZARD_STEP_ERROR' 
    });
  }
});

/**
 * POST /api/wizard/reset
 * Reset wizard progress (for development/testing)
 */
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const success = await resetWizardProgress(userId);

    if (!success) {
      throw new Error('Failed to reset wizard progress');
    }

    res.json({
      success: true,
      message: 'Wizard progress reset successfully',
      data: {
        resetUserId: userId,
        allSteps: WIZARD_STEPS
      }
    });
  } catch (error) {
    console.error('Reset wizard error:', error);
    res.status(500).json({ 
      error: 'Failed to reset wizard progress',
      code: 'WIZARD_RESET_ERROR' 
    });
  }
});

/**
 * POST /api/wizard/save-profile
 * Save personal info: name, jobTitle, phone
 */
router.post('/save-profile', requireAuth, async (req, res) => {
  try {
    const { name, jobTitle, phone } = req.body;
    const userId = req.user.id;

    const fields = [];
    const values = [];
    if (name?.trim())           { fields.push('`name` = ?');     values.push(name.trim()); }
    if (jobTitle !== undefined) { fields.push('`jobTitle` = ?'); values.push(jobTitle ?? ''); }
    if (phone !== undefined)    { fields.push('`phone` = ?');    values.push(phone ?? ''); }

    if (fields.length > 0) {
      values.push(userId);
      await prisma.$executeRawUnsafe(
        `UPDATE \`user\` SET ${fields.join(', ')} WHERE id = ?`,
        ...values
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/**
 * POST /api/wizard/save-company
 * Save company info: companyName, industry, size, website
 */
router.post('/save-company', requireAuth, async (req, res) => {
  try {
    const { companyName, industry, size, website } = req.body;
    const userId = req.user.id;

    // Find the user's owner/admin org
    const membership = await prisma.membership.findFirst({
      where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
      orderBy: { createdAt: 'asc' },
      select: { orgId: true },
    });

    if (!membership) {
      return res.json({ success: true, skipped: true });
    }

    const orgId = membership.orgId;
    const fields = [];
    const values = [];
    if (companyName?.trim())  { fields.push('`name` = ?');     values.push(companyName.trim()); }
    if (industry !== undefined) { fields.push('`industry` = ?'); values.push(industry ?? ''); }
    if (size !== undefined)     { fields.push('`size` = ?');     values.push(size ?? ''); }
    if (website !== undefined)  { fields.push('`website` = ?');  values.push(website ?? ''); }

    if (fields.length > 0) {
      values.push(orgId);
      await prisma.$executeRawUnsafe(
        `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
        ...values
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save company error:', error);
    res.status(500).json({ error: 'Failed to save company info' });
  }
});

/**
 * POST /api/wizard/save-theme
 * Save org theme preference: 'dark' or 'light'
 */
router.post('/save-theme', requireAuth, async (req, res) => {
  try {
    const { theme } = req.body;
    if (theme !== 'dark' && theme !== 'light') {
      return res.status(400).json({ error: 'Invalid theme. Must be "dark" or "light".' });
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: req.user.id, role: { in: ['OWNER', 'ADMIN'] } },
      orderBy: { createdAt: 'asc' },
      select: { orgId: true },
    });

    if (!membership) {
      return res.json({ success: true, skipped: true });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE organizations SET theme = ? WHERE id = ?`,
      theme, membership.orgId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save theme error:', error);
    res.status(500).json({ error: 'Failed to save theme' });
  }
});

export default router;