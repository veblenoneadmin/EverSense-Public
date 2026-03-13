// backend/api/skills.js — Skillset management + AI task auto-assign
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// Lazy-init: create tables on first request if they don't exist yet
let tablesReady = false;
async function ensureSkillsTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `skills` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `name` VARCHAR(100) NOT NULL,' +
      '  `category` VARCHAR(50) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `skills_name_orgId_key` (`name`,`orgId`),' +
      '  KEY `skills_orgId_idx` (`orgId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `staff_skills` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(191) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `skillId` VARCHAR(191) NOT NULL,' +
      '  `level` INT NOT NULL,' +
      '  `yearsExp` INT NOT NULL DEFAULT 0,' +
      '  `notes` TEXT NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `staff_skills_userId_skillId_key` (`userId`,`skillId`),' +
      '  KEY `staff_skills_orgId_idx` (`orgId`),' +
      '  KEY `staff_skills_userId_idx` (`userId`),' +
      '  KEY `staff_skills_skillId_idx` (`skillId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
    console.log('[Skills] Tables ready');
  } catch (e) {
    console.error('[Skills] Table init error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL LIBRARY (org-level skill definitions)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/skills/library — all skills defined for this org
router.get('/library', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const skills = await prisma.skill.findMany({
      where: { orgId: req.orgId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { staffSkills: true } } },
    });
    res.json({ skills });
  } catch (err) {
    console.error('[Skills] library error:', err);
    res.status(500).json({ error: 'Failed to fetch skill library' });
  }
});

// POST /api/skills/library — create a new skill (admin/owner only)
router.post('/library', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const { name, category } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });

    const skill = await prisma.skill.upsert({
      where: { name_orgId: { name: name.trim(), orgId: req.orgId } },
      update: { category },
      create: { name: name.trim(), category, orgId: req.orgId },
    });
    res.status(201).json({ skill });
  } catch (err) {
    console.error('[Skills] create error:', err);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

// DELETE /api/skills/library/:skillId
router.delete('/library/:skillId', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    await prisma.skill.delete({ where: { id: req.params.skillId } });
    res.json({ message: 'Skill deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SKILLS (per-user skill ratings)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/skills/staff/:userId — get one user's skills
router.get('/staff/:userId', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const raw = await prisma.staffSkill.findMany({
      where: { userId: req.params.userId, orgId: req.orgId },
      include: { skill: true },
      orderBy: [{ skill: { category: 'asc' } }, { level: 'desc' }],
    });
    const staffSkills = raw.map(ss => ({
      id:       ss.id,
      skillId:  ss.skillId,
      name:     ss.skill.name,
      category: ss.skill.category,
      level:    ss.level,
      yearsExp: ss.yearsExp,
      notes:    ss.notes,
    }));
    res.json({ staffSkills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff skills' });
  }
});

// GET /api/skills/team — all staff skills for the org (admin view)
router.get('/team', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const memberships = await prisma.membership.findMany({
      where: { orgId: req.orgId, role: { not: 'CLIENT' } },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
          include: {
            staffSkills: {
              where: { orgId: req.orgId },
              include: { skill: true },
            },
          },
        },
      },
    });

    const team = memberships.map(m => ({
      userId:    m.userId,
      name:      m.user.name || m.user.email,
      email:     m.user.email,
      image:     m.user.image,
      role:      m.role,
      skills:    m.user.staffSkills.map(ss => ({
        id:       ss.id,
        skillId:  ss.skillId,
        name:     ss.skill.name,
        category: ss.skill.category,
        level:    ss.level,
        yearsExp: ss.yearsExp,
        notes:    ss.notes,
      })),
    }));

    res.json({ team });
  } catch (err) {
    console.error('[Skills] team error:', err);
    res.status(500).json({ error: 'Failed to fetch team skills' });
  }
});

