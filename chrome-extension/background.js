import { transcribeAudio } from './transcription.js';

// =============================================================================
// background.js — Service Worker
// Manages offscreen document lifecycle, recording state, and Azure upload.
// Audio APIs (getUserMedia, AudioContext, MediaRecorder) live in offscreen.js.
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

function getChromeAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Not authenticated'));
      } else {
        resolve(token);
      }
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
      // Offscreen was also killed — clear stale state
      chrome.storage.local.set({ recordingState: { isRecording: false } });
      return;
    }

    // Offscreen still alive — restore in-memory state
    const s = stored.recordingState;
    recordingState.isRecording    = true;
    recordingState.userId         = s.userId         || null;
    recordingState.startTime      = s.startTime      || Date.now();
    recordingState.totalPausedMs  = s.totalPausedMs  || 0;
    recordingState.recTitle       = s.recTitle       || '';
    recordingState.recDescription = s.recDescription || '';

    if (s.isPaused && s.pauseStartTime) {
      // Fold in time elapsed since the pause was stored (service worker was dead during this gap)
      recordingState.totalPausedMs += Date.now() - s.pauseStartTime;
      recordingState.isPaused      = true;
      recordingState.pauseStartTime = Date.now();
    } else {
      recordingState.isPaused      = false;
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
  if (recordingState.isPaused && recordingState.pauseStartTime) {
    elapsed -= (Date.now() - recordingState.pauseStartTime);
  }
  return Math.max(0, elapsed);
}

function broadcastState(extra = {}) {
  chrome.runtime.sendMessage(
    {
      action:      'recordingStateUpdate',
      isRecording: recordingState.isRecording,
      isPaused:    recordingState.isPaused,
      elapsedMs:   getElapsedMs(),
      ...extra,
    },
    () => void chrome.runtime.lastError,
  );
}

async function getUploadSasToken(userId, blobName) {
  const authToken = await getChromeAuthToken();
  const response = await fetch('https://recora-chrome-extension.onrender.com/generate-upload-sas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body:    JSON.stringify({ userId, blobName }),
    cache:   'no-store',
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get SAS token: ${response.status} ${response.statusText}: ${errorText}`);
  }
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

  const headers = {
    'x-ms-blob-type': 'BlockBlob',
    'Content-Type':   blob.type || 'audio/webm',
    'x-ms-date':      new Date().toUTCString(),
    'x-ms-version':   '2020-04-08',
    'Content-Length': blob.size.toString(),
    ...metaHeaders,
  };

  const response = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure upload failed: ${response.status} ${response.statusText}: ${errorText}`);
  }
  console.log(`Successfully uploaded: ${fullBlobPath}`);
  return fullBlobPath;
}

