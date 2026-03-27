// backend/api/calendar.js — Calendar CRUD
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { createNotification } from './notifications.js';
import {
  hasGoogleCalendarAccess,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '../lib/google-calendar.js';

const router = express.Router();

// ── Lazy table init ───────────────────────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `calendar_events` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `description` TEXT NULL,' +
      '  `location` VARCHAR(500) NULL,' +
      '  `startAt` DATETIME(3) NOT NULL,' +
      '  `endAt` DATETIME(3) NOT NULL,' +
      '  `allDay` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `color` VARCHAR(20) NOT NULL DEFAULT \'#007acc\',' +
      '  `meetLink` VARCHAR(500) NULL,' +
      '  `createdById` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `googleEventId` VARCHAR(500) NULL,' +
      '  `googleCalendarId` VARCHAR(500) NULL,' +
      '  `syncedToGoogle` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `ce_orgId_idx` (`orgId`),' +
      '  KEY `ce_orgId_startAt_idx` (`orgId`,`startAt`),' +
      '  KEY `ce_createdById_idx` (`createdById`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    // Add Google columns to pre-existing tables — check information_schema first to avoid errors
    const googleCols = [
      { name: 'googleEventId',    ddl: 'ALTER TABLE `calendar_events` ADD COLUMN `googleEventId` VARCHAR(500) NULL' },
      { name: 'googleCalendarId', ddl: 'ALTER TABLE `calendar_events` ADD COLUMN `googleCalendarId` VARCHAR(500) NULL' },
      { name: 'syncedToGoogle',   ddl: 'ALTER TABLE `calendar_events` ADD COLUMN `syncedToGoogle` TINYINT(1) NOT NULL DEFAULT 0' },
    ];
    for (const col of googleCols) {
      const exists = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'calendar_events' AND column_name = ?`,
        col.name
      );
      if (Number(exists[0]?.cnt ?? 0) === 0) {
        await prisma.$executeRawUnsafe(col.ddl);
      }
    }
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `calendar_event_attendees` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `eventId` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `cea_event_user_key` (`eventId`,`userId`),' +
      '  KEY `cea_orgId_idx` (`orgId`),' +
      '  KEY `cea_userId_idx` (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
    console.log('[Calendar] Tables ready');
  } catch (e) {
    console.error('[Calendar] Table init error:', e.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a date as MySQL DATETIME string — avoids Prisma auto-detecting ISO strings */
function toMySQL(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

async function replaceAttendees(eventId, userIds, orgId) {
  await prisma.$executeRawUnsafe('DELETE FROM calendar_event_attendees WHERE eventId = ?', eventId);
  for (const userId of userIds) {
    await prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO calendar_event_attendees (id, eventId, userId, orgId) VALUES (?, ?, ?, ?)',
      randomUUID(), eventId, userId, orgId
    );
  }
}

function shapeEvent(row, attendeeUserMap) {
  return {
    id:    row.id,
    title: row.title,
    start: row.startAt instanceof Date ? row.startAt.toISOString() : row.startAt,
    end:   row.endAt   instanceof Date ? row.endAt.toISOString()   : row.endAt,
    allDay: !!row.allDay,
    color:  row.color || '#007acc',
    extendedProps: {
      description:      row.description,
      location:         row.location,
      meetLink:         row.meetLink,
      createdById:      row.createdById,
      syncedToGoogle:   !!row.syncedToGoogle,
      googleEventId:    row.googleEventId || null,
      googleCalendarId: row.googleCalendarId || null,
      attendees:        attendeeUserMap,
    },
  };
}

// ── GET /api/calendar/status ──────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  try {
    const googleConnected = await hasGoogleCalendarAccess(req.user.id);
    res.json({ googleConnected });
  } catch {
    res.json({ googleConnected: false });
  }
});

// ── GET /api/calendar/members ─────────────────────────────────────────────────
router.get('/members', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const memberships = await prisma.membership.findMany({
      where: { orgId: req.orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    res.json({
      members: memberships.map(m => ({
        id:    m.user.id,
        name:  m.user.name,
        email: m.user.email,
        image: m.user.image,
        role:  m.role,
      })),
    });
  } catch (err) {
    console.error('[Calendar] members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── GET /api/calendar/events ──────────────────────────────────────────────────
router.get('/events', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { start, end } = req.query;

    let whereClause = 'WHERE orgId = ?';
    const params = [req.orgId];
    if (start) { whereClause += ' AND endAt >= ?';   params.push(toMySQL(start)); }
    if (end)   { whereClause += ' AND startAt <= ?'; params.push(toMySQL(end));   }

    const events = await prisma.$queryRawUnsafe(
      `SELECT * FROM calendar_events ${whereClause} ORDER BY startAt ASC`,
      ...params
    );

    if (events.length === 0) {
      const googleEvents = await listGoogleCalendarEvents(
        req.user.id,
        start ? new Date(start).toISOString() : new Date().toISOString(),
        end   ? new Date(end).toISOString()   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      );
      return res.json({ events: googleEvents });
    }

    // Fetch attendees for all events in one query
    const eventIds = events.map(e => e.id);
    const placeholders = eventIds.map(() => '?').join(',');
    const attendeeRows = await prisma.$queryRawUnsafe(
      `SELECT eventId, userId FROM calendar_event_attendees WHERE eventId IN (${placeholders})`,
      ...eventIds
    );

    // Hydrate user details
    const allUserIds = [...new Set(attendeeRows.map(a => a.userId))];
    const users = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Group attendees by event
    const attendeesByEvent = {};
    for (const row of attendeeRows) {
      if (!attendeesByEvent[row.eventId]) attendeesByEvent[row.eventId] = [];
      if (userMap[row.userId]) attendeesByEvent[row.eventId].push(userMap[row.userId]);
    }

    const shaped = events.map(e => shapeEvent(e, attendeesByEvent[e.id] || []));

    // Merge Google Calendar events (read-only, shown in Google blue)
    const googleEvents = await listGoogleCalendarEvents(
      req.user.id,
      start ? new Date(start).toISOString() : new Date().toISOString(),
      end   ? new Date(end).toISOString()   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    // Exclude Google events that are already synced locally (avoid duplicates)
    const localGoogleIds = new Set(events.filter(e => e.googleEventId).map(e => e.googleEventId));
    const externalGoogle = googleEvents.filter(e => !localGoogleIds.has(e.extendedProps.googleEventId));

    res.json({ events: [...shaped, ...externalGoogle] });
  } catch (err) {
    console.error('[Calendar] list error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ── POST /api/calendar/events ─────────────────────────────────────────────────
router.post('/events', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const {
      title, description, location,
      startAt, endAt, allDay = false,
      color = '#007acc', attendeeIds = [],
      meetLink = null,
      syncToGoogle = false,
    } = req.body;

    if (!title || !startAt || !endAt) {
      return res.status(400).json({ error: 'title, startAt, endAt are required' });
    }

    const id = randomUUID();
    const start = new Date(startAt);
    const end   = new Date(endAt);

    // Google Calendar sync (optional)
    let finalMeetLink = meetLink || null;
    let googleEventId = null;
    let googleCalendarId = null;
    let syncedToGoogle = 0;

    if (syncToGoogle) {
      // Fetch attendee emails for Google Calendar
      let attendeeEmails = [];
      if (attendeeIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: attendeeIds } },
          select: { email: true },
        });
        attendeeEmails = users.map(u => u.email);
      }

      const googleResult = await createGoogleCalendarEvent(req.user.id, {
        title, description, location, color,
        startAt, endAt, allDay,
        attendeeEmails,
      });

      if (!googleResult.error) {
        googleEventId    = googleResult.googleEventId;
        googleCalendarId = googleResult.googleCalendarId;
        finalMeetLink    = googleResult.meetLink || finalMeetLink;
        syncedToGoogle   = 1;
      }
    }

    await prisma.$executeRawUnsafe(
      'INSERT INTO calendar_events ' +
      '(id, title, description, location, startAt, endAt, allDay, color, meetLink, createdById, orgId, googleEventId, googleCalendarId, syncedToGoogle, createdAt, updatedAt) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      id, title, description || null, location || null,
      toMySQL(start), toMySQL(end), allDay ? 1 : 0, color,
      finalMeetLink, req.user.id, req.orgId,
      googleEventId, googleCalendarId, syncedToGoogle
    );

    await replaceAttendees(id, attendeeIds, req.orgId);

    // Notify attendees (excluding creator)
    if (attendeeIds.length > 0) {
      try {
        const creator = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        const startStr = new Date(startAt).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        for (const attendeeId of attendeeIds) {
          if (attendeeId !== req.user.id) {
            createNotification({
              userId: attendeeId,
              orgId: req.orgId,
              title: `Calendar Invite: ${title}`,
              body: `${creator?.name || 'Someone'} invited you to "${title}" on ${startStr}${location ? ` at ${location}` : ''}.`,
              link: '/calendar',
              type: 'calendar',
            });
          }
        }
      } catch (_) {}
    }

    const rows = await prisma.$queryRawUnsafe('SELECT * FROM calendar_events WHERE id = ?', id);
    res.status(201).json({ event: shapeEvent(rows[0], []) });
  } catch (err) {
    console.error('[Calendar] create error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ── PUT /api/calendar/events/:id ──────────────────────────────────────────────
router.put('/events/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM calendar_events WHERE id = ? AND orgId = ?', id, req.orgId
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const existing = rows[0];

    const {
      title, description, location,
      startAt, endAt, allDay, color,
      attendeeIds, meetLink,
    } = req.body;

    const newTitle  = title       !== undefined ? title       : existing.title;
    const newDesc   = description !== undefined ? description : existing.description;
    const newLoc    = location    !== undefined ? location    : existing.location;
    const newStart  = startAt     ? new Date(startAt) : existing.startAt;
    const newEnd    = endAt       ? new Date(endAt)   : existing.endAt;
    const newAllDay = allDay      !== undefined ? (allDay ? 1 : 0) : existing.allDay;
    const newColor  = color       !== undefined ? color       : existing.color;
    let   newMeet   = meetLink    !== undefined ? (meetLink || null) : existing.meetLink;

    // Re-sync to Google Calendar if already synced
    if (existing.syncedToGoogle && existing.googleEventId) {
      const googleResult = await updateGoogleCalendarEvent(
        req.user.id,
        existing.googleEventId,
        existing.googleCalendarId,
        {
          title: newTitle, description: newDesc, location: newLoc,
          color: newColor, startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(), allDay: !!newAllDay,
        }
      );
      if (googleResult.error) {
        console.warn('[Calendar] Google sync update failed:', googleResult.error);
      }
    }

    await prisma.$executeRawUnsafe(
      'UPDATE calendar_events SET title=?, description=?, location=?, startAt=?, endAt=?, allDay=?, color=?, meetLink=?, updatedAt=NOW(3) WHERE id=?',
      newTitle, newDesc || null, newLoc || null,
      toMySQL(newStart), toMySQL(newEnd), newAllDay, newColor, newMeet, id
    );

    if (Array.isArray(attendeeIds)) {
      await replaceAttendees(id, attendeeIds, req.orgId);
      // Notify attendees of the update (excluding updater)
      try {
        const updater = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
        const startStr = newStart.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        for (const attendeeId of attendeeIds) {
          if (attendeeId !== req.user.id) {
            createNotification({
              userId: attendeeId,
              orgId: req.orgId,
              title: `Event Updated: ${newTitle}`,
              body: `${updater?.name || 'Someone'} updated the event on ${startStr}.`,
              link: '/calendar',
              type: 'calendar',
            });
          }
        }
      } catch (_) {}
    }

    const updated = await prisma.$queryRawUnsafe('SELECT * FROM calendar_events WHERE id = ?', id);
    res.json({ event: shapeEvent(updated[0], []) });
  } catch (err) {
    console.error('[Calendar] update error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// ── DELETE /api/calendar/events/:id ──────────────────────────────────────────
router.delete('/events/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM calendar_events WHERE id = ? AND orgId = ?', id, req.orgId
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const existing = rows[0];

    // Delete from Google Calendar if synced
    if (existing.syncedToGoogle && existing.googleEventId) {
      deleteGoogleCalendarEvent(
        req.user.id,
        existing.googleEventId,
        existing.googleCalendarId
      ).catch(e => console.warn('[Calendar] Google delete failed:', e.message));
    }

    await prisma.$executeRawUnsafe('DELETE FROM calendar_event_attendees WHERE eventId = ?', id);
    await prisma.$executeRawUnsafe('DELETE FROM calendar_events WHERE id = ?', id);

    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('[Calendar] delete error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
