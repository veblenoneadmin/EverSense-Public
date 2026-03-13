// backend/lib/sse.js — Server-Sent Events connection registry

// orgId → Set of Express response objects
const connections = new Map();

export function addConnection(orgId, res) {
  if (!connections.has(orgId)) connections.set(orgId, new Set());
  connections.get(orgId).add(res);
}

export function removeConnection(orgId, res) {
  const set = connections.get(orgId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(orgId);
}

/**
 * Broadcast a named SSE event to all clients connected to an org.
 * @param {string} orgId
 * @param {string} event  — e.g. 'attendance', 'notification'
 * @param {object} data
 */
export function broadcast(orgId, event, data = {}) {
  const clients = connections.get(orgId);
  if (!clients?.size) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch { /* client already disconnected */ }
  }
}
