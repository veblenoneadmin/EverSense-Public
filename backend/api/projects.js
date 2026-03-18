// Project management API endpoints
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireResourceOwnership } from '../lib/rbac.js';
import { validateBody, validateQuery, commonSchemas, projectSchemas } from '../lib/validation.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
import { createNotification } from './notifications.js';
const router = express.Router();

// Get all projects for a user/organization
router.get('/', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { userId, status, limit = 50 } = req.query;
    // Always use req.orgId — set by withOrgScope (falls back to EMERGENCY hardcoded value)
    const orgId = req.orgId;

    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }

    const where = { orgId };
    if (status) where.status = status;

    // CLIENT role — restrict to projects linked to their client record
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user.id, orgId },
      select: { role: true },
    });
    console.log(`[Projects] GET / userId=${req.user.id} orgId=${orgId} role=${membership?.role || 'none'}`);
    if (membership?.role === 'CLIENT') {
      let clientId = null;

      // Get user email for lookups
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true, name: true },
      });
      console.log(`[Projects] CLIENT lookup — userId=${req.user.id} email=${user?.email} orgId=${req.orgId}`);

      // 1) Try user_id lookup (column may not exist on older deployments)
      try {
        const rows = await prisma.$queryRawUnsafe(
          'SELECT id FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1',
          req.user.id, req.orgId
        );
        if (rows.length) { clientId = rows[0].id; console.log(`[Projects] found by user_id: ${clientId}`); }
      } catch { /* user_id column not yet added */ }

      // 2) Fallback: case-insensitive email match
      if (!clientId && user?.email) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            'SELECT id, email FROM clients WHERE LOWER(email) = LOWER(?) AND orgId = ? LIMIT 1',
            user.email, req.orgId
          );
          if (rows.length) { clientId = rows[0].id; console.log(`[Projects] found by email: ${clientId} (db email: ${rows[0].email})`); }
          else {
            // Log ALL clients in this org so we can see what's there
            const allClients = await prisma.$queryRawUnsafe(
              'SELECT id, name, email FROM clients WHERE orgId = ?', req.orgId
            );
            console.log(`[Projects] No email match. Clients in org: ${JSON.stringify(allClients.map(c => ({ id: c.id, email: c.email })))}`);
          }
        } catch (e) { console.warn(`[Projects] email lookup error: ${e.message}`); }
      }

      if (clientId) {
        where.clientId = clientId;
        // Also check how many projects are linked
        const linkedCount = await prisma.project.count({ where: { clientId, orgId } });
        console.log(`[Projects] clientId=${clientId} → ${linkedCount} linked projects in org`);
      } else {
        console.log(`[Projects] CLIENT ${req.user.id} → no client record found`);
        return res.json({ success: true, projects: [], total: 0 });
      }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    if (where.clientId) {
      console.log(`[Projects] CLIENT query returned ${projects.length} projects for clientId=${where.clientId}`);
    }

    // Enrich projects with task stats and actual time spent
    const enrichedProjects = [...projects];
    if (projects.length) {
      try {
        const projectIds = projects.map(p => p.id);
        const ph = projectIds.map(() => '?').join(',');
        const taskStats = await prisma.$queryRawUnsafe(
          `SELECT projectId,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                  SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
                  SUM(COALESCE(actualHours, 0)) AS timeSpent
           FROM macro_tasks
           WHERE projectId IN (${ph})
           GROUP BY projectId`,
          ...projectIds
        );
        const statsMap = {};
        for (const row of taskStats) {
          statsMap[row.projectId] = {
            total:      Number(row.total),
            completed:  Number(row.completed),
            inProgress: Number(row.inProgress),
            pending:    Number(row.total) - Number(row.completed) - Number(row.inProgress),
            timeSpent:  Number(row.timeSpent),
          };
        }
        for (const p of enrichedProjects) {
          p.tasks = statsMap[p.id] || { total: 0, completed: 0, inProgress: 0, pending: 0, timeSpent: 0 };
          p.hoursLogged = statsMap[p.id]?.timeSpent ?? p.hoursLogged;
        }
      } catch (statsErr) {
        console.warn('[Projects] task stats enrichment failed:', statsErr.message);
      }
    }

    res.json({
      success: true,
      projects: enrichedProjects,
      total: enrichedProjects.length
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch projects');
  }
});

