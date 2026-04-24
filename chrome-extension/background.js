import { transcribeAudio } from './transcription.js';

// =============================================================================
// background.js — Service Worker
// Manages offscreen document lifecycle, recording state, and Azure upload.
// Audio blobs arrive via IndexedDB (not sendMessage) to avoid 64 MiB limit.
// =============================================================================

let recordingState = {
  isRecording:    false,
  isPaused:       false,
  startTime:      null,
  pauseStartTime: null,
  totalPausedMs:  0,
  userId:         null,
  userEmail:      '',
  recTitle:       '',
  recDescription: '',
};

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

// ---------------------------------------------------------------------------
// IndexedDB helpers — shared extension origin with offscreen document
// ---------------------------------------------------------------------------
const IDB_NAME    = 'recora-recordings';
const IDB_VERSION = 1;
const IDB_STORE   = 'blobs';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise(resolve => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); resolve(); }; // best-effort
  });
}

// ---------------------------------------------------------------------------
// Auth + offscreen lifecycle
// ---------------------------------------------------------------------------
function getChromeAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      if (chrome.runtime.lastError || !token)
        reject(new Error(chrome.runtime.lastError?.message || 'Not authenticated'));
      else resolve(token);
    });
  });
}

// Restore state after service worker restart (MV3 workers are killed after ~30s idle)
(async () => {
  try {
    const stored = await chrome.storage.local.get(['recordingState']);
    if (!stored.recordingState?.isRecording) return;

    const hasDoc = await chrome.offscreen.hasDocument().catch(() => false);
    if (!hasDoc) {
      chrome.storage.local.set({ recordingState: { isRecording: false } });
      return;
    }

    const s = stored.recordingState;
    recordingState.isRecording    = true;
    recordingState.userId         = s.userId        || null;
    recordingState.startTime      = s.startTime     || Date.now();
    recordingState.totalPausedMs  = s.totalPausedMs || 0;
    recordingState.recTitle       = s.recTitle      || '';
    recordingState.recDescription = s.recDescription || '';

    if (s.isPaused && s.pauseStartTime) {
      recordingState.totalPausedMs  += Date.now() - s.pauseStartTime;
      recordingState.isPaused        = true;
      recordingState.pauseStartTime  = Date.now();
    } else {
      recordingState.isPaused       = false;
      recordingState.pauseStartTime = null;
    }
  } catch (_) {}
})();

async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument().catch(() => false);
  if (!has) {
    await chrome.offscreen.createDocument({
      url:           OFFSCREEN_URL,
      reasons:       ['USER_MEDIA'],
      justification: 'Record tab and microphone audio',
    });
  }
}

async function closeOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument().catch(() => false);
  if (has) await chrome.offscreen.closeDocument();
}

function getElapsedMs() {
  if (!recordingState.isRecording) return 0;
  let elapsed = Date.now() - recordingState.startTime - recordingState.totalPausedMs;
  if (recordingState.isPaused && recordingState.pauseStartTime)
    elapsed -= (Date.now() - recordingState.pauseStartTime);
  return Math.max(0, elapsed);
}

function broadcastState(extra = {}) {
  chrome.runtime.sendMessage({
    action:      'recordingStateUpdate',
    isRecording: recordingState.isRecording,
    isPaused:    recordingState.isPaused,
    elapsedMs:   getElapsedMs(),
    ...extra,
  }, () => void chrome.runtime.lastError);
}

// ---------------------------------------------------------------------------
// Azure upload
// ---------------------------------------------------------------------------
async function getUploadSasToken(userId, blobName) {
  const authToken = await getChromeAuthToken();
  const response  = await fetch('https://recora-chrome-extension.onrender.com/generate-upload-sas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body:    JSON.stringify({ userId, blobName }),
    cache:   'no-store',
  });
  if (!response.ok) throw new Error(`SAS token failed: ${response.status}`);
  const { sasToken } = await response.json();
  return sasToken;
}

async function uploadBlobWithRestApi(blob, userId, metadata, ext = 'webm') {
  const uniqueBlobName = `recording_${Date.now()}.${ext}`;
  const fullBlobPath   = `${userId}/${uniqueBlobName}`;
  const sasToken       = await getUploadSasToken(userId, uniqueBlobName);
  const uploadUrl      = `https://recorderextension.blob.core.windows.net/meeting-audio/${encodeURIComponent(fullBlobPath)}?${sasToken}`;

  const metaHeaders = Object.fromEntries(
    Object.entries({
      userid:       userId,
      audiominutes: metadata.audioMinutes.toString(),
      audioseconds: metadata.audioSeconds.toString(),
    }).map(([k, v]) => [`x-ms-meta-${k}`, v])
  );

  const response = await fetch(uploadUrl, {
    method:  'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type':   blob.type || 'audio/webm',
      'x-ms-date':      new Date().toUTCString(),
      'x-ms-version':   '2020-04-08',
      'Content-Length': blob.size.toString(),
      ...metaHeaders,
    },
    body: blob,
  });
  if (!response.ok) throw new Error(`Azure upload failed: ${response.status}`);
  return fullBlobPath;
}

