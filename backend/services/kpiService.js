import { prisma } from '../lib/prisma.js';

/**
 * Enhanced KPI Service with performance categorization and intelligent insights
 * Categorizes employees into: Star Performers, Overworked, Coasters, and Underperformers
 */

// ─── Date Range Helpers ───────────────────────────────────────────────────────

export function getDateRange(period, referenceDate) {
  const ref = new Date(referenceDate);
  let start, end;

  if (period === 'daily') {
    start = new Date(ref);
    start.setHours(0, 0, 0, 0);
    end = new Date(ref);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = ref.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    start = new Date(ref);
    start.setDate(ref.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // yearly
    start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
  }
  return { start, end };
}

export function getPrevDateRange(period, current) {
  const { start, end } = current;

  if (period === 'daily') {
    const d = 24 * 60 * 60 * 1000;
    return {
      start: new Date(start.getTime() - d),
      end: new Date(end.getTime() - d),
    };
  } else if (period === 'weekly') {
    const w = 7 * 24 * 60 * 60 * 1000;
    return {
      start: new Date(start.getTime() - w),
      end: new Date(end.getTime() - w),
    };
  } else if (period === 'monthly') {
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
    return { start: prevStart, end: prevEnd };
  } else {
    // yearly
    return {
      start: new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
      end: new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    };
  }
}

function fmt(date) {
  return date.toISOString().split('T')[0];
}

function pctChange(prev, curr) {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

// ─── Performance Analysis Helpers ──────────────────────────────────────────────

/**
 * Categorizes employees by performance metrics
 * Returns: { starPerformers, overworked, coasters, underperformers }
 */
export function categorizeEmployeePerformance(employees, org) {
  if (employees.length === 0) {
    return {
      starPerformers: [],
      overworked: [],
      coasters: [],
      underperformers: [],
    };
  }

  // Calculate percentiles
  const sortedByHours = [...employees].sort((a, b) => b.hours - a.hours);
  const sortedByTasks = [...employees].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  const sortedByReports = [...employees].sort((a, b) => b.reports - a.reports);
  const sortedByAvgHours = [...employees].sort((a, b) => b.avgHoursPerDay - a.avgHoursPerDay);

  const p75Hours = sortedByHours[Math.floor(employees.length * 0.25)]?.hours || 0;
  const p75Tasks = sortedByTasks[Math.floor(employees.length * 0.25)]?.tasksCompleted || 0;
  const p75Reports = sortedByReports[Math.floor(employees.length * 0.25)]?.reports || 0;
  const p50Hours = sortedByHours[Math.floor(employees.length * 0.5)]?.hours || 0;
  const p25Hours = sortedByHours[Math.floor(employees.length * 0.75)]?.hours || 0;

  const avgHours = sortedByHours.reduce((sum, e) => sum + e.hours, 0) / employees.length;
  const avgTasks = sortedByTasks.reduce((sum, e) => sum + e.tasksCompleted, 0) / employees.length;
  const avgReports = sortedByReports.reduce((sum, e) => sum + e.reports, 0) / employees.length;

  const categories = {
    starPerformers: [],
    overworked: [],
    coasters: [],
    underperformers: [],
  };

  for (const emp of employees) {
    const hoursAboveAvg = emp.hours > avgHours * 1.2; // 20% above average
    const taskAboveAvg = emp.tasksCompleted > avgTasks * 1.2;
    const reportAboveAvg = emp.reports > avgReports * 1.2;
    const lowActivity = emp.hours < avgHours * 0.5 || !emp.hasActivity;
    const excessiveHours = emp.hours > avgHours * 1.6; // 60% above average

    let category = 'coasters';
    let score = 0;

    // Star Performers: High hours + high tasks + high reports
    if ((hoursAboveAvg && taskAboveAvg && reportAboveAvg) || (emp.hours >= p75Hours && emp.tasksCompleted >= Math.max(p75Tasks, 2))) {
      category = 'starPerformers';
      score = (emp.hours / p75Hours) * 0.3 + (emp.tasksCompleted / Math.max(p75Tasks, 1)) * 0.4 + (emp.reports / Math.max(p75Reports, 1)) * 0.3;
    }
    // Overworked: Very high hours but sustainable productivity
    else if (excessiveHours && taskAboveAvg && emp.daysActive / 7 > 0.8) {
      category = 'overworked';
      score = emp.hours / avgHours;
    }
    // Underperformers: Low activity across metrics
    else if (lowActivity) {
      category = 'underperformers';
      score = Math.min(
        emp.hours / avgHours,
        emp.tasksCompleted / Math.max(avgTasks, 1),
        emp.reports / Math.max(avgReports, 1)
      );
    }
    // Coasters: Moderate activity
    else {
      category = 'coasters';
      score = Math.min(
        emp.hours / avgHours,
        emp.tasksCompleted / Math.max(avgTasks, 1)
      );
    }

    categories[category].push({
      ...emp,
      performanceScore: Math.round(score * 100) / 100,
    });
  }

  // Sort each category by performance score
  Object.keys(categories).forEach(key => {
    categories[key].sort((a, b) => b.performanceScore - a.performanceScore);
  });

  return categories;
}

/**
 * Generates comprehensive KPI metrics for specific time period
 */
export function calculateMetrics(data) {
  const { attendanceLogs, reports, tasksCompleted, timeLogs } = data;

  const totalHours = attendanceLogs.reduce((s, l) => s + (l.duration || 0) / 3600, 0);
  const totalReports = reports.length;
  const totalTasks = tasksCompleted.length;
  const activeEmployees = new Set(attendanceLogs.map(l => l.userId)).size;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalReports,
    totalTasks,
    activeEmployees,
    avgHoursPerEmployee: activeEmployees > 0 ? Math.round((totalHours / activeEmployees) * 100) / 100 : 0,
    avgTasksPerEmployee: activeEmployees > 0 ? Math.round((totalTasks / activeEmployees) * 100) / 100 : 0,
    avgReportsPerEmployee: activeEmployees > 0 ? Math.round((totalReports / activeEmployees) * 100) / 100 : 0,
  };
}

/**
 * Identifies underperformers with action items
 */
export function generateActionItems(performanceData, metrics) {
  const actionItems = [];

  const { underperformers, overworked } = performanceData;

  // Underperformers action items
  for (const emp of underperformers) {
    const reasons = [];

    if (emp.hours < metrics.avgHoursPerEmployee * 0.5) {
      reasons.push(`Logged ${emp.hours}h vs avg ${metrics.avgHoursPerEmployee}h`);
    }
    if (emp.tasksCompleted < metrics.avgTasksPerEmployee * 0.5) {
      reasons.push(`Completed ${emp.tasksCompleted} tasks vs avg ${Math.round(metrics.avgTasksPerEmployee)}`);
    }
    if (emp.reports < metrics.avgReportsPerEmployee * 0.5 && metrics.avgReportsPerEmployee > 0) {
      reasons.push(`Submitted ${emp.reports} reports vs avg ${Math.round(metrics.avgReportsPerEmployee)}`);
    }
    if (!emp.hasActivity) {
      reasons.push('No recorded activity');
    }

    if (reasons.length > 0) {
      actionItems.push({
        type: 'underperformance',
        severity: 'high',
        employee: {
          id: emp.id,
          name: emp.name,
          email: emp.email,
        },
        reasons,
        recommendation: 'Schedule performance review and discuss support needs',
      });
    }
  }

  // Overworked action items
  for (const emp of overworked) {
    actionItems.push({
      type: 'burnout-risk',
      severity: 'medium',
      employee: {
        id: emp.id,
        name: emp.name,
        email: emp.email,
      },
      reasons: [
        `${emp.hours}h logged (${Math.round((emp.hours / metrics.avgHoursPerEmployee) * 100)}% above avg)`,
        `Active ${emp.daysActive} days (${Math.round((emp.daysActive / 7) * 100)}% of period)`,
      ],
      recommendation: 'Consider workload redistribution or additional support',
    });
  }

  return actionItems;
}

/**
 * Generates comprehensive KPI report
 */
export async function generateKPIReport(orgId, period = 'weekly', referenceDate = new Date()) {
  const range = getDateRange(period, referenceDate);
  const prevRange = getPrevDateRange(period, range);

  // Fetch organization members
  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const memberCount = memberships.length;

  // Fetch current and previous period data in parallel
  const [attendanceLogs, reports, tasksCompleted, timeLogs, prevAttendanceLogs, prevReports, prevTasksCompleted] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { orgId, timeIn: { gte: range.start, lte: range.end } },
    }),
    prisma.report.findMany({
      where: { orgId, createdAt: { gte: range.start, lte: range.end } },
    }),
    prisma.macroTask.findMany({
      where: { orgId, status: 'completed', completedAt: { gte: range.start, lte: range.end } },
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.timeLog.findMany({
      where: { orgId, begin: { gte: range.start, lte: range.end } },
      include: { task: { include: { project: { select: { id: true, name: true } } } } },
    }),
    // Previous period
    prisma.attendanceLog.findMany({
      where: { orgId, timeIn: { gte: prevRange.start, lte: prevRange.end } },
    }),
    prisma.report.findMany({
      where: { orgId, createdAt: { gte: prevRange.start, lte: prevRange.end } },
    }),
    prisma.macroTask.findMany({
      where: { orgId, status: 'completed', completedAt: { gte: prevRange.start, lte: prevRange.end } },
    }),
  ]);

  // Build per-user map
  const userMap = new Map();
  for (const m of memberships) {
    const u = m.user;
    userMap.set(u.id, {
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      role: m.role,
      hours: 0,
      reports: 0,
      tasksCompleted: 0,
      projects: new Set(),
      daysActive: new Set(),
    });
  }

  for (const log of attendanceLogs) {
    const u = userMap.get(log.userId);
    if (!u) continue;
    u.hours += (log.duration || 0) / 3600;
    u.daysActive.add(log.date);
  }

  for (const r of reports) {
    const u = userMap.get(r.userId);
    if (u) u.reports += 1;
  }

  for (const t of tasksCompleted) {
    const u = userMap.get(t.userId);
    if (!u) continue;
    u.tasksCompleted += 1;
    if (t.project) u.projects.add(t.project.name);
  }

  // Project analysis
  const projectMap = new Map();
  for (const tl of timeLogs) {
    const proj = tl.task?.project;
    const projId = proj?.id || '__unassigned__';
    const projName = proj?.name || 'Unassigned';
    if (!projectMap.has(projId)) {
      projectMap.set(projId, { id: projId, name: projName, hours: 0, tasksCount: 0, contributors: new Set() });
    }
    projectMap.get(projId).hours += (tl.duration || 0) / 3600;
    projectMap.get(projId).contributors.add(tl.userId);
  }

  for (const t of tasksCompleted) {
    const id = t.project?.id || '__unassigned__';
    if (projectMap.has(id)) {
      projectMap.get(id).tasksCount += 1;
      projectMap.get(id).contributors.add(t.userId);
    }
  }

  // Format employee data
  const employees = [...userMap.values()]
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      hours: Math.round(u.hours * 100) / 100,
      reports: u.reports,
      tasksCompleted: u.tasksCompleted,
      projects: [...u.projects],
      daysActive: u.daysActive.size,
      avgHoursPerDay: u.daysActive.size > 0 ? Math.round((u.hours / u.daysActive.size) * 100) / 100 : 0,
      hasActivity: u.hours > 0 || u.reports > 0 || u.tasksCompleted > 0,
    }))
    .sort((a, b) => b.hours - a.hours || b.reports - a.reports);

  // Calculate metrics
  const currentMetrics = calculateMetrics({
    attendanceLogs,
    reports,
    tasksCompleted,
    timeLogs,
  });

  const previousMetrics = calculateMetrics({
    attendanceLogs: prevAttendanceLogs,
    reports: prevReports,
    tasksCompleted: prevTasksCompleted,
    timeLogs: [],
  });

  // Categorize performance
  const performanceData = categorizeEmployeePerformance(employees);

  // Create completion rate (reports submitted / total members)
  const completionRate = memberCount > 0 ? Math.round((reports.length / memberCount) * 100) : 0;
  const prevCompletionRate = memberCount > 0 ? Math.round((prevReports.length / memberCount) * 100) : 0;

  // Get top project
  const topProject = [...projectMap.values()].sort((a, b) => b.hours - a.hours)[0] || null;

  // Missing reporters
  const reporterIds = new Set(reports.map(r => r.userId));
  const missingReporters = [...userMap.values()]
    .filter(u => !reporterIds.has(u.id))
    .map(u => ({ id: u.id, name: u.name, email: u.email }));

  // Generate action items
  const actionItems = generateActionItems(performanceData, currentMetrics);

  // Calculate trend
  const completionTrend = pctChange(prevCompletionRate, completionRate);

  return {
    reportMeta: {
      period,
      dateRange: {
        start: fmt(range.start),
        end: fmt(range.end),
      },
      previousDateRange: {
        start: fmt(prevRange.start),
        end: fmt(prevRange.end),
      },
      generatedAt: new Date().toISOString(),
      orgId,
    },
    summary: {
      ...currentMetrics,
      completionRate,
      memberCount,
      topProject: topProject ? { name: topProject.name, hours: Math.round(topProject.hours * 100) / 100 } : null,
    },
    trends: {
      hours: pctChange(previousMetrics.totalHours, currentMetrics.totalHours),
      reports: pctChange(previousMetrics.totalReports, currentMetrics.totalReports),
      tasks: pctChange(previousMetrics.totalTasks, currentMetrics.totalTasks),
      activeEmployees: pctChange(previousMetrics.activeEmployees, currentMetrics.activeEmployees),
      completionRate: completionTrend,
    },
    performance: performanceData,
    employees,
    projects: [...projectMap.values()]
      .map(p => ({
        ...p,
        hours: Math.round(p.hours * 100) / 100,
        contributors: p.contributors.size,
      }))
      .sort((a, b) => b.hours - a.hours),
    actionItems,
    missingReporters,
  };
}