async function syncMetadataToAzure(userId) {
  if (!userId) return;
  try {
    const authToken = await getChromeAuthToken();
    const { recordings = [] } = await new Promise(resolve =>
      chrome.storage.local.get(['recordings'], resolve)
    );
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

function base64ToBlob(base64) {
  const parts = base64.split(',');
  const mime  = parts[0].match(/:(.*?);/)[1];
  const bstr  = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Popup → start
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
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Popup → stop
  if (message.action === 'stopRecording') {
    chrome.runtime.sendMessage(
      { target: 'offscreen', action: 'stopRecording' },
      () => void chrome.runtime.lastError,
    );
    sendResponse({ success: true });
    return false;
  }

  // Popup → get state on open
  if (message.action === 'getRecordingState') {
    if (recordingState.isRecording) {
      sendResponse({ isRecording: true, isPaused: recordingState.isPaused, elapsedMs: getElapsedMs() });
      return false;
    }
    // Service worker may have just restarted — check storage before returning idle
    // (the async restore IIFE may not have finished yet when this message arrives)
    chrome.storage.local.get(['recordingState'], (stored) => {
      const s = stored.recordingState;
      if (!s?.isRecording) {
        sendResponse({ isRecording: false, isPaused: false, elapsedMs: 0 });
        return;
      }
      let elapsed = Date.now() - (s.startTime || Date.now()) - (s.totalPausedMs || 0);
      if (s.isPaused && s.pauseStartTime) elapsed -= Date.now() - s.pauseStartTime;
      sendResponse({ isRecording: true, isPaused: s.isPaused || false, elapsedMs: Math.max(0, elapsed) });
    });
    return true; // async response
  }

  // Popup → pause
  if (message.action === 'pauseRecording') {
    chrome.runtime.sendMessage(
      { target: 'offscreen', action: 'pauseRecording' },
      () => void chrome.runtime.lastError,
    );
    sendResponse({ success: true });
    return false;
  }

  // Popup → resume
  if (message.action === 'resumeRecording') {
    chrome.runtime.sendMessage(
      { target: 'offscreen', action: 'resumeRecording' },
      () => void chrome.runtime.lastError,
    );
    sendResponse({ success: true });
    return false;
  }

  // Offscreen → recording is live
  if (message.action === 'offscreenRecordingStarted') {
    recordingState.isRecording   = true;
    recordingState.isPaused      = false;
    recordingState.startTime     = message.startTime;
    recordingState.pauseStartTime = null;
    recordingState.totalPausedMs  = 0;
    chrome.storage.local.set({ recordingState: { isRecording: true, isPaused: false, startTime: message.startTime, totalPausedMs: 0, userId: recordingState.userId, recTitle: recordingState.recTitle, recDescription: recordingState.recDescription } });
    broadcastState({ status: 'recording' });
    return false;
  }

  // Offscreen → recording was paused
  if (message.action === 'offscreenRecordingPaused') {
    recordingState.isPaused      = true;
    recordingState.pauseStartTime = Date.now();
    chrome.storage.local.set({ recordingState: { isRecording: true, isPaused: true, pauseStartTime: recordingState.pauseStartTime, startTime: recordingState.startTime, totalPausedMs: recordingState.totalPausedMs, userId: recordingState.userId } });
    broadcastState({ status: 'paused' });
    return false;
  }

  // Offscreen → recording was resumed
  if (message.action === 'offscreenRecordingResumed') {
    if (recordingState.pauseStartTime) {
      recordingState.totalPausedMs += Date.now() - recordingState.pauseStartTime;
    }
    recordingState.isPaused      = false;
    recordingState.pauseStartTime = null;
    chrome.storage.local.set({ recordingState: { isRecording: true, isPaused: false, startTime: recordingState.startTime, totalPausedMs: recordingState.totalPausedMs, userId: recordingState.userId } });
    broadcastState({ status: 'resumed' });
    return false;
  }

  // Offscreen → blob ready, upload it
  if (message.action === 'offscreenRecordingStopped') {
    recordingState.isRecording    = false;
    recordingState.isPaused       = false;
    recordingState.startTime      = null;
    recordingState.pauseStartTime = null;
    recordingState.totalPausedMs  = 0;
    chrome.storage.local.set({ recordingState: { isRecording: false } });
    broadcastState({ status: 'uploading' });

    const blob    = base64ToBlob(message.blobData);
    const wavBlob = message.wavBlobData ? base64ToBlob(message.wavBlobData) : null;
    const recId   = `rec_${Date.now()}`;
    const recDate = new Date();

    // Patch helper — updates a record in storage by id (no importScripts dependency)
    function patchRec(patch) {
      chrome.storage.local.get(['recordings'], (result) => {
        const recs = result.recordings || [];
        const idx  = recs.findIndex(r => r.id === recId);
        if (idx !== -1) Object.assign(recs[idx], patch);
        chrome.storage.local.set({ recordings: recs });
      });
    }

    // Save skeleton record RIGHT NOW — recording always appears in History
    // regardless of whether the upload or transcription succeeds later.
    chrome.storage.local.get(['recordings'], (result) => {
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

    // Capture email-related state now (recordingState may be mutated by later recordings)
    const emailTo    = recordingState.userEmail;
    const emailTitle = recordingState.recTitle ||
      `Recording — ${recDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Upload WebM to Azure
    uploadBlobWithRestApi(blob, message.userId, message.duration, 'webm')
      .then((fullBlobPath) => {
        broadcastState({ status: 'upload_success' });
        closeOffscreenDocument();
        const audioUrl = `https://recorderextension.blob.core.windows.net/meeting-audio/${fullBlobPath}`;
        patchRec({ audio_url: audioUrl });
        // Re-sync so Azure recordings.json always has the audio_url — transcription
        // may have already synced before this upload finished (race condition fix).
        syncMetadataToAzure(syncUserId);

        // Hook: send email when recording stops — fire-and-forget
        if (emailTo) {
          getChromeAuthToken()
            .then(authToken => fetch('https://recora-chrome-extension.onrender.com/send-recording-email', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({
                downloadLink: audioUrl,
                duration:     message.duration,
                blobPath:     fullBlobPath,
                title:        emailTitle,
              }),
            }))
            .catch((err) => console.warn('Email notification failed:', err.message));
        }
      })
      .catch((err) => {
        broadcastState({ status: 'upload_failed', error: err.message });
        closeOffscreenDocument();
        patchRec({ status: 'upload_failed' });
      });

    // Upload WAV to Azure independently (best-effort)
    if (wavBlob) {
      uploadBlobWithRestApi(wavBlob, message.userId, message.duration, 'wav')
        .then((wavPath) => {
          patchRec({ wav_url: `https://recorderextension.blob.core.windows.net/meeting-audio/${wavPath}` });
          // Re-sync so wav_url is persisted in Azure too
          syncMetadataToAzure(syncUserId);
        })
        .catch((err) => {
          console.warn('WAV upload failed:', err.message);
        });
    }

    // Transcription — runs independently of upload
    const syncUserId = message.userId;
    if (typeof transcribeAudio === 'function') {
      getChromeAuthToken()
        .then(authToken => transcribeAudio(blob, authToken))
        .then(({ transcript, summary }) => {
          patchRec({ transcript, summary, status: 'done' });
          broadcastState({ status: 'transcription_done', recId });
          syncMetadataToAzure(syncUserId);
        })
        .catch((err) => {
          patchRec({ status: 'transcription_failed', transcription_error: err.message });
          broadcastState({ status: 'transcription_done', recId });
          syncMetadataToAzure(syncUserId);
        });
    } else {
      patchRec({ status: 'done' });
      syncMetadataToAzure(syncUserId);
    }

    return false;
  }

  // Offscreen → setup error
  if (message.action === 'offscreenRecordingError') {
    recordingState.isRecording = false;
    broadcastState({ status: 'recording_error', error: message.error });
    closeOffscreenDocument();
    return false;
  }
});
// // Function to get dynamic SAS token from your backend
// async function getUploadSasToken(userId, blobName) {
//     try {
//         // IMPORTANT: Replace 'https://recora-chrome-extension.onrender.com' with your actual backend URL if different
//         const response = await fetch('https://recora-chrome-extension.onrender.com/generate-upload-sas', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ userId, blobName }),
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             throw new Error(`Failed to get upload SAS from backend: ${response.status} ${response.statusText}: ${errorText}`);
//         }
//         const { sasToken } = await response.json();
//         return sasToken;
//     } catch (error) {
//         console.error("Error fetching upload SAS token from backend:", error);
//         throw error; // Re-throw to be caught by the calling function
//     }
// }

