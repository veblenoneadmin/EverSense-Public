// Centralized error handling utilities for API endpoints

export function handleApiError(error, req, res, context = 'API operation') {
  const errorInfo = {
    error: error.message,
    code: error.code,
    context,
    userId: req.user?.id,
    orgId: req.orgId || req.query.orgId,
    endpoint: `${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  console.error(`❌ ${context} failed:`, errorInfo);

  // Handle specific Prisma error codes
  if (error.code === 'P2002') {
    return res.status(409).json({ 
      error: 'Duplicate entry constraint violation',
      code: 'DUPLICATE_ENTRY',
      message: 'A record with this information already exists'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Record not found',
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    });
  }

  if (error.code === 'P2003') {
    return res.status(400).json({ 
      error: 'Foreign key constraint violation',
      code: 'CONSTRAINT_VIOLATION',
      message: 'Referenced resource does not exist'
    });
  }

  if (error.code?.startsWith('P')) {
    return res.status(400).json({ 
      error: 'Database constraint error',
      code: 'DATABASE_CONSTRAINT',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Data validation failed'
    });
  }

  // Handle connection errors
  if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
    return res.status(503).json({ 
      error: 'Database connection error',
      code: 'DB_CONNECTION_ERROR',
      message: 'Unable to connect to database'
    });
  }

  // Handle timeout errors
  if (error.message.includes('timeout')) {
    return res.status(408).json({ 
      error: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      message: 'Operation timed out'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return res.status(400).json({ 
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }

  // Handle authorization errors
  if (error.message.includes('Unauthorized') || error.message.includes('Permission')) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      code: 'AUTHORIZATION_ERROR',
      message: 'You do not have permission to perform this action'
    });
  }

  // Generic server error
  return res.status(500).json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
  });
}

// Async error handler wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleApiError(error, req, res, `${req.method} ${req.path}`);
    });
  };
}

// Validation helper
export function validateRequiredFields(body, fields) {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}