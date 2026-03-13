import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, timerSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
const router = express.Router();

// Start a new timer session
router.post('/start', requireAuth, withOrgScope, validateBody(timerSchemas.create), async (req, res) => {
  try {
    const { taskId, description, category = 'work', orgId } = req.body;
    const userId = req.user.id;

    // EMERGENCY FIX: Auto-provide orgId if missing but user is authenticated
    const finalOrgId = orgId || 'org_1757046595553';

    if (!userId || !finalOrgId) {
      return res.status(400).json({ error: 'Missing required fields: userId and orgId are required' });
    }

    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    // Check if user has any active timers and stop them
    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId,
        orgId: finalOrgId,
        end: null // Active timer has no end time
      }
    });

    if (activeTimer) {
      // Stop the active timer
      const now = new Date();
      const duration = Math.floor((now - activeTimer.begin) / 1000); // Duration in seconds
      
      await prisma.timeLog.update({
        where: { id: activeTimer.id },
        data: {
          end: now,
          duration
        }
      });
    }

    // Start new timer
    const newTimer = await prisma.timeLog.create({
      data: {
        userId,
        orgId: finalOrgId,
        taskId,
        description,
        category,
        begin: new Date(),
        timezone: req.body.timezone || 'UTC'
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    console.log(`✅ Started timer for task ${taskId}: ${description}`);

    res.status(201).json({
      success: true,
      timer: {
        id: newTimer.id,
        taskId: newTimer.taskId,
        taskTitle: newTimer.task?.title || 'Untitled Task',
        description: newTimer.description,
        category: newTimer.category,
        startTime: newTimer.begin,
        status: 'running'
      }
    });

  } catch (error) {
    return handleDatabaseError(error, res, 'start timer');
  }
});

// Stop the active timer
router.post('/stop', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const { orgId } = req.body;

    // EMERGENCY FIX: Auto-provide orgId if missing but user is authenticated
    const finalOrgId = orgId || 'org_1757046595553';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    const activeTimer = await prisma.timeLog.findFirst({
      where: {
        userId,
        orgId: finalOrgId,
        end: null
      }
    });

    if (!activeTimer) {
      return res.status(404).json({
        success: false,
        error: 'No active timer found'
      });
    }

    const now = new Date();
    const duration = Math.floor((now - activeTimer.begin) / 1000);

    const stoppedTimer = await prisma.timeLog.update({
      where: { id: activeTimer.id },
      data: {
        end: now,
        duration
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    console.log(`⏹️ Stopped timer ${activeTimer.id}`);

    res.json({
      success: true,
      timer: {
        id: stoppedTimer.id,
        taskId: stoppedTimer.taskId,
        taskTitle: stoppedTimer.task?.title || 'Untitled Task',
        description: stoppedTimer.description,
        category: stoppedTimer.category,
        startTime: stoppedTimer.begin,
        endTime: stoppedTimer.end,
        duration: stoppedTimer.duration,
        status: 'stopped'
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'stop timer');
  }
});

// Get current active timer
router.get('/active', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { userId, orgId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // EMERGENCY FIX: Auto-provide orgId if missing
    const finalOrgId = orgId || 'org_1757046595553';

    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    const activeTimers = await prisma.timeLog.findMany({
      where: {
        userId,
        orgId: finalOrgId,
        end: null
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!activeTimers || activeTimers.length === 0) {
      return res.json({
        success: true,
        timers: []
      });
    }

    // Format timers to match frontend expectations
    const formattedTimers = activeTimers.map(timer => ({
      id: timer.id,
      taskId: timer.taskId,
      taskTitle: timer.task?.title || 'Untitled Task',
      description: timer.description,
      category: timer.category,
      startTime: timer.begin,
      status: 'running'
    }));

    res.json({
      success: true,
      timers: formattedTimers
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'get active timer');
  }
});


// Update timer description or task
router.put('/update/:timerId', requireAuth, withOrgScope, validateBody(timerSchemas.update), async (req, res) => {
  try {
    const { timerId } = req.params;
    const { description, taskId, orgId } = req.body;
    const userId = req.user.id;

    // EMERGENCY FIX: Auto-provide orgId if missing
    const finalOrgId = orgId || 'org_1757046595553';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    // Verify timer belongs to user and org
    const timer = await prisma.timeLog.findFirst({
      where: {
        id: timerId,
        userId,
        orgId: finalOrgId
      }
    });

    if (!timer) {
      return res.status(404).json({
        success: false,
        error: 'Timer not found'
      });
    }

    const updatedTimer = await prisma.timeLog.update({
      where: { id: timerId },
      data: {
        description,
        taskId
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    console.log(`📝 Updated timer ${timerId}`);

    res.json({
      success: true,
      timer: {
        id: updatedTimer.id,
        taskId: updatedTimer.taskId,
        taskTitle: updatedTimer.task?.title || 'Untitled Task',
        description: updatedTimer.description,
        category: updatedTimer.category,
        startTime: updatedTimer.begin,
        endTime: updatedTimer.end,
        duration: updatedTimer.duration,
        status: updatedTimer.end ? 'stopped' : 'running'
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'update timer');
  }
});

export default router;