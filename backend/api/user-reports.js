// User Reports API — full raw-SQL rewrite (no Prisma model joins)
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────
async function getRole(userId, orgId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, orgId },
    select: { role: true },
  });
  return membership?.role || 'STAFF';
}

// ── GET /api/user-reports ─────────────────────────────────────────────────────
router.get('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { projectId: filterProjectId, memberId, search, dateFrom, dateTo } = req.query;

    const role         = await getRole(userId, orgId);
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    // ── Fetch all reports for this org (or just this user) ───────────────────
    let sql    = `SELECT * FROM reports WHERE orgId = ?`;
    let params = [orgId];

    if (!isPrivileged) {
      sql += ` AND userId = ?`;
      params.push(userId);
    } else if (memberId) {
      sql += ` AND userId = ?`;
      params.push(memberId);
    }

    sql += ` ORDER BY createdAt DESC LIMIT 500`;

    console.log(`🔍 GET /api/user-reports: orgId=${orgId} userId=${userId} role=${role} sql="${sql}" params=${JSON.stringify(params)}`);
    let reports = await prisma.$queryRawUnsafe(sql, ...params);
    console.log(`📊 Found ${reports.length} reports`);

    // JS-side filtering (avoids complex dynamic SQL)
    if (filterProjectId) reports = reports.filter(r => r.projectId === filterProjectId);
    if (search) {
      const s = search.toLowerCase();
      reports = reports.filter(r =>
        r.title?.toLowerCase().includes(s) ||
        r.description?.toLowerCase().includes(s) ||
        r.userName?.toLowerCase().includes(s)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      reports = reports.filter(r => new Date(r.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      reports = reports.filter(r => new Date(r.createdAt) <= to);
    }

    // ── Enrich: user data (non-fatal) ───────────────────────────────────────
    const userIds  = [...new Set(reports.map(r => r.userId).filter(Boolean))];
    const usersMap = {};
    if (userIds.length) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        });
        users.forEach(u => { usersMap[u.id] = u; });
      } catch (e) {
        console.error('User enrichment failed (non-fatal):', e.message);
      }
    }

    // ── Enrich: project data (non-fatal) ────────────────────────────────────
    const projIds  = [...new Set(reports.map(r => r.projectId).filter(Boolean))];
    const projsMap = {};
    if (projIds.length) {
      try {
        const ph    = projIds.map(() => '?').join(',');
        const projs = await prisma.$queryRawUnsafe(
          `SELECT id, name, color, status, budget FROM projects WHERE id IN (${ph})`, ...projIds
        );
        projs.forEach(p => { projsMap[p.id] = p; });
      } catch (e) {
        console.error('Project enrichment failed (non-fatal):', e.message);
      }
    }

    // ── Project list for dropdown ────────────────────────────────────────────
    const projectList = await prisma.$queryRawUnsafe(
      `SELECT id, name, color FROM projects WHERE orgId = ? ORDER BY name ASC`, orgId
    );

    // ── Member list (admin only) ─────────────────────────────────────────────
    let members = [];
    if (isPrivileged) {
      const mRows = await prisma.membership.findMany({
        where: { orgId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      members = mRows.map(m => ({
        id:   m.userId,
        name: m.user?.name || m.user?.email || 'Unknown',
        role: m.role,
      }));
    }

    // ── Analytics ────────────────────────────────────────────────────────────
    // Use the unfiltered reports set for stats
    const allSql    = isPrivileged ? `SELECT userId, projectId, createdAt FROM reports WHERE orgId = ?`
                                   : `SELECT userId, projectId, createdAt FROM reports WHERE orgId = ? AND userId = ?`;
    const allParams = isPrivileged ? [orgId] : [orgId, userId];
    const allRows   = await prisma.$queryRawUnsafe(allSql, ...allParams);

    const now       = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const analytics = {
      total:          allRows.length,
      thisWeek:       allRows.filter(r => new Date(r.createdAt) >= weekStart).length,
      uniqueProjects: new Set(allRows.map(r => r.projectId).filter(Boolean)).size,
      uniqueMembers:  new Set(allRows.map(r => r.userId)).size,
    };

    // ── Format ───────────────────────────────────────────────────────────────
    const formatted = reports.map(r => ({
      id:          r.id,
      title:       r.title || null,
      description: r.description,
      userName:    r.userName,
      image:       r.image || null,
      createdAt:   r.createdAt,
      updatedAt:   r.updatedAt,
      user:    usersMap[r.userId]  ? { id: usersMap[r.userId].id, name: usersMap[r.userId].name, email: usersMap[r.userId].email, image: usersMap[r.userId].image } : null,
      project: projsMap[r.projectId] ? { id: projsMap[r.projectId].id, name: projsMap[r.projectId].name, color: projsMap[r.projectId].color, status: projsMap[r.projectId].status, budget: projsMap[r.projectId].budget } : null,
    }));

    res.json({ success: true, role, isPrivileged, reports: formatted, total: formatted.length, analytics, members, projects: projectList });
  } catch (err) {
    console.error('GET /api/user-reports error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/user-reports ────────────────────────────────────────────────────
router.post('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { title, description, userName, image, projectId } = req.body;

    if (!description?.trim()) return res.status(400).json({ success: false, error: 'Description is required' });
    if (!userName?.trim())    return res.status(400).json({ success: false, error: 'userName is required' });

    // Verify project belongs to org (skip if no projectId)
    if (projectId) {
      const pRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM projects WHERE id = ? AND orgId = ? LIMIT 1`, projectId, orgId
      );
      if (!pRows.length) return res.status(400).json({ success: false, error: 'Project not found in this organization' });
    }

    const id = randomUUID();
    console.log(`📝 Inserting report: id=${id} userId=${userId} orgId=${orgId} projectId=${projectId || 'none'}`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO reports (id, title, description, userName, image, projectId, userId, orgId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      id, title?.trim() || null, description.trim(), userName.trim(), image || null, projectId || null, userId, orgId
    );

    // Verify insert
    const check = await prisma.$queryRawUnsafe(`SELECT id FROM reports WHERE id = ? LIMIT 1`, id);
    console.log(`✅ Report created: ${id} by ${req.user.email} — verified=${check.length > 0}`);
    res.status(201).json({ success: true, report: { id } });
  } catch (err) {
    console.error('POST /api/user-reports error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/user-reports/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const orgId  = req.orgId;

    const role         = await getRole(userId, orgId);
    const isPrivileged = role === 'OWNER' || role === 'ADMIN';

    const checkSql = isPrivileged
      ? `SELECT id FROM reports WHERE id = ? AND orgId = ? LIMIT 1`
      : `SELECT id FROM reports WHERE id = ? AND orgId = ? AND userId = ? LIMIT 1`;
    const checkParams = isPrivileged ? [id, orgId] : [id, orgId, userId];

    const rows = await prisma.$queryRawUnsafe(checkSql, ...checkParams);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Report not found or access denied' });

    await prisma.$executeRawUnsafe(`DELETE FROM reports WHERE id = ?`, id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/user-reports/:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
