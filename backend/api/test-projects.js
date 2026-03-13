// Test project API endpoint - bypasses auth for testing
import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

// Test project creation without auth (for debugging)
router.post('/test-create', async (req, res) => {
  try {
    console.log('🧪 Testing project creation (no auth)');
    
    // Create a test project with fake user/org data
    const project = await prisma.project.create({
      data: {
        name: 'Test Project - ' + new Date().toISOString().slice(0, 16),
        description: 'Created via test endpoint to verify database connection',
        status: 'active',
        priority: 'high',
        color: '#646cff',
        orgId: 'org_1757046595553', // Use existing org from your database
        estimatedHours: 10,
        budget: 5000
      }
    });
    
    console.log('✅ Test project created:', project.name);
    
    res.json({ 
      success: true, 
      project,
      message: 'Test project created successfully' 
    });
    
  } catch (error) {
    console.error('❌ Test project creation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all projects (no auth for testing)
router.get('/test-list', async (req, res) => {
  try {
    console.log('🧪 Testing project list (no auth)');
    
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`✅ Found ${projects.length} projects`);
    
    res.json({ 
      success: true, 
      projects,
      count: projects.length 
    });
    
  } catch (error) {
    console.error('❌ Test project list failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;