// PUT /api/skills/staff — upsert a skill for a user
router.put('/staff', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const { skillId, level, yearsExp, notes } = req.body;
    const userId = req.user.id;

    if (!skillId || !level) return res.status(400).json({ error: 'skillId and level required' });
    if (level < 1 || level > 5) return res.status(400).json({ error: 'level must be 1-5' });

    const staffSkill = await prisma.staffSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      update: { level: parseInt(level), yearsExp: yearsExp || 0, notes: notes || null, orgId: req.orgId },
      create: { userId, skillId, orgId: req.orgId, level: parseInt(level), yearsExp: yearsExp || 0, notes: notes || null },
      include: { skill: true },
    });

    res.json({ staffSkill });
  } catch (err) {
    console.error('[Skills] upsert error:', err);
    res.status(500).json({ error: 'Failed to save skill' });
  }
});

// DELETE /api/skills/staff/:skillId — remove a skill from current user
router.delete('/staff/:skillId', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    await prisma.staffSkill.deleteMany({
      where: { userId: req.user.id, skillId: req.params.skillId, orgId: req.orgId },
    });
    res.json({ message: 'Skill removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove skill' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI SKILL GENERATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/skills/ai-generate — given a team/role description, AI suggests skills
router.post('/ai-generate', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

    const VALID_CATEGORIES = ['Technical', 'Design', 'Management', 'Communication', 'Sales', 'Operations', 'Finance', 'Other'];

    const systemPrompt = `You are a skills taxonomy expert. Given a description of a team, company, or role, generate a comprehensive list of relevant professional skills.

Output ONLY a JSON array (no markdown, no extra text) with 10-20 skills in this format:
[
  { "name": "Skill Name", "category": "Category" },
  ...
]

Valid categories: ${VALID_CATEGORIES.join(', ')}

Rules:
- Each skill name should be concise (1-4 words), specific, and professional
- Cover a diverse mix of categories relevant to the description
- No duplicates
- Skills should be practical and industry-standard`;

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt.trim() },
        ],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('[Skills] AI generate error:', err);
      return res.status(500).json({ error: 'AI service unavailable' });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';

    let skills;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      skills = JSON.parse(clean);
      if (!Array.isArray(skills)) throw new Error('Not an array');
      // Validate and sanitize
      skills = skills
        .filter(s => s.name && typeof s.name === 'string')
        .map(s => ({
          name: s.name.trim().slice(0, 100),
          category: VALID_CATEGORIES.includes(s.category) ? s.category : 'Other',
        }));
    } catch (e) {
      console.error('[Skills] AI parse error:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: rawText });
    }

    res.json({ skills });
  } catch (err) {
    console.error('[Skills] ai-generate error:', err);
    res.status(500).json({ error: 'AI generation failed', details: err.message });
  }
});

