// backend/api/fireflies.js — Fireflies webhook + transcript storage + notifications

import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { fetchTranscript, fetchLatestTranscripts, fetchTranscriptRaw } from '../lib/fireflies.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { broadcast } from '../lib/sse.js';

const router = express.Router();

// ── Table setup ───────────────────────────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `notifications` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `body` TEXT NULL,' +
      '  `link` VARCHAR(500) NULL,' +
      '  `type` VARCHAR(50) NOT NULL DEFAULT \'info\',' +
      '  `isRead` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `notif_userId_idx` (`userId`),' +
      '  KEY `notif_orgId_userId_idx` (`orgId`, `userId`),' +
      '  KEY `notif_createdAt_idx` (`createdAt`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `fireflies_transcripts` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `date` DATETIME(3) NULL,' +
      '  `duration` INT NULL,' +
      '  `participants` TEXT NULL,' +
      '  `overview` TEXT NULL,' +
      '  `notes` TEXT NULL,' +
      '  `action_items` TEXT NULL,' +
      '  `keywords` VARCHAR(1000) NULL,' +
      '  `outline` TEXT NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `ft_date_idx` (`date`),' +
      '  KEY `ft_createdAt_idx` (`createdAt`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
    console.log('  ✅ fireflies_transcripts table ready');
  } catch (_e) { /* tables likely exist */ }
  // Add notes column only if it doesn't already exist (prevents Prisma dup-column error log)
  try {
    const cols = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'fireflies_transcripts' AND column_name = 'notes'`
    );
    if (!Number(cols[0]?.cnt)) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE fireflies_transcripts ADD COLUMN `notes` TEXT NULL AFTER `overview`'
      );
      console.log('  ✅ fireflies_transcripts.notes column added');
    }
  } catch (_e) { /* silently skip */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function tryParseJSON(str, fallback = []) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// Fireflies keywords can come back as an array ["kw1","kw2"] or a plain string.
// MySQL VARCHAR can't accept arrays — always normalise to a comma-separated string.
function normaliseKeywords(kw) {
  if (!kw) return null;
  if (Array.isArray(kw)) return kw.join(', ');
  return String(kw);
}

function pickSummaryOverview(summary) {
  if (!summary) return null;
  return summary.overview || summary.notes || null;
}

function buildNotifBody(transcript) {
  const { date, duration, summary } = transcript;
  const dateStr = date
    ? new Date(typeof date === 'number' ? date : date).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;
  const durationMin = duration ? Math.round(duration / 60) : null;
  const overviewText = pickSummaryOverview(summary);
  const lines = [];
  if (dateStr)          lines.push(`Date: ${dateStr}`);
  if (durationMin)      lines.push(`Duration: ${durationMin} min`);
  if (overviewText)     { lines.push(''); lines.push('Summary:'); lines.push(overviewText); }
  if (summary?.action_items) { lines.push(''); lines.push('Action Items:'); lines.push(summary.action_items); }
  const kw = normaliseKeywords(summary?.keywords);
  if (kw)                    { lines.push(''); lines.push(`Keywords: ${kw}`); }
  return lines.join('\n');
}

// ── Core: store transcript + send notifications ───────────────────────────────
// Returns true if this was a new transcript, false if already stored.
// Build full participant list from both participants (emails) and meeting_attendees (names+emails)
function mergeParticipants(participants = [], meeting_attendees = []) {
  const emailSet = new Set(participants.map(e => String(e).toLowerCase().trim()).filter(Boolean));
  const extras = (meeting_attendees || [])
    .map(a => {
      if (a.email && !emailSet.has(a.email.toLowerCase().trim())) return a.email;
      if (!a.email && (a.displayName || a.name)) return a.displayName || a.name;
      return null;
    })
    .filter(Boolean);
  return [...participants, ...extras];
}

async function processTranscript(transcript) {
  const { id, title, date, duration, participants = [], meeting_attendees = [], summary } = transcript;
  if (!id) return false;

  // Full list: participant emails + any extra attendee names from meeting_attendees
  const allParticipants = mergeParticipants(participants, meeting_attendees);

  await ensureTables();

  // Check if already stored
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id, overview FROM fireflies_transcripts WHERE id = ? LIMIT 1', id
  );

  // Parse date safely
  let parsedDate = null;
  if (date) {
    const d = typeof date === 'number' ? new Date(date) : new Date(date);
    parsedDate = isNaN(d.getTime()) ? null : d;
  }

  const resolvedOverview = pickSummaryOverview(summary);
  const hasSummary = !!(resolvedOverview || summary?.notes || summary?.action_items || summary?.keywords || summary?.outline);

  // Log what Fireflies returned so Railway logs confirm the data
  console.log(`[Fireflies] "${title}" summary+participants:`, JSON.stringify({
    summary_object:    !!summary,
    overview:          summary?.overview     ? summary.overview.slice(0, 80) : null,
    notes:             summary?.notes        ? summary.notes.slice(0, 80)    : null,
    action_items:      summary?.action_items ? '(present)'                   : null,
    keywords:          normaliseKeywords(summary?.keywords) || null,
    hasSummary,
    participants_raw:  participants.length,
    meeting_attendees: meeting_attendees.length,
    allParticipants:   allParticipants.length,
  }));

  if (existing.length) {
    let didUpdate = false;

    // Always sync participants — meeting_attendees enriches the stored list
    if (allParticipants.length > 0) {
      await prisma.$executeRawUnsafe(
        'UPDATE fireflies_transcripts SET participants=? WHERE id=?',
        JSON.stringify(allParticipants.map(e => String(e).trim()).filter(Boolean)),
        id,
      );
    }

    // Update summary if it was missing before and is now available
    if (!existing[0].overview && hasSummary) {
      await prisma.$executeRawUnsafe(
        'UPDATE fireflies_transcripts SET overview=?, notes=?, action_items=?, keywords=?, outline=? WHERE id=?',
        resolvedOverview,
        summary?.notes        || null,
        summary?.action_items || null,
        normaliseKeywords(summary?.keywords),
        summary?.outline      || null,
        id,
      );
      console.log(`[Fireflies] Updated summary for: "${title}"`);
      didUpdate = true;
    }

    return didUpdate; // only send notifications if summary was newly added
  }

  // New transcript — store it
  await prisma.$executeRawUnsafe(
    'INSERT INTO fireflies_transcripts (id, title, date, duration, participants, overview, notes, action_items, keywords, outline, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
    id,
    title?.trim() || 'Untitled Meeting',
    parsedDate,
    duration || null,
    JSON.stringify(allParticipants.map(e => String(e).trim()).filter(Boolean)),
    resolvedOverview,
    summary?.notes        || null,
    summary?.action_items || null,
    normaliseKeywords(summary?.keywords),
    summary?.outline      || null,
  );

  // Match participants to EverSense users — use emails from both sources
  const allEmails = [
    ...participants,
    ...(meeting_attendees || []).filter(a => a.email).map(a => a.email),
  ];
  const lcEmails = allEmails.map(e => String(e).toLowerCase().trim()).filter(Boolean);
  if (!lcEmails.length) {
    console.log(`[Fireflies] Stored transcript "${title}" — no participants to notify`);
    return true;
  }

  // Use Prisma ORM to avoid case-sensitive table name issues (User vs user on MySQL)
  // lcEmails are already lowercase; MySQL utf8mb4_unicode_ci is case-insensitive so this matches
  const users = await prisma.user.findMany({
    where: { email: { in: lcEmails } },
    select: { id: true, email: true },
  }).catch(() => []);

  if (!users.length) {
    console.log(`[Fireflies] Stored "${title}" — no matching users for: ${lcEmails.join(', ')}`);
    return true;
  }

  const notifTitle = `Meeting Summary: ${title?.trim() || 'Untitled Meeting'}`;
  const notifBody  = buildNotifBody(transcript);
  const notifLink  = `/meetings/${id}`;
  let notified = 0;

  for (const user of users) {
    const memberships = await prisma.membership.findMany({
      where:  { userId: user.id },
      select: { orgId: true },
    });
    for (const { orgId } of memberships) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO notifications (id, userId, orgId, title, body, link, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())',
        randomUUID(), user.id, orgId, notifTitle, notifBody, notifLink, 'meeting'
      );
      broadcast(orgId, 'notification', { userId: user.id });
      notified++;
    }
  }

  console.log(`[Fireflies] Stored + sent ${notified} notification(s) for: "${title}"`);
  return true;
}

// ── POST /api/fireflies/transcripts/:id/refresh — force-refresh one meeting ──
router.post('/transcripts/:id/refresh', requireAuth, async (req, res) => {
  if (!process.env.FIREFLIES_API_KEY) {
    return res.status(503).json({ success: false, error: 'FIREFLIES_API_KEY not configured' });
  }
  try {
    await ensureTables();
    const transcript = await fetchTranscript(req.params.id);
    if (!transcript) return res.status(404).json({ success: false, error: 'Transcript not found in Fireflies' });

    const resolvedOverview = pickSummaryOverview(transcript.summary);
    const { id, title, date, duration, participants = [], meeting_attendees = [], summary } = transcript;
    const allParticipants = mergeParticipants(participants, meeting_attendees);

    // Check if already stored
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM fireflies_transcripts WHERE id = ? LIMIT 1', id
    );

    if (existing.length) {
      // Force update summary fields + participants
      await prisma.$executeRawUnsafe(
        'UPDATE fireflies_transcripts SET participants=?, overview=?, notes=?, action_items=?, keywords=?, outline=? WHERE id=?',
        JSON.stringify(allParticipants.map(e => String(e).trim()).filter(Boolean)),
        resolvedOverview,
        summary?.notes        || null,
        summary?.action_items || null,
        normaliseKeywords(summary?.keywords),
        summary?.outline      || null,
        id,
      );
    } else {
      // Not in DB yet — insert it now
      let parsedDate = null;
      if (date) {
        const d = typeof date === 'number' ? new Date(date) : new Date(date);
        parsedDate = isNaN(d.getTime()) ? null : d;
      }
      await prisma.$executeRawUnsafe(
        'INSERT INTO fireflies_transcripts (id, title, date, duration, participants, overview, notes, action_items, keywords, outline, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        id,
        title?.trim() || 'Untitled Meeting',
        parsedDate,
        duration || null,
        JSON.stringify(allParticipants.map(e => String(e).trim()).filter(Boolean)),
        resolvedOverview,
        summary?.notes        || null,
        summary?.action_items || null,
        normaliseKeywords(summary?.keywords),
        summary?.outline      || null,
      );
    }

    // Log exactly what Fireflies returned so Railway logs show whether summary fields are populated
    console.log(`[Fireflies] Refresh result for "${title}":`, JSON.stringify({
      action: existing.length ? 'updated' : 'inserted',
      summary_received: !!transcript.summary,
      overview:     transcript.summary?.overview     ? transcript.summary.overview.slice(0, 80)     : null,
      notes:        transcript.summary?.notes        ? transcript.summary.notes.slice(0, 80)        : null,
      action_items: transcript.summary?.action_items ? transcript.summary.action_items.slice(0, 80) : null,
      keywords:     normaliseKeywords(transcript.summary?.keywords) || null,
      outline:      transcript.summary?.outline      ? transcript.summary.outline.slice(0, 80)      : null,
    }));
    res.json({ success: true, hasSummary: !!resolvedOverview, wasNew: !existing.length });
  } catch (err) {
    console.error('[Fireflies] Refresh error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/fireflies/debug/:id — raw Fireflies API response for diagnosis ──
router.get('/debug/:id', requireAuth, async (req, res) => {
  if (!process.env.FIREFLIES_API_KEY) {
    return res.status(503).json({ success: false, error: 'FIREFLIES_API_KEY not configured' });
  }
  try {
    const raw = await fetchTranscriptRaw(req.params.id);
    res.json({ success: true, raw });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/fireflies/webhook ───────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.json({ received: true }); // respond immediately so Fireflies doesn't retry

  try {
    const { meetingId, transcriptId } = req.body;
    const id = meetingId || transcriptId;
    if (!id) { console.warn('[Fireflies] Webhook with no id'); return; }

    console.log(`[Fireflies] Webhook — fetching transcript: ${id}`);
    const transcript = await fetchTranscript(id);
    if (!transcript) { console.warn(`[Fireflies] No transcript for id: ${id}`); return; }

    await processTranscript(transcript);
  } catch (err) {
    console.error('[Fireflies] Webhook error:', err.message);
  }
});

// ── GET /api/fireflies/transcripts ────────────────────────────────────────────
router.get('/transcripts', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, title, date, duration, participants, overview, notes, action_items, keywords, outline, createdAt ' +
      'FROM fireflies_transcripts ORDER BY date DESC, createdAt DESC LIMIT 50'
    );
    const transcripts = rows.map(r => ({
      ...r,
      participants: tryParseJSON(r.participants, []),
    }));
    res.json({ success: true, transcripts });
  } catch (err) {
    console.error('[Fireflies] GET /transcripts error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/fireflies/transcripts/:id ───────────────────────────────────────
router.get('/transcripts/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const rows = await prisma.$queryRawUnsafe(
      'SELECT * FROM fireflies_transcripts WHERE id = ? LIMIT 1', req.params.id
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Transcript not found' });
    const t = rows[0];
    res.json({ success: true, transcript: { ...t, participants: tryParseJSON(t.participants, []) } });
  } catch (err) {
    console.error('[Fireflies] GET /transcripts/:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/fireflies/status ─────────────────────────────────────────────────
// Quick check used by the frontend badge — just needs to know key is present
router.get('/status', async (req, res) => {
  res.json({ connected: !!process.env.FIREFLIES_API_KEY });
});

// ── GET /api/fireflies/diagnostics — full connection + data check ─────────────
router.get('/diagnostics', requireAuth, async (req, res) => {
  const result = {
    apiKeySet:      !!process.env.FIREFLIES_API_KEY,
    apiKeyPrefix:   process.env.FIREFLIES_API_KEY ? process.env.FIREFLIES_API_KEY.slice(0, 8) + '...' : null,
    apiReachable:   false,
    graphqlErrors:  null,
    transcriptCount: 0,
    firstTranscript: null,
    dbRowCount:     0,
    dbRows:         [],
    error:          null,
  };

  if (!result.apiKeySet) {
    return res.json(result);
  }

  // Test live Fireflies API
  try {
    const raw = await fetchTranscriptRaw('test-connection-ping').catch(() => null);
    // Even if ID is wrong, a good API key returns data.errors, not HTTP error
    result.apiReachable = true;
  } catch (e) {
    result.error = `API unreachable: ${e.message}`;
    return res.json(result);
  }

  // Fetch real transcripts list
  try {
    const { fetchLatestTranscripts: fetchList } = await import('../lib/fireflies.js');
    // We'll call the raw fetch directly to capture errors
    const apiKey = process.env.FIREFLIES_API_KEY;
    const gqlRes = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `query { transcripts(limit: 5) { id title date duration participants summary { overview action_items keywords outline } } }`,
      }),
    });
    const json = await gqlRes.json();

    if (json.errors?.length) {
      result.graphqlErrors = json.errors;
    } else {
      const list = json.data?.transcripts ?? [];
      result.transcriptCount = list.length;
      result.firstTranscript = list[0] ? {
        id:          list[0].id,
        title:       list[0].title,
        date:        list[0].date,
        duration:    list[0].duration,
        participants: list[0].participants,
        summary:     list[0].summary,
      } : null;
    }
  } catch (e) {
    result.error = `Transcript fetch error: ${e.message}`;
  }

  // Check what's in our DB
  try {
    await ensureTables();
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, title, overview IS NOT NULL as hasSummary, createdAt FROM fireflies_transcripts ORDER BY createdAt DESC LIMIT 10'
    );
    result.dbRowCount = rows.length;
    result.dbRows = rows;
  } catch (e) {
    result.error = (result.error ? result.error + ' | ' : '') + `DB error: ${e.message}`;
  }

  res.json(result);
});

// ── Polling: check Fireflies every 30 minutes ─────────────────────────────────
export async function startFirefliesPolling() {
  if (!process.env.FIREFLIES_API_KEY) {
    console.log('[Fireflies] No API key — polling disabled');
    return;
  }

  const poll = async () => {
    try {
      console.log('[Fireflies] Polling for latest transcripts...');
      const transcripts = await fetchLatestTranscripts();
      let newCount = 0;
      for (const t of transcripts) {
        try {
          const isNew = await processTranscript(t);
          if (isNew) newCount++;
        } catch (e) {
          console.error('[Fireflies] Poll: error processing transcript:', t.id, e.message);
        }
      }
      if (newCount) console.log(`[Fireflies] Poll complete — ${newCount} new transcript(s)`);
      else console.log('[Fireflies] Poll complete — no new transcripts');
    } catch (err) {
      console.error('[Fireflies] Poll error:', err.message);
    }
  };

  // Run once immediately, then every 30 minutes
  await poll();
  setInterval(poll, 30 * 60 * 1000);
}

// ── POST /api/fireflies/sync — manual sync trigger ────────────────────────────
router.post('/sync', requireAuth, async (req, res) => {
  if (!process.env.FIREFLIES_API_KEY) {
    return res.status(503).json({ success: false, error: 'FIREFLIES_API_KEY not configured' });
  }
  try {
    await ensureTables();
    let newCount = 0;

    // 1) Fetch latest 20 from Fireflies and process any new or summary-ready ones
    const transcripts = await fetchLatestTranscripts();
    for (const t of transcripts) {
      try {
        const isNew = await processTranscript(t);
        if (isNew) newCount++;
      } catch (e) {
        console.error('[Fireflies] Sync: error processing transcript:', t.id, e.message);
      }
    }

    // 2) Re-fetch any stored transcripts that are still missing a summary
    //    (covers meetings that were synced before Fireflies finished processing)
    const pendingSummaries = await prisma.$queryRawUnsafe(
      'SELECT id FROM fireflies_transcripts WHERE overview IS NULL LIMIT 20'
    ).catch(() => []);

    for (const row of pendingSummaries) {
      try {
        const transcript = await fetchTranscript(row.id);
        if (transcript) {
          const isNew = await processTranscript(transcript);
          if (isNew) newCount++;
        }
      } catch (e) {
        console.error('[Fireflies] Sync: error re-fetching pending transcript:', row.id, e.message);
      }
    }

    res.json({ success: true, total: transcripts.length, newCount });
  } catch (err) {
    console.error('[Fireflies] Manual sync error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
