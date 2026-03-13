import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';

const router = express.Router();

/**
 * GET /api/reports/financial
 * Get financial report data (revenue, expenses, profit) for different periods
 */
router.get('/financial', requireAuth, async (req, res) => {
  try {
    const { orgId = 'default', period = 'month', limit = '12' } = req.query;
    const limitNum = Math.min(24, Math.max(1, parseInt(limit)));
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    // Calculate date ranges based on period
    const now = new Date();
    const periods = [];
    
    for (let i = 0; i < limitNum; i++) {
      const periodStart = new Date(now);
      const periodEnd = new Date(now);
      
      switch (period) {
        case 'week':
          periodStart.setDate(now.getDate() - (i * 7 + 7));
          periodEnd.setDate(now.getDate() - (i * 7));
          break;
        case 'quarter':
          periodStart.setMonth(now.getMonth() - (i * 3 + 3));
          periodEnd.setMonth(now.getMonth() - (i * 3));
          break;
        case 'year':
          periodStart.setFullYear(now.getFullYear() - (i + 1));
          periodEnd.setFullYear(now.getFullYear() - i);
          break;
        case 'month':
        default:
          periodStart.setMonth(now.getMonth() - (i + 1));
          periodEnd.setMonth(now.getMonth() - i);
          break;
      }
      
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setDate(0); // Last day of month
      periodEnd.setHours(23, 59, 59, 999);
      
      periods.push({ start: periodStart, end: periodEnd });
    }

    const reportData = [];

    for (const { start, end } of periods) {
      // Get hours tracked (only real data we have)
      const hoursStats = await prisma.timeLog.aggregate({
        where: {
          orgId: orgId,
          begin: {
            gte: start,
            lte: end
          },
          end: { not: null }
        },
        _sum: {
          duration: true
        }
      });

      // Get real invoice data
      const invoiceStats = await prisma.invoice.aggregate({
        where: {
          orgId: orgId,
          createdAt: {
            gte: start,
            lte: end
          },
          status: { in: ['sent', 'paid'] }
        },
        _sum: {
          totalAmount: true
        },
        _count: true
      });
      
      // Get real expense data
      const expenseStats = await prisma.expense.aggregate({
        where: {
          orgId: orgId,
          expenseDate: {
            gte: start,
            lte: end
          }
        },
        _sum: {
          amount: true
        }
      });
      
      // Get projects completed in this period
      const projectsCompleted = await prisma.project.count({
        where: {
          orgId: orgId,
          status: 'completed',
          updatedAt: {
            gte: start,
            lte: end
          }
        }
      });
      
      // Get active clients (clients with activity in this period)
      const activeClients = await prisma.client.findMany({
        where: {
          orgId: orgId,
          OR: [
            {
              projects: {
                some: {
                  updatedAt: {
                    gte: start,
                    lte: end
                  }
                }
              }
            },
            {
              invoices: {
                some: {
                  createdAt: {
                    gte: start,
                    lte: end
                  }
                }
              }
            }
          ]
        },
        select: { id: true }
      });

      const revenue = invoiceStats._sum.totalAmount || 0;
      const expenses = expenseStats._sum.amount || 0;
      const profit = revenue - expenses;
      const hoursTracked = Math.round((hoursStats._sum.duration || 0) / 3600); // Convert to hours
      const averageHourlyRate = hoursTracked > 0 ? Math.round(revenue / hoursTracked) : 0;

      reportData.push({
        period: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        revenue,
        expenses,
        profit,
        hoursTracked,
        projectsCompleted,
        clientsActive: activeClients.length,
        invoicesSent: invoiceStats._count || 0,
        averageHourlyRate
      });
    }

    res.json({
      success: true,
      data: reportData.reverse() // Most recent first
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch financial report');
  }
});

/**
 * GET /api/reports/projects
 * Get project performance metrics
 */
router.get('/projects', requireAuth, async (req, res) => {
  try {
    const { orgId = 'default', limit = '10' } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    // Get real project data
    const projects = await prisma.project.findMany({
      where: { orgId },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limitNum
    });
    
    const projectPerformance = projects.map(project => ({
      name: project.name,
      client: project.client?.name || 'No Client',
      completion: project.progress || 0,
      budget: parseFloat(project.budget || 0),
      spent: parseFloat(project.spent || 0),
      status: project.status,
      hoursTracked: project.hoursLogged || 0,
      estimatedHours: project.estimatedHours || 0,
      startDate: project.startDate,
      endDate: project.endDate
    }));

    res.json({
      success: true,
      data: projectPerformance
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch project performance');
  }
});

/**
 * GET /api/reports/clients
 * Get client metrics and performance
 */
router.get('/clients', requireAuth, async (req, res) => {
  try {
    const { orgId = 'default', limit = '10' } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    // Get the last 12 months for client analysis
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Get real client data
    const clients = await prisma.client.findMany({
      where: { orgId },
      include: {
        projects: {
          select: {
            id: true,
            spent: true,
            hoursLogged: true
          }
        },
        invoices: {
          where: {
            createdAt: {
              gte: oneYearAgo
            }
          },
          select: {
            totalAmount: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limitNum
    });
    
    const clientMetrics = clients.map(client => {
      const totalRevenue = client.invoices.reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount), 0);
      const totalHours = client.projects.reduce((sum, project) => sum + (project.hoursLogged || 0), 0);
      const projectCount = client.projects.length;
      
      return {
        name: client.name,
        company: client.company,
        revenue: totalRevenue,
        hours: totalHours,
        projects: projectCount,
        status: client.status,
        priority: client.priority,
        hourlyRate: parseFloat(client.hourlyRate || 0)
      };
    });

    res.json({
      success: true,
      data: clientMetrics
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch client metrics');
  }
});

/**
 * GET /api/reports/summary
 * Get high-level summary metrics for dashboard
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { orgId = 'default' } = req.query;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    // Get current month data
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Get last month for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Current month stats - only get real data for time logs
    const [currentHours, lastHours] = await Promise.all([
      prisma.timeLog.aggregate({
        where: { orgId, begin: { gte: monthStart, lte: monthEnd }, end: { not: null }},
        _sum: { duration: true }
      }),
      prisma.timeLog.aggregate({
        where: { orgId, begin: { gte: lastMonthStart, lte: lastMonthEnd }, end: { not: null }},
        _sum: { duration: true }
      })
    ]);

    // Get real data for all metrics
    const [currentRevenue, currentExpenses, currentProjects, lastRevenue, lastExpenses, lastProjects] = await Promise.all([
      // Current month revenue
      prisma.invoice.aggregate({
        where: { orgId, createdAt: { gte: monthStart, lte: monthEnd }, status: { in: ['sent', 'paid'] }},
        _sum: { totalAmount: true }
      }),
      // Current month expenses
      prisma.expense.aggregate({
        where: { orgId, expenseDate: { gte: monthStart, lte: monthEnd }},
        _sum: { amount: true }
      }),
      // Current active projects
      prisma.project.count({
        where: { orgId, status: { in: ['active', 'planning', 'in_progress'] }}
      }),
      // Last month revenue
      prisma.invoice.aggregate({
        where: { orgId, createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { in: ['sent', 'paid'] }},
        _sum: { totalAmount: true }
      }),
      // Last month expenses
      prisma.expense.aggregate({
        where: { orgId, expenseDate: { gte: lastMonthStart, lte: lastMonthEnd }},
        _sum: { amount: true }
      }),
      // Projects completed last month
      prisma.project.count({
        where: { orgId, status: 'completed', updatedAt: { gte: lastMonthStart, lte: lastMonthEnd }}
      })
    ]);

    const currentRevenueValue = currentRevenue._sum.totalAmount || 0;
    const currentExpenseValue = currentExpenses._sum.amount || 0;
    const currentHoursValue = Math.round((currentHours._sum.duration || 0) / 3600);
    const lastRevenueValue = lastRevenue._sum.totalAmount || 0;
    const lastExpenseValue = lastExpenses._sum.amount || 0;
    const lastHoursValue = Math.round((lastHours._sum.duration || 0) / 3600);

    // Calculate trends
    const revenueTrend = lastRevenueValue > 0 ? 
      Math.round(((currentRevenueValue - lastRevenueValue) / lastRevenueValue) * 100) : 0;
    const expenseTrend = lastExpenseValue > 0 ?
      Math.round(((currentExpenseValue - lastExpenseValue) / lastExpenseValue) * 100) : 0;
    const hoursTrend = lastHoursValue > 0 ?
      Math.round(((currentHoursValue - lastHoursValue) / lastHoursValue) * 100) : 0;

    res.json({
      success: true,
      summary: {
        revenue: {
          current: currentRevenueValue,
          trend: revenueTrend,
          direction: revenueTrend >= 0 ? 'up' : 'down'
        },
        expenses: {
          current: currentExpenseValue,
          trend: Math.abs(expenseTrend),
          direction: expenseTrend >= 0 ? 'up' : 'down'
        },
        profit: {
          current: currentRevenueValue - currentExpenseValue,
          trend: revenueTrend - expenseTrend,
          direction: (currentRevenueValue - currentExpenseValue) >= (lastRevenueValue - lastExpenseValue) ? 'up' : 'down'
        },
        hours: {
          current: currentHoursValue,
          trend: Math.abs(hoursTrend),
          direction: hoursTrend >= 0 ? 'up' : 'down'
        },
        activeProjects: currentProjects || 0,
        completedLastMonth: lastProjects || 0
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch summary report');
  }
});

export default router;