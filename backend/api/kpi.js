import express from 'express';
import { generateKPIReport } from '../services/kpiService.js';

const router = express.Router();

/**
 * GET /api/kpi/generate - Enhanced KPI Report with Performance Categorization
 * Query params:
 *   - orgId: Organization ID (required)
 *   - period: 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'weekly')
 *   - date: Reference date for the period (default: today)
 */
router.get('/generate', async (req, res) => {
  try {
    const { orgId, period = 'weekly', date } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid period. Must be: daily | weekly | monthly | yearly',
      });
    }

    const referenceDate = date ? new Date(date) : new Date();

    // Generate comprehensive KPI report
    const report = await generateKPIReport(orgId, period, referenceDate);

    return res.json(report);
  } catch (err) {
    console.error('KPI generate error:', err);
    res.status(500).json({
      error: 'Failed to generate KPI report',
      detail: err.message,
    });
  }
});

/**
 * GET /api/kpi/summary - Quick summary metrics
 * Returns only high-level metrics without employee details
 */
router.get('/summary', async (req, res) => {
  try {
    const { orgId, period = 'weekly', date } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const referenceDate = date ? new Date(date) : new Date();
    const report = await generateKPIReport(orgId, period, referenceDate);

    // Return only summary and trends
    return res.json({
      reportMeta: report.reportMeta,
      summary: report.summary,
      trends: report.trends,
      topPerformers: report.performance.starPerformers.slice(0, 5),
      underperformers: report.performance.underperformers,
      actionItemsCount: report.actionItems.length,
    });
  } catch (err) {
    console.error('KPI summary error:', err);
    res.status(500).json({
      error: 'Failed to generate KPI summary',
      detail: err.message,
    });
  }
});

/**
 * GET /api/kpi/performance - Detailed performance data
 * Returns performance categories with recommendations
 */
router.get('/performance', async (req, res) => {
  try {
    const { orgId, period = 'weekly', date } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const referenceDate = date ? new Date(date) : new Date();
    const report = await generateKPIReport(orgId, period, referenceDate);

    return res.json({
      reportMeta: report.reportMeta,
      performance: report.performance,
      actionItems: report.actionItems,
      summary: report.summary,
    });
  } catch (err) {
    console.error('KPI performance error:', err);
    res.status(500).json({
      error: 'Failed to retrieve performance data',
      detail: err.message,
    });
  }
});

export default router;
