// =============================================================================
// transcription.js — Deepgram proxy + summary/MOM extraction
// =============================================================================

const BACKEND = 'https://recora-chrome-extension.onrender.com';

export async function transcribeAudio(blob, authToken) {
  const params = new URLSearchParams({
    model:         'nova-2',
    diarize:       'true',
    utterances:    'true',
    summarize:     'v2',
    punctuate:     'true',
    smart_format:  'true',
    filler_words:  'false',
    paragraphs:    'true',
    language:      'en',
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
// Transcript builder
// ---------------------------------------------------------------------------
function secsToStamp(secs) {
  const s  = Math.floor(secs);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function buildTranscript(utterances) {
  return (utterances || []).map(u => ({
    speaker:   `Speaker ${String.fromCharCode(65 + (u.speaker % 26))}`,
    timestamp: secsToStamp(u.start),
    text:      u.transcript.trim(),
  }));
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function ensureEnds(str) {
  return /[.!?]$/.test(str.trim()) ? str.trim() : str.trim() + '.';
}

function buildSummary(results) {
  const shortSummary = results?.summary?.short || '';
  const utterances   = results?.utterances     || [];

  // Full text from all utterances
  const fullText  = utterances.map(u => u.transcript).join(' ');
  const sentences = splitSentences(fullText);

  // Key points — prefer Deepgram summary, fall back to first sentences
  const keyPoints = shortSummary
    ? splitSentences(shortSummary).slice(0, 6).map(s => capitalize(ensureEnds(s)))
    : sentences.slice(0, 4).map(s => capitalize(ensureEnds(s)));

  // Decision patterns
  const decisionRx = /\b(decided|agreed|confirmed|approved|resolved|concluded|we(?:'re| are|'ll| will) go(?:ing)? with|we chose|it(?:'s| is) (?:agreed|decided|resolved|confirmed)|the decision|going forward)\b/i;

  // Action item patterns — try to capture named assignments
  const actionRx = /\b(will|shall|should|must|needs? to|has to|follow[- ]?up|to[- ]?do|action item|assigned to|responsible for|by (?:monday|tuesday|wednesday|thursday|friday|eod|end of|next))\b/i;

  const decisions    = sentences.filter(s => decisionRx.test(s)).slice(0, 8).map(s => capitalize(ensureEnds(s)));
  const actionItems  = extractActionItems(sentences, utterances).slice(0, 8);

  return { key_points: keyPoints, decisions, action_items: actionItems };
}

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+/g) || [])
    .map(s => s.trim())
    .filter(s => s.length > 15); // drop tiny fragments
}

function extractActionItems(sentences, utterances) {
  const actionRx   = /\b(will|shall|should|must|needs? to|has to|follow[- ]?up|to[- ]?do|action item|assigned to|responsible for)\b/i;
  const namedRx    = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|needs? to|has to|is going to)\s+(.+)/;

  const items = [];
  for (const s of sentences) {
    if (!actionRx.test(s)) continue;
    const m = namedRx.exec(s);
    if (m) {
      items.push(`${m[1]}: ${capitalize(ensureEnds(m[2]))}`);
    } else {
      items.push(capitalize(ensureEnds(s)));
    }
  }
  return items;
}
