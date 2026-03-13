// Task management API endpoints
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireTaskOwnership } from '../lib/rbac.js';
import { requireAuthOrApiKey } from '../middleware/apiKeyAuth.js';
import { validateBody, validateQuery, commonSchemas, taskSchemas } from '../lib/validation.js';
import { createNotification } from './notifications.js';
const router = express.Router();

// ── Lazy active_timers table init ─────────────────────────────────────────────
let activeTimersTableReady = false;
async function ensureActiveTimersTable() {
  if (activeTimersTableReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `active_timers` (' +
      '  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(36) NOT NULL,' +
      '  `taskId` VARCHAR(50) NOT NULL, `orgId` VARCHAR(191) NOT NULL,' +
      '  `startedAt` DATETIME(3) NOT NULL,' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `at_user_org_key` (`userId`,`orgId`),' +
      '  KEY `at_orgId_idx` (`orgId`), KEY `at_taskId_idx` (`taskId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    activeTimersTableReady = true;
  } catch (_) { activeTimersTableReady = true; }
}

// ── Lazy task_assignees table init ────────────────────────────────────────────
let assigneesTableReady = false;
async function ensureAssigneesTable() {
  if (assigneesTableReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `task_assignees` (' +
      '  `id` VARCHAR(191) NOT NULL, `taskId` VARCHAR(50) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL, `orgId` VARCHAR(191) NOT NULL,' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `ta_task_user_key` (`taskId`,`userId`),' +
      '  KEY `ta_taskId_idx` (`taskId`), KEY `ta_userId_idx` (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    assigneesTableReady = true;
  } catch (_) { assigneesTableReady = true; }
}

// ── Replace all assignees for a task ─────────────────────────────────────────
async function setTaskAssignees(taskId, orgId, assigneeIds) {
  if (!Array.isArray(assigneeIds)) return;
  await ensureAssigneesTable();
  await prisma.$executeRawUnsafe('DELETE FROM task_assignees WHERE taskId = ?', taskId);
  for (const uid of assigneeIds) {
    try {
      await prisma.$executeRawUnsafe(
        'INSERT IGNORE INTO task_assignees (id, taskId, userId, orgId) VALUES (?, ?, ?, ?)',
        randomUUID(), taskId, uid, orgId
      );
    } catch (_) {}
  }
}

// ── GET /api/tasks/members — org members for assignee picker ─────────────────
router.get('/members', requireAuth, withOrgScope, async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { orgId: req.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    res.json({
      members: memberships.map(m => ({
        id:    m.user.id,
        name:  m.user.name,
        email: m.user.email,
        role:  m.role,
      })),
    });
  } catch (err) {
    console.error('[Tasks] members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── GET /api/tasks/active-timers — org-wide active timers for admin ──────────
router.get('/active-timers', requireAuth, withOrgScope, async (req, res) => {
  await ensureActiveTimersTable();
  try {
    const timers = await prisma.$queryRawUnsafe(
      'SELECT at.userId, at.taskId, UNIX_TIMESTAMP(at.startedAt)*1000 AS startedAt, u.name ' +
      'FROM active_timers at JOIN `user` u ON u.id = at.userId WHERE at.orgId = ?',
      req.orgId
    );
    res.json({ timers: timers.map(t => ({ ...t, startedAt: Number(t.startedAt) })) });
  } catch (e) {
    console.error('[Tasks] active-timers error:', e);
    res.status(500).json({ error: 'Failed to fetch active timers' });
  }
});

// ── POST /api/tasks/timer/start — record that current user started a timer ───
router.post('/timer/start', requireAuth, withOrgScope, async (req, res) => {
  const { taskId, startedAt } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  await ensureActiveTimersTable();
  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO active_timers (id, userId, taskId, orgId, startedAt) VALUES (?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE taskId = VALUES(taskId), startedAt = VALUES(startedAt)',
      randomUUID(), req.user.id, taskId, req.orgId, new Date(startedAt || Date.now())
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Tasks] timer/start error:', e);
    res.status(500).json({ error: 'Failed to save timer' });
  }
});

// ── POST /api/tasks/timer/stop — clear current user's active timer ────────────
router.post('/timer/stop', requireAuth, withOrgScope, async (req, res) => {
  await ensureActiveTimersTable();
  try {
    await prisma.$executeRawUnsafe(
      'DELETE FROM active_timers WHERE userId = ? AND orgId = ?',
      req.user.id, req.orgId
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Tasks] timer/stop error:', e);
    res.status(500).json({ error: 'Failed to clear timer' });
  }
});

// Get tasks (main endpoint)
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, userId, status, priority, projectId, limit = 200, offset = 0 } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    console.log('📋 Fetching tasks:', { orgId, userId, status, priority, projectId, limit, offset });

    const where = { orgId };

    // Apply filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = userId;
    if (projectId) where.projectId = projectId;

    // Role-based task visibility
    const callerMembership = await prisma.membership.findFirst({
      where: { userId: req.user.id, orgId }
    });
    const callerRole = callerMembership?.role;

    if (callerRole === 'CLIENT') {
      // CLIENT: restrict to tasks from their assigned projects only
      let clientRows = [];
      try {
        clientRows = await prisma.$queryRawUnsafe(
          `SELECT id FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1`,
          req.user.id, orgId
        );
      } catch (e) {
        // user_id column may not exist yet, fall back to email lookup
        const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
        if (userRecord?.email) {
          clientRows = await prisma.$queryRawUnsafe(
            `SELECT id FROM clients WHERE email = ? AND orgId = ? LIMIT 1`,
            userRecord.email, orgId
          );
        }
      }
      let clientProjectIds = [];
      if (clientRows.length > 0) {
        const projects = await prisma.project.findMany({
          where: { clientId: clientRows[0].id, orgId },
          select: { id: true }
        });
        clientProjectIds = projects.map(p => p.id);
      }
      where.projectId = { in: clientProjectIds.length > 0 ? clientProjectIds : ['__none__'] };
    } else if (callerRole === 'STAFF') {
      // STAFF: only see tasks assigned to them (primary or multi-assignee)
      delete where.userId; // ignore any userId filter — scope to self
      let staffAssigneeTaskIds = [];
      try {
        await ensureAssigneesTable();
        const rows = await prisma.$queryRawUnsafe(
          `SELECT taskId FROM task_assignees WHERE userId = ? AND orgId = ?`,
          req.user.id, orgId
        );
        staffAssigneeTaskIds = rows.map(r => r.taskId);
      } catch (_) {}
      where.OR = [
        { userId: req.user.id },
        ...(staffAssigneeTaskIds.length > 0 ? [{ id: { in: staffAssigneeTaskIds } }] : [])
      ];
    } else if (userId && callerRole !== 'CLIENT') {
      // ADMIN/OWNER with userId filter — also include tasks where they're a multi-assignee
      let assigneeTaskIds = [];
      try {
        await ensureAssigneesTable();
        const rows = await prisma.$queryRawUnsafe(
          `SELECT taskId FROM task_assignees WHERE userId = ? AND orgId = ?`,
          userId, orgId
        );
        assigneeTaskIds = rows.map(r => r.taskId);
      } catch (_) {}
      if (assigneeTaskIds.length > 0) {
        delete where.userId;
        where.OR = [{ userId }, { id: { in: assigneeTaskIds } }];
      }
    }

    const tasks = await prisma.macroTask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.macroTask.count({ where });

    console.log(`✅ Found ${tasks.length} tasks for orgId: ${orgId}`);

    // Format tasks (no include: — enrich user/project separately to avoid collation issues)
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours || 0,
      dueDate: task.dueDate,
      assignee: null,
      project: null,
      projectId: task.projectId,
      projectColor: null,
      projectStatus: null,
      isBillable: false,
      hourlyRate: 0,
      tags: task.tags ? (Array.isArray(task.tags) ? task.tags : []) : [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      userId: task.userId,
      assignees: [],
    }));

    if (formattedTasks.length > 0) {
      const taskIds = formattedTasks.map(t => t.id);
      const ph = taskIds.map(() => '?').join(',');

      // Enrich primary assignee names via raw SQL (avoids collation JOIN issues)
      try {
        const userIds = [...new Set(formattedTasks.map(t => t.userId).filter(Boolean))];
        if (userIds.length) {
          const uph = userIds.map(() => '?').join(',');
          const users = await prisma.$queryRawUnsafe(
            `SELECT id, name, email FROM User WHERE id IN (${uph})`, ...userIds
          );
          const uMap = {};
          for (const u of users) uMap[u.id] = u;
          for (const t of formattedTasks) {
            const u = uMap[t.userId];
            if (u) t.assignee = u.name;
          }
        }
      } catch (_) {}

      // Enrich project names via raw SQL
      try {
        const projectIds = [...new Set(formattedTasks.map(t => t.projectId).filter(Boolean))];
        if (projectIds.length) {
          const pph = projectIds.map(() => '?').join(',');
          const projects = await prisma.$queryRawUnsafe(
            `SELECT id, name, color, status FROM projects WHERE id IN (${pph})`, ...projectIds
          );
          const pMap = {};
          for (const p of projects) pMap[p.id] = p;
          for (const t of formattedTasks) {
            const p = pMap[t.projectId];
            if (p) { t.project = p.name; t.projectColor = p.color; t.projectStatus = p.status; }
          }
        }
      } catch (_) {}

      // Batch-fetch multi-assignees
      try {
        await ensureAssigneesTable();
        const rows = await prisma.$queryRawUnsafe(
          `SELECT ta.taskId, ta.userId, u.name, u.email FROM task_assignees ta JOIN User u ON u.id = ta.userId WHERE ta.taskId IN (${ph})`,
          ...taskIds
        );
        const aMap = {};
        for (const r of rows) {
          if (!aMap[r.taskId]) aMap[r.taskId] = [];
          aMap[r.taskId].push({ id: r.userId, name: r.name, email: r.email });
        }
        for (const t of formattedTasks) t.assignees = aMap[t.id] || [];
      } catch (_) {}
    }

    res.json({
      success: true,
      tasks: formattedTasks,
      total
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// Get recent tasks
router.get('/recent', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, userId, limit = 10 } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Role-based task visibility for recent tasks
    let recentWhere = { orgId, ...(userId ? { userId } : {}) };
    const recentMembership = await prisma.membership.findFirst({
      where: { userId: req.user.id, orgId }
    });
    const recentRole = recentMembership?.role;

    if (recentRole === 'CLIENT') {
      let clientRows = [];
      try {
        clientRows = await prisma.$queryRawUnsafe(
          `SELECT id FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1`,
          req.user.id, orgId
        );
      } catch (e) {
        const userRecord = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
        if (userRecord?.email) {
          clientRows = await prisma.$queryRawUnsafe(
            `SELECT id FROM clients WHERE email = ? AND orgId = ? LIMIT 1`,
            userRecord.email, orgId
          );
        }
      }
      let clientProjectIds = [];
      if (clientRows.length > 0) {
        const projects = await prisma.project.findMany({
          where: { clientId: clientRows[0].id, orgId },
          select: { id: true }
        });
        clientProjectIds = projects.map(p => p.id);
      }
      recentWhere.projectId = { in: clientProjectIds.length > 0 ? clientProjectIds : ['__none__'] };
    } else if (recentRole === 'STAFF') {
      // STAFF: only see tasks assigned to them
      delete recentWhere.userId;
      let staffAssigneeTaskIds = [];
      try {
        await ensureAssigneesTable();
        const rows = await prisma.$queryRawUnsafe(
          `SELECT taskId FROM task_assignees WHERE userId = ? AND orgId = ?`,
          req.user.id, orgId
        );
        staffAssigneeTaskIds = rows.map(r => r.taskId);
      } catch (_) {}
      recentWhere.OR = [
        { userId: req.user.id },
        ...(staffAssigneeTaskIds.length > 0 ? [{ id: { in: staffAssigneeTaskIds } }] : [])
      ];
    }

    // EMERGENCY FIX: Remove relations causing collation mismatch
    const tasks = await prisma.macroTask.findMany({
      where: recentWhere,
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    // EMERGENCY FIX: Simplify to avoid collation issues
    const tasksWithStats = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      lastWorked: null, // Will fix later after database collation issue is resolved
      totalTime: 0, // Will fix later after database collation issue is resolved
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      completedAt: task.completedAt
    }));
    
    res.json({
      success: true,
      tasks: tasksWithStats,
      total: tasksWithStats.length
    });
  } catch (error) {
    console.error('Error fetching recent tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent tasks' });
  }
});

