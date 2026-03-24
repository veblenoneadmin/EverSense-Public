// backend/lib/google-calendar.js
// Google Calendar v3 integration — OAuth2 token handling + event CRUD

import { google } from 'googleapis';
import { prisma } from './prisma.js';

/**
 * Build an authenticated OAuth2 client for a given userId.
 * Handles automatic access-token refresh and persists the new token.
 * Returns null if the user has no Google account or no valid tokens.
 */
export async function getGoogleAuthClient(userId) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'google' },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
    },
  });

  if (!account || !account.accessToken) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.BETTER_AUTH_URL || 'http://localhost:3001'}/api/auth/callback/google`
  );

  // Check if access token is expired (5-minute buffer)
  const now = Date.now();
  const expiresAt = account.accessTokenExpiresAt ? new Date(account.accessTokenExpiresAt).getTime() : 0;
  const isExpired = expiresAt - now < 5 * 60 * 1000;

  if (isExpired && account.refreshToken) {
    try {
      oauth2Client.setCredentials({ refresh_token: account.refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();

      await prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken: credentials.access_token,
          accessTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      });

      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('[GoogleCal] Token refresh failed:', err.message);
      await prisma.account.update({
        where: { id: account.id },
        data: { accessToken: null },
      }).catch(() => {});
      return null;
    }
  } else {
    oauth2Client.setCredentials({ access_token: account.accessToken });
  }

  return oauth2Client;
}

/**
 * Check whether a user has Google Calendar connected.
 */
export async function hasGoogleCalendarAccess(userId) {
  const client = await getGoogleAuthClient(userId);
  return client !== null;
}

/**
 * Push a new event to the user's primary Google Calendar.
 * Returns { googleEventId, googleCalendarId, meetLink } on success.
 * Returns { error: 'google_not_connected' } if user has no valid token.
 */
export async function createGoogleCalendarEvent(userId, eventData) {
  const auth = await getGoogleAuthClient(userId);
  if (!auth) return { error: 'google_not_connected' };

  const calendar = google.calendar({ version: 'v3', auth });

  const resource = {
    summary: eventData.title,
    description: eventData.description || undefined,
    location: eventData.location || undefined,
    colorId: hexToGoogleColorId(eventData.color),
    start: eventData.allDay
      ? { date: toDateString(eventData.startAt) }
      : { dateTime: new Date(eventData.startAt).toISOString() },
    end: eventData.allDay
      ? { date: toDateString(addDay(eventData.endAt)) } // Google all-day end is exclusive
      : { dateTime: new Date(eventData.endAt).toISOString() },
    conferenceData: {
      createRequest: {
        requestId: `vebtask-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: (eventData.attendeeEmails || []).map(email => ({ email })),
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    const evt = response.data;
    const meetLink =
      evt.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

    return {
      googleEventId: evt.id,
      googleCalendarId: 'primary',
      meetLink,
    };
  } catch (err) {
    console.error('[GoogleCal] insert error:', err.message);
    return { error: err.message };
  }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateGoogleCalendarEvent(userId, googleEventId, googleCalendarId, eventData) {
  const auth = await getGoogleAuthClient(userId);
  if (!auth) return { error: 'google_not_connected' };

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.patch({
      calendarId: googleCalendarId || 'primary',
      eventId: googleEventId,
      resource: {
        summary: eventData.title,
        description: eventData.description || undefined,
        location: eventData.location || undefined,
        colorId: hexToGoogleColorId(eventData.color),
        start: eventData.allDay
          ? { date: toDateString(eventData.startAt) }
          : { dateTime: new Date(eventData.startAt).toISOString() },
        end: eventData.allDay
          ? { date: toDateString(addDay(eventData.endAt)) }
          : { dateTime: new Date(eventData.endAt).toISOString() },
      },
      sendUpdates: 'all',
    });
    return { success: true };
  } catch (err) {
    console.error('[GoogleCal] patch error:', err.message);
    return { error: err.message };
  }
}

/**
 * Delete a Google Calendar event. Handles 410 (already deleted) gracefully.
 */
export async function deleteGoogleCalendarEvent(userId, googleEventId, googleCalendarId) {
  const auth = await getGoogleAuthClient(userId);
  if (!auth) return { error: 'google_not_connected' };

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.delete({
      calendarId: googleCalendarId || 'primary',
      eventId: googleEventId,
      sendUpdates: 'all',
    });
    return { success: true };
  } catch (err) {
    if (err?.code === 410 || err?.status === 410) return { success: true }; // already gone
    console.error('[GoogleCal] delete error:', err.message);
    return { error: err.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(d) {
  return new Date(d).toISOString().split('T')[0];
}

function addDay(d) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + 1);
  return dt;
}

const HEX_TO_COLOR_ID = {
  '#007acc': '1', // Peacock (blue)
  '#4ec9b0': '7', // Sage (teal)
  '#6a9955': '2', // Sage (green)
  '#dcdcaa': '5', // Banana (yellow)
  '#ce9178': '6', // Tangerine (orange)
  '#f44747': '11',// Tomato (red)
  '#c586c0': '3', // Grape (purple)
  '#569cd6': '9', // Blueberry (sky blue)
};

function hexToGoogleColorId(hex) {
  return HEX_TO_COLOR_ID[(hex || '').toLowerCase()] || '1';
}
