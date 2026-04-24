// =============================================================================
// transcription.js — Deepgram integration + recording storage helpers
// Loaded by background.js via importScripts('transcription.js')
// =============================================================================

const BACKEND = 'https://recora-chrome-extension.onrender.com';

export async function transcribeAudio(blob, authToken) {
  const params = new URLSearchParams({
    model:        'nova-2',
    diarize:      'true',
    utterances:   'true',
    summarize:    'v2',
    punctuate:    'true',
    smart_format: 'true',
  });

  const res = await fetch(`${BACKEND}/transcribe?${params}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type':  blob.type || 'audio/webm',
    },
    body: blob,
  });

  if (!res.ok) throw new Error(`Transcription failed: HTTP ${res.status}`);

  const data = await res.json();
  return {
    transcript: buildTranscript(data.results?.utterances),
    summary:    buildSummary(data.results),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function secsToStamp(secs) {
  const s = Math.floor(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function buildTranscript(utterances) {
  return (utterances || []).map(u => ({
    speaker:   `Speaker ${String.fromCharCode(65 + (u.speaker % 26))}`,
    timestamp: secsToStamp(u.start),
    text:      u.transcript,
  }));
}

function buildSummary(results) {
  const shortSummary = results?.summary?.short || '';
  const utterances   = results?.utterances || [];
  const text         = utterances.map(u => u.transcript).join(' ');
  const sentences    = (text.match(/[^.!?]+[.!?]+/g) || []).map(s => s.trim()).filter(Boolean);

  const actionRx   = /\b(will|should|must|need to|follow[- ]?up|to[- ]?do|assigned to|responsible for|action item)\b/i;
  const decisionRx = /\b(decided|agreed|confirmed|approved|resolved|concluded|we will go with|we chose)\b/i;

  const keyPoints = shortSummary
    ? shortSummary.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).slice(0, 6)
    : sentences.slice(0, 4);

  return {
    key_points:   keyPoints,
    decisions:    sentences.filter(s => decisionRx.test(s)).slice(0, 5),
    action_items: sentences.filter(s => actionRx.test(s)).slice(0, 5),
  };
}

// --- chrome.storage.local helpers ---

async function saveRecording(rec) {
  const { recordings = [] } = await chrome.storage.local.get(['recordings']);
  recordings.unshift(rec);
  await chrome.storage.local.set({ recordings });
}

async function updateRecording(id, patch) {
  const { recordings = [] } = await chrome.storage.local.get(['recordings']);
  const idx = recordings.findIndex(r => r.id === id);
  if (idx !== -1) recordings[idx] = { ...recordings[idx], ...patch };
  await chrome.storage.local.set({ recordings });
}