// Get comment + attachment counts for all tasks in an org (batch)
router.get('/counts', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId is required' });

    const [commentRows, attachmentRows] = await Promise.all([
      prisma.$queryRawUnsafe(
        'SELECT taskId, COUNT(*) as count FROM task_comments WHERE orgId = ? GROUP BY taskId',
        orgId
      ),
      prisma.$queryRawUnsafe(
        'SELECT taskId, COUNT(*) as count FROM task_attachments WHERE orgId = ? GROUP BY taskId',
        orgId
      ),
    ]);

    const counts = {};
    for (const row of commentRows) {
      if (!counts[row.taskId]) counts[row.taskId] = { comments: 0, attachments: 0 };
      counts[row.taskId].comments = Number(row.count);
    }
    for (const row of attachmentRows) {
      if (!counts[row.taskId]) counts[row.taskId] = { comments: 0, attachments: 0 };
      counts[row.taskId].attachments = Number(row.count);
    }

    res.json({ success: true, counts });
  } catch (error) {
    console.error('Error fetching task counts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch counts' });
  }
});

// Get task details
router.get('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await prisma.macroTask.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        org: {
          select: {
            id: true,
            name: true
          }
        },
        timeLogs: {
          select: {
            id: true,
            begin: true,
            end: true,
            duration: true,
            description: true,
            category: true
          },
          orderBy: {
            begin: 'desc'
          }
        }
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Calculate total time worked
    const totalTime = task.timeLogs
      .filter(log => log.end !== null)
      .reduce((sum, log) => sum + log.duration, 0);
    
    // Get last worked time
    const lastWorked = task.timeLogs.length > 0 ? task.timeLogs[0].begin : null;
    
    const taskDetails = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      lastWorked: lastWorked,
      totalTime: totalTime,
      assignedTo: task.user,
      organization: task.org,
      tags: task.tags,
      timeLogs: task.timeLogs
    };
    
    res.json(taskDetails);
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({ error: 'Failed to fetch task details' });
  }
});

