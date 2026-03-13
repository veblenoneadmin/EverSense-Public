import { prisma } from './prisma.js';

/**
 * Available wizard steps in order
 */
export const WIZARD_STEPS = ['welcome', 'profile'];

/**
 * Check if user has completed a specific wizard step
 * @param {string} userId - User ID
 * @param {string} step - Wizard step to check
 * @returns {Promise<boolean>} - Whether the step is completed
 */
export async function hasCompletedWizardStep(userId, step) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user || !user.completedWizards) {
      return false;
    }

    const completedSteps = user.completedWizards.split(',').filter(Boolean);
    return completedSteps.includes(step);
  } catch (error) {
    console.error('Error checking wizard step:', error);
    return false;
  }
}

/**
 * Mark a wizard step as completed for a user
 * @param {string} userId - User ID
 * @param {string} step - Wizard step to mark as completed
 * @returns {Promise<boolean>} - Success status
 */
export async function markWizardStepCompleted(userId, step) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let completedSteps = [];
    if (user.completedWizards) {
      completedSteps = user.completedWizards.split(',').filter(Boolean);
    }

    // Don't add duplicates
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        completedWizards: completedSteps.join(',')
      }
    });

    return true;
  } catch (error) {
    console.error('Error marking wizard step completed:', error);
    return false;
  }
}

/**
 * Get the next wizard step that needs to be completed
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - Next step name or null if all completed
 */
export async function getNextWizardStep(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user) {
      return WIZARD_STEPS[0]; // Start from beginning if user not found
    }

    const completedSteps = user.completedWizards 
      ? user.completedWizards.split(',').filter(Boolean)
      : [];

    // Find first incomplete step
    for (const step of WIZARD_STEPS) {
      if (!completedSteps.includes(step)) {
        return step;
      }
    }

    // All steps completed
    return null;
  } catch (error) {
    console.error('Error getting next wizard step:', error);
    return WIZARD_STEPS[0]; // Default to first step on error
  }
}

/**
 * Check if user needs onboarding (has incomplete wizard steps)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether user needs onboarding
 */
export async function userNeedsOnboarding(userId) {
  try {
    const nextStep = await getNextWizardStep(userId);
    return nextStep !== null;
  } catch (error) {
    console.error('Error checking if user needs onboarding:', error);
    return true; // Default to requiring onboarding on error
  }
}

/**
 * Get onboarding progress percentage
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Progress percentage (0-100)
 */
export async function getOnboardingProgress(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user || !user.completedWizards) {
      return 0;
    }

    const completedSteps = user.completedWizards.split(',').filter(Boolean);
    return Math.round((completedSteps.length / WIZARD_STEPS.length) * 100);
  } catch (error) {
    console.error('Error getting onboarding progress:', error);
    return 0;
  }
}

/**
 * Get all completed wizard steps for a user
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} - Array of completed step names
 */
export async function getCompletedWizardSteps(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { completedWizards: true }
    });

    if (!user || !user.completedWizards) {
      return [];
    }

    return user.completedWizards.split(',').filter(Boolean);
  } catch (error) {
    console.error('Error getting completed wizard steps:', error);
    return [];
  }
}

/**
 * Reset user's wizard progress (for testing/admin purposes)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
export async function resetWizardProgress(userId) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        completedWizards: null
      }
    });

    return true;
  } catch (error) {
    console.error('Error resetting wizard progress:', error);
    return false;
  }
}