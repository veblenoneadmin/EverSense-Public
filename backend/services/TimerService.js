import { prisma } from '../lib/prisma.js';

/**
 * Timer Service - Based on Kimai's TimesheetService logic
 * Handles all timer operations: start, stop, pause, restart
 */
export class TimerService {
  
  /**
   * Get all active timers for a user
   */
  async getActiveTimers(userId, orgId = null) {
    const where = {
      userId,
      end: null, // Active timers have no end time
    };
    
    if (orgId) {
      where.orgId = orgId;
    }

    return await prisma.timeLog.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        begin: 'desc'
      }
    });
  }

  /**
   * Start a new timer
   * Automatically stops other running timers for the user (Kimai behavior)
   */
  async startTimer(userId, orgId, data) {
    const { taskId, description, category = 'work', timezone = 'UTC' } = data;

    // Use transaction to ensure consistency
    return await prisma.$transaction(async (tx) => {
      // First, stop all active timers for this user (Kimai behavior)
      await this.stopActiveTimers(userId, orgId, tx);

      // Create new timer
      const timer = await tx.timeLog.create({
        data: {
          userId,
          orgId,
          taskId,
          description,
          category,
          timezone,
          begin: new Date(),
          // end: null (default - indicates active timer)
          // duration: 0 (default - calculated when stopped)
        },
        include: {
          task: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      return timer;
    });
  }

  /**
   * Stop a specific timer
   */
  async stopTimer(timerId, userId) {
    const timer = await prisma.timeLog.findFirst({
      where: {
        id: timerId,
        userId,
        end: null // Only active timers can be stopped
      }
    });

    if (!timer) {
      throw new Error('Timer not found or already stopped');
    }

    // Calculate duration
    const now = new Date();
    const durationMs = now.getTime() - timer.begin.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);

    // Update timer with end time and duration
    return await prisma.timeLog.update({
      where: { id: timerId },
      data: {
        end: now,
        duration: durationSeconds,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
  }

  /**
   * Stop all active timers for a user (internal method)
   */
  async stopActiveTimers(userId, orgId = null, tx = null) {
    const prismaClient = tx || prisma;
    const now = new Date();
    
    const where = {
      userId,
      end: null
    };
    
    if (orgId) {
      where.orgId = orgId;
    }

    // Find all active timers
    const activeTimers = await prismaClient.timeLog.findMany({
      where
    });

    // Stop each one
    for (const timer of activeTimers) {
      const durationMs = now.getTime() - timer.begin.getTime();
      const durationSeconds = Math.floor(durationMs / 1000);

      await prismaClient.timeLog.update({
        where: { id: timer.id },
        data: {
          end: now,
          duration: durationSeconds,
        }
      });
    }

    return activeTimers.length;
  }

  /**
   * Restart a timer (create new one based on existing)
   */
  async restartTimer(existingTimerId, userId, orgId) {
    const existingTimer = await prisma.timeLog.findFirst({
      where: {
        id: existingTimerId,
        userId
      }
    });

    if (!existingTimer) {
      throw new Error('Timer not found');
    }

    // Start new timer with same configuration
    return await this.startTimer(userId, orgId, {
      taskId: existingTimer.taskId,
      description: existingTimer.description,
      category: existingTimer.category,
      timezone: existingTimer.timezone
    });
  }

  /**
   * Get timer statistics for dashboard
   */
  async getTimerStats(userId, orgId = null) {
    const where = { userId };
    if (orgId) where.orgId = orgId;

    // Active timers
    const activeCount = await prisma.timeLog.count({
      where: { ...where, end: null }
    });

    // Today's total time
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayEntries = await prisma.timeLog.findMany({
      where: {
        ...where,
        begin: {
          gte: startOfDay,
          lt: endOfDay
        },
        end: { not: null } // Only completed entries
      },
      select: {
        duration: true
      }
    });

    const todayTotalSeconds = todayEntries.reduce((sum, entry) => sum + entry.duration, 0);

    // This week's total
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekEntries = await prisma.timeLog.findMany({
      where: {
        ...where,
        begin: { gte: startOfWeek },
        end: { not: null }
      },
      select: {
        duration: true
      }
    });

    const weekTotalSeconds = weekEntries.reduce((sum, entry) => sum + entry.duration, 0);

    return {
      activeTimers: activeCount,
      todayTotalSeconds,
      weekTotalSeconds,
      todayFormatted: this.formatDuration(todayTotalSeconds),
      weekFormatted: this.formatDuration(weekTotalSeconds)
    };
  }

  /**
   * Format duration in seconds to human readable format
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get recent time entries for a user
   */
  async getRecentEntries(userId, orgId = null, limit = 10) {
    const where = { userId };
    if (orgId) where.orgId = orgId;

    return await prisma.timeLog.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        begin: 'desc'
      },
      take: limit
    });
  }

  /**
   * Update timer details (description, category, etc.)
   */
  async updateTimer(timerId, userId, updates) {
    const timer = await prisma.timeLog.findFirst({
      where: {
        id: timerId,
        userId
      }
    });

    if (!timer) {
      throw new Error('Timer not found');
    }

    return await prisma.timeLog.update({
      where: { id: timerId },
      data: updates,
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
  }

  /**
   * Delete a time entry
   */
  async deleteTimer(timerId, userId) {
    const timer = await prisma.timeLog.findFirst({
      where: {
        id: timerId,
        userId
      }
    });

    if (!timer) {
      throw new Error('Timer not found');
    }

    await prisma.timeLog.delete({
      where: { id: timerId }
    });

    return { success: true, deletedTimer: timer };
  }
}

export const timerService = new TimerService();