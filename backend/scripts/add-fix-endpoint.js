// Add this temporarily to your server.js file
import { fixTonyMembership } from './scripts/railway-fix-membership.js';

// Temporary admin endpoint - REMOVE AFTER USE
app.get('/admin-fix-membership', async (req, res) => {
  try {
    // Simple security - check if request is from Tony
    const auth = req.headers.authorization;
    if (!auth || auth !== 'Bearer fix-tony-membership') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await fixTonyMembership();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fix membership', 
      details: error.message 
    });
  }
});

// Then call: GET /admin-fix-membership with header:
// Authorization: Bearer fix-tony-membership