// Create new task
router.post('/', requireAuthOrApiKey, withOrgScope, validateBody(taskSchemas.create), async (req, res) => {
  try {
    const {
      title,
      description,
      userId,
      orgId,
      priority = 'Medium',
      status = 'not_started',
      estimatedHours = 0,
      category = 'General',
      projectId,
      dueDate,
      tags
    } = req.body;

    if (!title || !userId || !orgId) {
      return res.status(400).json({ error: 'title, userId, and orgId are required' });
    }
    
    // If projectId is provided, fetch project name for category
    let taskCategory = category;
    if (projectId) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true }
        });
        if (project) {
          taskCategory = `Project: ${project.name}`;
        }
      } catch (error) {
        console.error('Error fetching project for task creation:', error);
      }
    }

    const task = await prisma.macroTask.create({
      data: {
        title,
        description,
        userId,
        orgId,
        createdBy: userId,
        priority,
        status,
        estimatedHours: parseFloat(estimatedHours),
        category: taskCategory,
        projectId: projectId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });
    
    console.log(`✅ Created new task: ${title}`);

    // Store multi-assignees
    const assigneeIds = Array.isArray(req.body.assigneeIds) && req.body.assigneeIds.length > 0
      ? req.body.assigneeIds
      : (userId ? [userId] : []);
    await setTaskAssignees(task.id, orgId, assigneeIds);

    // Notify all assignees (excluding the creator)
    if (assigneeIds.length > 0) {
      const creator = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      for (const assigneeId of assigneeIds) {
        if (assigneeId !== req.user.id) {
          createNotification({
            userId: assigneeId,
            orgId,
            title: `New Task Assigned: ${title}`,
            body: `Assigned to you by ${creator?.name || 'a team member'}${task.project ? ` in "${task.project.name}"` : ''}.`,
            type: 'task',
          });
        }
      }
    }

    res.status(201).json({
      task: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task (PUT)
router.put('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    console.log('🔄 Task update request:', {
      taskId,
      updates: JSON.stringify(updates, null, 2),
      userId: req.user?.id,
      orgId: req.orgId
    });
    
    // Remove fields that shouldn't be updated directly
    const newAssigneeIds = updates.assigneeIds;
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.createdBy;
    delete updates.assigneeIds;

    // Handle date fields
    if (updates.dueDate !== undefined) {
      updates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.completedAt) {
      updates.completedAt = new Date(updates.completedAt);
    }

    // Handle numeric fields
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = typeof updates.estimatedHours === 'number' ? updates.estimatedHours : parseFloat(updates.estimatedHours) || 0;
    }
    if (updates.actualHours !== undefined) {
      updates.actualHours = typeof updates.actualHours === 'number' ? updates.actualHours : parseFloat(updates.actualHours) || 0;
    }

    // Handle projectId - store it in database and also update category for compatibility
    if (updates.projectId !== undefined) {
      if (updates.projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: updates.projectId },
            select: { name: true }
          });
          if (project) {
            updates.category = `Project: ${project.name}`;
            // Keep projectId - it IS a valid database field
          }
        } catch (error) {
          console.error('Error fetching project for task update:', error);
        }
      } else {
        updates.category = 'General';
        updates.projectId = null; // Set to null for no project
      }
    }

    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });

    // Replace assignees if provided (empty array clears all)
    if (Array.isArray(newAssigneeIds)) {
      await setTaskAssignees(taskId, req.orgId, newAssigneeIds);
    }

    console.log(`📝 Updated task ${taskId}`);

    // Notify new assignees if task was reassigned
    const notifyIds = Array.isArray(newAssigneeIds) ? newAssigneeIds : (updates.userId ? [updates.userId] : []);
    if (notifyIds.length > 0) {
      const updater = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      for (const uid of notifyIds) {
        if (uid !== req.user.id) {
          createNotification({
            userId: uid,
            orgId: req.orgId,
            title: `Task Assigned to You: ${task.title}`,
            body: `Assigned by ${updater?.name || 'a team member'}${task.project ? ` (${task.project.name})` : ''}.`,
            type: 'task',
          });
        }
      }
    }

    res.json({
      task: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Update task (PATCH - same as PUT for compatibility)
router.patch('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    console.log('🔄 Task PATCH request:', {
      taskId,
      updates: JSON.stringify(updates, null, 2),
      userId: req.user?.id,
      orgId: req.orgId
    });

    // Remove fields that shouldn't be updated directly
    const newAssigneeIdsPatch = updates.assigneeIds;
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.createdBy;
    delete updates.assigneeIds;

    // Handle date fields
    if (updates.dueDate !== undefined) {
      updates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.completedAt) {
      updates.completedAt = new Date(updates.completedAt);
    }

    // Handle numeric fields
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = typeof updates.estimatedHours === 'number' ? updates.estimatedHours : parseFloat(updates.estimatedHours) || 0;
    }
    if (updates.actualHours !== undefined) {
      updates.actualHours = typeof updates.actualHours === 'number' ? updates.actualHours : parseFloat(updates.actualHours) || 0;
    }

    // Handle projectId - store it in database and also update category for compatibility
    if (updates.projectId !== undefined) {
      if (updates.projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: updates.projectId },
            select: { name: true }
          });
          if (project) {
            updates.category = `Project: ${project.name}`;
            // Keep projectId - it IS a valid database field
          }
        } catch (error) {
          console.error('Error fetching project for task update:', error);
        }
      } else {
        updates.category = 'General';
        updates.projectId = null; // Set to null for no project
      }
    }

    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true
          }
        }
      }
    });

    // Replace assignees if provided (empty array clears all)
    if (Array.isArray(newAssigneeIdsPatch)) {
      await setTaskAssignees(taskId, req.orgId, newAssigneeIdsPatch);
    }

    console.log(`📝 PATCH Updated task ${taskId}`);

    // Notify new assignees if reassigned
    const notifyIdsPatch = Array.isArray(newAssigneeIdsPatch) ? newAssigneeIdsPatch : (updates.userId ? [updates.userId] : []);
    if (notifyIdsPatch.length > 0) {
      const updater = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      for (const uid of notifyIdsPatch) {
        if (uid !== req.user.id) {
          createNotification({
            userId: uid,
            orgId: req.orgId,
            title: `Task Assigned to You: ${task.title}`,
            body: `Assigned by ${updater?.name || 'a team member'}${task.project ? ` (${task.project.name})` : ''}.`,
            type: 'task',
          });
        }
      }
    }

    res.json({
      task: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task (PATCH):', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Update task status
router.patch('/:taskId/status', requireAuth, withOrgScope, requireTaskOwnership, validateBody(taskSchemas.statusUpdate), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    
    const updateData = { status };
    
    // If marking as completed, set completedAt timestamp
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status !== 'completed') {
      // If changing from completed to something else, clear completedAt
      updateData.completedAt = null;
    }
    
    const task = await prisma.macroTask.update({
      where: { id: taskId },
      data: updateData
    });
    
    console.log(`📝 Updated task ${taskId} status to: ${status}`);

    // Notify the task assignee about the status change (if someone else changed it)
    if (task.userId && task.userId !== req.user.id) {
      const updater = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      createNotification({
        userId: task.userId,
        orgId: req.orgId,
        title: `Task Status Updated: ${task.title}`,
        body: `Status changed to "${status}" by ${updater?.name || 'a team member'}.`,
        type: 'task',
      });
    }
    // If completed, also notify all org admins/owners (excluding the completer and assignee)
    if (status === 'completed') {
      prisma.membership.findMany({
        where: { orgId: req.orgId, role: { in: ['OWNER', 'ADMIN'] } },
        select: { userId: true },
      }).then(admins => {
        for (const { userId: adminId } of admins) {
          if (adminId !== req.user.id && adminId !== task.userId) {
            createNotification({
              userId: adminId,
              orgId: req.orgId,
              title: `Task Completed: ${task.title}`,
              body: `"${task.title}" has been marked as completed.`,
              type: 'task',
            });
          }
        }
      }).catch(() => {});
    }

    res.json({
      message: 'Task status updated successfully',
      taskId: taskId,
      status: status,
      completedAt: task.completedAt
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Delete task
router.delete('/:taskId', requireAuth, withOrgScope, requireTaskOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    await prisma.macroTask.delete({
      where: { id: taskId }
    });
    
    console.log(`🗑️ Deleted task ${taskId}`);
    
    res.json({
      message: 'Task deleted successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get tasks by organization
router.get('/org/:orgId', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, priority, userId, limit = 50, offset = 0 } = req.query;
    
    const where = { orgId };
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = userId;
    
    const tasks = await prisma.macroTask.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            timeLogs: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    const total = await prisma.macroTask.count({ where });
    
    res.json({
      tasks,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching organization tasks:', error);
    res.status(500).json({ error: 'Failed to fetch organization tasks' });
  }
});

// Get tasks for the entire team/organization (admin view)
router.get('/team', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { orgId, status, priority, limit = 50, assignedTo } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    const where = { orgId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.userId = assignedTo;
    
    const tasks = await prisma.macroTask.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        timeLogs: {
          select: {
            begin: true,
            end: true,
            duration: true,
            userId: true,
            user: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            begin: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            timeLogs: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    // Calculate total time and last worked for each task
    const tasksWithStats = await Promise.all(tasks.map(async (task) => {
      // Get total time worked on this task by all users
      const timeStats = await prisma.timeLog.aggregate({
        where: {
          taskId: task.id,
          end: { not: null } // Only completed time entries
        },
        _sum: {
          duration: true
        }
      });
      
      const totalTime = timeStats._sum.duration || 0;
      const lastWorked = task.timeLogs.length > 0 ? task.timeLogs[0].begin : null;
      const lastWorkedBy = task.timeLogs.length > 0 ? task.timeLogs[0].user?.name : null;
      
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        category: task.category,
        dueDate: task.dueDate,
        assignedTo: task.user,
        lastWorked: lastWorked,
        lastWorkedBy: lastWorkedBy,
        totalTime: totalTime,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      };
    }));
    
    res.json({
      success: true,
      tasks: tasksWithStats,
      total: tasksWithStats.length
    });
  } catch (error) {
    console.error('Error fetching team tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch team tasks' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/tasks/:taskId/comments */
router.get('/:taskId/comments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const comments = await prisma.taskComment.findMany({
      where: { taskId: req.params.taskId, orgId: req.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, comments });
  } catch (e) { console.error('Failed to fetch comments:', e); res.status(500).json({ error: 'Failed to fetch comments' }); }
});

/** POST /api/tasks/:taskId/comments */
router.post('/:taskId/comments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const comment = await prisma.taskComment.create({
      data: { taskId: req.params.taskId, orgId: req.orgId, userId: req.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Notify task assignee and creator (excluding the commenter)
    try {
      const taskInfo = await prisma.macroTask.findUnique({
        where: { id: req.params.taskId },
        select: { userId: true, title: true, createdBy: true },
      });
      if (taskInfo) {
        const notifyIds = new Set([taskInfo.userId, taskInfo.createdBy].filter(id => id && id !== req.user.id));
        const commenterName = comment.user?.name || 'Someone';
        const preview = content.trim().length > 100 ? content.trim().slice(0, 97) + '...' : content.trim();
        for (const uid of notifyIds) {
          createNotification({
            userId: uid,
            orgId: req.orgId,
            title: `New Comment on: ${taskInfo.title}`,
            body: `${commenterName}: "${preview}"`,
            type: 'comment',
          });
        }
      }
    } catch (_) {}

    res.status(201).json({ success: true, comment });
  } catch (e) { console.error('Failed to post comment:', e); res.status(500).json({ error: 'Failed to post comment' }); }
});

/** DELETE /api/tasks/:taskId/comments/:commentId */
router.delete('/:taskId/comments/:commentId', requireAuth, withOrgScope, async (req, res) => {
  try {
    const comment = await prisma.taskComment.findFirst({
      where: { id: req.params.commentId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== req.user.id) return res.status(403).json({ error: 'Not your comment' });
    await prisma.taskComment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete comment' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/tasks/:taskId/attachments */
router.get('/:taskId/attachments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: req.params.taskId, orgId: req.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, mimeType: true, size: true, category: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ success: true, attachments });
  } catch (e) { console.error('Failed to fetch attachments:', e); res.status(500).json({ error: 'Failed to fetch attachments' }); }
});

/** GET /api/tasks/:taskId/attachments/:attachId/download */
router.get('/:taskId/attachments/:attachId/download', requireAuth, withOrgScope, async (req, res) => {
  try {
    const att = await prisma.taskAttachment.findFirst({
      where: { id: req.params.attachId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    res.json({ success: true, attachment: att });
  } catch (e) { res.status(500).json({ error: 'Failed to download attachment' }); }
});

/** POST /api/tasks/:taskId/attachments  body: { name, mimeType, size, data (base64), category? } */
router.post('/:taskId/attachments', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { name, mimeType, size, data, category = 'attachment' } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name and data required' });
    const att = await prisma.taskAttachment.create({
      data: { taskId: req.params.taskId, orgId: req.orgId, userId: req.user.id,
        name, mimeType: mimeType || 'application/octet-stream', size: size || 0, data, category },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const { data: _d, ...rest } = att;
    res.status(201).json({ success: true, attachment: rest });
  } catch (e) { console.error('Failed to upload attachment:', e); res.status(500).json({ error: 'Failed to upload attachment' }); }
});

/** DELETE /api/tasks/:taskId/attachments/:attachId */
router.delete('/:taskId/attachments/:attachId', requireAuth, withOrgScope, async (req, res) => {
  try {
    const att = await prisma.taskAttachment.findFirst({
      where: { id: req.params.attachId, taskId: req.params.taskId, orgId: req.orgId },
    });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    if (att.userId !== req.user.id) return res.status(403).json({ error: 'Not your attachment' });
    await prisma.taskAttachment.delete({ where: { id: req.params.attachId } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete attachment' }); }
});

export default router;