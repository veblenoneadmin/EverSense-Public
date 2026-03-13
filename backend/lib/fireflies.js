// backend/lib/fireflies.js — Fireflies.ai GraphQL client

const FIREFLIES_API = 'https://api.fireflies.ai/graphql';

// Standard Fireflies summary fields — keep minimal to avoid GraphQL
// "unknown field" errors on accounts that don't support extended fields
const SUMMARY_FIELDS = `
  summary {
    overview
    notes
    action_items
    keywords
    outline
  }
`;

const TRANSCRIPT_QUERY = `
  query Transcript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      duration
      participants
      meeting_attendees {
        displayName
        email
      }
      ${SUMMARY_FIELDS}
    }
  }
`;

const LATEST_TRANSCRIPTS_QUERY = `
  query {
    transcripts(limit: 20) {
      id
      title
      date
      duration
      participants
      meeting_attendees {
        displayName
        email
      }
      ${SUMMARY_FIELDS}
    }
  }
`;

/**
 * Fetch a single transcript (with summary) from Fireflies.
 * @param {string} meetingId — the Fireflies transcript/meeting ID
 * @returns {object|null} transcript object or null on error
 */
export async function fetchTranscript(meetingId) {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    console.warn('[Fireflies] FIREFLIES_API_KEY not set — skipping');
    return null;
  }

  const res = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPT_QUERY,
      variables: { id: meetingId },
    }),
  });

  if (!res.ok) {
    throw new Error(`Fireflies API HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Fireflies GraphQL: ${json.errors[0].message}`);
  }

  return json.data?.transcript ?? null;
}

/**
 * Fetch the latest transcripts (up to 20) from Fireflies.
 * @returns {Array} array of transcript objects or empty array
 */
/**
 * Fetch raw Fireflies API response for a transcript (for debugging).
 * Returns the full unparsed JSON so we can see exactly what the API gives us.
 */
export async function fetchTranscriptRaw(meetingId) {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) return { error: 'FIREFLIES_API_KEY not set' };

  const res = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPT_QUERY,
      variables: { id: meetingId },
    }),
  });

  return res.json();
}

export async function fetchLatestTranscripts() {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    console.warn('[Fireflies] FIREFLIES_API_KEY not set — skipping poll');
    return [];
  }

  const res = await fetch(FIREFLIES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: LATEST_TRANSCRIPTS_QUERY }),
  });

  if (!res.ok) throw new Error(`Fireflies API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`Fireflies GraphQL: ${json.errors[0].message}`);
  return json.data?.transcripts ?? [];
}
