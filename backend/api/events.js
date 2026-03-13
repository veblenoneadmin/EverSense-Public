// backend/api/events.js — SSE endpoint for real-time push updates

import express from 'express';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { addConnection, removeConnection } from '../lib/sse.js';

const router = express.Router();

// GET /api/events — keep-alive SSE stream per org
router.get('/', requireAuth, withOrgScope, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/Railway buffering
  res.flushHeaders();

  const orgId = req.orgId;
  addConnection(orgId, res);

  // Initial ping so the client knows the stream is open
  res.write('event: ping\ndata: {}\n\n');

  // Heartbeat every 25s to prevent proxy/load-balancer timeouts
  const heartbeat = setInterval(() => {
    try { res.write('event: ping\ndata: {}\n\n'); } catch { cleanup(); }
  }, 25_000);

  function cleanup() {
    clearInterval(heartbeat);
    removeConnection(orgId, res);
  }

  req.on('close', cleanup);
});

export default router;
