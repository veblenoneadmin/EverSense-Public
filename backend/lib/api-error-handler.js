// Shared API error handling utilities
import { prisma } from './prisma.js';

// Helper function to check database connection
export async function checkDatabaseConnection(res) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (dbError) {
    console.error('Database connection failed:', dbError.message);
    res.status(503).json({ 
      error: 'Database temporarily unavailable',
      code: 'DB_CONNECTION_ERROR',
      message: 'Please try again later'
    });
    return false;
  }
}

// Helper function for enhanced error handling
export function handleDatabaseError(error, res, operation = 'database operation') {
  console.error(`Error in ${operation}:`, error);
  
  if (error.code === 'P1001') {
    return res.status(503).json({ 
      error: 'Database connection failed',
      code: 'DB_CONNECTION_ERROR',
      message: 'Database server is not accessible'
    });
  } else if (error.code?.startsWith('P')) {
    return res.status(500).json({ 
      error: 'Database query failed',
      code: 'DB_QUERY_ERROR',
      message: 'Failed to execute database query'
    });
  }
  
  return res.status(500).json({ error: `Failed to ${operation}` });
}

// Helper function to handle validation errors
export function handleValidationError(error, res, operation = 'validate request') {
  console.error(`Validation error in ${operation}:`, error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.errors || []
    });
  }
  
  return res.status(400).json({
    error: 'Bad request',
    code: 'BAD_REQUEST',
    message: 'Invalid request parameters'
  });
}