import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';

const router = express.Router();

/**
 * GET /api/onboarding/status
 * Check if user needs onboarding
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has completed onboarding
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user) {
      return res.json({ needsOnboarding: true });
    }

    // CLIENT users are added by an admin — they should skip the onboarding wizard
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { role: true },
    });
    const isClientOnly = memberships.length > 0 && memberships.every(m => m.role === 'CLIENT');
    if (isClientOnly) {
      return res.json({ needsOnboarding: false, completedSteps: [], requiredSteps: [] });
    }

    const completedSteps = user.completedWizards ? user.completedWizards.split(',').filter(Boolean) : [];
    const requiredSteps = ['welcome', 'profile'];

    // Check if all required steps are completed
    const allStepsCompleted = requiredSteps.every(step => completedSteps.includes(step));

    res.json({
      needsOnboarding: !allStepsCompleted,
      completedSteps,
      requiredSteps
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // Default to requiring onboarding if there's an error
    res.json({ needsOnboarding: true });
  }
});

export default router;