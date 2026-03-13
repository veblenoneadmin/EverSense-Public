// Expense management API endpoints
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireResourceOwnership } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, expenseSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
const router = express.Router();

// Get all expenses for a user/organization
router.get('/', requireAuth, withOrgScope, validateQuery(z.object({
  limit: z.string().optional().transform((val) => {
    const num = parseInt(val);
    return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 100);
  }),
  offset: z.string().optional().transform((val) => {
    const num = parseInt(val);
    return isNaN(num) ? 0 : Math.max(num, 0);
  }),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: z.string().optional(),
  userId: z.string().optional(),
  orgId: z.string().optional()
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: "Start date must be before or equal to end date"
})), async (req, res) => {
  try {
    const { userId, orgId, startDate, endDate, category, limit = 50 } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const where = { orgId };
    if (userId) where.userId = userId;
    if (category) where.category = category;
    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { expenseDate: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    
    res.json({ 
      success: true, 
      expenses,
      total: expenses.length,
      totalAmount
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch expenses');
  }
});

// Create new expense
router.post('/', requireAuth, withOrgScope, validateBody(expenseSchemas.create), async (req, res) => {
  try {
    const { userId, orgId, title, amount, category, expenseDate, description, vendor, paymentMethod, receiptUrl, isTaxDeductible, isRecurring } = req.body;
    
    if (!userId || !orgId || !title || !amount || !category) {
      return res.status(400).json({ error: 'Missing required fields: userId, orgId, title, amount, and category are required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const expense = await prisma.expense.create({
      data: {
        userId,
        orgId,
        title,
        amount: parseFloat(amount),
        category,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        description: description || null,
        vendor: vendor || null,
        paymentMethod: paymentMethod || 'card',
        receiptUrl: receiptUrl || null,
        status: 'pending',
        isTaxDeductible: isTaxDeductible || false,
        isRecurring: isRecurring || false
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`✅ Created new expense: ${title}`);
    
    res.status(201).json({ 
      success: true, 
      expense 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'create expense');
  }
});

// Update expense
router.patch('/:id', requireAuth, withOrgScope, requireResourceOwnership('expense'), validateBody(expenseSchemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.orgId;
    delete updates.userId;
    
    // Handle numeric fields
    if (updates.amount !== undefined) {
      updates.amount = parseFloat(updates.amount);
    }
    
    // Handle date fields
    if (updates.expenseDate) {
      updates.expenseDate = new Date(updates.expenseDate);
    }
    
    const expense = await prisma.expense.update({
      where: { id },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`📝 Updated expense ${id}`);
    
    res.json({ 
      success: true, 
      expense,
      message: 'Expense updated successfully' 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'update expense');
  }
});

// Delete expense
router.delete('/:id', requireAuth, withOrgScope, requireResourceOwnership('expense'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    await prisma.expense.delete({
      where: { id }
    });
    
    console.log(`🗑️ Deleted expense ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Expense deleted successfully' 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'delete expense');
  }
});

// Get expense statistics
router.get('/stats', requireAuth, withOrgScope, validateQuery(commonSchemas.dateRange), async (req, res) => {
  try {
    const { userId, orgId, startDate, endDate } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const where = { orgId };
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const expenses = await prisma.expense.findMany({
      where,
      select: {
        amount: true,
        status: true,
        category: true,
        expenseDate: true
      }
    });
    
    const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const pendingAmount = expenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const approvedAmount = expenses.filter(exp => exp.status === 'approved').reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    // Group by category
    const categories = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount);
      return acc;
    }, {});
    
    // Monthly trend (simplified - group by month)
    const monthlyTrend = expenses.reduce((acc, exp) => {
      const month = exp.expenseDate.toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + parseFloat(exp.amount);
      return acc;
    }, {});
    
    const stats = {
      totalAmount,
      pendingAmount,
      approvedAmount,
      totalExpenses: expenses.length,
      categories,
      monthlyTrend: Object.entries(monthlyTrend).map(([month, amount]) => ({ month, amount }))
    };
    
    res.json({ 
      success: true, 
      stats 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch expense statistics');
  }
});

export default router;