// // Upload blob to Azure using REST API
// async function uploadBlobWithRestApi(blob, user_id, metadata) {
//     console.log("uploadBlobWithRestApi called.....");

//     try {
//         const uniqueBlobName = `recording_${Date.now()}.webm`; // Only the filename part (e.g., "recording_12345.webm")
//         const fullBlobPath = `${user_id}/${uniqueBlobName}`; // The full path in Azure (e.g., "user123/recording_12345.webm")

//         // Get a fresh, dynamic SAS token for this specific upload operation
//         const sasToken = await getUploadSasToken(user_id, uniqueBlobName);

//         // Construct the full upload URL with the dynamic SAS token
//         const uploadUrl = `https://recorderextension.blob.core.windows.net/meeting-audio/${encodeURIComponent(fullBlobPath)}?${sasToken}`;

//         // Prepare metadata headers
//         const metaHeaders = Object.fromEntries(
//             Object.entries({
//                 userid: user_id,
//                 audiominutes: metadata.audioMinutes.toString(),
//                 audioseconds: metadata.audioSeconds.toString(),
//             }).map(([k, v]) => [`x-ms-meta-${k}`, v])
//         );

//         // Required headers for blob PUT operation
//         const headers = {
//             "x-ms-blob-type": "BlockBlob",
//             "Content-Type": blob.type || "audio/webm", // Use the actual blob type, or fallback
//             "x-ms-date": new Date().toUTCString(), // Current UTC date for Azure
//             "x-ms-version": "2020-04-08", // Azure Storage REST API version
//             "Content-Length": blob.size.toString(), // CRITICAL: Blob size must be provided
//             ...metaHeaders, // Spread the custom metadata headers
//         };

//         const response = await fetch(uploadUrl, {
//             method: "PUT",
//             headers: headers,
//             body: blob,
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             throw new Error(`Azure Blob upload failed: ${response.status} ${response.statusText}: ${errorText}`);
//         }

//         console.log(`Successfully uploaded: ${fullBlobPath} for user ${user_id}`);
//     } catch (error) {
//         console.error("Azure REST API upload error:", error);
//         // Rethrow or handle as needed, to propagate to the caller (chrome.runtime.onMessage.addListener)
//         throw error;
//     }
// }


// // Listener to upload blob sent from popup
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === "uploadAudioBlob") {
//     const { user_id, blobData, duration } = message;

//     console.log(`Uploading for user ${user_id} audio duration: ${duration.audioMinutes}m ${duration.audioSeconds}s`);

//     // Helper function to convert base64 string back to Blob object
//     function base64ToBlob(base64) {
//       const parts = base64.split(',');
//       const mime = parts[0].match(/:(.*?);/)[1]; // Extract MIME type (e.g., "audio/webm")
//       const bstr = atob(parts[1]); // Decode base64 string
//       let n = bstr.length;
//       const u8arr = new Uint8Array(n); // Create Uint8Array for raw binary data

//       while (n--) {
//         u8arr[n] = bstr.charCodeAt(n); // Populate Uint8Array with character codes
//       }

//       return new Blob([u8arr], { type: mime }); // Create Blob from Uint8Array and MIME type
//     }

//     const audioBlob = base64ToBlob(blobData);
//     console.log("Converted audio Blob:", audioBlob);

//     // Call the upload function and handle its promise
//     uploadBlobWithRestApi(audioBlob, user_id, { audioMinutes: duration.audioMinutes, audioSeconds: duration.audioSeconds })
//       .then(() => sendResponse({ success: true })) // Respond to the sender (popup) with success
//       .catch((err) => sendResponse({ success: false, error: err.message })); // Respond with error

//     return true; // Important: Indicates that the response will be sent asynchronously
//   }
// });