// POST /api/skills/library/bulk — add multiple skills at once
router.post('/library/bulk', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureSkillsTables();
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) return res.status(400).json({ error: 'skills array required' });

    let added = 0;
    let skipped = 0;
    for (const s of skills) {
      if (!s.name || !s.category) continue;
      try {
        await prisma.skill.upsert({
          where: { name_orgId: { name: s.name.trim(), orgId: req.orgId } },
          update: {},
          create: { name: s.name.trim(), category: s.category, orgId: req.orgId },
        });
        added++;
      } catch { skipped++; }
    }
    res.json({ added, skipped });
  } catch (err) {
    console.error('[Skills] bulk create error:', err);
    res.status(500).json({ error: 'Failed to bulk add skills' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI TASK AUTO-ASSIGN
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_LABEL = { 1: 'Beginner', 2: 'Basic', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert' };

// POST /api/skills/auto-assign — given a task, AI picks the best staff member
router.post('/auto-assign', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { taskTitle, taskDescription, requiredSkills = [], priority = 'Medium', estimatedHours = 0 } = req.body;

    if (!taskTitle) return res.status(400).json({ error: 'taskTitle required' });

    // 1. Gather all team members with their skills
    const memberships = await prisma.membership.findMany({
      where: { orgId: req.orgId, role: { in: ['STAFF', 'ADMIN'] } },
      include: {
        user: {
          select: { id: true, name: true, email: true },
          include: {
            staffSkills: {
              where: { orgId: req.orgId },
              include: { skill: true },
            },
          },
        },
      },
    });

    if (memberships.length === 0) {
      return res.status(400).json({ error: 'No staff members found in this organisation' });
    }

    // 2. Gather current workload for each member (open tasks this week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const workloads = await Promise.all(memberships.map(async m => {
      const [openTasks, weekHours] = await Promise.all([
        prisma.macroTask.count({
          where: { userId: m.userId, orgId: req.orgId, status: { in: ['not_started', 'in_progress'] } },
        }),
        prisma.attendanceLog.aggregate({
          where: { userId: m.userId, orgId: req.orgId, timeIn: { gte: weekStart }, timeOut: { not: null } },
          _sum: { duration: true },
        }),
      ]);
      const weekHoursNum = Math.round((workloads?.find(w => w) ? 0 : (weekHours._sum.duration || 0)) / 3600 * 10) / 10;
      return { userId: m.userId, openTasks, weekHours: weekHoursNum };
    }));

    const workloadMap = Object.fromEntries(workloads.map(w => [w.userId, w]));

    // 3. Build context for Claude
    const staffContext = memberships.map(m => {
      const wl = workloadMap[m.userId] || { openTasks: 0, weekHours: 0 };
      const skills = m.user.staffSkills.map(ss =>
        `${ss.skill.name} (${ss.skill.category}) — ${LEVEL_LABEL[ss.level] || ss.level}${ss.yearsExp ? `, ${ss.yearsExp}yr exp` : ''}`
      ).join(', ') || 'No skills listed';

      return `- ${m.user.name || m.user.email} [${m.role}]
  Skills: ${skills}
  Current workload: ${wl.openTasks} open tasks, ${wl.weekHours}h logged this week`;
    }).join('\n\n');

    const prompt = `You are a smart task allocation assistant for a team management app.

TASK TO ASSIGN:
Title: ${taskTitle}
Description: ${taskDescription || 'No description provided'}
Priority: ${priority}
Estimated Hours: ${estimatedHours}h
Required Skills: ${requiredSkills.length > 0 ? requiredSkills.join(', ') : 'Not specified'}

AVAILABLE TEAM MEMBERS:
${staffContext}

Based on skill match, proficiency level, and current workload, recommend the BEST person to assign this task to.

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{
  "assignedTo": "<exact name or email as listed above>",
  "userId": "<the user identifier>",
  "confidence": <number 1-100>,
  "reason": "<2-3 sentence explanation of why this person was chosen>",
  "skillMatch": "<which of their skills are most relevant>",
  "workloadNote": "<brief comment on their current availability>"
}`;

    // 4. Call Claude API
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('[Skills] Claude API error:', err);
      return res.status(500).json({ error: 'AI service unavailable', details: err });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || '';

    // Parse JSON from Claude's response
    let suggestion;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      suggestion = JSON.parse(clean);
    } catch {
      console.error('[Skills] Failed to parse AI response:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI suggestion', raw: rawText });
    }

    // Find the actual userId from the suggestion
    const matchedMember = memberships.find(m =>
      m.user.name === suggestion.assignedTo ||
      m.user.email === suggestion.assignedTo ||
      m.userId === suggestion.userId
    );

    res.json({
      suggestion: {
        ...suggestion,
        userId:      matchedMember?.userId || null,
        userName:    matchedMember?.user.name || matchedMember?.user.email || suggestion.assignedTo,
        userEmail:   matchedMember?.user.email || null,
        userRole:    matchedMember?.role || null,
      },
      teamSize: memberships.length,
    });

  } catch (err) {
    console.error('[Skills] auto-assign error:', err);
    res.status(500).json({ error: 'Auto-assign failed', details: err.message });
  }
});

export default router;