// Create new project
router.post('/', requireAuth, withOrgScope, validateBody(projectSchemas.create), async (req, res) => {
  try {
    let { orgId, name, description, clientId, budget, estimatedHours, startDate, endDate, priority, status, color } = req.body;
    
    // EMERGENCY FIX: Auto-provide orgId if missing but user is authenticated
    if (!orgId && req.user?.id) {
      console.log('🔧 EMERGENCY: Auto-adding orgId for project creation');
      orgId = 'org_1757046595553';
    }
    
    if (!orgId || !name) {
      return res.status(400).json({ error: 'Missing required fields: orgId and name are required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        description: description || null,
        clientId: clientId || null,
        budget: budget ? parseFloat(budget) : null,
        estimatedHours: estimatedHours ? parseInt(estimatedHours) : 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        priority: priority || 'medium',
        status: status || 'planning',
        color: color || 'bg-primary'
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`✅ Created new project: ${name}`);

    // Notify all org admins/owners about the new project (excluding the creator)
    try {
      const creator = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      const admins = await prisma.membership.findMany({
        where: { orgId: project.orgId, role: { in: ['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'] } },
        select: { userId: true },
      });
      for (const { userId: adminId } of admins) {
        if (adminId !== req.user.id) {
          createNotification({
            userId: adminId,
            orgId: project.orgId,
            title: `New Project: ${project.name}`,
            body: `Created by ${creator?.name || 'a team member'}.`,
            type: 'project',
            link: '/projects',
          });
        }
      }
    } catch (_) {}

    res.status(201).json({
      success: true,
      project
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'create project');
  }
});

// Update project
router.patch('/:id', requireAuth, withOrgScope, validateBody(projectSchemas.update), async (req, res) => {
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
    
    // Handle numeric fields
    if (updates.budget !== undefined) {
      updates.budget = updates.budget ? parseFloat(updates.budget) : null;
    }
    if (updates.estimatedHours !== undefined) {
      updates.estimatedHours = updates.estimatedHours ? parseInt(updates.estimatedHours) : 0;
    }
    if (updates.hoursLogged !== undefined) {
      updates.hoursLogged = updates.hoursLogged ? parseInt(updates.hoursLogged) : 0;
    }
    if (updates.progress !== undefined) {
      updates.progress = updates.progress ? parseInt(updates.progress) : 0;
    }
    if (updates.spent !== undefined) {
      updates.spent = updates.spent ? parseFloat(updates.spent) : 0;
    }
    
    // Handle date fields
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate);
    }
    
    const project = await prisma.project.update({
      where: { id },
      data: updates,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`📝 Updated project ${id}`);

    // Notify org admins/owners if status was changed (excluding the updater)
    if (updates.status) {
      try {
        const updater = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        const admins = await prisma.membership.findMany({
          where: { orgId: project.orgId, role: { in: ['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'] } },
          select: { userId: true },
        });
        for (const { userId: adminId } of admins) {
          if (adminId !== req.user.id) {
            createNotification({
              userId: adminId,
              orgId: project.orgId,
              title: `Project Updated: ${project.name}`,
              body: `Status changed to "${project.status}" by ${updater?.name || 'a team member'}.`,
              type: 'project',
              link: '/projects',
            });
          }
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      project,
      message: 'Project updated successfully'
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'update project');
  }
});

// Delete project
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    await prisma.project.delete({
      where: { id }
    });
    
    console.log(`🗑️ Deleted project ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'delete project');
  }
});

// Get project statistics
router.get('/stats', requireAuth, withOrgScope, validateQuery(commonSchemas.pagination), async (req, res) => {
  try {
    const { userId, orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }
    
    // Check database connection first
    if (!(await checkDatabaseConnection(res))) {
      return; // Response already sent by checkDatabaseConnection
    }
    
    const projects = await prisma.project.findMany({
      where: { orgId },
      select: {
        status: true,
        budget: true,
        spent: true,
        hoursLogged: true,
        estimatedHours: true,
        endDate: true
      }
    });
    
    const now = new Date();
    const stats = {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      overdue: projects.filter(p => p.endDate && new Date(p.endDate) < now && p.status !== 'completed').length,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
      totalSpent: projects.reduce((sum, p) => sum + (p.spent || 0), 0),
      totalHours: projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0),
      totalEstimatedHours: projects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0)
    };
    
    res.json({ 
      success: true, 
      stats 
    });
    
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch project statistics');
  }
});

// ── Keyword-based task simulation (fallback when no AI key is set) ────────────
function simulateTaskGeneration(name, description, priority) {
  const text = `${name} ${description || ''}`.toLowerCase();
  const p    = { high: 'High', medium: 'Medium', low: 'Low' }[priority?.toLowerCase()] || 'Medium';

  const isWeb      = /web|website|frontend|react|angular|vue|ui|ux|portal/.test(text);
  const isBackend  = /backend|api|server|database|node|python|django|rails/.test(text);
  const isMobile   = /mobile|app|ios|android|flutter|react native/.test(text);
  const isDesign   = /design|figma|brand|logo|graphic|visual/.test(text);
  const isMarketing = /marketing|campaign|social|seo|content|email/.test(text);
  const isData     = /data|analytics|report|dashboard|bi|machine learning|ml|ai/.test(text);

  if (isWeb || isMobile) return [
    { title: 'Design UI wireframes',            description: 'Create wireframes and mockups for key user flows', requiredSkills: ['UI Design'],        priority: p, estimatedHours: 8  },
    { title: 'Set up project structure',        description: 'Initialize repository and configure dev environment', requiredSkills: ['Frontend Development'], priority: p, estimatedHours: 4 },
    { title: 'Implement frontend components',   description: 'Build reusable UI components based on designs', requiredSkills: ['React'],             priority: p, estimatedHours: 16 },
    { title: 'Develop backend API endpoints',   description: 'Create REST API endpoints to support all features', requiredSkills: ['Backend API'],      priority: p, estimatedHours: 12 },
    { title: 'Database schema design',          description: 'Design and implement database models', requiredSkills: ['Database'],          priority: p, estimatedHours: 6  },
    { title: 'QA testing and bug fixes',        description: 'Conduct end-to-end testing and resolve issues', requiredSkills: ['QA Testing'],        priority: p, estimatedHours: 8  },
    { title: 'Deployment and monitoring setup', description: 'Deploy to production and configure monitoring alerts', requiredSkills: ['DevOps'],            priority: 'Low', estimatedHours: 4 },
  ];
  if (isDesign) return [
    { title: 'Brand research and moodboard',   description: 'Research competitors and create design direction', requiredSkills: ['UI Design'],    priority: p, estimatedHours: 6  },
    { title: 'Logo and identity design',       description: 'Create primary logo and brand identity system', requiredSkills: ['UI Design'],    priority: p, estimatedHours: 12 },
    { title: 'Design system creation',         description: 'Build reusable component library and style guide', requiredSkills: ['UI Design'],    priority: p, estimatedHours: 10 },
    { title: 'Client review and revisions',    description: 'Present designs and incorporate feedback', requiredSkills: ['Project Management'], priority: p, estimatedHours: 4  },
    { title: 'Final asset export and delivery',description: 'Export all assets in required formats', requiredSkills: ['UI Design'],    priority: 'Low', estimatedHours: 3 },
  ];
  if (isMarketing) return [
    { title: 'Campaign strategy and planning', description: 'Define target audience, goals, and KPIs', requiredSkills: ['Project Management'], priority: p, estimatedHours: 6  },
    { title: 'Content creation',               description: 'Write copy and create visuals for campaign materials', requiredSkills: ['UI Design'],        priority: p, estimatedHours: 12 },
    { title: 'SEO and keyword research',       description: 'Research and implement SEO strategy', requiredSkills: ['Backend API'],      priority: p, estimatedHours: 8  },
    { title: 'Campaign launch and monitoring', description: 'Launch campaign and monitor performance metrics', requiredSkills: ['Project Management'], priority: p, estimatedHours: 4  },
    { title: 'Results analysis and reporting', description: 'Analyse results and prepare performance report', requiredSkills: ['Project Management'], priority: 'Low', estimatedHours: 4 },
  ];
  if (isData) return [
    { title: 'Data requirements gathering',    description: 'Define data sources, metrics, and reporting needs', requiredSkills: ['Project Management'], priority: p, estimatedHours: 4  },
    { title: 'Database and pipeline setup',    description: 'Set up data ingestion and transformation pipelines', requiredSkills: ['Database'],          priority: p, estimatedHours: 10 },
    { title: 'Dashboard design',               description: 'Design and build interactive data visualisations', requiredSkills: ['UI Design'],        priority: p, estimatedHours: 12 },
    { title: 'Data validation and testing',    description: 'Validate data accuracy and test edge cases', requiredSkills: ['QA Testing'],        priority: p, estimatedHours: 6  },
    { title: 'Documentation and handover',     description: 'Document data models and prepare user guide', requiredSkills: ['Project Management'], priority: 'Low', estimatedHours: 3 },
  ];
  // General fallback
  return [
    { title: `Define ${name} requirements`,   description: 'Document detailed requirements and acceptance criteria', requiredSkills: ['Project Management'], priority: p,     estimatedHours: 4  },
    { title: 'Create project plan',            description: 'Break down work into milestones and assign responsibilities', requiredSkills: ['Project Management'], priority: p,     estimatedHours: 3  },
    { title: 'Solution architecture design',  description: 'Design technical approach and component interactions', requiredSkills: ['Backend API'],      priority: p,     estimatedHours: 6  },
    { title: 'Core implementation – Phase 1', description: 'Implement the primary features and core functionality', requiredSkills: ['Backend API'],      priority: p,     estimatedHours: 16 },
    { title: 'Testing and quality assurance', description: 'Conduct thorough testing across all features', requiredSkills: ['QA Testing'],        priority: p,     estimatedHours: 8  },
    { title: 'Deployment and handover',        description: 'Deploy to production and prepare handover documentation', requiredSkills: ['DevOps'],            priority: 'Low', estimatedHours: 4  },
  ];
}

// ── POST /api/projects/:id/generate-tasks ────────────────────────────────────
// Generates tasks from project keywords via OpenRouter AI (same key as Brain
// Dump), falls back to keyword-based simulation if no key is configured.
router.post('/:id/generate-tasks', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId  = req.orgId;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project)              return res.status(404).json({ error: 'Project not found' });
    if (project.orgId !== orgId) return res.status(403).json({ error: 'Access denied' });

    // 1. Generate task list — AI if key available, else simulation ─────────────
    let generatedTasks;
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

    if (OPENROUTER_KEY || ANTHROPIC_KEY) {
      const prompt = `You are a project management assistant. Generate a practical, specific task list for this project.

Project Name: ${project.name}
Description:  ${project.description || 'No description provided'}
Priority:     ${project.priority}

Return ONLY a JSON array — no markdown, no extra text:
[
  {
    "title": "Task title",
    "description": "One sentence describing what needs to be done",
    "requiredSkills": ["Skill name"],
    "priority": "high|medium|low",
    "estimatedHours": <number>
  }
]
Rules: 4-8 tasks, 1-2 skills each (use: React, UI Design, Backend API, QA Testing, Project Management, Database, DevOps), estimatedHours 1-16.`;

      let aiRaw = null;
      try {
        if (OPENROUTER_KEY) {
          // OpenRouter (same provider as Brain Dump)
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1500, temperature: 0.3 }),
          });
          if (r.ok) {
            const d = await r.json();
            aiRaw = d.choices?.[0]?.message?.content || null;
          }
        } else if (ANTHROPIC_KEY) {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
          });
          if (r.ok) {
            const d = await r.json();
            aiRaw = d.content?.[0]?.text || null;
          }
        }
      } catch (aiErr) {
        console.warn('[Projects] AI call failed, falling back to simulation:', aiErr.message);
      }

      if (aiRaw) {
        try {
          generatedTasks = JSON.parse(aiRaw.replace(/```json|```/g, '').trim());
        } catch {
          console.warn('[Projects] AI response parse failed, using simulation');
        }
      }
    }

    // Simulation fallback
    if (!generatedTasks || !Array.isArray(generatedTasks) || generatedTasks.length === 0) {
      console.log('[Projects] Using keyword-based simulation for task generation');
      generatedTasks = simulateTaskGeneration(project.name, project.description, project.priority);
    }

    // 2. Fetch all staff with their skills ────────────────────────────────────
    // Falls back to no-skills query if skills tables don't exist yet (P2021)
    let memberships;
    try {
      memberships = await prisma.membership.findMany({
        where: { orgId, role: { in: ['STAFF', 'ADMIN', 'OWNER', 'HALL_OF_JUSTICE'] } },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
            include: {
              staffSkills: {
                where:   { orgId },
                include: { skill: true },
              },
            },
          },
        },
      });
    } catch (skillsErr) {
      console.warn('[Projects] staffSkills tables not ready, skipping skills-based assignment:', skillsErr.message);
      memberships = await prisma.membership.findMany({
        where: { orgId, role: { in: ['STAFF', 'ADMIN', 'OWNER', 'HALL_OF_JUSTICE'] } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
      // Patch in empty staffSkills so the rest of the code works unchanged
      memberships = memberships.map(m => ({ ...m, user: { ...m.user, staffSkills: [] } }));
    }

    // Workload: open task count per user
    const workloadMap = {};
    if (memberships.length) {
      const counts = await Promise.all(
        memberships.map(m =>
          prisma.macroTask.count({
            where: { userId: m.userId, orgId, status: { in: ['not_started', 'in_progress'] } },
          }).then(count => ({ userId: m.userId, count }))
        )
      );
      counts.forEach(w => { workloadMap[w.userId] = w.count; });
    }

    const WORKLOAD_LIMIT = 10; // open tasks before considered overloaded

    // 3. Assign + create each task ────────────────────────────────────────────
    const createdTasks = [];
    const priorityFmt  = { high: 'High', medium: 'Medium', low: 'Low' };

    for (const taskDef of generatedTasks) {
      const reqSkills = taskDef.requiredSkills || [];

      // Score every staff member
      const scored = memberships.map(m => {
        const workload       = workloadMap[m.userId] || 0;
        const matchingSkills = m.user.staffSkills.filter(ss =>
          reqSkills.some(rs =>
            ss.skill.name.toLowerCase().includes(rs.toLowerCase()) ||
            rs.toLowerCase().includes(ss.skill.name.toLowerCase())
          )
        );
        const skillScore = matchingSkills.reduce((sum, ss) => sum + ss.level, 0);
        const topSkill   = [...matchingSkills].sort((a, b) => b.level - a.level)[0];

        return {
          userId:        m.userId,
          name:          m.user.name || m.user.email,
          email:         m.user.email,
          image:         m.user.image,
          workload,
          skillScore,
          topSkillName:  topSkill?.skill.name || null,
          topSkillLevel: topSkill?.level       || 0,
          available:     workload < WORKLOAD_LIMIT,
        };
      });

      scored.sort((a, b) =>
        b.skillScore !== a.skillScore ? b.skillScore - a.skillScore : a.workload - b.workload
      );

      const assignee   = scored[0] || null;
      const assignedTo = assignee?.userId || req.user.id;
      const priority   = priorityFmt[taskDef.priority?.toLowerCase()] ||
                         priorityFmt[project.priority?.toLowerCase()]  || 'Medium';

      try {
        const task = await prisma.macroTask.create({
          data: {
            title:          String(taskDef.title),
            description:    taskDef.description ? String(taskDef.description) : null,
            userId:         assignedTo,
            orgId,
            projectId:      id,
            createdBy:      req.user.id,
            priority,
            estimatedHours: parseFloat(taskDef.estimatedHours) || 0,
            status:         'not_started',
            tags:           reqSkills,
          },
        });

        if (assignee) workloadMap[assignee.userId] = (workloadMap[assignee.userId] || 0) + 1;

        createdTasks.push({
          id:             task.id,
          title:          task.title,
          description:    task.description,
          priority:       task.priority,
          estimatedHours: Number(task.estimatedHours),
          status:         task.status,
          requiredSkills: reqSkills,
          assignee: assignee ? {
            userId:        assignee.userId,
            name:          assignee.name,
            email:         assignee.email,
            image:         assignee.image,
            workload:      assignee.workload,
            skillScore:    assignee.skillScore,
            topSkillName:  assignee.topSkillName,
            topSkillLevel: assignee.topSkillLevel,
          } : null,
        });
      } catch (taskErr) {
        console.error(`[Projects] Failed to create task "${taskDef.title}":`, taskErr.message);
        // Skip this task and continue with the rest
      }
    }

    if (createdTasks.length === 0) {
      return res.status(500).json({ error: 'All task creations failed — check server logs' });
    }

    console.log(`[Projects] ✅ Generated ${createdTasks.length} tasks for "${project.name}"`);
    res.json({ success: true, tasks: createdTasks, count: createdTasks.length });

  } catch (err) {
    console.error('[Projects] generate-tasks error:', err);
    res.status(500).json({ error: 'Failed to generate tasks', details: err.message });
  }
});

// ── GET /api/projects/:id/overview ───────────────────────────────────────────
// Returns project + all its tasks with assignee info.
router.get('/:id/overview', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where:   { id },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
    if (!project)                  return res.status(404).json({ error: 'Project not found' });
    if (project.orgId !== req.orgId) return res.status(403).json({ error: 'Access denied' });

    const tasks = await prisma.macroTask.findMany({
      where:   { projectId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with user data (non-fatal)
    const userIds  = [...new Set(tasks.map(t => t.userId).filter(Boolean))];
    const usersMap = {};
    if (userIds.length) {
      try {
        const users = await prisma.user.findMany({
          where:  { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        });
        users.forEach(u => { usersMap[u.id] = u; });
      } catch { /* non-fatal */ }
    }

    const enriched = tasks.map(t => {
      const u = t.userId ? usersMap[t.userId] : null;
      return {
        id:             t.id,
        title:          t.title,
        description:    t.description,
        status:         t.status,
        priority:       t.priority,
        estimatedHours: t.estimatedHours,
        requiredSkills: Array.isArray(t.tags) ? t.tags : [],
        createdAt:      t.createdAt,
        assignee: u ? {
          userId: t.userId,
          name:   u.name || u.email,
          email:  u.email,
          image:  u.image,
        } : null,
      };
    });

    res.json({ success: true, project, tasks: enriched });

  } catch (err) {
    console.error('[Projects] overview error:', err);
    res.status(500).json({ error: 'Failed to fetch project overview' });
  }
});

export default router;