import { z } from 'zod';

/**
 * Middleware factory to validate request body using Zod schemas
 */
export function validateBody(schema) {
  return (req, res, next) => {
    console.log('🔍 Validating request body:', JSON.stringify(req.body, null, 2));
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
        received: req.body
      });
    }
    console.log('✅ Validation passed');
    req.validatedData = validation.data;
    next();
  };
}

/**
 * Middleware factory to validate query parameters using Zod schemas
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const validation = schema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors
      });
    }
    req.validatedQuery = validation.data;
    next();
  };
}

/**
 * Middleware factory to validate URL parameters using Zod schemas
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const validation = schema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid URL parameters',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors
      });
    }
    req.validatedParams = validation.data;
    next();
  };
}

// Common validation schemas
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid(),
  
  // MongoDB ObjectId validation (24 character hex string)
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  
  // Organization ID validation (flexible for both UUID and ObjectId)
  orgId: z.string().min(1).max(50),
  
  // User ID validation
  userId: z.string().min(1).max(50),
  
  // Pagination parameters
  pagination: z.object({
    limit: z.string().optional().transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 100);
    }),
    offset: z.string().optional().transform((val) => {
      const num = parseInt(val);
      return isNaN(num) ? 0 : Math.max(num, 0);
    })
  }),
  
  // Date range parameters
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).refine((data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: "Start date must be before or equal to end date"
  })
};

// Task-specific schemas
export const taskSchemas = {
  create: z.object({
    title: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
    status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled']).default('not_started'),
    dueDate: z.string().datetime().optional(),
    assigneeId: z.string().optional(),
    projectId: z.string().optional(),
    estimatedHours: z.number().min(0).max(1000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional()
  }),
  
  update: z.object({
    title: z.string().min(1).max(500).trim().optional(),
    description: z.union([z.string().max(2000), z.null()]).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
    status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional(),
    category: z.string().max(100).optional(),
    dueDate: z.union([z.string().datetime(), z.null()]).optional(),
    estimatedHours: z.number().min(0).max(1000).optional(),
    actualHours: z.number().min(0).max(1000).optional(),
    tags: z.union([
      z.array(z.string().max(50)).max(10),
      z.null(),
      z.undefined()
    ]).optional()
  }).passthrough(),
  
  statusUpdate: z.object({
    status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'])
  })
};

// Timer-specific schemas
export const timerSchemas = {
  create: z.object({
    taskId: z.string().optional(),
    projectId: z.string().optional(),
    description: z.string().max(500).optional(),
    startTime: z.string().datetime().optional()
  }),
  
  update: z.object({
    description: z.string().max(500).optional(),
    endTime: z.string().datetime().optional()
  })
};

// Project-specific schemas
export const projectSchemas = {
  create: z.object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(2000).optional(),
    status: z.enum(['planning', 'active', 'completed', 'on_hold', 'cancelled']).default('planning'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    clientId: z.string().optional(),
    // clientName: z.string().max(100).optional(), // Temporarily disabled until DB migration
    budget: z.number().min(0).optional(),
    estimatedHours: z.number().min(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    color: z.string().max(50).optional()
  }),
  
  update: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['planning', 'active', 'completed', 'on_hold', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    clientId: z.string().optional(),
    // clientName: z.string().max(100).optional(), // Temporarily disabled until DB migration
    budget: z.number().min(0).optional(),
    estimatedHours: z.number().min(0).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    color: z.string().max(50).optional()
  })
};

// Client-specific schemas
export const clientSchemas = {
  create: z.object({
    name: z.string().min(1).max(100).trim(),
    email: z.string().email(),
    phone: z.string().max(20).optional(),
    company: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
    contactPerson: z.string().max(255).optional(),
    industry: z.string().max(255).optional(),
    hourlyRate: z.number().min(0).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  
  update: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    company: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
    contactPerson: z.string().max(255).optional(),
    industry: z.string().max(255).optional(),
    hourlyRate: z.number().min(0).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })
};

// Expense-specific schemas
export const expenseSchemas = {
  create: z.object({
    title: z.string().min(1).max(255).trim(),
    amount: z.number().min(0.01).max(999999.99),
    category: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    vendor: z.string().max(255).optional(),
    paymentMethod: z.string().max(50).default('card'),
    receiptUrl: z.string().url().optional(),
    expenseDate: z.string().datetime().optional(),
    isTaxDeductible: z.boolean().default(false),
    isRecurring: z.boolean().default(false)
  }),
  
  update: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    amount: z.number().min(0.01).max(999999.99).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    vendor: z.string().max(255).optional(),
    paymentMethod: z.string().max(50).optional(),
    receiptUrl: z.string().url().optional(),
    expenseDate: z.string().datetime().optional(),
    isTaxDeductible: z.boolean().optional(),
    isRecurring: z.boolean().optional()
  })
};

// Invoice-specific schemas
export const invoiceSchemas = {
  create: z.object({
    clientId: z.string().optional(),
    clientName: z.string().min(1).max(255),
    amount: z.number().min(0.01).max(999999.99),
    taxAmount: z.number().min(0).optional(),
    description: z.string().max(2000).optional(),
    dueDate: z.string().datetime().optional()
  }),
  
  statusUpdate: z.object({
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  })
};