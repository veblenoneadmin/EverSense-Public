// Widget statistics API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
const router = express.Router();

// Tasks completed today endpoint
router.get('/tasks-completed-today', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const todayCount = await prisma.macroTask.count({
      where: {
        orgId,
        status: 'completed',
        completedAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });
    
    // Get yesterday's count for trend calculation
    const yesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
    
    const yesterdayCount = await prisma.macroTask.count({
      where: {
        orgId,
        status: 'completed',
        completedAt: {
          gte: yesterday,
          lt: yesterdayEnd
        }
      }
    });
    
    const trendPercentage = yesterdayCount > 0 
      ? ((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(1)
      : 0;
    
    const trendDirection = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'neutral';
    
    res.json({
      count: todayCount,
      trend: {
        percentage: Math.abs(trendPercentage),
        direction: trendDirection
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch task statistics');
  }
});

// Time tracked today endpoint
router.get('/time-today', requireAuth, async (req, res) => {
  try {
    const { orgId, userId } = req.query;
    
    if (!orgId || !userId) {
      return res.status(400).json({ error: 'orgId and userId are required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const result = await prisma.timeLog.aggregate({
      where: {
        userId,
        orgId,
        begin: {
          gte: startOfDay,
          lt: endOfDay
        },
        end: { not: null } // Only completed entries
      },
      _sum: {
        duration: true
      }
    });
    
    const todaySeconds = result._sum.duration || 0;
    
    // Get yesterday's time for trend
    const yesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
    
    const yesterdayResult = await prisma.timeLog.aggregate({
      where: {
        userId,
        orgId,
        begin: {
          gte: yesterday,
          lt: yesterdayEnd
        },
        end: { not: null }
      },
      _sum: {
        duration: true
      }
    });
    
    const yesterdaySeconds = yesterdayResult._sum.duration || 0;
    
    const trendPercentage = yesterdaySeconds > 0 
      ? ((todaySeconds - yesterdaySeconds) / yesterdaySeconds * 100).toFixed(1)
      : 0;
    
    const trendDirection = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'neutral';
    
    res.json({
      seconds: todaySeconds,
      trend: {
        percentage: Math.abs(trendPercentage),
        direction: trendDirection
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch time statistics');
  }
});

// Active projects count endpoint
router.get('/active-projects', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    // Count active projects (excluding completed and cancelled)
    const activeCount = await prisma.project.count({
      where: {
        orgId,
        status: {
          in: ['active', 'planning', 'on_hold']
        }
      }
    });
    
    // Count projects with deadlines this week
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const dueSoon = await prisma.project.count({
      where: {
        orgId,
        status: {
          in: ['active', 'planning', 'on_hold']
        },
        endDate: {
          gte: today,
          lte: weekFromNow
        }
      }
    });
    
    res.json({
      count: activeCount,
      dueSoon: dueSoon,
      label: `${dueSoon} due this week`
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch project statistics');
  }
});

// Team members count endpoint
router.get('/team-members', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const memberCount = await prisma.membership.count({
      where: {
        orgId
      }
    });
    
    // Count members who have been active today (created time logs)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const activeToday = await prisma.timeLog.findMany({
      where: {
        orgId,
        begin: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });
    
    res.json({
      count: memberCount,
      activeToday: activeToday.length,
      label: `${activeToday.length} active today`
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch member statistics');
  }
});


// Productivity score endpoint
router.get('/productivity', requireAuth, async (req, res) => {
  try {
    const { orgId, userId } = req.query;
    
    if (!orgId || !userId) {
      return res.status(400).json({ error: 'orgId and userId are required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    // Get current week boundaries
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get tasks completed this week
    const completedTasks = await prisma.macroTask.count({
      where: {
        userId,
        orgId,
        status: 'completed',
        completedAt: {
          gte: startOfWeek
        }
      }
    });
    
    // Get total tasks assigned this week (or updated)
    const totalTasks = await prisma.macroTask.count({
      where: {
        userId,
        orgId,
        updatedAt: {
          gte: startOfWeek
        }
      }
    });
    
    // Calculate simple productivity score
    const score = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Get last week's score for trend
    const lastWeekStart = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(startOfWeek.getTime());
    
    const lastWeekCompleted = await prisma.macroTask.count({
      where: {
        userId,
        orgId,
        status: 'completed',
        completedAt: {
          gte: lastWeekStart,
          lt: lastWeekEnd
        }
      }
    });
    
    const lastWeekTotal = await prisma.macroTask.count({
      where: {
        userId,
        orgId,
        updatedAt: {
          gte: lastWeekStart,
          lt: lastWeekEnd
        }
      }
    });
    
    const lastWeekScore = lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;
    
    const trendPercentage = lastWeekScore > 0 ? ((score - lastWeekScore) / lastWeekScore * 100).toFixed(1) : 0;
    const trendDirection = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'neutral';
    
    res.json({
      score: score,
      trend: {
        percentage: Math.abs(trendPercentage),
        direction: trendDirection
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch productivity statistics');
  }
});

// Overdue tasks endpoint
router.get('/overdue-tasks', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const now = new Date();
    
    const overdueCount = await prisma.macroTask.count({
      where: {
        orgId,
        status: {
          not: 'completed'
        },
        dueDate: {
          lt: now
        }
      }
    });
    
    const priority = overdueCount > 5 ? 'high' : overdueCount > 2 ? 'medium' : 'low';
    
    res.json({
      count: overdueCount,
      priority: priority,
      label: overdueCount === 0 ? 'All caught up!' : `${overdueCount} overdue`
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch overdue task statistics');
  }
});

export default router;