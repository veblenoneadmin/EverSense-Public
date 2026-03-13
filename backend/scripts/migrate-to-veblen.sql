-- ================================================================
-- VEBLEN ORG MIGRATION
-- Run each block in DBeaver in order (select all → Execute Script)
-- Safe to re-run — every step is idempotent
-- ================================================================


-- ── STEP 1: Confirm owner user exists ───────────────────────────
-- If this returns no row, change the email below to the real owner
SELECT id, email FROM user WHERE email = 'admin@eversense.ai';


-- ── STEP 2: Create Veblen org (skips if slug already exists) ────
INSERT IGNORE INTO organizations (id, name, slug, createdById, createdAt, updatedAt)
SELECT
  'clveblen0000000000000',   -- fixed ID, only used if org doesn't exist yet
  'Veblen',
  'veblen',
  id,
  NOW(),
  NOW()
FROM user
WHERE email = 'admin@eversense.ai'
LIMIT 1;


-- ── STEP 3: Capture the Veblen org ID ───────────────────────────
SET @veblenId = (SELECT id FROM organizations WHERE slug = 'veblen' LIMIT 1);

-- Confirm it resolved
SELECT @veblenId AS veblen_org_id;


-- ── STEP 4: Add memberships for every user not yet in Veblen ────
-- IGNORE handles the unique(userId, orgId) constraint safely
INSERT IGNORE INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
SELECT
  CONCAT('mbvb',
    LPAD(HEX(FLOOR(RAND() * 4294967295)), 8, '0'),
    LPAD(HEX(FLOOR(RAND() * 4294967295)), 8, '0')
  ),
  u.id,
  @veblenId,
  IF(u.email = 'admin@eversense.ai', 'OWNER', 'STAFF'),
  NOW(),
  NOW()
FROM user u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.userId = u.id AND m.orgId = @veblenId
);

-- Confirm membership count
SELECT COUNT(*) AS veblen_member_count FROM memberships WHERE orgId = @veblenId;


-- ── STEP 5: Backfill orphaned orgIds in every data table ─────────
-- Only rows whose orgId doesn't match any real organization are updated.
-- Rows already on a valid org are untouched.

UPDATE macro_tasks
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE time_logs
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE projects
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE clients
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE reports
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE skills
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE staff_skills
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE attendance_logs
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE calendar_events
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE calendar_event_attendees
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE task_comments
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE task_attachments
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

UPDATE invites
  SET orgId = @veblenId
  WHERE orgId NOT IN (SELECT id FROM organizations);

-- Uncomment if the notifications table exists in your DB:
-- UPDATE notifications
--   SET orgId = @veblenId
--   WHERE orgId NOT IN (SELECT id FROM organizations);


-- ── STEP 6: Verify ────────────────────────────────────────────────

-- Users still missing from Veblen (should return 0 rows)
SELECT u.id, u.email
FROM user u
WHERE NOT EXISTS (
  SELECT 1 FROM memberships m
  WHERE m.userId = u.id AND m.orgId = @veblenId
);

-- Orphaned orgIds remaining per table (each should return 0)
SELECT 'macro_tasks'              AS tbl, COUNT(*) AS orphaned FROM macro_tasks            WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'time_logs',                        COUNT(*) FROM time_logs                         WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'projects',                         COUNT(*) FROM projects                          WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'clients',                          COUNT(*) FROM clients                           WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'reports',                          COUNT(*) FROM reports                           WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'skills',                           COUNT(*) FROM skills                            WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'staff_skills',                     COUNT(*) FROM staff_skills                      WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'attendance_logs',                  COUNT(*) FROM attendance_logs                   WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'calendar_events',                  COUNT(*) FROM calendar_events                   WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'calendar_event_attendees',         COUNT(*) FROM calendar_event_attendees          WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'task_comments',                    COUNT(*) FROM task_comments                     WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'task_attachments',                 COUNT(*) FROM task_attachments                  WHERE orgId NOT IN (SELECT id FROM organizations)
UNION ALL
SELECT 'invites',                          COUNT(*) FROM invites                           WHERE orgId NOT IN (SELECT id FROM organizations);
