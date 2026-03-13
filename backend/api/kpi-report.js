// KPI Intelligence Report API
// Add to: backend/api/kpi-report.js
// Register in server: app.use('/api/kpi-report', kpiReportRouter);

import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';

const router = express.Router();

/**
 * GET /api/kpi-report
 * Returns comprehensive KPI intelligence data including performer classifications
 * Query params:
 *   - orgId: string (required)
 *   - period: 'daily' | 'weekly' | 'monthly' (default: 'weekly')
 *   - date: ISO date string (default: now)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { orgId, period = 'weekly', date, start: customStart, end: customEnd } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    if (!(await checkDatabaseConnection(res))) return;

    let start, end, previousStart, previousEnd, label, expectedHoursOverride;
    if (customStart && customEnd) {
      start = new Date(customStart); start.setHours(0, 0, 0, 0);
      end = new Date(customEnd); end.setHours(23, 59, 59, 999);
      const spanMs = end - start;
      previousEnd = new Date(start.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - spanMs);
      const days = Math.max(1, Math.ceil(spanMs / (1000 * 60 * 60 * 24)));
      expectedHoursOverride = days * 8;
      label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      const refDate = date ? new Date(date) : new Date();
      ({ start, end, previousStart, previousEnd, label } = getDateRange(period, refDate));
    }

    // ─── Fetch all members in org ───────────────────────────────────────────
    const memberships = await prisma.membership.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } }
      }
    });

    const memberIds = memberships.map(m => m.userId);

    // ─── Fetch time logs for current & previous period ────────────────────
    const [currentLogs, previousLogs] = await Promise.all([
      prisma.timeLog.findMany({
        where: { orgId, userId: { in: memberIds }, begin: { gte: start, lte: end }, end: { not: null } },
        include: { task: { select: { id: true, title: true, projectId: true, estimatedHours: true, status: true } } }
      }),
      prisma.timeLog.findMany({
        where: { orgId, userId: { in: memberIds }, begin: { gte: previousStart, lte: previousEnd }, end: { not: null } }
      })
    ]);

    // ─── Fetch tasks ──────────────────────────────────────────────────────
    const [currentTasks, overdueTasks] = await Promise.all([
      prisma.macroTask.findMany({
        where: {
          orgId,
          userId: { in: memberIds },
          updatedAt: { gte: start, lte: end }
        }
      }),
      prisma.macroTask.findMany({
        where: {
          orgId,
          userId: { in: memberIds },
          status: { notIn: ['completed', 'cancelled'] },
          dueDate: { lt: new Date() }
        }
      })
    ]);

    // ─── Fetch projects ───────────────────────────────────────────────────
    const projects = await prisma.project.findMany({
      where: { orgId },
      include: {
        tasks: {
          where: { userId: { in: memberIds } },
          select: { userId: true, status: true, estimatedHours: true, actualHours: true }
        }
      }
    });

    // ─── Per-user aggregation ─────────────────────────────────────────────
    const userStats = memberships.map(({ user, role }) => {
      const userCurrentLogs = currentLogs.filter(l => l.userId === user.id);
      const userPreviousLogs = previousLogs.filter(l => l.userId === user.id);
      const userTasks = currentTasks.filter(t => t.userId === user.id);
      const userOverdue = overdueTasks.filter(t => t.userId === user.id);

      const currentHours = userCurrentLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600;
      const previousHours = userPreviousLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600;

      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const totalTasks = userTasks.length;
      const inProgressTasks = userTasks.filter(t => t.status === 'in_progress').length;

      // Estimation accuracy: compare actual vs estimated on completed tasks
      const completedWithEstimate = userTasks.filter(
        t => t.status === 'completed' && Number(t.estimatedHours) > 0
      );
      const estimationAccuracy = completedWithEstimate.length > 0
        ? completedWithEstimate.reduce((sum, t) => {
            const ratio = Math.min(Number(t.estimatedHours), Number(t.actualHours)) /
                          Math.max(Number(t.estimatedHours), Number(t.actualHours));
            return sum + ratio;
          }, 0) / completedWithEstimate.length * 100
        : null;

      // Billable ratio
      const billableLogs = userCurrentLogs.filter(l => l.isBillable);
      const billableHours = billableLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600;
      const billableRatio = currentHours > 0 ? (billableHours / currentHours) * 100 : 0;

      // Hourly trend
      const hoursTrend = previousHours > 0
        ? ((currentHours - previousHours) / previousHours) * 100
        : null;

      // Expected hours per period
      const expectedHours = expectedHoursOverride ?? (period === 'daily' ? 8 : period === 'weekly' ? 40 : 160);
      const utilizationRate = (currentHours / expectedHours) * 100;

      // Task completion rate
      const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        user,
        role,
        currentHours: Math.round(currentHours * 10) / 10,
        previousHours: Math.round(previousHours * 10) / 10,
        hoursTrend: hoursTrend !== null ? Math.round(hoursTrend) : null,
        utilizationRate: Math.round(utilizationRate),
        completedTasks,
        inProgressTasks,
        totalTasks,
        overdueTaskCount: userOverdue.length,
        taskCompletionRate: Math.round(taskCompletionRate),
        billableHours: Math.round(billableHours * 10) / 10,
        billableRatio: Math.round(billableRatio),
        estimationAccuracy: estimationAccuracy !== null ? Math.round(estimationAccuracy) : null,
        sessionCount: userCurrentLogs.length,
        avgSessionLength: userCurrentLogs.length > 0
          ? Math.round((currentHours / userCurrentLogs.length) * 10) / 10
          : 0,
        activeDays: new Set(userCurrentLogs.map(l => new Date(l.begin).toDateString())).size,
      };
    });

    // ─── Performer Classification ─────────────────────────────────────────
    // Only classify STAFF/ADMIN (not CLIENT role)
    const classifiableUsers = userStats.filter(u => u.role !== 'CLIENT');
    const avgHours = classifiableUsers.length > 0
      ? classifiableUsers.reduce((s, u) => s + u.currentHours, 0) / classifiableUsers.length
      : 0;
    const avgCompletionRate = classifiableUsers.length > 0
      ? classifiableUsers.reduce((s, u) => s + u.taskCompletionRate, 0) / classifiableUsers.length
      : 0;

    const classifiedUsers = userStats.map(u => {
      let classification = null;
      let classificationReason = '';

      if (u.role === 'CLIENT') {
        return { ...u, classification: 'client', classificationReason: 'Client account', score: null };
      }

      // Scoring algorithm
      const hoursScore = Math.min(100, u.utilizationRate); // 0-100
      const completionScore = u.taskCompletionRate; // 0-100
      const overdueScore = Math.max(0, 100 - u.overdueTaskCount * 10); // penalty per overdue
      const estimationScore = u.estimationAccuracy ?? 70; // default mid if no data
      const trendScore = u.hoursTrend !== null ? Math.min(120, 60 + u.hoursTrend) : 60;

      const compositeScore = (
        hoursScore * 0.30 +
        completionScore * 0.30 +
        overdueScore * 0.15 +
        estimationScore * 0.15 +
        trendScore * 0.10
      );

      // Classification logic
      if (u.currentHours === 0 && u.completedTasks === 0) {
        classification = 'inactive';
        classificationReason = 'No activity logged this period';
      } else if (compositeScore >= 80 && u.utilizationRate >= 90 && u.taskCompletionRate >= 75) {
        classification = 'star';
        classificationReason = `Exceptional performance — ${u.utilizationRate}% utilization, ${u.taskCompletionRate}% task completion`;
      } else if (u.utilizationRate >= 130 || u.currentHours > avgHours * 1.5) {
        classification = 'overworked';
        classificationReason = `Logged ${u.currentHours}h vs expected — risk of burnout`;
      } else if (compositeScore < 40 || (u.utilizationRate < 50 && u.taskCompletionRate < 40)) {
        classification = 'underperformer';
        classificationReason = `Below average on hours (${u.utilizationRate}% util.) and task completion (${u.taskCompletionRate}%)`;
      } else if (
        u.currentHours >= avgHours * 0.8 &&
        u.taskCompletionRate < avgCompletionRate * 0.6 &&
        u.overdueTaskCount > 2
      ) {
        classification = 'coaster';
        classificationReason = `Hours look fine but low output — ${u.overdueTaskCount} overdue tasks, ${u.taskCompletionRate}% completion`;
      } else {
        classification = 'solid';
        classificationReason = 'Performing within expected range';
      }

      return {
        ...u,
        classification,
        classificationReason,
        score: Math.round(compositeScore)
      };
    });

    // ─── Org-level KPIs ────────────────────────────────────────────────────
    const totalHours = currentLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600;
    const totalPreviousHours = previousLogs.reduce((s, l) => s + (l.duration || 0), 0) / 3600;
    const totalCompleted = currentTasks.filter(t => t.status === 'completed').length;
    const totalTasks = currentTasks.length;
    const totalOverdue = overdueTasks.length;
    const billableHoursTotal = currentLogs.filter(l => l.isBillable).reduce((s, l) => s + (l.duration || 0), 0) / 3600;

    // Project health
    const projectHealth = projects.map(p => {
      const budget = Number(p.budget) || 0;
      const spent = Number(p.spent) || 0;
      const budgetUsed = budget > 0 ? (spent / budget) * 100 : null;
      const hoursLogged = p.hoursLogged || 0;
      const estimatedHours = p.estimatedHours || 0;
      const hoursUsed = estimatedHours > 0 ? (hoursLogged / estimatedHours) * 100 : null;
      const isOverBudget = budget > 0 && spent > budget;
      const isOverTime = estimatedHours > 0 && hoursLogged > estimatedHours;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        color: p.color,
        budget,
        spent,
        budgetUsed: budgetUsed !== null ? Math.round(budgetUsed) : null,
        estimatedHours,
        hoursLogged,
        hoursUsed: hoursUsed !== null ? Math.round(hoursUsed) : null,
        progress: p.progress,
        isOverBudget,
        isOverTime,
        taskCount: p.tasks.length,
        completedTaskCount: p.tasks.filter(t => t.status === 'completed').length,
      };
    });

    // Classification breakdown counts
    const classificationCounts = {
      star: classifiedUsers.filter(u => u.classification === 'star').length,
      solid: classifiedUsers.filter(u => u.classification === 'solid').length,
      coaster: classifiedUsers.filter(u => u.classification === 'coaster').length,
      overworked: classifiedUsers.filter(u => u.classification === 'overworked').length,
      underperformer: classifiedUsers.filter(u => u.classification === 'underperformer').length,
      inactive: classifiedUsers.filter(u => u.classification === 'inactive').length,
    };

    res.json({
      success: true,
      period,
      label,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      orgKPIs: {
        totalHours: Math.round(totalHours * 10) / 10,
        previousHours: Math.round(totalPreviousHours * 10) / 10,
        hoursTrend: totalPreviousHours > 0
          ? Math.round(((totalHours - totalPreviousHours) / totalPreviousHours) * 100)
          : null,
        totalCompleted,
        totalTasks,
        totalOverdue,
        taskCompletionRate: totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0,
        billableHours: Math.round(billableHoursTotal * 10) / 10,
        billableRatio: totalHours > 0 ? Math.round((billableHoursTotal / totalHours) * 100) : 0,
        activeMembers: classifiedUsers.filter(u => u.currentHours > 0).length,
        totalMembers: memberships.length,
        classificationCounts,
      },
      users: classifiedUsers,
      projectHealth,
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch KPI report');
  }
});

// ─── Helper: Date range calculator ─────────────────────────────────────────
function getDateRange(period, refDate) {
  const now = new Date(refDate);
  let start, end, previousStart, previousEnd, label;

  if (period === 'daily') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end = new Date(now); end.setHours(23, 59, 59, 999);
    previousStart = new Date(start); previousStart.setDate(previousStart.getDate() - 1);
    previousEnd = new Date(end); previousEnd.setDate(previousEnd.getDate() - 1);
    label = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  } else if (period === 'weekly') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start = new Date(now); start.setDate(now.getDate() + diffToMonday); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    previousStart = new Date(start); previousStart.setDate(start.getDate() - 7);
    previousEnd = new Date(end); previousEnd.setDate(end.getDate() - 7);
    label = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    // monthly
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  return { start, end, previousStart, previousEnd, label };
}

export default router;