async function syncMetadataToAzure(userId) {
  if (!userId) return;
  try {
    const authToken = await getChromeAuthToken();
    const { recordings = [] } = await new Promise(r => chrome.storage.local.get(['recordings'], r));
    const sasRes = await fetch('https://recora-chrome-extension.onrender.com/generate-upload-sas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body:    JSON.stringify({ userId, blobName: 'recordings.json' }),
      cache:   'no-store',
    });
    if (!sasRes.ok) return;
    const { sasToken } = await sasRes.json();
    const json    = JSON.stringify(recordings);
    const byteLen = new TextEncoder().encode(json).length;
    await fetch(`https://recorderextension.blob.core.windows.net/meeting-audio/${encodeURIComponent(userId)}/recordings.json?${sasToken}`, {
      method:  'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type':   'application/json',
        'x-ms-date':      new Date().toUTCString(),
        'x-ms-version':   '2020-04-08',
        'Content-Length': String(byteLen),
      },
      body: json,
    });
  } catch (err) {
    console.warn('Azure metadata sync failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  if (message.action === 'startRecording') {
    if (recordingState.isRecording) {
      broadcastState({ status: 'recording' });
      sendResponse({ success: false, error: 'Already recording' });
      return false;
    }
    recordingState.userId         = message.userId;
    recordingState.userEmail      = message.userEmail      || '';
    recordingState.recTitle       = message.recTitle       || '';
    recordingState.recDescription = message.recDesc        || '';
    ensureOffscreenDocument()
      .then(() => {
        chrome.runtime.sendMessage(
          { target: 'offscreen', action: 'startRecording', userId: message.userId, tabStreamId: message.tabStreamId },
          () => void chrome.runtime.lastError,
        );
        sendResponse({ success: true });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'stopRecording') {
    chrome.runtime.sendMessage(
      { target: 'offscreen', action: 'stopRecording' },
      () => void chrome.runtime.lastError,
    );
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'getRecordingState') {
    if (recordingState.isRecording) {
      sendResponse({ isRecording: true, isPaused: recordingState.isPaused, elapsedMs: getElapsedMs() });
      return false;
    }
    chrome.storage.local.get(['recordingState'], stored => {
      const s = stored.recordingState;
      if (!s?.isRecording) { sendResponse({ isRecording: false, isPaused: false, elapsedMs: 0 }); return; }
      let elapsed = Date.now() - (s.startTime || Date.now()) - (s.totalPausedMs || 0);
      if (s.isPaused && s.pauseStartTime) elapsed -= Date.now() - s.pauseStartTime;
      sendResponse({ isRecording: true, isPaused: s.isPaused || false, elapsedMs: Math.max(0, elapsed) });
    });
    return true;
  }

  if (message.action === 'pauseRecording') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'pauseRecording' }, () => void chrome.runtime.lastError);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'resumeRecording') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'resumeRecording' }, () => void chrome.runtime.lastError);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'offscreenRecordingStarted') {
    recordingState.isRecording    = true;
    recordingState.isPaused       = false;
    recordingState.startTime      = message.startTime;
    recordingState.pauseStartTime = null;
    recordingState.totalPausedMs  = 0;
    chrome.storage.local.set({ recordingState: {
      isRecording: true, isPaused: false,
      startTime: message.startTime, totalPausedMs: 0,
      userId: recordingState.userId, recTitle: recordingState.recTitle, recDescription: recordingState.recDescription,
    }});
    broadcastState({ status: 'recording' });
    return false;
  }

  if (message.action === 'offscreenRecordingPaused') {
    recordingState.isPaused       = true;
    recordingState.pauseStartTime = Date.now();
    chrome.storage.local.set({ recordingState: {
      isRecording: true, isPaused: true,
      pauseStartTime: recordingState.pauseStartTime,
      startTime: recordingState.startTime, totalPausedMs: recordingState.totalPausedMs,
      userId: recordingState.userId,
    }});
    broadcastState({ status: 'paused' });
    return false;
  }

  if (message.action === 'offscreenRecordingResumed') {
    if (recordingState.pauseStartTime) recordingState.totalPausedMs += Date.now() - recordingState.pauseStartTime;
    recordingState.isPaused       = false;
    recordingState.pauseStartTime = null;
    chrome.storage.local.set({ recordingState: {
      isRecording: true, isPaused: false,
      startTime: recordingState.startTime, totalPausedMs: recordingState.totalPausedMs,
      userId: recordingState.userId,
    }});
    broadcastState({ status: 'resumed' });
    return false;
  }

  // Offscreen → blob ready in IndexedDB
  if (message.action === 'offscreenRecordingStopped') {
    recordingState.isRecording    = false;
    recordingState.isPaused       = false;
    recordingState.startTime      = null;
    recordingState.pauseStartTime = null;
    recordingState.totalPausedMs  = 0;
    chrome.storage.local.set({ recordingState: { isRecording: false } });
    broadcastState({ status: 'uploading' });

    const recId   = `rec_${Date.now()}`;
    const recDate = new Date();
    const syncUserId  = message.userId;
    const emailTo     = recordingState.userEmail;
    const emailTitle  = recordingState.recTitle ||
      `Recording — ${recDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

    function patchRec(patch) {
      chrome.storage.local.get(['recordings'], result => {
        const recs = result.recordings || [];
        const idx  = recs.findIndex(r => r.id === recId);
        if (idx !== -1) Object.assign(recs[idx], patch);
        chrome.storage.local.set({ recordings: recs });
      });
    }

    // Skeleton record appears in History immediately
    chrome.storage.local.get(['recordings'], result => {
      const recs = result.recordings || [];
      recs.unshift({
        id:          recId,
        userId:      message.userId,
        title:       recordingState.recTitle ||
                       `Recording — ${recDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`,
        description: recordingState.recDescription || '',
        date:        recDate.toISOString(),
        duration:    message.duration,
        audio_url:   '',
        wav_url:     '',
        transcript:  [],
        summary:     { key_points: [], decisions: [], action_items: [] },
        status:      'processing',
      });
      chrome.storage.local.set({ recordings: recs }, () => {
        broadcastState({ status: 'transcribing', recId });
      });
    });

    // Read blob from IDB (no size limit, no base64 overhead)
    idbGet(message.idbKey)
      .then(blob => {
        idbDelete(message.idbKey); // clean up IDB entry

        if (!blob) {
          patchRec({ status: 'upload_failed', transcription_error: 'Audio data not found in IDB' });
          broadcastState({ status: 'upload_failed', error: 'Audio data not found' });
          closeOffscreenDocument();
          return;
        }

        // Upload WebM to Azure
        uploadBlobWithRestApi(blob, syncUserId, message.duration, 'webm')
          .then(fullBlobPath => {
            const audioUrl = `https://recorderextension.blob.core.windows.net/meeting-audio/${fullBlobPath}`;
            patchRec({ audio_url: audioUrl });
            broadcastState({ status: 'upload_success' });
            closeOffscreenDocument();
            syncMetadataToAzure(syncUserId);

            if (emailTo) {
              getChromeAuthToken()
                .then(authToken => fetch('https://recora-chrome-extension.onrender.com/send-recording-email', {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                  body: JSON.stringify({ downloadLink: audioUrl, duration: message.duration, blobPath: fullBlobPath, title: emailTitle }),
                }))
                .catch(err => console.warn('Email notification failed:', err.message));
            }
          })
          .catch(err => {
            broadcastState({ status: 'upload_failed', error: err.message });
            closeOffscreenDocument();
            patchRec({ status: 'upload_failed' });
          });

        // Transcription — runs independently of upload
        if (typeof transcribeAudio === 'function') {
          getChromeAuthToken()
            .then(authToken => transcribeAudio(blob, authToken))
            .then(({ transcript, summary }) => {
              patchRec({ transcript, summary, status: 'done' });
              broadcastState({ status: 'transcription_done', recId });
              syncMetadataToAzure(syncUserId);
            })
            .catch(err => {
              patchRec({ status: 'transcription_failed', transcription_error: err.message });
              broadcastState({ status: 'transcription_done', recId });
              syncMetadataToAzure(syncUserId);
            });
        } else {
          patchRec({ status: 'done' });
          syncMetadataToAzure(syncUserId);
        }
      })
      .catch(err => {
        patchRec({ status: 'upload_failed', transcription_error: err.message });
        broadcastState({ status: 'upload_failed', error: err.message });
        closeOffscreenDocument();
      });

    return false;
  }

  if (message.action === 'offscreenRecordingError') {
    recordingState.isRecording = false;
    broadcastState({ status: 'recording_error', error: message.error });
    closeOffscreenDocument();
    return false;
  }
});
